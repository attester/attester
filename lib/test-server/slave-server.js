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

var util = require("util");
var events = require("events");
var dns = require("dns");

var detectBrowser = require("../util/browser-detection.js").detectBrowser;

var allowedTestUpdateEvents = {
    "testStarted": 1,
    "testFinished": 1,
    "error": 1,
    "coverage": 1
};

var wrapInTryCatch = function (scope, fct) {
    return function () {
        try {
            return fct.apply(scope, arguments);
        } catch (e) {
            console.log("Error when called from " + scope + ": ", e.stack || e);
        }
    };
};

var checkRestart = function (scope, task) {
    var restarts = task.restarts || 0;
    restarts++;
    if (restarts > scope.config.maxTaskRestarts) {
        return false;
    }
    task.restarts = restarts;
    return true;
};

var campaignTaskFinished = function (scope) {
    var task = scope.currentTask;
    var campaign = scope.currentCampaign;
    var restart = scope.currentTaskRestartPlanned;
    scope.currentTask = null;
    scope.currentCampaign = null;
    scope.currentTaskRestartPlanned = false;
    if (scope.taskTimeoutId != null) {
        clearTimeout(scope.taskTimeoutId);
        scope.taskTimeoutId = null;
    }
    var event = {
        event: "taskFinished"
    };
    task.browser.onTaskFinished();
    feedEventWithTaskData(event, task);
    event.restartPlanned = restart && checkRestart(scope, task);
    if (event.restartPlanned) {
        task.browser.addTask(task);
    }
    campaign.addResult(event);
    if (scope.socket) {
        scope.socket.emit('slave-stop');
        scope.emitAvailable();
    }
};

var emitTaskError = function (scope, message) {
    var task = scope.currentTask;
    if (task) {
        scope.currentCampaign.addResult({
            event: "error",
            taskId: task.taskId,
            taskName: task.test.name,
            error: {
                message: message
            },
            name: task.test.name
        });
        if (scope.config.taskRestartOnFailure) {
            scope.currentTaskRestartPlanned = true;
        }
        campaignTaskFinished(scope);
    }
};

var feedEventWithTaskData = function (event, task) {
    event.taskId = task.taskId;
    return event;
};

var Slave = function (socket, data, config) {
    this.id = data.id;
    this.config = config;
    this.socket = socket;
    this.userAgent = data.userAgent;
    this.browserInfo = detectBrowser(data);
    this.displayName = this.browserInfo.displayName;
    this.address = socket.conn.remoteAddress;
    this.port = socket.request.connection.remotePort;
    this.addressName = null; // set by onReceiveAddressName
    this.currentTask = null;
    this.currentCampaign = null;
    this.paused = !! data.paused;
    this.taskTimeoutId = null;
    this.idle = false;

    // matchingCampaignBrowsers is an array of objects containing a campaign and
    // a browser properties, it is updated by the test server when a campaign is
    // added or removed, and when a slave is added or removed
    this.matchingCampaignBrowsers = [];

    dns.reverse(this.address, this.onReceiveAddressName.bind(this));
    socket.on('disconnect', wrapInTryCatch(this, this.onSocketDisconnected));
    socket.on('test-update', wrapInTryCatch(this, this.onTestUpdate));
    socket.on('task-finished', wrapInTryCatch(this, this.onTaskFinished));
    socket.on('pause-changed', wrapInTryCatch(this, this.onPauseChanged));
};

util.inherits(Slave, events.EventEmitter);

Slave.prototype.toString = function () {
    var os = this.browserInfo.os.displayName;
    var id = this.id ? " " + this.id : "";
    return (this.addressName || this.address) + ":" + this.port + id + " (" + this.displayName + "; " + os + ")";
};

Slave.prototype.onReceiveAddressName = function (err, names) {
    if (!err && names.length > 0) {
        this.addressName = names[0];
    }
};

Slave.prototype.findTask = function () {
    var matchingCampaignBrowsers = this.matchingCampaignBrowsers;
    for (var i = 0, l = matchingCampaignBrowsers.length; i < l; i++) {
        var curMatch = matchingCampaignBrowsers[i];
        var curBrowser = curMatch.browser;
        if (curBrowser.hasTasks()) {
            var task = curBrowser.takeTask();
            this.assignTask(curMatch.campaign, task);
            return;
        }
    }
};

Slave.prototype.assignTask = function (campaign, task) {
    this.currentTask = task;
    this.currentCampaign = campaign;
    this.currentTaskRestartPlanned = false;
    if (this.idle) {
        this.idle = false;
        this.emit('busy');
    }
    this.emit('unavailable');
    task.slave = this;
    var test = task.test;
    this.socket.emit('slave-execute', {
        url: test.url,
        name: test.name,
        taskId: task.taskId,
        campaignId: campaign.id,
        stats: {
            remainingTasks: campaign.remainingTasks,
            browserRemainingTasks: task.browser.pendingTasks
        }
    });
    this.currentCampaign.addResult({
        event: "taskStarted",
        taskId: task.taskId,
        taskName: test.name,
        slave: {
            userAgent: this.userAgent,
            address: this.address,
            addressName: this.addressName,
            port: this.port
        }
    });
    this.taskTimeoutId = setTimeout(this.taskTimeout.bind(this), this.config.taskTimeout);
};

Slave.prototype.onTestUpdate = function (event) {
    var eventName = event.event;
    if (eventName == "error" && this.config.taskRestartOnFailure) {
        this.currentTaskRestartPlanned = true;
    }
    if (allowedTestUpdateEvents.hasOwnProperty(eventName)) {
        feedEventWithTaskData(event, this.currentTask);
        this.currentCampaign.addResult(event);
    }
};

Slave.prototype.onPauseChanged = function (paused) {
    paused = !! paused; // makes sure it is a boolean
    if (this.paused !== paused) {
        this.paused = paused;
        if (!this.currentTask) {
            if (!this.emitAvailable()) {
                this.emit('unavailable');
            }
        }
    }
};

Slave.prototype.onSocketDisconnected = function () {
    if (this.socket) {
        this.socket = null;
        this.currentTaskRestartPlanned = true;
        emitTaskError(this, "Browser was disconnected: " + this.toString());
        this.emit('disconnect');
    }
};

Slave.prototype.onTaskFinished = function () {
    campaignTaskFinished(this);
};

Slave.prototype.disconnect = function () {
    if (this.socket) {
        this.socket.disconnect();
    }
};

Slave.prototype.isAvailable = function () {
    return this.socket && !(this.paused || this.currentTask);
};

Slave.prototype.emitAvailable = function () {
    var res = this.isAvailable();
    if (res) {
        this.emit('available');
        if (this.isAvailable() && !this.idle) {
            // still no task after saying it is available
            this.idle = true;
            this.emit('idle');
        }
    }
    return res;
};

Slave.prototype.getStatus = function () {
    if (this.currentTask) {
        return this.currentTask.test.name;
    } else if (this.paused) {
        return "(paused)";
    } else {
        return "(idle)";
    }
};

Slave.prototype.taskTimeout = function () {
    this.taskTimeoutId = null;
    emitTaskError(this, "Task timeout.");
};

Slave.prototype.dispose = function (callback) {
    this.socket.emit('dispose');
    // Give the slave some time to die
    setTimeout(function () {
        this.disconnect();
        callback();
    }.bind(this), 100);
};

module.exports = Slave;