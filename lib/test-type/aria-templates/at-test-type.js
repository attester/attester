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

var sendTest = function (req, res, next) {
    var parsedUrl = url.parse(req.url);
    var automatic = (parsedUrl.pathname == '/test.html');
    if (!automatic) {
        if (parsedUrl.pathname == '/MainTestSuite.js') {
            return sendAttesterTestSuite.call(this, req, res, next);
        }
        if (parsedUrl.pathname != '/interactive.html') {
            return next();
        }
    }
    var query = querystring.parse(parsedUrl.query);
    res.setHeader('Content-Type', 'text/html;charset=utf-8');
    var content = ['<!doctype html>\n<html><head><title>Aria Templates tester</title>'];
    content.push('<meta http-equiv="X-UA-Compatible" content="IE=edge" />');
    content.push('<script type="text/javascript">var Aria=', JSON.stringify(this.ariaConfig), ';</script>');
    content.push('<script type="text/javascript" src="', encodeURI(this.bootstrap), '"></script>');
    var extraScripts = this.extraScripts;
    for (var i = 0, l = extraScripts.length; i < l; i++) {
        content.push('<script type="text/javascript" src="', encodeURI(extraScripts[i]), '"></script>');
    }
    if (automatic) {
        content.push('<script type="text/javascript">var __testClasspath=', JSON.stringify(query.testClasspath || ""), ';</script>');
        content.push('<script type="text/javascript" src="/__attester__/aria-templates/run.js"></script>');
    } else {
        content.push('<style>html{overflow:hidden;} body{margin:0px;background-color:#FAFAFA;font-family: tahoma,arial,helvetica,sans-serif;font-size: 11px;}</style>');
    }
    content.push('</head><body>');
    if (automatic) {
        content.push('<div id="TESTAREA"></div>');
    } else {
        content.push('<div id="root"></div><script type="text/javascript">var width={min:180};var height={min:342};aria.core.DownloadMgr.updateRootMap({"MainTestSuite":"./"});aria.core.DownloadMgr.updateUrlMap({"MainTestSuite":"MainTestSuite.js"});Aria.loadTemplate({rootDim:{width:width,height:height},classpath:"aria.tester.runner.view.main.Main",div:"root",width:width,height:height,moduleCtrl:{classpath:"aria.tester.runner.ModuleController"}});</script>');
    }
    content.push('</body></html>');
    content = content.join('');
    res.write(content);
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
    app.use('/__attester__/aria-templates', sendTest.bind(this));
    app.use('/__attester__/aria-templates', connect['static'](path.join(__dirname, 'client')));

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
        self.testCases = tests;
        for (var i = 0, l = tests.length; i < l; i++) {
            var curTest = tests[i];
            curTest.url = '/__attester__/aria-templates/test.html?testClasspath=' + encodeURIComponent(curTest.name);
        }
        callback();
    });
};

module.exports = AriaTemplatesTests;