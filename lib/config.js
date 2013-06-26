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
 * Configuration comes from a file that overrides default values provided here.
 * It is also possible to override the values red in that file.
 *
 * The default configuration contains
 * - resources : Mapping between the exposed web server and the file system
 * - tests : Test configuration for each type of test, this is specific for the testing framework
 * - coverage : Specifies which files will be instrumented for code coverage
 * - test-reports : Map each test reporter to its output
 * - coverage-reports : Map each coverage reporter to its output
 * - browsers : List of browser waiting to be connected
 */
var fs = require('fs');
var yaml = require('js-yaml');

var merge = require('./merge.js');

function readConfigFile(configFile, logger) {
    var configFileContent;
    try {
        configFileContent = fs.readFileSync(configFile, "utf8");
    } catch (e) {
        logger.logError("Error while opening the configuration file: %s", [e]);
        return false;
    }
    try {
        return (/\.ya?ml$/i).test(configFile) ? yaml.load(configFileContent) : JSON.parse(configFileContent);
    } catch (e) {
        logger.logError("Unable to parse configuration file %s : %s", [configFile, e]);
        return false;
    }
}

var getDefaults = function () {
    return {
        'coverage': null,
        'resources': {
            '/': []
        },
        'test-reports': {
            'json-log-file': [],
            'json-file': [],
            'xml-file': [],
            'xml-directory': []
        },
        'coverage-reports': {
            'json-file': [],
            'lcov-file': []
        }
        // browsers by default is missing to let it run on whatever browser is connected
    };
};

// Match '<%= FOO %>' where FOO is a propString, eg. foo or foo.bar but not
// a method call like foo() or foo.bar().
var propStringTmplRe = /<%=\s*([a-z0-9_$]+(?:\.[a-z0-9_$]+)*)\s*%>/gi;

/**
 * Read the configuration file (if any) and generate a configuration object with the proper overrides.
 * @param  {String} configFile Configuration file path
 * @param  {Object} override Override some configuration parameters
 * @param  {Object} environment Environment configuration file
 * @param  {Object} logger
 * @return {Object} Configuration object
 */
exports.readConfig = function (configFile, override, environment, logger) {
    var configData = getDefaults();
    if (configFile) {
        configFile = readConfigFile(configFile, logger);
        if (configFile === false) {
            return;
        }
        merge(configData, configFile);
    }
    if (environment) {
        environment = readConfigFile(environment, logger);
        if (configFile !== false) {
            if (!configData.env) {
                configData.env = {};
            }
            merge(configData.env, environment);
        }
    }

    if (override) {
        var argvResources = override.resources;
        if (argvResources) { // "array-ify" entries in resources so they can get merged properly
            for (var key in argvResources) {
                if (argvResources.hasOwnProperty(key) && !Array.isArray(argvResources[key])) {
                    argvResources[key] = [argvResources[key]];
                }
            }
        }

        merge(configData, override);
    }
    return recurse(configData, function (value) {
        return replace(value, configData);
    });
};


/**
 * Recurse through objects and arrays executing a function for each non object.
 * The return value replaces the original value
 * @param {Object} value Object on which to recur
 * @param {Function} fn Callback function
 */

function recurse(value, fn) {
    if (Object.prototype.toString.call(value) === "[object Array]") {
        return value.map(function (value) {
            return recurse(value, fn);
        });
    } else if (Object.prototype.toString.call(value) === "[object Object]") {
        var obj = {};
        Object.keys(value).forEach(function (key) {
            obj[key] = recurse(value[key], fn);
        });
        return obj;
    } else {
        return fn(value);
    }
}

/**
 * Get the value of a configuration parameter that might use templates
 * @param {String} value Configuration value
 * @param {Object} configData Container object
 * @return {String} String with replacements
 */

function replace(value, configData) {
    if (typeof value != "string") {
        return value;
    } else {
        return value.replace(propStringTmplRe, function (match, path) {
            var value = get(configData, path);
            if (!(value instanceof Error)) {
                return value;
            } else {
                return match;
            }
        });
    }
}

// Keep a map of what I'm currently trying to get. Avoids circular references
var memoGet = {};
/**
 * Get the value of a json object at a given path
 * @param {Object} object Container object
 * @param {String} path Path, delimited by dots
 * @return {Object} value
 */

function get(object, path) {
    if (memoGet[path]) {
        return new Error("circular reference for " + path);
    }
    var parts = path.split(".");
    var obj = object;

    while (typeof obj === "object" && obj && parts.length) {
        var part = parts.shift();
        if (!(part in obj)) {
            return new Error("invalid path");
        }
        obj = obj[part];
    }
    memoGet[path] = true;
    // The replace can cause a circular reference
    var value = replace(obj, object);
    delete memoGet[path];
    return value;
}
