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
var Q = require("q");
var processes = null;
var allClosedDefer = null; // Q defer resolving when all processes are closed

var closeAllProcesses = function () {
    if (processes && processes.length > 0) {
        for (var i = processes.length - 1; i >= 0; i--) {
            processes[i].kill();
        }
    }
};

var onChildProcessExit = function (code, signal) {
    var i = processes.indexOf(this);
    if (i > -1) {
        processes.splice(i, 1);
    }
    if (processes.length === 0) {
        allClosedDefer.resolve();
        allClosedDefer = null;
        processes = null;
        process.removeListener('exit', closeAllProcesses);
    }
};

var initProcessesArray = function () {
    if (!processes) {
        processes = [];
        allClosedDefer = Q.defer();
        process.on('exit', closeAllProcesses);
    }
};

var registerChildProcess = function (process) {
    process.on('exit', onChildProcessExit.bind(process));
    initProcessesArray();
    processes.push(process);
};

module.exports = {
    spawn: function (command, args, options) {
        var process = child_process.spawn(command, args, options);
        registerChildProcess(process);
        return process;
    },
    register: registerChildProcess,
    closeAll: closeAllProcesses,
    number: function () {
        return processes ? processes.length : 0;
    },
    wait: function (timeout) {
        var defer = Q.defer();
        if (allClosedDefer) {
            // the first call to defer.resolve wins:
            allClosedDefer.promise.then(defer.resolve); // either all processes are closed
            setTimeout(defer.resolve, timeout); // or the timeout happens
        } else {
            defer.resolve();
        }
        return defer.promise;
    }
};
