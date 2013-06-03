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

var ConsoleReport = function (campaign, logger, slowTestThreshold) {
    this.campaign = campaign;
    this.logger = logger;
    this.slowTestThreshold = slowTestThreshold || 0;
};

var getRemainingTasksForBrowser = function (browserInfo) {
    var campaignBrowser = this.campaign.findCampaignBrowser(browserInfo);
    if (campaignBrowser) {
        return campaignBrowser.tasksQueue.length;
    } else {
        return -1;
    }
};

var eventTypes = {
    tasksList : function (event) {
        this.logger.logInfo("Total %d tasks to be executed.", [event.remainingTasks]);
    },
    campaignFinished: function campaignFinished(event) {
        this.logger.logInfo("Campaign finished.");
    },
    taskIgnored: function (event) {
        this.logger.logWarn("Skipping %s", [event.name]);
    },
    testFinished: function testFinished(event) {
        if (!event.method) {
            if (event.asserts != null) {
                var msg = "[%s s] [%s] [%d left, %d total] %s: %d assert(s)";
                if (this.slowTestThreshold && event.duration > this.slowTestThreshold) {
                    msg = msg.bold.inverse;
                }
                var duration = (event.duration / 1000).toFixed(2);
                var remainingTasksForBrowser = getRemainingTasksForBrowser.call(this, event.browserInfo);
                var remainingTasksTotal = event.remainingTasks;
                this.logger.logInfo(msg, [duration, event.browserInfo.shortName, remainingTasksForBrowser,
                        remainingTasksTotal, event.name, event.asserts]);
            } else {
                this.logger.logInfo("%s", [event.name]);
            }
        }
    },
    error: function error(event) {
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
