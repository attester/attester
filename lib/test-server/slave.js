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
var detectBrowser = require("../browser-detection.js").detectBrowser;
var dns = require("dns");

var allowedTestUpdateEvents = {
    "testStarted": 1,
    "testFinished": 1,
    "error": 1,
    "coverage": 1
};

var Slave = function (socket, data) {
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
    dns.reverse(this.address, this.onReceiveAddressName.bind(this));
    socket.on('disconnect', this.onSocketDisconnected.bind(this));
    socket.on('test-update', this.onTestUpdate.bind(this));
    socket.on('task-finished', this.onTaskFinished.bind(this));
};

util.inherits(Slave, events.EventEmitter);

Slave.prototype.onReceiveAddressName = function (err, names) {
    if (!err && names.length > 0) {
        this.addressName = names[0];
    }
};

Slave.prototype.assignTask = function (campaign, task) {
    this.currentTask = task;
    this.currentCampaign = campaign;
    task.slave = this;
    var test = task.test;
    this.socket.emit('slave-execute', {
        url: test.url,
        name: test.name,
        taskId: task.taskId,
        campaignId: campaign.id
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
};

Slave.prototype.onTestUpdate = function (event) {
    event = event || {};
    var eventName = event.event;
    if (allowedTestUpdateEvents.hasOwnProperty(eventName)) {
        var task = this.currentTask;
        event.taskId = task.taskId;
        event.taskName = task.test.name;
        this.currentCampaign.addResult(event);
    }
};

Slave.prototype.onSocketDisconnected = function () {
    var task = this.currentTask;
    if (task) {
        var campaign = this.currentCampaign;
        campaign.addResult({
            event: "error",
            taskId: task.taskId,
            taskName: task.test.name,
            error: {
                message: "Browser was disconnected."
            }
        });
        campaign.addResult({
            event: "taskFinished",
            taskId: task.taskId,
            taskName: task.test.name
        });
    }
    this.emit('disconnect');
};

Slave.prototype.onTaskFinished = function () {
    var task = this.currentTask;
    var campaign = this.currentCampaign;
    this.currentTask = null;
    this.currentCampaign = null;
    this.subTestsById = null;
    this.socket.emit('slave-stop');
    campaign.addResult({
        event: "taskFinished",
        taskId: task.taskId,
        taskName: task.test.name
    });
    this.emit('available');
};

Slave.prototype.disconnect = function () {
    this.socket.disconnect();
};

module.exports = Slave;