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

var browserMatch = require('../browser-detection.js').browserMatch;

var buildNameFromConfig = function (config) {
    var name = "";
    if (config.browserName) {
        name = config.browserName;
        if (config.majorVersion != null) {
            name += " " + config.majorVersion;
            if (config.minorVersion != null) {
                name += "." + config.minorVersion;
                if (config.revision != null) {
                    name += "." + config.revision;
                }
            }
        }
    }
    if (config.os) {
        name += " (" + config.os + ")";
    }
    return name;
};

var Browser = function (config) {
    this.name = config.name || buildNameFromConfig(config); // the browser name is only used for display in test results
    this.config = config;

    /**
     * Contains tasks not yet dispatched.
     */
    this.tasksQueue = [];
    /**
     * Counts tasks not yet finished. Will be always >= this.tasksQueue.length
     */
    this.pendingTasks = 0;
};

Browser.prototype = {};

Browser.prototype.addTask = function (task) {
    this.pendingTasks++;
    this.tasksQueue.push(task);
};

Browser.prototype.hasTasks = function () {
    return this.tasksQueue.length > 0;
};

Browser.prototype.takeTask = function () {
    return this.tasksQueue.shift();
};

Browser.prototype.matches = function (slave) {
    return browserMatch(this.config, slave.browserInfo);
};

Browser.prototype.onTaskFinished = function () {
    this.pendingTasks--;
};

module.exports = Browser;