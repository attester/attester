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
var util = require("util");
var events = require("events");

var connect = require('connect');
var SocketIO = require('socket.io');
var _ = require("lodash");

var attesterResultsUI = require('attester-results-ui');

var http = require('./http-server.js');
var Slave = require('./slave-server.js');
var Viewer = require('./viewer-server.js');
var SlaveController = require('./slave-controller.js');
var Logger = require('../logging/logger.js');

// middlewares
var index = require("../middlewares/index");
var template = require("../middlewares/template");

var detectHostname = require("../util/detectHostname");

var arrayRemove = function (array, item) {
    var index = array.indexOf(item);
    if (index >= 0) {
        array.splice(index, 1);
        return true;
    }
    return false;
};

var clientTypes = {
    "slave": function (socket, data) {
        var newSlave = new Slave(socket, data, this.config);
        this.addSlave(newSlave);
    },
    "viewer": function (socket, data) {
        // creates a new Viewer, which will register to campaign results
        new Viewer(socket, data, this);
    },
    "slaveController": function (socket, data) {
        // creates a new slave controller, which will be notified when its slaves
        // are connected, disconnected, and idle
        new SlaveController(socket, data, this);
    }
};

var socketConnection = function (socket) {
    var testServer = this;
    socket.once('hello', function (data) {
        var fn = clientTypes[data.type];
        if (fn) {
            fn.call(testServer, socket, data);
        } else {
            // unknown hello message: close the connection so that the remote
            // program knows it is not supported
            socket.close();
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

    var campaignIdMatch = req.url.match(/^\/campaign([0-9]+)(\/|$)/);
    var campaign = campaignIdMatch ? testServer.findCampaign(campaignIdMatch[1]) : null;
    if (!campaign) {
        return next();
    }
    if (!campaignIdMatch[2]) {
        // campaign root, display its configuration
        // it could be later improved by adding a home page for each campaign
        res.statusCode = 301;
        res.setHeader('Location', '/__attester__/index.html#campaign' + campaign.id);
        res.end();
        return;
    }
    // Remove the campaign baseURL
    req.url = req.url.substr(campaign.baseURL.length);
    campaign.handleRequest(req, res, next);
};

var campaignFinished = function (campaign) {
    var testServer = this;
    if (this.config.shutdownOnCampaignEnd) {
        arrayRemove(testServer.campaigns, campaign);
        testServer.slaves.forEach(testServer.updateMatchingCampaignBrowsers.bind(testServer));
    }
};

var slaveDisconnected = function (slave) {
    var testServer = this;
    arrayRemove(testServer.slaves, slave);
    arrayRemove(testServer.availableSlaves, slave);
    testServer.updateMatchingCampaignBrowsers(slave);
    testServer.logger.logInfo("Slave disconnected: " + slave.toString());
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

var jsonApi = function (req, res, next) {
    var testServer = this;
    if (req.path !== "/status.json") {
        return next();
    }
    var status = testServer.getStatus();
    var jsonResponse = JSON.stringify(status);
    var parsedUrl = url.parse(req.url, true);
    var jsonpCallback = parsedUrl.query.callback;
    if (jsonpCallback) {
        res.header("Content-Type", "application/javascript");
        jsonResponse = [jsonpCallback, "(", jsonResponse, ");"].join("");
    } else {
        res.header("Content-Type", "application/json");
    }
    res.write(jsonResponse);
    res.end();
};

var globalCoverage = function (req, res, next) {
    if (!this.campaigns) {
        next(new Error("No campaign configured"));
    } else {
        // FIXME Until we have a better way to display historical data we can only use the first campaign
        var campaign = this.campaigns[0];
        if (campaign.coverage) {
            campaign.coverage.resultsSender('/__attester__/coverage/display', campaign.config['coverage-reports']['json-file'])(req, res, next);
        }
    }
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
    app.use(connect.compress());
    app.use(index);
    app.use(connect.favicon(path.join(__dirname, "client", "favicon.ico")));
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
    app.use('/__attester__/json3', connect['static'](path.dirname(require.resolve("json3/lib/json3.js"))));
    app.use('/__attester__/coverage/display', globalCoverage.bind(this));
    app.use('/__attester__/coverage/data', routeCoverage.bind(this));
    app.use('/__attester__/results-ui', attesterResultsUI({
        serverURL: "{CURRENTHOST}"
    }));
    app.use(routeToCampaign.bind(this));
    app.use('/__attester__', jsonApi.bind(this));
    this.app = app;
    this.server = http.createServer(app);
    this.socketio = new SocketIO(this.server);
    this.socketio.on('connection', socketConnection.bind(this));
    this.slaves = []; // array of all slaves
    this.availableSlaves = []; // array of available slaves
    this.campaigns = []; // array of campaigns
    this.frozen = config.frozen; // if frozen, then don't assign tasks
};

util.inherits(TestServer, events.EventEmitter);

var serverURLPathnames = {
    'slave': '/__attester__/slave.html',
    'home': '/'
};

TestServer.prototype.getURL = function (urlType) {
    var pathname = serverURLPathnames[urlType];
    if (pathname == null) {
        return;
    }
    return url.format({
        protocol: 'http',
        port: this.port,
        hostname: this.hostname,
        pathname: pathname
    });
};

TestServer.prototype.listen = function (port, host, callback) {
    var self = this;
    this.server.listen(port, host, function () {
        self.port = port;
        self.hostname = host;
        if (host == "0.0.0.0" || host == "::") {
            detectHostname(host).then(function (hostname) {
                self.hostname = hostname;
            })["finally"](callback);
        } else {
            callback();
        }
    });
};

TestServer.prototype.getStatus = function () {
    return {
        slaves: this.slaves.map(function (slave) {
            return {
                address: slave.address,
                addressName: slave.addressName,
                port: slave.port,
                displayName: slave.displayName,
                userAgent: slave.userAgent,
                paused: slave.paused,
                idle: slave.idle,
                currentCampaign: slave.currentCampaign ? slave.currentCampaign.id : null,
                currentTask: slave.currentTask ? slave.currentTask.test.name : null
            };
        }),
        campaigns: this.campaigns.map(function (campaign) {
            return {
                campaignNumber: campaign.campaignNumber,
                id: campaign.id,
                totalTasks: campaign.tasks.length,
                remainingTasks: campaign.remainingTasks,
                browsers: campaign.browsers.map(function (browser) {
                    return browser.getJsonInfo();
                })
            };
        })
    };
};

TestServer.prototype.close = function (callback) {
    var slaves = this.slaves;
    var slaveDisposeBack = _.after(slaves.length, function () {
        try {
            this.server.close(callback);
        } catch (e) {}
    }.bind(this));

    for (var i = 0, l = slaves.length; i < l; i++) {
        this.logger.logDebug("Disposing the slave: " + slaves[i].toString());
        try {
            slaves[i].dispose(slaveDisposeBack);
        } catch (e) {}
    }
};

TestServer.prototype.addSlave = function (slave) {
    this.logger.logInfo("New slave connected: " + slave.toString());
    this.updateMatchingCampaignBrowsers(slave);
    this.slaves.push(slave);
    slave.once('disconnect', slaveDisconnected.bind(this, slave));
    slave.on('available', slaveAvailable.bind(this, slave));
    slave.on('unavailable', slaveUnavailable.bind(this, slave));
    if (slave.id) {
        var listeners = this.emit('slave-added-' + slave.id, slave);
        if (!listeners) {
            // disconnects any slave which has an unregistered id
            this.logger.logInfo("Id " + slave.id + " is not registered, slave will be disconnected.");
            slave.disconnect();
            return;
        }
    }
    slave.emitAvailable(); // this will trigger assignTasks if the slave is available
};

TestServer.prototype.addCampaign = function (campaign) {
    this.campaigns.push(campaign);
    campaign.once('finished', campaignFinished.bind(this, campaign));
    var slaveURL = this.getURL("slave");
    campaign.addResult({
        event: "serverAttached",
        homeURL: this.getURL("home"),
        slaveURL: slaveURL
    });
    this.slaves.forEach(this.updateMatchingCampaignBrowsers.bind(this));
    this.assignTasks();
};

TestServer.prototype.updateMatchingCampaignBrowsers = function (slave) {
    var res = [];
    // checks that the slave is connected:
    if (slave.socket) {
        this.campaigns.forEach(function (currentCampaign) {
            currentCampaign.browsers.forEach(function (currentBrowser) {
                if (currentBrowser.matches(slave)) {
                    res.push({
                        campaign: currentCampaign,
                        browser: currentBrowser
                    });
                }
            });
        });
    }
    slave.matchingCampaignBrowsers = res;
};

TestServer.prototype.assignTasks = function () {
    if (this.frozen) {
        return;
    }
    // automatically called when tasks could be assigned to slaves
    var campaigns = this.campaigns;
    for (var i = 0, l = campaigns.length; i < l; i++) {
        var currentCampaign = campaigns[i];
        currentCampaign.checkFinished();
    }
    var availableSlaves = this.availableSlaves;
    for (var k = availableSlaves.length - 1; k >= 0; k--) {
        var currentSlave = availableSlaves[k];
        currentSlave.findTask();
    }
};

TestServer.prototype.findCampaign = function (campaignId) {
    var campaigns = this.campaigns;
    for (var i = 0, l = campaigns.length; i < l; i++) {
        var curCampaign = campaigns[i];
        // campaignNumber is used if predictableUrls == true. The values are 1, 2, 3...
        // campaign id's values OTOH are timestamps, so there's no risk of collision.
        if (curCampaign.id == campaignId || curCampaign.campaignNumber == campaignId) {
            return curCampaign;
        }
    }
    return null;
};

TestServer.prototype.dispose = function (callback) {
    this.logger.logDebug("Disposing test server");
    var self = this;
    this.close(function () {
        self.logger.dispose();
        callback();
    });
};

module.exports = TestServer;