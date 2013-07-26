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
    var statusInfo = document.getElementById('status_info');
    var pauseResume = document.getElementById('pause_resume');
    var logs = document.getElementById('status_logs');
    var paused = false;
    var iframeParent = document.getElementById('content');
    var iframe;
    var baseUrl = location.protocol + "//" + location.host;
    var socketStatus = "loading";
    var testStatus = "waiting";
    var testInfo = "loading";
    var currentTask = null;
    var pendingTestStarts = null;
    var beginning = new Date();

    var log = window.location.search.indexOf("log=true") !== -1 ?
    function (message) {
        var time = (new Date() - beginning) + "ms";
        // Log to the browser console
        if (window.console && window.console.log) {
            console.log(time, message);
        }
        // Log to the div console (useful for remote slaves or when console is missing)
        logs.innerHTML = "<p><span class='timestamp'>" + time + "</span>" + message + "</p>" + logs.innerHTML;
        logs.firstChild.scrollIntoView(false);
    } : function () {};

    var updateStatus = function () {
        statusBar.innerHTML = socketStatus + " - " + testStatus;
        pauseResume.innerHTML = paused ? "Resume" : "Pause";
        statusInfo.innerHTML = "<span id='_info_" + testInfo + "'></span>";
    };

    var socketStatusUpdater = function (status, info) {
        return function (param) {
            socketStatus = param ? status.replace('$', param) : status;
            testInfo = info || status;
            updateStatus();
        };
    };

    var removeIframe = function () {
        if (iframe) {
            attester.currentTask = null;
            iframeParent.removeChild(iframe);
            iframe = null;
        }
    };

    var createIframe = function (src) {
        removeIframe();
        attester.currentTask = {};
        iframe = document.createElement("iframe");
        iframe.setAttribute("id", "iframe");
        iframe.setAttribute("src", src);
        iframe.setAttribute("frameborder", "0");
        iframeParent.appendChild(iframe);
    };

    var stop = function () {
        currentTask = null;
        pendingTestStarts = null;
        removeIframe();
        testStatus = paused ? "paused" : "waiting";
        testInfo = "idle";
        updateStatus();
    };

    log("creating a socket");
    var socket = io.connect(location.protocol + '//' + location.host, {
        'reconnection delay': 500,
        'reconnection limit': 2000,
        'max reconnection attempts': Infinity
    });

    socket.on('connect', function () {
        log("slave connected");
        attester.connected = true;
        stop();
        socket.emit('hello', {
            type: 'slave',
            paused: paused,
            userAgent: window.navigator.userAgent,
            documentMode: document.documentMode
        });
        socketStatusUpdater('connected');
    });

    socket.on('disconnect', function () {
        log("slave disconnected");
        attester.connected = false;
        socketStatusUpdater('disconnected');
    });
    if (config.onDisconnect) {
        socket.on('disconnect', config.onDisconnect);
    }
    socket.on('reconnecting', socketStatusUpdater('reconnecting in $ ms...', 'disconnected'));
    socket.on('reconnect', socketStatusUpdater('re-connected', 'connected'));
    socket.on('reconnect_failed', socketStatusUpdater('failed to reconnect', 'disconnected'));
    socket.on('server_disconnect', function () {
        log("server disconnected");
        testInfo = "disconnected";
        socket.socket.disconnect();
        socket.socket.reconnect();
    });
    socket.on('slave-execute', function (data) {
        currentTask = data;
        pendingTestStarts = {};
        removeIframe();
        testStatus = "executing " + data.name + " remaining " + data.stats.remainingTasks + " tasks in this campaign";
        if (data.stats.browserRemainingTasks != data.stats.remainingTasks) {
            testStatus += ", including " + data.stats.browserRemainingTasks + " tasks for this browser";
        }
        testInfo = "executing";
        updateStatus();
        log("<i>slave-execute</i> task <i>" + data.name + "</i>, " + data.stats.remainingTasks + " tasks left");
        createIframe(baseUrl + data.url);
    });
    socket.on('slave-stop', stop);
    socket.on('disconnect', stop);

    pauseResume.onclick = function () {
        log("toggle pause status");
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
        log("sending test update <i class='event'>" + name + "</i> for test <i>" + info.name + "</i>");
        if (name === "testStarted") {
            if (pendingTestStarts.hasOwnProperty(info.testId)) {
                log("<i>warning</i> this <i>testStarted</i> is (wrongly) reusing a previous testId: <i>" + info.testId + "</i>");
            }
            pendingTestStarts[info.testId] = info;
        } else if (name === "testFinished") {
            var previousTestStart = pendingTestStarts[info.testId];
            if (!previousTestStart) {
                log("<i>warning</i> this <i>testFinished</i> is ignored as it has no previous <i>testStarted</i>");
                return;
            }
            pendingTestStarts[info.testId] = false;
            info.duration = info.time - previousTestStart.time;
        }
        if (name === "error") {
            log("<i class='error'>error</i> message: <i>" + info.error.message + "</i>");
        }
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

    // Used to store methods and properties specific to the running task
    attester.currentTask = {};
})();