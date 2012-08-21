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

(function () {
    var window = this;
    var config = window.atjstestrunnerConfig || {}; // a config object can be set by the PhantomJS script
    window.atjstestrunnerConfig = null;
    var atjstestrunner = {};
    window.atjstestrunner = atjstestrunner;

    var location = window.location;
    var document = window.document;
    var statusBar = document.getElementById('status_bar');
    var iframe = document.getElementById('iframe');
    var emptyUrl = location.href.replace(/\/slave\.html/, '/empty.html');
    var baseUrl = location.protocol + "//" + location.host;
    var socketStatus = "loading";
    var testStatus = "waiting";

    var updateStatus = function () {
        statusBar.innerHTML = "Aria Templates Javascript test runner - " + socketStatus + " - " + testStatus;
    };

    var socketStatusUpdater = function (status) {
        return function (param) {
            socketStatus = param ? status.replace('$', param) : status;
            updateStatus();
        };
    };

    var stop = function () {
        iframe.src = emptyUrl;
        testStatus = "waiting";
        updateStatus();
    };

    var socket = io.connect(location.protocol + '//' + location.host, {
        'reconnection delay' : 500,
        'reconnection limit' : 2000,
        'max reconnection attempts' : Infinity
    });

    socket.on('connect', function () {
        atjstestrunner.connected = true;
        stop();
        socket.emit('hello', {
            type : 'slave',
            userAgent : window.navigator.userAgent
        });
    });

    socket.on('connect', socketStatusUpdater('connected'));
    socket.on('disconnect', socketStatusUpdater('disconnected'));
    socket.on('disconnect', function () {
        atjstestrunner.connected = false;
    });
    if (config.onDisconnect) {
        socket.on('disconnect', config.onDisconnect);
    }
    socket.on('reconnecting', socketStatusUpdater('reconnecting in $ ms...'));
    socket.on('reconnect', socketStatusUpdater('re-connected'));
    socket.on('reconnect_failed', socketStatusUpdater('failed to reconnect'));
    socket.on('server_disconnect', function () {
        socket.socket.disconnect();
        socket.socket.reconnect();
    });
    socket.on('slave-execute', function (data) {
        iframe.src = "empty.html";
        testStatus = "executing " + data.name;
        updateStatus();
        iframe.src = baseUrl + data.url;
    });
    socket.on('slave-stop', stop);
    socket.on('disconnect', stop);

    var sendTestUpdate = function (name, info) {
        if (!info) {
            info = {};
        }
        if (!info.time) {
            info.time = new Date().getTime();
        }
        info.event = name;
        socket.emit('test-update', info);
    };

    atjstestrunner.testStart = function (info) {
        sendTestUpdate('testStarted', info);
    };
    atjstestrunner.testEnd = function (info) {
        sendTestUpdate('testFinished', info);
    };
    atjstestrunner.testError = function (info) {
        sendTestUpdate('error', info);
    };
    atjstestrunner.taskFinished = function (info) {
        socket.emit('task-finished', info);
    };
    atjstestrunner.stackTrace = function (exception) {
        // this function is re-defined in stacktrace.js
        return [];
    };
    atjstestrunner.coverage = function (window) {
        var $$_l = window.$$_l;
        if ($$_l) {
            socket.emit('coverage', {
                name : "",
                lines : $$_l.lines,
                runLines : $$_l.runLines,
                code : $$_l.code,
                allConditions : $$_l.allConditions,
                conditions : $$_l.conditions,
                allFunctions : $$_l.allFunctions,
                runFunctions : $$_l.runFunctions
            });
        }
    };
    atjstestrunner.globalErrors = (config.globalErrors == true);
    // If true, global errors are already handled (so the test runner does not have to call testError for them)

})();
