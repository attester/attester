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

var ConsoleReport = function (logger, campaign, slowTestThreshold) {
    this.logger = logger;
    this.campaign = campaign;
    this.slowTestThreshold = slowTestThreshold || 0;
};

var eventTypes = {
    tasksList: function (event) {
        this.logger.logInfo("Total %d tasks to be executed.", [this.campaign.remainingTasks]);
    },
    campaignFinished: function (event) {
        this.logger.logInfo("Campaign finished.");
    },
    taskIgnored: function (event) {
        this.logger.logWarn("Skipping %s", [event.name]);
    },
    taskFinished: function (event) {
        var taskId = event.taskId;

        var task = this.campaign.jsonReport.tasks[taskId];
        var taskName = task.name;

        var browser = this.campaign.tasks[taskId].browser;
        var browserName = browser.name || "default browser";
        var browserRemainingTasks = browser.pendingTasks;

        if (task.nbAsserts != null) {
            var totalRemainingTasks = this.campaign.remainingTasks;
            var duration = event.time - task.startTime;

            var msg = "[%s s] [%s] [%d left, %d total] %s: %d assert(s)";
            if (task.nbFailures > 0 || task.nbErrors > 0) {
                msg = task.nbFailures ? (msg + "; " + task.nbFailures + " failed") : msg;
                msg = task.nbErrors ? (msg + "; " + task.nbErrors + " error(s)") : msg;
                msg = msg.yellow.bold; // there'll be enough red from the earlier error itself
            } else if (this.slowTestThreshold && duration > this.slowTestThreshold) {
                msg = msg.bold.inverse;
            }

            duration = (duration / 1000).toFixed(2);
            this.logger.logInfo(msg, [duration, browserName, browserRemainingTasks, totalRemainingTasks, taskName, task.nbAsserts]);
        } else {
            this.logger.logInfo("%s", [taskName]);
        }

        if (event.restartPlanned) {
            this.logger.logWarn("%s will be restarted", [taskName]);
        }
        if (browserRemainingTasks === 0) {
            this.logger.logInfo("All tasks finished for browser: ", [browserName]);
        }
    },
    error: function (event) {
        var name = event.name || "";
        var method = event.method || "";
        if (name) {
            if (method) {
                name = name + "." + method;
            }
        } else {
            name = event.taskName || "";
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