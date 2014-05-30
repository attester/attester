/*
 * Copyright 2013 Amadeus s.a.s.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var pathUtil = require("path");

var exitProcess = require("exit");

var optimizeParallel = require("../optimize-parallel.js");
var spawn = require("../child-processes.js").spawn;

/**
 * Launcher for PhantomJS, this module listen to attester event to create phantom instances and connect them as slaves
 */

var attester = require("../attester");
var config = attester.config;
var logger = attester.logger;

// Most of the entries in cfg will be set later in "launcher.connect" listener
var cfg = {
    maxRetries: 3,
    // how many times to retry rebooting phantom in case of recoverable errors
    onAllPhantomsDied: function () {
        endProcess(1);
    },
    phantomPath: null,
    slaveURL: null,
    pipeStdOut: true,
    phantomInstances: 0
};
var state = {
    retries: [],
    // stores how many times each instance was rebooted
    erroredPhantomInstances: 0
    // stores how many phantoms died unrecoverably
};

// Exposing all those methods for the sake of testability.
// They don't rely on global `cfg` and `state` but on parameters for for the same reason.
module.exports = {
    /**
     * Starts PhantomJS child process with instance number `n` using `cfg.path` as PhantomJS path and connects it to
     * `cfg.slaveURL`
     * @param {Object} cfg
     * @param {Object} state
     * @param {Integer} n
     */
    bootPhantom: function (cfg, state, n) {
        cfg.args = cfg.args || {};
        var phantomPath = cfg.phantomPath;
        var controlScript = pathUtil.join(__dirname, '../browsers/phantomjs.js');

        var args = [];
        args.push(controlScript);
        args.push("--auto-exit");
        if (cfg.args.autoExitPolling) {
            args.push("--auto-exit-polling=" + cfg.args.autoExitPolling);
        }
        if (typeof n == "undefined") {
            n = Math.round(Math.random() * 1000) % 1000;
        }
        args.push("--instance-id=" + n);
        args.push(cfg.slaveURL);

        var phantomProcess = spawn(phantomPath, args, {
            stdio: "pipe"
        });
        if (cfg.pipeStdOut) {
            phantomProcess.stdout.pipe(process.stdout);
            phantomProcess.stderr.pipe(process.stderr);
        }
        if (cfg.onData) {
            phantomProcess.stdout.on("data", cfg.onData);
        }
        phantomProcess.on("exit", cfg.onExit || this.createPhantomExitCb(cfg, state, n).bind(this));
        phantomProcess.on("error", cfg.onError || this.createPhantomErrorCb(cfg, state, n).bind(this));
        return phantomProcess;
    },

    /**
     * Factory of callback functions to be used as 'exit' listener by PhantomJS processes.
     * @param {Object} cfg
     * @param {Object} state
     * @param {Integer} n
     * @return {Function}
     */
    createPhantomExitCb: function (cfg, state, n) {
        // Node 0.8 and 0.10 differently handle spawning errors ('exit' vs 'error'), but errors that happened after
        // launching the command are both handled in 'exit' callback
        return function (code, signal) {
            // See http://tldp.org/LDP/abs/html/exitcodes.html and http://stackoverflow.com/a/1535733/
            if (code === 0 || signal == "SIGTERM") {
                return;
            }

            var isNotRecoverable = (code == 127 || code == 126);
            if (isNotRecoverable) {
                ++state.erroredPhantomInstances;
                var path = cfg.phantomPath;
                if (code == 127) {
                    logger.logError("Spawn: exited with code 127. PhantomJS executable not found. Make sure to download PhantomJS and add its folder to your system's PATH, or pass the full path directly to Attester via --phantomjs-path.\nUsed command: '" + path + "'");
                } else if (code == 126) {
                    logger.logError("Spawn: exited with code 126. Unable to execute PhantomJS. Make sure to have proper read & execute permissions set.\nUsed command: '" + path + "'");
                }
                checkIfAllPhantomsDied(cfg, state);
                return;
            }

            // Now, try to recover unless retried too many times

            // prepare error message
            var errMsg;
            if (code == 75) {
                errMsg = "Spawn: PhantomJS[" + n + "] exited with code 75: unable to load attester page within specified timeout, or errors happened while loading.";
                if (cfg.phantomInstances > 1) {
                    errMsg += " You may try decreasing the number of PhantomJS instances in attester config to avoid that problem.";
                }
            } else {
                errMsg = "Spawn: PhantomJS[" + n + "] exited with code " + code + " and signal " + signal;
            }

            // check how many retries happened for this instance
            var retries = state.retries;
            retries[n] = (retries[n] || 0) + 1;
            if (retries[n] < cfg.maxRetries) {
                // log just a warning and try rebooting
                logger.logWarn(errMsg);
                logger.logWarn("Trying to reboot instance nr " + n + "...");
                this.bootPhantom(cfg, state, n);
            } else {
                logger.logError(errMsg);
                ++state.erroredPhantomInstances;
                checkIfAllPhantomsDied(cfg, state);
            }
        };
    },

    /**
     * Factory of callback functions to be used as 'error' listener by PhantomJS processes.
     * @param {Object} cfg
     * @param {Object} state
     * @param {Integer} n
     * @return {Function}
     */
    createPhantomErrorCb: function (cfg, state, n) {
        return function (err) {
            if (err.code == "ENOENT") {
                logger.logError("Spawn: exited with code ENOENT. PhantomJS executable not found. Make sure to download PhantomJS and add its folder to your system's PATH, or pass the full path directly to Attester via --phantomjs-path.\nUsed command: '" + cfg.phantomPath + "'");
            } else {
                logger.logError("Unable to spawn PhantomJS; error code " + err.code);
            }
        };
    }
};

attester.event.once("launcher.connect", function (slaveURL) {
    var suggestedInstances = config["phantomjs-instances"]; // config is not available earlier
    var phantomInstances = optimizeParallel({
        memoryPerInstance: 60,
        maxInstances: suggestedInstances
    }, logger);
    if (phantomInstances === 0) {
        return;
    }

    // Set cfg so that functions depending on these globals work fine
    cfg.phantomInstances = phantomInstances;
    cfg.phantomPath = config["phantomjs-path"];
    cfg.slaveURL = slaveURL;

    logger.logDebug("Spawning " + phantomInstances + " instances of PhantomJS");
    if (phantomInstances == 1) {
        // If there's only one phantom, let's assign it a random "id"
        // This is for analyzing logs of attester suite itself
        // For normal users requesting N phantoms, assign them ids 1 through N
        module.exports.bootPhantom(cfg, state);
    } else {
        for (var n = 1; n <= phantomInstances; n++) {
            module.exports.bootPhantom(cfg, state, n);
        }
    }
});

function checkIfAllPhantomsDied(cfg, state) {
    // If all phantoms died and were unable to recover, something is really wrong
    if (state.erroredPhantomInstances === cfg.phantomInstances && cfg.phantomInstances > 0) {
        logger.logError("All the instances of PhantomJS were terminated with errors; disposing attester and exiting");
        if (cfg.onAllPhantomsDied) {
            cfg.onAllPhantomsDied();
        }
    }
}

function endProcess(code) {
    attester.event.emit("closing");
    process.nextTick(function () {
        exitProcess(code);
    });
}