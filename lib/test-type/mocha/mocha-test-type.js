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

var util = require('util');
var connect = require('connect');
var path = require('path');

var BaseTestType = require('../base-test-type.js');
var FileSet = require('../../fileset');

var merge = require('../../merge.js');

/**
 * Send a test page, this is doing something only when serving test.html
 * In that case the page that looks like http://visionmedia.github.com/mocha/#browser-support
 *
 * The other resources are inside /attester__/mocha/ and are structured as so
 * - lib/        Mocha lib files
 * - client/     Client files needed to connect to atteter
 * - assertion/  Assertion libraries
 * - tests/      User defined test files
 */
var template = require('../../middlewares/template');

/**
 * Generates the configuration object for mocha.setup()
 */
var buildSetupConfig = function (config) {
    var options = {
        ui: config.ui
    };
    if (config.ignoreLeaks === true) {
        // because of https://github.com/visionmedia/mocha/pull/781 we cannot set
        // ignoreLeaks : false
        options.ignoreLeaks = true;
    }
    if (config.globals.length !== 0) {
        options.globals = config.globals.slice();
    }
    return JSON.stringify(options);
};

var MochaTestType = function (campaign, inputConfig) {
    // Default values for the configuration object
    var testConfig = {
        files: {
            rootDirectory: process.cwd(),
            includes: [],
            excludes: []
        },
        extraScripts: [],
        ui: 'bdd',
        ignoreLeaks: false,
        globals: [],
        assertion: 'expect'
    };
    merge(testConfig, inputConfig);

    BaseTestType.call(this, campaign, testConfig);

    var app = connect();
    var mochaSetup = buildSetupConfig(testConfig);
    app.use('/__attester__/mocha', template.bind({
        data: {
            config: testConfig,
            mochaSetup: mochaSetup
        },
        page: "/test.html",
        path: path.join(__dirname, "templates", "testPage.html")
    }));
    app.use('/__attester__/mocha/lib', connect['static'](path.dirname(require.resolve('mocha'))));
    app.use('/__attester__/mocha/client', connect['static'](path.join(__dirname, 'client')));
    app.use('/__attester__/mocha/tests', connect['static'](path.join(__dirname, path.relative(__dirname, testConfig.files.rootDirectory))));

    var assertion = testConfig.assertion;
    if (/^expect([\.\-]?js)?$/.test(assertion)) {
        testConfig.assertion = '/__attester__/mocha/assertion/expect.js';
        app.use('/__attester__/mocha/assertion', connect['static'](path.dirname(require.resolve('expect.js'))));
    } else if (/chai(\.js)?/.test(assertion)) {
        testConfig.assertion = '/__attester__/mocha/assertion/chai.js';
        app.use('/__attester__/mocha/assertion', connect['static'](path.dirname(require.resolve('chai'))));
    }
    app.use('/__attester__/mocha', template.bind({
        data: {
            config: testConfig,
            mochaSetup: mochaSetup,
            // The test list is available only after initialization
            tests: this.testsTrees
        },
        page: "/interactive.html",
        path: path.join(__dirname, "templates", "interactive.html")
    }));

    this.handleRequest = app.handle.bind(app);
    this.debug = "/__attester__/mocha/interactive.html";
    this.extraScripts = testConfig.extraScripts;
};

util.inherits(MochaTestType, BaseTestType);

MochaTestType.prototype.name = "Mocha Test";

/**
 * Initialize this test script by extending the file sets in the configuration object.
 * @param {Function} callback
 */
MochaTestType.prototype.init = function (callback) {
    var testType = this;
    var files = new FileSet(this.config.files);
    files.iterate(function (filePath) {
        testType.testsTrees.push({
            name: filePath,
            url: "/__attester__/mocha/test.html?name=" + encodeURIComponent(filePath)
        });
    }, function () {
        callback();
    });
};

module.exports = MochaTestType;