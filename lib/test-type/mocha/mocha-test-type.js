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
var path = require('path');

var BaseTestType = require('../base-test-type.js');
var FileSet = require('../../util/files/fileset');

var merge = require('../../util/merge.js');
var attester = require('../../attester');

/**
 * Send a test page, this is doing something only when serving test.html
 * In that case the page that looks like http://visionmedia.github.com/mocha/#browser-support
 *
 * The other resources are inside this.getBaseURL() and are structured as so
 * - lib/        Mocha lib files
 * - client/     Client files needed to connect to attester
 * - assertion/  Assertion libraries
 * - tests/      User defined test files
 */


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
        extraScripts: null,
        // could be either array or object
        ui: "bdd",
        ignoreLeaks: false,
        globals: [],
        assertion: "expect"
    };
    merge(testConfig, inputConfig);

    BaseTestType.call(this, campaign, testConfig);
    this.config.mochaSetup = buildSetupConfig(testConfig);

    // I have to do this because then I modify the description
    var testDescription = {
        head: [],
        body: []
    };
    var interactiveDescription = {
        head: [],
        body: []
    };
    merge(testDescription, require("./templates/test-page.json"));
    merge(interactiveDescription, require("./templates/interactive.json"));

    this.use("lib", attester.middlewares.staticFolder(path.dirname(require.resolve("mocha"))));
    this.use("client", attester.middlewares.staticFolder(path.join(__dirname, "client")));
    this.use("tests", attester.middlewares.staticFolder(path.join(__dirname, path.relative(__dirname, testConfig.files.rootDirectory))));

    var assertion = testConfig.assertion;
    var assertionDescription = {
        tagName: "script"
    };
    if (/^expect([\.\-]?js)?$/.test(assertion)) {
        assertionDescription.src = this.getBaseURL() + "/assertion/expect.js";
        this.use(attester.middlewares.staticFile.bind({
            page: "/assertion/expect.js",
            path: path.join(path.dirname(require.resolve("expect.js")), "expect.js")
        }));
    } else if (/chai(\.js)?/.test(assertion)) {
        assertionDescription.src = this.getBaseURL() + "/assertion/chai.js";
        this.use(attester.middlewares.staticFile.bind({
            page: "/assertion/chai.js",
            path: path.join(path.dirname(require.resolve("chai")), "chai.js")
        }));
    } else {
        // I hope the use gave a valid path for the assertion library
        assertionDescription.src = assertion;
    }

    testDescription.head.push(assertionDescription);
    interactiveDescription.head.push(assertionDescription);

    // Two test pages, one for automatic testing, one for interactive
    this.testPage("test.html", testDescription);
    this.testPage("interactive.html", interactiveDescription);
};

util.inherits(MochaTestType, BaseTestType);

MochaTestType.prototype.name = "Mocha Test";
MochaTestType.prototype.type = "mocha";
MochaTestType.prototype.debug = "interactive.html";

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
            url: "test.html?name=" + encodeURIComponent(filePath)
        });
    }, function () {
        callback();
    });
};

module.exports = MochaTestType;