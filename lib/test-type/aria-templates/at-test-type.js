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

var BaseTestType = require('../base-test-type.js');
var util = require('util');
var connect = require('connect');
var TestsEnumerator = require('./at-tests-enumerator.js');
var fs = require('fs');
var path = require('path');
var url = require('url');
var querystring = require('querystring');
var merge = require('../../merge.js');

var sendTest = function (req, res, next) {
    var parsedUrl = url.parse(req.url);
    if (parsedUrl.pathname != '/test.html') {
        return next();
    }
    var query = querystring.parse(parsedUrl.query);
    res.setHeader('Content-Type', 'text/html;charset=utf-8');
    var content = ['<!doctype html>\n<html><head><title>Aria Templates tester</title>'];
    content.push('<script type="text/javascript">var Aria=', JSON.stringify(this.ariaConfig), ';</script>');
    content.push('<script type="text/javascript" src="', escape(this.bootstrap), '"></script>');
    content.push('<script type="text/javascript">var __testClasspath=', JSON.stringify(query.testClasspath || ""), ';</script>');
    content.push('<script type="text/javascript" src="/__atjstestrunner__/aria-templates/run.js"></script>');
    content.push('</head><body><div id="TESTAREA"></div></body></html>');
    content = content.join('');
    res.write(content);
    res.end();
};

var AriaTemplatesTests = function (campaign, inputConfig) {
    // Default values for the config:
    var testConfig = {
        rootFolderPath : '/',
        bootstrap : null, // the default value depends on the rootFolderPath, that's why it is processed later
        debug : true,
        memCheckMode : true,
        classpaths : {
            includes : [],
            excludes : []
        },
        files : {
            includes : [],
            excludes : []
        }
    };
    merge(testConfig, inputConfig);
    if (!testConfig.bootstrap) {
        testConfig.bootstrap = testConfig.rootFolderPath + 'aria/bootstrap.js'
    }

    BaseTestType.call(this, campaign, testConfig);
    var rootFolderPath = testConfig.rootFolderPath;

    var ariaConfig = {
        memCheckMode : testConfig.memCheckMode,
        debug : testConfig.debug,
        rootFolderPath : rootFolderPath
    };
    this.ariaConfig = ariaConfig;
    this.bootstrap = testConfig.bootstrap;

    this._testsEnumerator = new TestsEnumerator({
        resources : campaign.resources,
        files : testConfig.files,
        classpaths : testConfig.classpaths,
        rootFolderPath : testConfig.rootFolderPath
    }, this.campaign.logger);

    var app = connect();
    app.use('/__atjstestrunner__/aria-templates', sendTest.bind(this));
    app.use('/__atjstestrunner__/aria-templates', connect.static(path.join(__dirname, 'client')));

    this.handleRequest = app.handle.bind(app);
};

util.inherits(AriaTemplatesTests, BaseTestType);

AriaTemplatesTests.prototype.name = "Aria Templates tests";

AriaTemplatesTests.prototype.init = function (callback) {
    var self = this;
    var testsEnumerator = self._testsEnumerator;
    testsEnumerator.init(function () {
        self.testsTrees = self._testsEnumerator.testsTrees;
        var tests = testsEnumerator.testCases;
        for (var i = 0, l = tests.length; i < l; i++) {
            var curTest = tests[i];
            curTest.url = '/__atjstestrunner__/aria-templates/test.html?testClasspath='
                    + encodeURIComponent(curTest.name);
        }
        callback();
    });
};

module.exports = AriaTemplatesTests;
