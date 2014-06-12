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

var util = require("util");
var events = require("events");

var Logger = function (name, instanceId, parent) {
    if (typeof instanceId == "object" && parent == null) {
        // instanceId may be missing
        parent = instanceId;
        instanceId = null;
    }
    this.name = name || null;
    this.logLevels = {
        '.': Logger.LEVEL_INFO
    };
    this.instanceId = instanceId || null;
    if (parent) {
        parent.addChild(this);
    }
};

util.inherits(Logger, events.EventEmitter);

Logger.LEVEL_TRACE = 5;
Logger.LEVEL_DEBUG = 4;
Logger.LEVEL_INFO = 3;
Logger.LEVEL_WARN = 2;
Logger.LEVEL_ERROR = 1;

Logger.prototype.onChildLog = function (evt) {
    var logger = this;
    var loggersChain = evt.loggersChain.slice(0);
    loggersChain.unshift(logger);
    logger.emit('log', {
        loggersChain: loggersChain,
        level: evt.level,
        message: evt.message,
        object: evt.object
    });
};

Logger.prototype.addChild = function (childLogger) {
    childLogger.on('log', this.onChildLog.bind(this));
    childLogger.logLevels = this.logLevels[childLogger.name] || this.logLevels['*'] || this.logLevels;
};

Logger.prototype.isEnabled = function (level) {
    return (level <= this.logLevels['.']);
};

Logger.prototype.log = function (level, message, args, object) {
    if (this.isEnabled(level)) {
        if (args) {
            args.unshift(message);
            message = util.format.apply(util, args);
        }
        this.emit('log', {
            loggersChain: [this],
            level: level,
            message: message,
            object: object
        });
    }
};

Logger.prototype.logError = function (message, args, object) {
    this.log(Logger.LEVEL_ERROR, message, args, object);
};

Logger.prototype.logWarn = function (message, args, object) {
    this.log(Logger.LEVEL_WARN, message, args, object);
};

Logger.prototype.logInfo = function (message, args, object) {
    this.log(Logger.LEVEL_INFO, message, args, object);
};

Logger.prototype.logDebug = function (message, args, object) {
    this.log(Logger.LEVEL_DEBUG, message, args, object);
};

Logger.prototype.logTrace = function (message, args, object) {
    this.log(Logger.LEVEL_TRACE, message, args, object);
};

Logger.prototype.dispose = function () {
    this.removeAllListeners();
};

module.exports = Logger;