/*
 * Copyright 2013 Amadeus s.a.s.
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

var portfinder = require("portfinder");

var TestServer = require("../test-server/server.js");

var attester = require("../attester");
var config = attester.config;

/**
 * The server module is responsible of starting a test server which is then serving
 * files to connected slaves and gathering results.
 */
var testServer = null;
var testServerReady = false;

function closeServer() {
    if (!testServerReady) {
        return;
    }
    attester.logger.logDebug("Closing the server");
    testServerReady = false;
    attester.event.emit("attester.please.hold");
    if (testServer) {
        testServer.dispose(function () {
            testServer = null;
            attester.event.emit("attester.please.continue");
        });
    }
}

exports.__init__ = function () {
    attester.event.on("attester.campaign.initialized", exports.addCampaign);
    attester.event.on("attester.closing", closeServer);
};

// It is enough to have a single server, it should be able to serve multiple campaigns
exports.create = function (callback) {
    testServer = new TestServer({
        frozen: config["server-only"],
        flashPolicyPort: config["flash-policy-port"],
        flashPolicyServer: config["flash-policy-server"],
        taskTimeout: config["task-timeout"]
    }, attester.logger);
    testServer.server.on("error", function (error) {
        testServer.logger.logError("Web server error: %s", [error]);
        attester.event.emit("server.error");
    });

    portfinder.basePort = config.port;
    portfinder.getPort(function (err, port) {
        if (err) {
            attester.event.emit("server.error", "Can't start the server: %s", [err]);
            return;
        }
        if (port != config.port && config.port > 0) {
            // logging error instead of a warning so it's more visible in the console
            attester.logger.logError("Port %d unavailable; using %d instead.", [config.port, port]);
        }
        testServer.server.listen(port, function () {
            testServerReady = true;
            attester.event.emit("server.listening");
            callback();
        });
    });
};

exports.addCampaign = function (campaign) {
    testServer.addCampaign(campaign);
};

/**
 * Add a given middleware to the one already served. This should normally be called by plugins
 * that want to include global middlewares to be served on any campaign
 */
exports.use = function (path, middleware) {
    if (!testServerReady) {
        attester.event.once("server.listening", addMiddleware.bind(this, path, middleware));
    } else {
        addMiddleware(path, middleware);
    }
};

function addMiddleware(path, middleware) {
    if (!middleware) {
        middleware = path;
        path = "/";
    }
    testServer.app.use(path, middleware);
}

exports.__reset__ = function () {
    attester.event.off("attester.campaign.initialized", exports.addCampaign);
    attester.event.off("attester.closing", closeServer);
    // In case I reset the module without raising attester.closing
    closeServer();
};