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

var connect = require("connect");
var fs = require("fs");

var url = require("../url");
var generator = require("../page-generator");
var attester = require("../attester");

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

    /**
     * Array of middlewares used by this test type. These must be connected onto the test server whenever a campaign is
     * running tests of this type
     */
    this.middlewares = [];
};

BaseTestType.prototype = {};

/**
 * Name of the test type.
 * @type String
 */
BaseTestType.prototype.name = "Unknown test type";

/**
 * How the test type is referenced in the configuration section
 * @type String
 */
BaseTestType.prototype.type = "unknown";

/**
 * Method called right after the constructor. It allows the test type to do some asynchronous operations to get
 * initialized. Once initialized, a test type must have the testTrees array correctly defined.
 * @param {Function} callback
 */
BaseTestType.prototype.init = function (callback) {
    callback();
};

/**
 * Register a middleware used by this test type while testing
 */
BaseTestType.prototype.use = function (route, middleware) {
    if (typeof route === "string") {
        this.middlewares.push([url.normalize(route), middleware]);
    } else {
        this.middlewares.push(["", route]);
    }
};

/**
 * Get an handler grouping all middlewares needed by this test type
 */
BaseTestType.prototype.getHandler = function () {
    normalizeExtraScripts.call(this);
    var app = connect();
    this.middlewares.forEach(function (middlewareArgs) {
        app.use(url.normalize(this.getBaseURL(), middlewareArgs[0]), middlewareArgs[1]);
    }, this);
    return app.handle.bind(app);
};

/**
 * Returns the base URL for all items served by this test type. It does not end with a slash.
 * @param {Boolean} absolute If true, returns a URL starting from the root of the server and including the campaign id,
 * otherwise, returns a URL relative to the campaign.
 */
BaseTestType.prototype.getBaseURL = function (absolute) {
    return url.normalize(absolute ? this.campaign.baseURL : "", "__attester__", this.type);
};

/**
 * Base test page served by this test type. Shouldn't be modified
 */
BaseTestType.prototype.baseTestPage = fs.readFileSync(__dirname + "/testPage.html").toString();

/**
 * Default content to be added in the base test page. Shouldn't be modified
 */
BaseTestType.prototype.baseTestContent = require("./test-content.json");

/**
 * Generate a middleware serving a test page for slaves.<br>
 * This method should be used to have a common page across all test types.<br>
 * Elements specific to this test type can be added through pageContent that has the structure described in module
 * page-generator.page
 */
BaseTestType.prototype.testPage = function (name, pageContent) {
    var app = connect();
    var templatePage = this.baseTestPage;
    this.use(attester.middlewares.template.bind({
        data: this,
        page: url.normalize(name),
        template: generateTemplate.bind(this, pageContent)
    }));
};

function generateTemplate(pageContent, model) {
    var fullContent = generator.merge(attester.testPage.getAll(), pageContent, this.baseTestContent);
    var page = generator.page(this.baseTestPage, fullContent, model, {
        src: prefixURL.bind(this),
        href: prefixURL.bind(this)
    });
    return page;
}

/**
 * Normalize `config.extraScripts` so that both legacy (array) and more flexible (object with "before" and "after")
 * modes work. Prefix all URLs with campaign URL.
 */

function normalizeExtraScripts() {
    this.config.extraScripts = this.config.extraScripts || {};
    var scripts = this.config.extraScripts;

    if (Array.isArray(scripts)) {
        // legacy mode; backward-compatibility code
        this.config.extraScripts = {
            before: [],
            after: encodeExtraScripts.call(this, scripts)
        };
    } else {
        // new mode: object with "before" and "after"
        scripts.before = encodeExtraScripts.call(this, scripts.before);
        scripts.after = encodeExtraScripts.call(this, scripts.after);
    }
}

/**
 * Prepend campaign base URL to all extra scripts.
 * @param {Array} scripts
 * @return {Array}
 */

function encodeExtraScripts(scripts) {
    scripts = scripts || [];
    if (typeof scripts == "string") {
        // possible if invoked from command line with only one value passed
        scripts = [scripts];
    }
    var newArr = [];

    for (var i = 0; i < scripts.length; i++) {
        newArr[i] = prefixURL.call(this, null, scripts[i], true);
    }
    return newArr;
}

function prefixURL(tag, value, encode) {
    if (/^https?:/.test(value)) {
        // if it contains the http(s) protocol there's no need to prefix it
        return value;
    } else {
        // Don't use the type here to avoid prefixing resources
        var normalized = url.normalize(this.campaign.baseURL, value);
        return encode === true ? encodeURI(normalized) : normalized;
    }
}

/**
 * URL of the debug interface where it should be possible to manually run tests.
 * @type String
 */
BaseTestType.prototype.debug = "";

/**
 * Dispose this test type. It's not normally needed, unless the test type needs to release
 * objects when it's not needed anymore. Typical objects are loggers.
 */
BaseTestType.prototype.dispose = function () {};

module.exports = BaseTestType;