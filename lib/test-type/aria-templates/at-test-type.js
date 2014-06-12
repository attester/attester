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
var TestsEnumerator = require('./at-tests-enumerator.js');

var url = require('../../url.js');
var merge = require('../../merge.js');
var attester = require('../../attester');

var sendAttesterTestSuite = function (req, res, next) {
    var output = ['Aria.classDefinition({$classpath:"MainTestSuite",$extends:"aria.jsunit.TestSuite",$constructor:function(){this.$TestSuite.constructor.call(this);\n'];
    var testCases = this.testCases;
    for (var i = 0, l = testCases.length; i < l; i++) {
        var curTest = testCases[i];
        output.push('this.addTests(', JSON.stringify(curTest.name), ');\n');
    }
    output.push('}});');
    res.setHeader('Content-Type', 'text/javascript');
    res.write(output.join(''));
    res.end();
};

var AriaTemplatesTests = function (campaign, inputConfig) {
    // Default values for the config:
    var testConfig = {
        rootFolderPath: '/',
        bootstrap: null,
        // the default value depends on the rootFolderPath, that's why it is processed later
        // moreover, it can be an array (legacy mode) or an object with "before" and "after" arrays, hence we can't make it an array here
        extraScripts: null,
        debug: true,
        memCheckMode: true,
        classpaths: {
            includes: [],
            excludes: []
        },
        files: {
            includes: [],
            excludes: []
        }
    };
    merge(testConfig, inputConfig);
    if (!testConfig.bootstrap) {
        testConfig.bootstrap = testConfig.rootFolderPath + 'aria/bootstrap.js';
    }

    BaseTestType.call(this, campaign, testConfig);
    var rootFolderPath = testConfig.rootFolderPath;

    var ariaConfig = {
        memCheckMode: testConfig.memCheckMode,
        debug: testConfig.debug,
        rootFolderPath: url.normalize(this.campaign.baseURL, rootFolderPath) + "/"
    };
    this.ariaConfig = ariaConfig;
    this.bootstrap = testConfig.bootstrap;

    this._testsEnumerator = new TestsEnumerator({
        resources: campaign.resources,
        files: testConfig.files,
        classpaths: testConfig.classpaths,
        rootFolderPath: testConfig.rootFolderPath
    }, this.campaign.logger);

    this.testPage("test.html", require("./templates/test-page.json"));
    this.testPage("interactive.html", require("./templates/interactive.json"));
    this.use((function (req, res, next) {
        if ("/MainTestSuite.js" === req.url) {
            sendAttesterTestSuite.call(this, req, res, next);
        } else {
            next();
        }
    }).bind(this));
    this.use(attester.middlewares.staticFolder(path.join(__dirname, 'client')));
};

util.inherits(AriaTemplatesTests, BaseTestType);

AriaTemplatesTests.prototype.name = "Aria Templates tests";
AriaTemplatesTests.prototype.type = "aria-templates";
AriaTemplatesTests.prototype.debug = "interactive.html";

AriaTemplatesTests.prototype.init = function (callback) {
    var self = this;
    var testsEnumerator = self._testsEnumerator;
    testsEnumerator.init(function () {
        self.testsTrees = self._testsEnumerator.testsTrees;
        var tests = testsEnumerator.testCases;
        self.testCases = tests;
        for (var i = 0, l = tests.length; i < l; i++) {
            var curTest = tests[i];
            curTest.url = 'test.html?testClasspath=' + encodeURIComponent(curTest.name);
        }
        callback();
    });
};

AriaTemplatesTests.prototype.dispose = function (baseURL) {
    this._testsEnumerator.dispose();
};

module.exports = AriaTemplatesTests;