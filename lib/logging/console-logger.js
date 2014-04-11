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

require('colors');

var Logger = require('./logger.js');

var LEVEL_COLORS = [
    ['red', 'bold'], 'yellow', 'green', null];
var LEVEL_NAMES = ['error', 'warn', 'info', 'debug'];

var ConsoleLogger = function (output) {
    this.output = output || process.stdout;
};

var buildId = function (loggersChain) {
    var somethingBefore = false;
    var leftParen = '['; // https://github.com/jshint/jshint/issues/1485
    var res = [leftParen];
    for (var i = 0, l = loggersChain.length; i < l; i++) {
        var curLogger = loggersChain[i];
        if (somethingBefore && (curLogger.name || curLogger.instanceId)) {
            res.push('.');
        }
        if (curLogger.name) {
            res.push(curLogger.name);
            somethingBefore = true;
        }
        if (curLogger.instanceId) {
            res.push('(');
            res.push(curLogger.instanceId);
            res.push(')');
            somethingBefore = true;
        }
    }
    res.push('] ');
    return res.join('');
};

ConsoleLogger.prototype.onLog = function (evt) {
    var color = LEVEL_COLORS[evt.level - 1];
    var message = evt.message;
    if (color) {
        if (Array.isArray(color)) {
            for (var i = 0, len = color.length; i < len; i++) {
                message = message[color[i]];
            }
        } else {
            message = message[color];
        }
    }
    var id = buildId(evt.loggersChain).grey;
    this.output.write(id + message + '\n');
};

ConsoleLogger.prototype.attach = function (logger) {
    logger.on('log', this.onLog.bind(this));
};

module.exports = ConsoleLogger;