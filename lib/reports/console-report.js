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

var ConsoleReport = function (logger, slowTestThreshold) {
    this.logger = logger;
    this.slowTestThreshold = slowTestThreshold || 0;
};

var eventTypes = {
    tasksList: function (event) {
        this.logger.logInfo("Total %d tasks to be executed.", [event.remainingTasks]);
    },
    campaignFinished: function (event) {
        this.logger.logInfo("Campaign finished.");
    },
    taskIgnored: function (event) {
        this.logger.logWarn("Skipping %s", [event.name]);
    },
    testFinished: function (event) {
        if (event.method) {
            return;
        }

        if (event.asserts != null) {
            var msg = "[%s s] [%s] [%d left, %d total] %s: %d assert(s)";
            if (this.slowTestThreshold && event.duration > this.slowTestThreshold) {
                msg = msg.bold.inverse;
            }
            var duration = (event.duration / 1000).toFixed(2);
            this.logger.logInfo(msg, [duration, event.browserName || "default browser", event.browserRemainingTasks - 1, event.remainingTasks - 1, event.name, event.asserts]);
        } else {
            this.logger.logInfo("%s", [event.name]);
        }
    },
    taskFinished: function (event) {
        if (event.browserRemainingTasks === 0) {
            this.logger.logInfo("All tasks finished for browser: ", [event.browserName]);
        }
    },
    error: function (event) {
        var name = event.name || "";
        var method = event.method || "";
        if (name && method) {
            name = name + "." + method;
        }
        var err = event.error || {};
        var message = err.message || "";
        if (name) {
            this.logger.logError("Error in %s: %s", [name, message]);
        } else {
            this.logger.logError("Error: %s", [message]);
        }
    },
    serverAttached: function serverAttached(event) {
        this.logger.logInfo("Server URL: %s", [event.homeURL]);
    }
};

ConsoleReport.prototype = {};

ConsoleReport.prototype.addResult = function (event) {
    var eventName = event.event;
    var eventHandler = eventTypes[eventName];
    if (eventHandler) {
        eventHandler.call(this, event);
    }
};

module.exports = ConsoleReport;