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

var http = require('../http-server.js');
var url = require('url');
var path = require('path');
var connect = require('connect');
var socketio = require('socket.io');
var Slave = require('./slave.js');
var Logger = require('../logging/logger.js');
var SocketIOLogger = require('../logging/socketio-logger.js');

var arrayRemove = function (array, item) {
    var index = array.indexOf(item);
    if (index >= 0) {
        array.splice(index, 1);
        return true;
    }
    return false;
};

var noCache = function (req, res, next) {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', (new Date(0)).toString());
    next();
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
        res.setHeader('Location', '/__atjstestrunner__/index.html');
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
    app.use('/__atjstestrunner__', connect['static'](__dirname + '/client'));
    app.use(routeToCampaign.bind(this));
    this.app = app;
    this.server = http.createServer(app);
    this.socketio = socketio.listen(this.server, {
        logger : new SocketIOLogger('socketio', this.logger)
    });
    this.socketio.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);
    this.socketio.set('client store expiration', 0);
    this.socketio.enable('browser client minification');
    this.socketio.disable('flash policy server');
    this.socketio.on('connection', socketConnection.bind(this));
    this.slaves = []; // array of all slaves
    this.availableSlaves = []; // array of available slaves
    this.campaigns = []; // array of campaigns
    this.frozen = config.frozen; // if frozen, then don't assign tasks
};

TestServer.prototype.getSlavesURL = function () {
    var address = this.server.address();
    var hostname = address.address;
    if (address.family == 'IPv4' && hostname == '0.0.0.0') {
        hostname = 'localhost';
    }
    return url.format({
        protocol : 'http',
        port : address.port,
        hostname : hostname,
        pathname : '/__atjstestrunner__/slave.html'
    });
};

TestServer.prototype.close = function () {
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
    this.availableSlaves.push(slave);
    slave.once('disconnect', slaveDisconnected.bind(this, slave));
    slave.on('available', slaveAvailable.bind(this, slave));
    this.assignTasks();
};

TestServer.prototype.addCampaign = function (campaign) {
    this.campaigns.push(campaign);
    campaign.once('finished', campaignFinished.bind(this, campaign));
    var url = this.getSlavesURL();
    campaign.addResult({
        event : "serverAttached",
        slaveURL : url,
        phantomJS : [path.join(__dirname, '../browsers/phantomjs.js'), "--auto-exit", url]
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
        for (var i = availableSlaves.length - 1; i >= 0; i--) {
            var currentSlave = availableSlaves[i];

            var browsers = currentCampaign.browsers;
            for (var j = 0, m = browsers.length; j < m; j++) {
                var currentBrowser = browsers[j];
                if (currentBrowser.matches(currentSlave) && currentBrowser.hasTasks()) {
                    var task = currentBrowser.takeTask();
                    availableSlaves.splice(i, 1);
                    currentSlave.assignTask(currentCampaign, task);
                }
            }
        }
    }
};

module.exports = TestServer;
