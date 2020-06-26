/*
 * Copyright 2015 Amadeus s.a.s.
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

var exitProcess = require("exit");
var registerChildProcess = require("../util/child-processes").register;
var attesterLauncher = require("attester-launcher");
var attester = require("../attester");
var logger = attester.logger;
var launcherProcesss = null;

/**
 * Start attester-launcher.
 */

function onLauncherConnect(slaveURL, info) {
    var launcherConfig = attester.config["launcher-config"];
    if (launcherConfig) {
        if (!Array.isArray(launcherConfig)) {
            launcherConfig = [launcherConfig];
        }
        if (attester.config["log-level"] >= 4) {
            launcherConfig.unshift("--verbose");
        }
        launcherConfig.unshift(attester.config["colors"] ? "--colors" : "--no-colors");
        launcherConfig.unshift("--server", info.homeURL);
        launcherProcesss = attesterLauncher.exec(launcherConfig);
        registerChildProcess(launcherProcesss);
        launcherProcesss.stdout.pipe(process.stdout);
        launcherProcesss.stderr.pipe(process.stderr);
        launcherProcesss.on("exit", onLauncherExit);
    }
}

function onLauncherExit() {
    launcherProcesss = null;
    if (attester.server.getRemainingTasks() > 0 && attester.config['shutdown-on-campaign-end']) {
        logger.logError("attester-launcher exited. disposing attester and exiting");
        attester.dispose().then(function () {
            exitProcess(1);
        });
    }
}

module.exports = {
    __init__: function () {
        attester.event.on("launcher.connect", onLauncherConnect);
    },
    __reset__: function () {
        if (launcherProcesss) {
            launcherProcesss.removeListener("exit", onLauncherExit);
            if (launcherProcesss.connected) {
                launcherProcesss.send("stop", function (error) {
                    // avoid error if the stop command does not arrive
                    // attester-launcher can already be in the process of stopping when sending the stop message
                    // in that case, sending the message can raise an exception that we can safely ignore
                });
            }
            launcherProcesss = null;
        }
        attester.event.off("launcher.connect", onLauncherConnect);
    }
};
