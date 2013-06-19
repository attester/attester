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

var connect = require('connect');

var BaseTestType = require('../base-test-type.js');
var TestsEnumerator = require('./at-tests-enumerator.js');

var merge = require('../../merge.js');
var template = require('../../middlewares/template');

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
        extraScripts: [],
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
        rootFolderPath: rootFolderPath
    };
    this.ariaConfig = ariaConfig;
    this.bootstrap = testConfig.bootstrap;
    this.extraScripts = testConfig.extraScripts;

    this._testsEnumerator = new TestsEnumerator({
        resources: campaign.resources,
        files: testConfig.files,
        classpaths: testConfig.classpaths,
        rootFolderPath: testConfig.rootFolderPath
    }, this.campaign.logger);

    var app = connect();
    app.use('/__attester__/aria-templates', template.bind({
        data: {
            ariaConfig: JSON.stringify(ariaConfig),
            config: testConfig
        },
        page: "/test.html",
        path: path.join(__dirname, "templates", "testPage.html")
    }));
    app.use('/__attester__/aria-templates', template.bind({
        data: {
            ariaConfig: JSON.stringify(ariaConfig),
            config: testConfig
        },
        page: "/interactive.html",
        path: path.join(__dirname, "templates", "interactive.html")
    }));
    app.use('/__attester__/aria-templates', (function (req, res, next) {
        if ("/MainTestSuite.js" === req.url) {
            sendAttesterTestSuite.call(this, req, res, next);
        } else {
            next();
        }
    }).bind(this));
    app.use('/__attester__/aria-templates', connect['static'](path.join(__dirname, 'client')));

    this.handleRequest = app.handle.bind(app);
    this.debug = "/__attester__/aria-templates/interactive.html";
};

util.inherits(AriaTemplatesTests, BaseTestType);

AriaTemplatesTests.prototype.name = "Aria Templates tests";

AriaTemplatesTests.prototype.init = function (callback) {
    var self = this;
    var testsEnumerator = self._testsEnumerator;
    testsEnumerator.init(function () {
        self.testsTrees = self._testsEnumerator.testsTrees;
        var tests = testsEnumerator.testCases;
        self.testCases = tests;
        for (var i = 0, l = tests.length; i < l; i++) {
            var curTest = tests[i];
            curTest.url = '/__attester__/aria-templates/test.html?testClasspath=' + encodeURIComponent(curTest.name);
        }
        callback();
    });
};

module.exports = AriaTemplatesTests;