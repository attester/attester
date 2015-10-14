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
var Q = require('q');

var TestServer = require("../test-server/test-server.js");

var attester = require("../attester");
var config = attester.config;

/**
 * The server module is responsible of starting a test server which is then serving files to connected slaves and
 * gathering results.
 */
var testServer = null;
var testServerReady = false;

/**
 * @return {Promise}
 */

function closeServer() {
    if (!testServerReady) {
        logResetDone();
        return Q();
    }
    attester.logger.logDebug("Closing the server");
    testServerReady = false;

    if (testServer) {
        var deferred = Q.defer();
        // TODO make testServer.dispose return promise
        testServer.dispose(function () {
            testServer = null;
            deferred.resolve();
        });
        logResetDone();
        return deferred.promise;
    } else {
        logResetDone();
        return Q();
    }
}

function logResetDone() {
    attester.logger.logDebug("__reset__ server done");
}

exports.__init__ = function () {
    attester.event.on("attester.campaign.initialized", exports.addCampaign);
};

// It is enough to have a single server, it should be able to serve multiple campaigns
exports.create = function (callback) {
    testServer = new TestServer({
        predictableUrls: config["predictable-urls"],
        shutdownOnCampaignEnd: config["shutdown-on-campaign-end"],
        frozen: config["server-only"],
        flashPolicyPort: config["flash-policy-port"],
        flashPolicyServer: config["flash-policy-server"],
        taskTimeout: config["task-timeout"],
        maxTaskRestarts: config["max-task-restarts"],
        taskRestartOnFailure: config["task-restart-on-failure"]
    }, attester.logger);
    testServer.server.on("error", function (error) {
        testServer.logger.logError("Web server error: %s", [error]);
        attester.event.emit("server.error");
    });

    portfinder.getPort({
        port: config.port,
        host: config.host
    }, function (err, port) {
        if (err) {
            attester.event.emit("server.error", "Can't start the server: %s", [err]);
            return;
        }
        if (port != config.port && config.port > 0) {
            // logging error instead of a warning so it's more visible in the console
            attester.logger.logError("Port %d unavailable; using %d instead.", [config.port, port]);
        }
        testServer.listen(port, config.host, function () {
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
 * Add a given middleware to the one already served. This should normally be called by plugins that want to include
 * global middlewares to be served on any campaign
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
    return closeServer();
};