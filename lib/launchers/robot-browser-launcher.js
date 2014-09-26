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

var seleniumJavaRobot = require("selenium-java-robot").exec;
var registerChildProcess = require("../util/child-processes").register;
var attester = require("../attester");
var robotProcess = null;

/**
 * Launcher for the robot browser specified on the command line.
 */

function onLauncherConnect(slaveURL) {
    var robotBrowser = attester.config["robot-browser"];
    if (robotBrowser) {
        var args = ["--url", slaveURL, "--browser", robotBrowser, "--auto-restart"];
        robotProcess = seleniumJavaRobot(args, {
            stdio: "pipe"
        });
        registerChildProcess(robotProcess);
        robotProcess.stdout.pipe(process.stdout);
        robotProcess.stderr.pipe(process.stderr);
    }
}

module.exports = {
    __init__: function () {
        attester.event.on("launcher.connect", onLauncherConnect);
    },
    __reset__: function () {
        if (robotProcess) {
            // this notifies the robot process that it should close the browser:
            robotProcess.stdin.end();
            robotProcess = null;
        }
        attester.event.off("launcher.connect", onLauncherConnect);
    }
};