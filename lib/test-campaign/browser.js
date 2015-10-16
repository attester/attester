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

var browserMatch = require('../util/browser-detection.js').browserMatch;

/**
 * @see Browser.prototype.parseBrowserConfig
 * <li> Usage: </li>
 * <li> Input: 'Chrome >=30 on Desktop Windows as Chrome Canary 30' </li>
 * <li> Match: [1] = 'Chrome', [2] = '>=30', [3] = 'Desktop Windows', [4] = 'Chrome Canary 30' </li>
 * Parts 2, 3, 4 are optional, will be undefined if not found.
 */
var _browserCfgRegex = /^\s*(\S+)(?:\s+(\W*\d\S*))?(?:\s+on\s+(.*?))?(?:\s+as\s+(.*?))?\s*$/i;

var buildNameFromConfig = function (config) {
    if (config.displayAs) {
        return config.displayAs;
    }

    var name = "";
    if (config.browserName) {
        name = config.browserName;
        if (config.browserVersion != null) {
            name += " " + config.browserVersion;
        }
    }
    if (config.os) {
        name += " (" + config.os + ")";
    }
    return name;
};

var Browser = function (cfgString) {
    /**
     * {browserName, browserVersion, os, displayAs}
     */
    this.config = Browser.parseBrowserConfig(cfgString);
    /**
     * Display name for the logs
     */
    this.name = buildNameFromConfig(this.config);
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

Browser.prototype.getJsonInfo = function () {
    return {
        name: this.name,
        remainingTasks: this.pendingTasks,
        runningTasks: this.pendingTasks - this.tasksQueue.length
    };
};

/**
 * @static
 */
Browser.parseBrowserConfig = function (cfgString) {
    if (cfgString == null || cfgString === "") {
        return {}; // default, unrestricted browser
    }

    var match = _browserCfgRegex.exec(cfgString);
    if (match === null) {
        return {
            browserName: "unparsable browser"
        };
    } else {
        // Some of the entries can be undefined, it's fine.
        // Note that garbage input may also produce valid match.
        return {
            browserName: match[1],
            browserVersion: match[2],
            os: match[3],
            displayAs: match[4]
        };
    }
};

module.exports = Browser;