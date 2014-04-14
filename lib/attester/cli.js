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

var attester = require("../attester");
var exitProcess = require("exit");

/**
 * The command line module simply handles the process life-cycle when attester
 * is called from the command line.
 * When a single campaign (or set of campaigns) is started, the process should
 * terminate when the campaign(s) end.
 */
exports.__init__ = function () {
    attester.event.once("attester.core.idle", finish);
    attester.event.once("attester.core.fail", fail);
};

function finish() {
    checkConfigAndEndProcess(0);
}

function fail() {
    checkConfigAndEndProcess(1);
}

function checkConfigAndEndProcess(code) {
    if (attester.config["shutdown-on-campaign-end"]) {
        endProcess(code);
    } else {
        attester.logger.logInfo("Idle; press CTRL-C to end the process.");
    }
}


function endProcess(code) {
    attester.event.emit("closing");
    process.nextTick(function () {
        exitProcess(code);
    });
}

exports.__reset__ = function () {
    attester.event.off("attester.core.idle", finish);
    attester.event.off("attester.core.fail", fail);
};