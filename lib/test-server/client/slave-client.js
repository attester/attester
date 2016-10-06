/* global io */
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
    var AttesterAPI = function (taskExecutionId) {
        this.__taskExecutionId = taskExecutionId || -1;
        this.currentTask = {};
    };
    var attesterPrototype = AttesterAPI.prototype = {};

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
    var slaveId = (function () {
        var match = /(?:\?|\&)id=([^&]+)/.exec(location.search);
        if (match) {
            return match[1];
        }
        return null;
    })();
    var flags = (function () {
        var match = /(?:\?|\&)flags=([^&]+)/.exec(location.search);
        if (match) {
            return decodeURIComponent(match[1]);
        }
        return null;
    })();
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

    var reportLogToServer = function (level, args, taskExecutionId) {
        var time = new Date().getTime();
        var msg = [];
        for (var i = 0, l = args.length; i < l; i++) {
            msg.push(String(args[i]));
        }
        socket.emit("log", {
            time: time,
            level: level,
            message: msg.join(" ")
        }, taskExecutionId);
    };

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
            window.attester = null;
            iframeParent.removeChild(iframe);
            iframe = null;
        }
    };

    var createIframe = function (src, taskExecutionId) {
        removeIframe();
        window.attester = new AttesterAPI(taskExecutionId);
        iframe = document.createElement("iframe");
        iframe.setAttribute("id", "iframe");
        iframe.setAttribute("src", src);
        // IE 7 needs frameBorder with B in upper case
        iframe.setAttribute("frameBorder", "0");
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
    var socket = io(location.protocol + '//' + location.host, {
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000
    });

    socket.on('connect', function () {
        log("slave connected");
        attesterPrototype.connected = true;
        stop();
        socket.emit('hello', {
            type: 'slave',
            id: slaveId,
            paused: paused,
            userAgent: window.navigator.userAgent,
            documentMode: document.documentMode,
            flags: flags
        });
    });
    socket.on('connect', socketStatusUpdater('connected'));

    socket.on('disconnect', function () {
        log("slave disconnected");
        attesterPrototype.connected = false;
    });
    socket.on('disconnect', socketStatusUpdater('disconnected'));
    if (config.onDisconnect) {
        socket.on('disconnect', config.onDisconnect);
    }
    socket.on('reconnecting', socketStatusUpdater('reconnecting in $ ms...', 'disconnected'));
    socket.on('reconnect', socketStatusUpdater('re-connected', 'connected'));
    socket.on('reconnect_failed', socketStatusUpdater('failed to reconnect', 'disconnected'));
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
        createIframe(baseUrl + data.url, data.taskExecutionId);
    });
    socket.on('slave-stop', stop);
    socket.on('disconnect', stop);
    if (config.onDispose) {
        socket.on('dispose', function () {
            config.onDispose();
        });
    }

    pauseResume.onclick = function () {
        log("toggle pause status");
        paused = !paused;
        updateStatus();
        socket.emit('pause-changed', paused);
        return false;
    };

    var checkTaskExecutionId = function (scope, name) {
        var res = currentTask && scope.__taskExecutionId === currentTask.taskExecutionId;
        if (!res) {
            var message = "ignoring call to attester." + name + " for a task that is not (or no longer) valid.";
            reportLogToServer("warn", [message]);
            log("<i>warning</i> " + message);
        }
        return res;
    };

    var sendTestUpdate = function (scope, name, info) {
        if (!checkTaskExecutionId(scope, name)) {
            return false;
        }
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
                return false;
            }
            pendingTestStarts[info.testId] = false;
            info.duration = info.time - previousTestStart.time;
        }
        if (name === "error") {
            log("<i class='error'>error</i> message: <i>" + info.error.message + "</i>");
        }
        socket.emit('test-update', info, currentTask.taskExecutionId);
        return true;
    };

    attesterPrototype.testStart = function (info) {
        sendTestUpdate(this, 'testStarted', info);
    };
    attesterPrototype.testEnd = function (info) {
        sendTestUpdate(this, 'testFinished', info);
    };
    attesterPrototype.testError = function (info) {
        sendTestUpdate(this, 'error', info);
    };
    attesterPrototype.taskFinished = function () {
        if (!checkTaskExecutionId(this, "taskFinished")) {
            return;
        }
        socket.emit('task-finished', currentTask.taskExecutionId);
    };
    attesterPrototype.stackTrace = function (exception) {
        // this function is re-defined in stacktrace.js
        return [];
    };

    var emptyFunction = function () {};
    var replaceConsoleFunction = function (console, name, scope) {
        var oldFunction = config.localConsole === false ? emptyFunction : console[name] || emptyFunction;
        console[name] = function () {
            var res = oldFunction.apply(this, arguments);
            var taskExecutionId = scope.__taskExecutionId;
            if (!currentTask || currentTask.taskExecutionId !== taskExecutionId) {
                taskExecutionId = -1;
            }
            reportLogToServer(name, arguments, taskExecutionId);
            return res;
        };
    };

    attesterPrototype.installConsole = function (window) {
        var console = window.console;
        if (!console) {
            console = window.console = {};
        }
        replaceConsoleFunction(console, "log", this);
        replaceConsoleFunction(console, "info", this);
        replaceConsoleFunction(console, "warn", this);
        replaceConsoleFunction(console, "error", this);
    };

    // To send coverage, using a POST request rather than using socket.io is better for performance reasons
    var send = function (url, data) {
        var xhr = (window.ActiveXObject) ? new window.ActiveXObject("Microsoft.XMLHTTP") : new window.XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(data);
    };

    attesterPrototype.coverage = function (window) {
        var $$_l = window.$$_l;
        if ($$_l) {
            // notify the server through socket.io that we are sending coverage (so that it will wait for it):
            if (sendTestUpdate(this, 'coverage')) {
                send('/__attester__/coverage/data/' + currentTask.campaignId + '/' + currentTask.taskId, JSON.stringify({
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
        }
    };

    // Creating an empty iframe so that IE can replace its url without any harm
    // (when refreshing the page, IE tries to restore the previous URL of the iframe)
    createIframe(baseUrl + location.pathname.replace(/\/[^\/]+$/, "/empty.html"));
})();
