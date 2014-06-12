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

var Logger = require('./logger.js');

var levels = {
    'trace': Logger.LEVEL_TRACE,
    'debug': Logger.LEVEL_DEBUG,
    'info': Logger.LEVEL_INFO,
    'warn': Logger.LEVEL_WARN,
    'error': Logger.LEVEL_ERROR
};

var logAdapter = function (logger, type) {
    var level = levels[type] || Logger.LEVEL_ERROR;
    if (logger.isEnabled(level)) {
        var msg = [];
        for (var i = 2, l = arguments.length; i < l; i++) {
            var arg = arguments[i];
            msg[i - 2] = arg;
        }
        logger.log(level, msg.join(''));
    }
    return this;
};

var SocketIOLogger = function (name, instanceId, parent) {
    var logger = new Logger(name, instanceId, parent);
    this.log = logAdapter.bind(this, logger);
    this.error = logAdapter.bind(this, logger, 'error');
    this.warn = logAdapter.bind(this, logger, 'warn');
    this.info = logAdapter.bind(this, logger, 'info');
    this.debug = logAdapter.bind(this, logger, 'trace'); // Socket.io debug logging is way too verbose for 'debug'
    this.logger = logger;
};

SocketIOLogger.prototype.dispose = function () {
    this.logger.dispose();
};

module.exports = SocketIOLogger;