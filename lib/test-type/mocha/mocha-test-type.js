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
var path = require('path');
var url = require('url');
var merge = require('../../merge.js');
var FileSet = require('../../fileset');
var querystring = require('querystring');

var config;

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
var sendTest = function (req, res, next) {
    var parsedUrl = url.parse(req.url);
    if (parsedUrl.pathname !== '/test.html') {
        // We're asking for one the resources
        return next();
    }
    // Send the test
    var query = querystring.parse(parsedUrl.query);
    res.setHeader('Content-Type', 'text/html;charset=utf-8');
    var content = ['<!doctype html>\n<html><head><title>Mocha tests</title>'];
    content.push('<meta http-equiv="X-UA-Compatible" content="IE=edge" />');
    content.push('<script src="' + config.assertion + '"></script>');
    content.push('<link rel="stylesheet" href="/__attester__/mocha/lib/mocha.css" />');
    var extraScripts = this.extraScripts;
    for (var i = 0, l = extraScripts.length; i < l; i++) {
        content.push('<script type="text/javascript" src="', encodeURI(extraScripts[i]), '"></script>');
    }
    content.push('<script src="/__attester__/mocha/lib/mocha.js"></script>');
    content.push('<script src="/__attester__/mocha/client/connector.js"></script>');
    content.push('<script>mocha.setup(' + buildSetupConfig(config) + ');</script>');
    content.push('</head><body>');
    content.push('<div id="mocha"></div>');
    content.push('<div id="TESTAREA"></div>');
    content.push('<script src="/__attester__/mocha/tests/' + query.name + '"></script>');
    content.push('<script>mocha.run();</script>');
    content.push('</body></html>');
    content = content.join('');
    res.write(content);
    res.end();
};

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
    config = testConfig;

    BaseTestType.call(this, campaign, config);

    var app = connect();
    app.use('/__attester__/mocha', sendTest.bind(this));
    app.use('/__attester__/mocha/lib', connect['static'](path.dirname(require.resolve('mocha'))));
    app.use('/__attester__/mocha/client', connect['static'](path.join(__dirname, 'client')));
    app.use('/__attester__/mocha/tests', connect['static'](path.join(__dirname, path.relative(__dirname, testConfig.files.rootDirectory))));

    var assertion = config.assertion;
    if (/^expect([\.\-]?js)?$/.test(assertion)) {
        config.assertion = '/__attester__/mocha/assertion/expect.js';
        app.use('/__attester__/mocha/assertion', connect['static'](path.dirname(require.resolve('expect.js'))));
    } else if (/chai(\.js)?/.test(assertion)) {
        config.assertion = '/__attester__/mocha/assertion/chai.js';
        app.use('/__attester__/mocha/assertion', connect['static'](path.dirname(require.resolve('chai'))));
    }

    this.handleRequest = app.handle.bind(app);
    this.extraScripts = config.extraScripts;
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