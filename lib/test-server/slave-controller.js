/*
 * Copyright 2015 Amadeus s.a.s.
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

var crypto = require("crypto");
var idNumber = 0;

var createSlaveId = function () {
    idNumber++;
    return idNumber + "-" + new Buffer(crypto.pseudoRandomBytes(8)).toString("hex");
};

var SlaveController = module.exports = function (socket, data, testServer) {
    this.socket = socket;
    this.testServer = testServer;
    this.slavesInfo = {};
    this.onSocketMessage = this.onSocketMessage.bind(this);
    this.onSocketDisconnect = this.onSocketDisconnect.bind(this);
    socket.on('data', this.onSocketMessage);
    socket.on('close', this.onSocketDisconnect);
};

SlaveController.prototype.onSocketMessage = function (message) {
    try {
        var data = JSON.parse(message);
        var type = data.type;
        var handler = this["onSocketMessage_" + type];
        if (handler) {
            handler.call(this, data);
        }
    } catch (e) {}
};

SlaveController.prototype.onSocketMessage_status = function () {
    this.socket.write(JSON.stringify({
        type: "status",
        status: this.testServer.getStatus()
    }));
};

SlaveController.prototype.onSocketMessage_slaveCreate = function () {
    var slaveId = createSlaveId();
    var slaveInfo = this.slavesInfo[slaveId] = {
        slaveId: slaveId,
        slave: null
    };
    slaveInfo.onSlaveConnect = this.onSlaveConnect.bind(this, slaveInfo);
    slaveInfo.onSlaveDisconnect = this.onSlaveDisconnect.bind(this, slaveInfo);
    slaveInfo.onSlaveIdle = this.onSlaveIdle.bind(this, slaveInfo);
    slaveInfo.onSlaveBusy = this.onSlaveBusy.bind(this, slaveInfo);
    this.testServer.on("slave-added-" + slaveId, slaveInfo.onSlaveConnect);
    this.socket.write(JSON.stringify({
        type: "slaveCreated",
        slaveId: slaveId
    }));
};

var removeSlave = function (slaveInfo) {
    var slave = slaveInfo.slave;
    if (slave) {
        slaveInfo.slave = null;
        slave.removeListener("disconnect", slaveInfo.onSlaveDisconnect);
        slave.removeListener("idle", slaveInfo.onSlaveIdle);
        slave.removeListener("busy", slaveInfo.onSlaveBusy);
        slave.disconnect(); // makes sure the slave is disconnected
    }
};

SlaveController.prototype.onSocketMessage_slaveDelete = function (data) {
    this.deleteSlave(data.slaveId);
};

SlaveController.prototype.deleteSlave = function (slaveId) {
    if (!this.slavesInfo.hasOwnProperty(slaveId)) {
        return;
    }
    var slaveInfo = this.slavesInfo[slaveId];
    delete this.slavesInfo[slaveId];
    removeSlave(slaveInfo);
    this.testServer.removeListener("slave-added-" + slaveId, slaveInfo.onSlaveConnect);
    if (this.socket) {
        this.socket.write(JSON.stringify({
            type: "slaveDeleted",
            slaveId: slaveId
        }));
    }
};

SlaveController.prototype.onSlaveConnect = function (slaveInfo, slave) {
    removeSlave(slaveInfo);
    slaveInfo.slave = slave;
    slave.on("disconnect", slaveInfo.onSlaveDisconnect);
    slave.on("busy", slaveInfo.onSlaveBusy);
    slave.on("idle", slaveInfo.onSlaveIdle);
    this.socket.write(JSON.stringify({
        type: "slaveConnected",
        slaveId: slaveInfo.slaveId,
        address: slave.address,
        port: slave.port,
        displayName: slave.displayName,
        userAgent: slave.userAgent,
        campaignBrowsers: slave.matchingCampaignBrowsers.map(function (info) {
            return {
                campaign: info.campaign.id,
                browser: info.browser.getJsonInfo()
            };
        })
    }));
};

SlaveController.prototype.onSlaveDisconnect = function (slaveInfo) {
    removeSlave(slaveInfo);
    if (this.socket) {
        this.socket.write(JSON.stringify({
            type: "slaveDisconnected",
            slaveId: slaveInfo.slaveId
        }));
    }
};

SlaveController.prototype.onSlaveIdle = function (slaveInfo) {
    if (this.socket) {
        this.socket.write(JSON.stringify({
            type: "slaveIdle",
            slaveId: slaveInfo.slaveId
        }));
    }
};

SlaveController.prototype.onSlaveBusy = function (slaveInfo) {
    if (this.socket) {
        this.socket.write(JSON.stringify({
            type: "slaveBusy",
            slaveId: slaveInfo.slaveId
        }));
    }
};

SlaveController.prototype.onSocketDisconnect = function () {
    this.socket = null;
    var slavesInfo = this.slavesInfo;
    for (var slaveId in slavesInfo) {
        this.deleteSlave(slaveId);
    }
    this.slavesInfo = null;
};
