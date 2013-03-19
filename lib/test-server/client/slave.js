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
    var config = window.attesterConfig || {}; // a config object can be set by the PhantomJS script
    window.attesterConfig = null;
    var attester = {};
    window.attester = attester;

    var location = window.location;
    var document = window.document;
    var statusBar = document.getElementById('status_text');
    var pauseResume = document.getElementById('pause_resume');
    var paused = false;
    var iframe = document.getElementById('iframe');
    var emptyUrl = location.href.replace(/\/slave\.html/, '/empty.html');
    var baseUrl = location.protocol + "//" + location.host;
    var socketStatus = "loading";
    var testStatus = "waiting";
    var currentTask = null;

    var updateStatus = function () {
        statusBar.innerHTML = "Attester - " + socketStatus + " - " + testStatus;
        pauseResume.innerHTML = paused ? "Resume" : "Pause";
    };

    var socketStatusUpdater = function (status) {
        return function (param) {
            socketStatus = param ? status.replace('$', param) : status;
            updateStatus();
        };
    };

    var stop = function () {
        currentTask = null;
        iframe.src = emptyUrl;
        testStatus = paused ? "paused" : "waiting";
        updateStatus();
    };

    var socket = io.connect(location.protocol + '//' + location.host, {
        'reconnection delay': 500,
        'reconnection limit': 2000,
        'max reconnection attempts': Infinity
    });

    socket.on('connect', function () {
        attester.connected = true;
        stop();
        socket.emit('hello', {
            type: 'slave',
            paused: paused,
            userAgent: window.navigator.userAgent,
            documentMode: document.documentMode
        });
    });

    socket.on('connect', socketStatusUpdater('connected'));
    socket.on('disconnect', socketStatusUpdater('disconnected'));
    socket.on('disconnect', function () {
        attester.connected = false;
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
        currentTask = data;
        iframe.src = "empty.html";
        testStatus = "executing " + data.name;
        updateStatus();
        iframe.src = baseUrl + data.url;
    });
    socket.on('slave-stop', stop);
    socket.on('disconnect', stop);

    pauseResume.onclick = function () {
        paused = !paused;
        updateStatus();
        socket.emit('pause-changed', paused);
        return false;
    };

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

    attester.testStart = function (info) {
        sendTestUpdate('testStarted', info);
    };
    attester.testEnd = function (info) {
        sendTestUpdate('testFinished', info);
    };
    attester.testError = function (info) {
        sendTestUpdate('error', info);
    };
    attester.taskFinished = function () {
        socket.emit('task-finished');
    };
    attester.stackTrace = function (exception) {
        // this function is re-defined in stacktrace.js
        return [];
    };

    // To send coverage, using a POST request rather than using socket.io is better for performance reasons
    var send = function (url, data) {
        var xhr = (window.ActiveXObject) ? new ActiveXObject("Microsoft.XMLHTTP") : new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(data);
    };

    attester.coverage = function (window) {
        var $$_l = window.$$_l;
        if ($$_l) {
            sendTestUpdate('coverage'); // notify the server through socket.io that we are sending coverage (so that it
            // will wait for it)
            send('/__attester__/coverage/data/' + currentTask.campaignId + '/' + currentTask.taskId, io.JSON.stringify({
                name: "",
                lines: $$_l.lines,
                runLines: $$_l.runLines,
                code: $$_l.code,
                allConditions: $$_l.allConditions,
                conditions: $$_l.conditions,
                allFunctions: $$_l.allFunctions,
                runFunctions: $$_l.runFunctions
            }));
        }
    };
})();