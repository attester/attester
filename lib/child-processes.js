/*
 * Copyright 2012 Amadeus s.a.s.
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

var child_process = require('child_process');

var processes = null;

var onMainProcessExit = function () {
    if (processes && processes.length > 0) {
        for (var i = processes.length - 1; i >= 0; i--) {
            processes[i].kill();
        }
    }
};

var onChildProcessExit = function (process, code, signal) {
    var i = processes.indexOf(process);
    if (i > -1) {
        processes.splice(i, 1);
    }
};

var initProcessesArray = function () {
    if (!processes) {
        processes = [];
        process.on('exit', onMainProcessExit);
    }
};

module.exports = {
    spawn : function (command, args, options) {
        var process = child_process.spawn(command, args, options);
        initProcessesArray();
        processes.push(process);
        process.on('exit', onChildProcessExit.bind(process));
        return process;
    }
};