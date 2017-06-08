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
var Logger = require('../logging/logger.js');

var slaveCounter = 0;
var taskExecutionCount = 0;

var detectBrowser = require("../util/browser-detection.js").detectBrowser;

var allowedTestUpdateEvents = {
    "testStarted": 1,
    "testFinished": 1,
    "error": 1,
    "coverage": 1
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
    scope.taskExecutionId = null;
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
        scope.socket.write('{"type":"slaveStop"}');
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

var Slave = function (socket, data, config, logger) {
    this.id = data.id;
    this.slaveNumber = ++slaveCounter;
    this.logger = new Logger("Slave", this.slaveNumber, logger);
    this.config = config;
    this.socket = socket;
    this.userAgent = data.userAgent;
    this.browserInfo = detectBrowser(data);
    this.displayName = this.browserInfo.displayName;
    this.address = socket.remoteAddress;
    this.port = socket.remotePort;
    this.addressName = null; // set by onReceiveAddressName
    this.taskExecutionId = null;
    this.currentTask = null;
    this.currentCampaign = null;
    this.paused = !!data.paused;
    this.taskTimeoutId = null;
    this.idle = false;

    // matchingCampaignBrowsers is an array of objects containing a campaign and
    // a browser properties, it is updated by the test server when a campaign is
    // added or removed, and when a slave is added or removed
    this.matchingCampaignBrowsers = [];

    dns.reverse(this.address, this.onReceiveAddressName.bind(this));
    socket.on('data', this.onSocketData.bind(this));
    socket.on('close', this.onSocketDisconnected.bind(this));
};

util.inherits(Slave, events.EventEmitter);

Slave.prototype.onSocketData = function (message) {
    try {
        var data = JSON.parse(message);
        var type = data.type;
        var handler = this["onSocketData_" + type];
        if (handler) {
            handler.call(this, data);
        } else {
            throw new Error("Unknown message type: " + type);
        }
    } catch (e) {
        console.log("Error when called from " + this + ": ", e.stack || e);
    }
};

Slave.prototype.toString = function () {
    var os = this.browserInfo.os.displayName;
    var id = this.id ? " " + this.id : "";
    return "[" + this.slaveNumber + "] " + (this.addressName || this.address) + ":" + this.port + id + " (" + this.displayName + "; " + os + ")";
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
    var taskExecutionId = this.taskExecutionId = ++taskExecutionCount;
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
    this.socket.write(JSON.stringify({
        type: 'slaveExecute',
        url: test.url,
        name: test.name,
        taskId: task.taskId,
        taskExecutionId: taskExecutionId,
        campaignId: campaign.id,
        stats: {
            remainingTasks: campaign.remainingTasks,
            browserRemainingTasks: task.browser.pendingTasks
        }
    }));
    this.currentCampaign.addResult({
        event: "taskStarted",
        taskId: task.taskId,
        taskName: test.name,
        slave: {
            userAgent: this.userAgent,
            address: this.address,
            addressName: this.addressName,
            port: this.port,
            slaveNumber: this.slaveNumber
        }
    });
    this.taskTimeoutId = setTimeout(this.taskTimeout.bind(this), this.config.taskTimeout);
};

Slave.prototype.onSocketData_testUpdate = function (message) {
    var event = message.event;
    var taskExecutionId = message.taskExecutionId;
    var eventName = event.event;
    if (!this.checkTaskExecutionId(taskExecutionId, eventName)) {
        return;
    }
    if (allowedTestUpdateEvents.hasOwnProperty(eventName)) {
        if (eventName == "error" && this.config.taskRestartOnFailure) {
            this.currentTaskRestartPlanned = true;
        }
        feedEventWithTaskData(event, this.currentTask);
        this.currentCampaign.addResult(event);
    }
};

Slave.prototype.onSocketData_pauseChanged = function (message) {
    var paused = message.paused;
    paused = !!paused; // makes sure it is a boolean
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
        this.logger.dispose();
    }
};

var clientLogLevels = {
    "debug": Logger.LEVEL_INFO,
    "log": Logger.LEVEL_INFO,
    "info": Logger.LEVEL_INFO,
    "warn": Logger.LEVEL_WARN,
    "error": Logger.LEVEL_ERROR
};

Slave.prototype.onSocketData_log = function (message) {
    var event = message.event;
    var taskExecutionId = message.taskExecutionId;
    var eventLevel = event.level;
    var loggerLevel = +clientLogLevels[eventLevel];
    if (!isNaN(loggerLevel)) {
        this.logger.log(loggerLevel, "[console.%s] %s", [eventLevel, event.message]);
        var currentTask = this.currentTask;
        if (currentTask && taskExecutionId === this.taskExecutionId) {
            feedEventWithTaskData(event, currentTask);
            event.event = "log";
            this.currentCampaign.addResult(event);
        }
    }
};

Slave.prototype.onSocketData_taskFinished = function (message) {
    var taskExecutionId = message.taskExecutionId;
    if (!this.checkTaskExecutionId(taskExecutionId, "taskFinished")) {
        return;
    }
    campaignTaskFinished(this);
};

Slave.prototype.checkTaskExecutionId = function (taskExecutionId, eventName) {
    var res = taskExecutionId === this.taskExecutionId;
    if (!res) {
        this.logger.logWarn("Ignoring %s event from a previous task, not filtered by the client.", [eventName]);
    }
    return res;
};

Slave.prototype.disconnect = function () {
    if (this.socket) {
        this.socket.close();
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
    this.socket.write('{"type":"dispose"}');
    // Give the slave some time to die
    setTimeout(function () {
        this.disconnect();
        callback();
    }.bind(this), 100);
};

module.exports = Slave;
