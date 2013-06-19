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

var url = require('url');
var path = require('path');
var fs = require("fs");

var connect = require('connect');
var socketio = require('socket.io');
var _ = require("lodash");

var http = require('../http-server.js');
var Slave = require('./slave.js');
var Logger = require('../logging/logger.js');
var SocketIOLogger = require('../logging/socketio-logger.js');

// middlewares
var noCache = require("../middlewares/noCache");
var index = require("../middlewares/index");
var template = require("../middlewares/template");

var arrayRemove = function (array, item) {
    var index = array.indexOf(item);
    if (index >= 0) {
        array.splice(index, 1);
        return true;
    }
    return false;
};

var socketConnection = function (socket) {
    var testServer = this;
    socket.once('hello', function (data) {
        if (data.type == 'slave') {
            var newSlave = new Slave(socket, data);
            testServer.addSlave(newSlave);
        }
    });
};

var routeToCampaign = function (req, res, next) {
    var testServer = this;
    if (req.path == '/') {
        // root of the server, redirect to welcome page:
        res.statusCode = 301;
        res.setHeader('Location', '/__attester__/index.html');
        res.end();
        return;
    }
    // for the time being, only one campaign is executed at a given time
    var campaign = testServer.campaigns[0];
    if (!campaign) {
        return next();
    }
    campaign.handleRequest(req, res, next);
};

var campaignFinished = function (campaign) {
    var testServer = this;
    arrayRemove(testServer.campaigns, campaign);
    testServer.assignTasks();
};

var slaveDisconnected = function (slave) {
    var testServer = this;
    arrayRemove(testServer.slaves, slave);
    arrayRemove(testServer.availableSlaves, slave);
};

var slaveAvailable = function (slave) {
    var testServer = this;
    // TODO: do an assert to check that this slave is not already available and is correctly in the slaves array
    testServer.availableSlaves.push(slave);

    // a slave is now available, it is time to assign it a task
    testServer.assignTasks();
};

var slaveUnavailable = function (slave) {
    var testServer = this;
    arrayRemove(testServer.availableSlaves, slave);
};

var routeCoverage = function (req, res, next) {
    var testServer = this;
    var match = /\/([0-9]+)\/([0-9]+)/.exec(req.path);
    var campaignId;
    var taskId;
    var campaign;
    if (match) {
        campaignId = match[1];
        taskId = match[2];
        if (!isNaN(campaignId) && !isNaN(taskId)) {
            campaign = testServer.findCampaign(campaignId);
        }
    }
    if (!campaign) {
        res.statusCode = 404;
        res.write('Not found');
        res.end();
        return;
    }
    var data = [];
    req.setEncoding('utf-8');
    req.on('data', function (chunk) {
        data.push(chunk);
    });
    req.on('end', function () {
        var json = JSON.parse(data.join(''));
        campaign.addCoverageResult(taskId, json);
        res.write('OK');
        res.end();
    });
};

/**
 * A test server is a web server which browsers can connect to and become its slaves, ready to execute some tests.
 * Browsers connect to it through a socket.io channel.
 * @param {Object} config Has the following properties:
 * <ul>
 * <li></li>
 * </ul>
 */
var TestServer = function (config, logger) {
    this.logger = new Logger("TestServer", logger);
    this.config = config;
    var app = connect();
    app.use(noCache);
    app.use(connect.compress());
    app.use(index);
    // Template pages (before the static folder)
    app.use('/__attester__', template.bind({
        data: this,
        page: "/index.html",
        path: path.join(__dirname, "client", "index.html")
    }));
    app.use('/__attester__', template.bind({
        data: this,
        page: "/status.html",
        path: path.join(__dirname, "client", "status.html")
    }));
    app.use('/__attester__', connect['static'](__dirname + '/client'));
    app.use('/__attester__/coverage/data', routeCoverage.bind(this));
    app.use(routeToCampaign.bind(this));
    this.app = app;
    this.server = http.createServer(app);
    this.socketio = socketio.listen(this.server, {
        logger: new SocketIOLogger('socketio', this.logger)
    });
    this.socketio.set('client store expiration', 0);
    this.socketio.enable('browser client minification');
    if (config.flashPolicyServer) {
        this.socketio.set('flash policy port', config.flashPolicyPort);
    } else {
        this.socketio.disable('flash policy server');
    }
    this.socketio.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);
    this.socketio.on('connection', socketConnection.bind(this));
    this.slaves = []; // array of all slaves
    this.availableSlaves = []; // array of available slaves
    this.campaigns = []; // array of campaigns
    this.frozen = config.frozen; // if frozen, then don't assign tasks
};

var serverURLPathnames = {
    'slave': '/__attester__/slave.html',
    'home': '/'
};

TestServer.prototype.getURL = function (urlType) {
    var pathname = serverURLPathnames[urlType];
    if (pathname == null) {
        return;
    }
    var address = this.server.address();
    var hostname = address.address;
    if (address.family == 'IPv4' && hostname == '0.0.0.0') {
        hostname = 'localhost';
    }
    return url.format({
        protocol: 'http',
        port: address.port,
        hostname: hostname,
        pathname: pathname
    });
};

TestServer.prototype.close = function () {
    this.socketio.disable('flash policy server');
    try {
        this.server.close();
    } catch (e) {}
    var slaves = this.slaves;
    for (var i = 0, l = slaves.length; i < l; i++) {
        try {
            slaves[i].disconnect();
        } catch (e) {}
    }
};

TestServer.prototype.addSlave = function (slave) {
    this.slaves.push(slave);
    if (slave.isAvailable()) {
        this.availableSlaves.push(slave);
    }
    slave.once('disconnect', slaveDisconnected.bind(this, slave));
    slave.on('available', slaveAvailable.bind(this, slave));
    slave.on('unavailable', slaveUnavailable.bind(this, slave));
    this.assignTasks();
};

TestServer.prototype.addCampaign = function (campaign) {
    this.campaigns.push(campaign);
    campaign.once('finished', campaignFinished.bind(this, campaign));
    var slaveURL = this.getURL("slave");
    campaign.addResult({
        event: "serverAttached",
        homeURL: this.getURL("home"),
        slaveURL: slaveURL,
        phantomJS: [path.join(__dirname, '../browsers/phantomjs.js'), "--auto-exit", slaveURL]
    });
    this.assignTasks();
};

TestServer.prototype.assignTasks = function () {
    if (this.frozen) {
        return;
    }
    // automatically called when tasks could be assigned to slaves
    var availableSlaves = this.availableSlaves;
    var currentCampaign = this.campaigns[0]; // for the time being, only one campaign is executed at a given time
    if (currentCampaign != null) {
        currentCampaign.checkFinished();
        for (var i = availableSlaves.length - 1; i >= 0; i--) {
            var currentSlave = availableSlaves[i];

            var browsers = currentCampaign.browsers;
            for (var j = 0, m = browsers.length; j < m; j++) {
                var currentBrowser = browsers[j];
                if (currentBrowser.matches(currentSlave) && currentBrowser.hasTasks()) {
                    var task = currentBrowser.takeTask();
                    currentSlave.assignTask(currentCampaign, task);
                }
            }
        }
    }
};

TestServer.prototype.findCampaign = function (campaignId) {
    var campaigns = this.campaigns;
    for (var i = 0, l = campaigns.length; i < l; i++) {
        var curCampaign = campaigns[i];
        if (curCampaign.id == campaignId) {
            return curCampaign;
        }
    }
    return null;
};

module.exports = TestServer;