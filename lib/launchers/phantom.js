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

var optimizeParallel = require("../optimize-parallel.js");
var childProcesses = require("../child-processes.js");

/**
 * Launcher for PhantomJS, this module listen to attester event to create phantom
 * instances and connect them as slaves
 */

var attester = require("../attester");
var config = attester.config;
var logger = attester.logger;

attester.event.once("launcher.connect", function (slaveURL) {
    var suggestedInstances = config["phantomjs-instances"];
    var phantomJSinstances = optimizeParallel({
        memoryPerInstance: 60,
        maxInstances: suggestedInstances
    }, logger);
    if (phantomJSinstances > 0) {
        var path = config["phantomjs-path"];
        var args = [pathUtil.join(__dirname, '../browsers/phantomjs.js'), "--auto-exit", slaveURL];
        var spawn = childProcesses.spawn;
        // BACKWARD-COMPAT node 0.8 start
        var checkPhantomjsSpawnExitCode = function (code) {
            if (code === 127) {
                logger.logError("Spawn: exited with code 127. PhantomJS executable not found. Make sure to download PhantomJS and add its folder to your system's PATH, or pass the full path directly to Attester via --phantomjs-path.\nUsed command: '" + path + "'");
            } else if (code === 126) {
                logger.logError("Spawn: exited with code 126. Unable to execute PhantomJS. Make sure to have proper read & execute permissions set.\nUsed command: '" + path + "'");
            } else if (code !== 0) {
                logger.logError("Spawn: PhantomJS exited with code " + code);
            }
        };
        // BACKWARD-COMPAT node 0.8 end
        var onPhantomJsSpawnError = function (err) {
            if (err.code === "ENOENT") {
                logger.logError("Spawn: exited with code ENOENT. PhantomJS executable not found. Make sure to download PhantomJS and add its folder to your system's PATH, or pass the full path directly to Attester via --phantomjs-path.\nUsed command: '" + path + "'");
            } else {
                logger.logError("Unable to spawn PhantomJS; error code " + err.code);
            }
        };
        for (var i = 0; i < phantomJSinstances; i++) {
            var curProcess = spawn(path, args, {
                stdio: "pipe"
            });
            curProcess.stdout.pipe(process.stdout);
            curProcess.stderr.pipe(process.stderr);
            // BACKWARD-COMPAT node 0.8 start
            curProcess.on("exit", checkPhantomjsSpawnExitCode); // node 0.8
            // BACKWARD-COMPAT node 0.8 end
            curProcess.on("error", onPhantomJsSpawnError); // node 0.10
        }
    }
});