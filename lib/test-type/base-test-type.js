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

/**
 * This is the base type to extend to write a new test type.
 * @param {Object} campaign
 * @param {Object} testConfig
 */
var BaseTestType = function (campaign, testConfig) {
    this.campaign = campaign;
    this.config = testConfig;

    /**
     * Array of tests trees. A tests tree has the following structure:
     * <ul>
     * <li>name: name of the test or test suite</li>
     * <li>url: url to run the test. It should be relative to the root of the test server, and start with /. The url
     * should only be defined for test cases, not for test suites, url is ignored in case subTests is defined.</li>
     * <li>results: array of 'error' or 'taskIgnored' events to be added to the results when creating tasks for this
     * test. If this property is defined, the url is not used and the test is not run.</li>
     * <li>subTests: array of sub tests trees (with the same structure, containing name and optionally subTests). This
     * property should only be present for test suites.</li>
     * </ul>
     */
    this.testsTrees = [];
};

BaseTestType.prototype = {};

/**
 * Name of the test type.
 * @type String
 */
BaseTestType.prototype.name = "Unknown test type";

/**
 * Method called right after the constructor. It allows the test type to do some asynchronous operations to get
 * initialized. Once initialized, a test type must have the testTrees array correctly defined.
 * @param {Function} callback
 */
BaseTestType.prototype.init = function (callback) {
    callback();
};

/**
 * Connect middleware which allows a test type to answer requests.
 */
BaseTestType.prototype.handleRequest = function (req, res, next) {
    next();
};

module.exports = BaseTestType;
