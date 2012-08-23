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

var allowedTestUpdateEvents = {
    "testStarted" : 1,
    "testFinished" : 1,
    "error" : 1
};

var browserRegexp = /(PhantomJS|Chrome|Firefox|Opera|Safari)\/([0-9]*)\.([0-9]*)(\.([0-9]*))?/;
var versionRegexp = /Version\/([0-9]*)\.([0-9]*)(\.([0-9]*))?/;
var ieRegexp = /MSIE ([0-9]*)\.([0-9]*)/;

var getBrowserInfo = function (userAgent) {
    var match = browserRegexp.exec(userAgent);
    if (match) {
        var version = versionRegexp.exec(userAgent);
        return {
            name : match[1],
            majorVersion : parseInt(version ? version[1] : match[2], 10),
            minorVersion : parseInt(version ? version[2] : match[3], 10),
            revision : parseInt(version ? version[4] : match[5], 10)
        };
    }
    match = ieRegexp.exec(userAgent);
    if (ieRegexp) {
        return {
            name : "IE",
            majorVersion : parseInt(match[1], 10),
            minorVersion : parseInt(match[2], 10),
            revision : NaN
        };
    }
    return {
        name : "Unknown browser",
        majorVersion : NaN,
        minorVersion : NaN,
        revision : NaN
    };
};

var Slave = function (socket, data) {
    this.socket = socket;
    this.userAgent = data.userAgent;
    this.browserInfo = getBrowserInfo(this.userAgent);
    var address = socket.handshake.address;
    this.address = address.address;
    this.port = address.port;
    this.currentTask = null;
    this.currentCampaign = null;
    socket.on('disconnect', this.onSocketDisconnected.bind(this));
    socket.on('test-update', this.onTestUpdate.bind(this));
    socket.on('coverage', this.onCoverage.bind(this));
    socket.on('task-finished', this.onTaskFinished.bind(this));
};

util.inherits(Slave, events.EventEmitter);

Slave.prototype.assignTask = function (campaign, task) {
    this.currentTask = task;
    this.currentCampaign = campaign;
    task.slave = this;
    var test = task.test;
    this.socket.emit('slave-execute', {
        url : test.url,
        name : test.name
    });
    this.currentCampaign.addResult({
        event : "taskStarted",
        taskId : task.taskId,
        taskName : test.name,
        slave : {
            userAgent : this.userAgent,
            address : this.address,
            port : this.port
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

Slave.prototype.onCoverage = function (coverage) {
    this.currentCampaign.addCoverageResult(coverage);
};

Slave.prototype.onSocketDisconnected = function () {
    var task = this.currentTask;
    if (task) {
        var campaign = this.currentCampaign;
        campaign.addResult({
            event : "error",
            taskId : task.taskId,
            taskName : task.test.name,
            error : {
                message : "Browser was disconnected."
            }
        });
        campaign.addResult({
            event : "taskFinished",
            taskId : task.taskId,
            taskName : task.test.name
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
        event : "taskFinished",
        taskId : task.taskId,
        taskName : task.test.name
    });
    this.emit('available');
};

Slave.prototype.disconnect = function () {
    this.socket.disconnect();
};

module.exports = Slave;
