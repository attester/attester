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

var Q = require('q');

var attester = require("../attester");
var Logger = require("../logging/logger");

var defaultLogger = module.exports = new Logger("attester");

// Expose also some methods to mock the logger
var originalMethods = {};
var mockable = ["logError", "logWarn", "logInfo", "logDebug"];
for (var i = 0; i < mockable.length; i += 1) {
    originalMethods[mockable[i]] = defaultLogger[mockable[i]];
}

defaultLogger._mock = function (mock) {
    for (var method in mock) {
        if (mockable.indexOf(method) !== -1) {
            defaultLogger[method] = mock[method];
        }
    }
};
defaultLogger.__reset__ = function () {
    for (var i = 0; i < mockable.length; i += 1) {
        defaultLogger[mockable[i]] = originalMethods[mockable[i]];
    }

    attester.logger.logDebug("__reset__ logger done");
    return Q();
};