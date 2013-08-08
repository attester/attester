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

var detectBrowser = require("../browser-detection.js").detectBrowser;

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

var campaignTaskFinished = function (scope, campaign, task) {
    var event = {
        event: "taskFinished"
    };
    task.browser.onTaskFinished();
    feedEventWithTaskData(event, task);
    campaign.addResult(event);
};

var emitTaskError = function (scope, message) {
    var task = scope.currentTask;
    if (task) {
        var campaign = scope.currentCampaign;
        campaign.addResult({
            event: "error",
            taskId: task.taskId,
            taskName: task.test.name,
            error: {
                message: message
            },
            name: task.test.name
        });
        campaignTaskFinished(scope, campaign, task);
        scope.currentTask = null;
        scope.currentCampaign = null;
    }
};

var feedEventWithTaskData = function (event, task) {
    event.taskId = task.taskId;
    event.taskName = task.test.name;
    event.browserName = task.browser.name;
    event.browserRemainingTasks = task.browser.pendingTasks;
    return event;
};

var Slave = function (socket, data, config) {
    this.config = config;
    this.socket = socket;
    this.userAgent = data.userAgent;
    this.browserInfo = detectBrowser(data);
    this.displayName = this.browserInfo.displayName;
    var address = socket.handshake.address;
    this.address = address.address;
    this.port = address.port;
    this.addressName = null; // set by onReceiveAddressName
    this.currentTask = null;
    this.currentCampaign = null;
    this.paused = !! data.paused;
    this.taskTimeoutId = null;
    dns.reverse(this.address, this.onReceiveAddressName.bind(this));
    socket.on('disconnect', wrapInTryCatch(this, this.onSocketDisconnected));
    socket.on('test-update', wrapInTryCatch(this, this.onTestUpdate));
    socket.on('task-finished', wrapInTryCatch(this, this.onTaskFinished));
    socket.on('pause-changed', wrapInTryCatch(this, this.onPauseChanged));
};

util.inherits(Slave, events.EventEmitter);

Slave.prototype.toString = function () {
    var os = this.browserInfo.os.name;
    return (this.addressName || this.address) + ":" + this.port + " (" + this.displayName + "; " + os + ")";
};

Slave.prototype.onReceiveAddressName = function (err, names) {
    if (!err && names.length > 0) {
        this.addressName = names[0];
    }
};

Slave.prototype.assignTask = function (campaign, task) {
    this.currentTask = task;
    this.currentCampaign = campaign;
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
            this.emit(paused ? 'unavailable' : 'available');
        }
    }
};

Slave.prototype.onSocketDisconnected = function () {
    var task = this.currentTask;
    emitTaskError(this, "Browser was disconnected: " + this.toString());
    this.emit('disconnect');
};

Slave.prototype.onTaskFinished = function () {
    var task = this.currentTask;
    var campaign = this.currentCampaign;
    this.currentTask = null;
    this.currentCampaign = null;
    clearTimeout(this.taskTimeoutId);
    this.socket.emit('slave-stop');
    campaignTaskFinished(this, campaign, task);
    if (!this.paused) {
        this.emit('available');
    }
};

Slave.prototype.disconnect = function () {
    this.socket.disconnect();
};

Slave.prototype.isAvailable = function () {
    return !(this.paused || this.currentTask);
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
    this.socket.emit('slave-stop');
    emitTaskError(this, "Task timeout.");
    if (!this.paused) {
        this.emit('available');
    }
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