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
    this.onCommandSlaveCreate = this.onCommandSlaveCreate.bind(this);
    this.onCommandSlaveDelete = this.onCommandSlaveDelete.bind(this);
    this.onCommandStatus = this.onCommandStatus.bind(this);
    this.onSocketDisconnect = this.onSocketDisconnect.bind(this);

    this.socket.on("slaveCreate", this.onCommandSlaveCreate);
    this.socket.on("slaveDelete", this.onCommandSlaveDelete);
    this.socket.on("status", this.onCommandStatus);
    this.socket.on("disconnect", this.onSocketDisconnect);
};

SlaveController.prototype.onCommandStatus = function () {
    this.socket.emit("status", this.testServer.getStatus());
};

SlaveController.prototype.onCommandSlaveCreate = function (data) {
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
    this.socket.emit("slaveCreated", slaveId);
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

SlaveController.prototype.onCommandSlaveDelete = function (slaveId) {
    if (!this.slavesInfo.hasOwnProperty(slaveId)) {
        return;
    }
    var slaveInfo = this.slavesInfo[slaveId];
    delete this.slavesInfo[slaveId];
    removeSlave(slaveInfo);
    this.testServer.removeListener("slave-added-" + slaveId, slaveInfo.onSlaveConnect);
    if (this.socket) {
        this.socket.emit("slaveDeleted", slaveId);
    }
};

SlaveController.prototype.onSlaveConnect = function (slaveInfo, slave) {
    removeSlave(slaveInfo);
    slaveInfo.slave = slave;
    slave.on("disconnect", slaveInfo.onSlaveDisconnect);
    slave.on("busy", slaveInfo.onSlaveBusy);
    slave.on("idle", slaveInfo.onSlaveIdle);
    this.socket.emit("slaveConnected", {
        id: slaveInfo.slaveId,
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
    });
};

SlaveController.prototype.onSlaveDisconnect = function (slaveInfo) {
    removeSlave(slaveInfo);
    if (this.socket) {
        this.socket.emit("slaveDisconnected", slaveInfo.slaveId);
    }
};

SlaveController.prototype.onSlaveIdle = function (slaveInfo) {
    if (this.socket) {
        this.socket.emit("slaveIdle", slaveInfo.slaveId);
    }
};

SlaveController.prototype.onSlaveBusy = function (slaveInfo) {
    if (this.socket) {
        this.socket.emit("slaveBusy", slaveInfo.slaveId);
    }
};

SlaveController.prototype.onSocketDisconnect = function () {
    this.socket = null;
    var slavesInfo = this.slavesInfo;
    for (var slaveId in slavesInfo) {
        this.onCommandSlaveDelete(slaveId);
    }
    this.slavesInfo = null;
};