/*
 * Copyright 2013 Amadeus s.a.s.
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

var colors = require("colors");
var fs = require("fs");
var yaml = require("js-yaml");
var Q = require('q');

var merge = require("../util/merge");
var attester = require("../attester");

/**
 * Default configuration values
 */
exports.getDefaults = function () {
    return {
        'colors': process.stdout.isTTY,
        'flash-policy-port': 0,
        'flash-policy-server': false,
        'heartbeats': 2000,
        'ignore-errors': false,
        'ignore-failures': false,
        'live-results': true,
        'log-level': 3,
        'max-task-restarts': 5,
        'phantomjs-instances': process.env.npm_package_config_phantomjsInstances || 0,
        'phantomjs-path': 'phantomjs',
        'port': 7777,
        'host': '0.0.0.0',
        'predictable-urls': false,
        'shutdown-on-campaign-end': true,
        'slow-test-threshold': 2500,
        'task-timeout': 5 * 60 * 1000 // 5 minutes
    };
};

// This is where things are stored
var internalConfig = exports.getDefaults();
var cachedParsedConfig = null;

/**
 * Read a configuration file synchronously.
 * The file can be either JSON or YAML. The method returns the parsed JSON object
 * @param {String} configFile File path
 */
exports.readFile = function (configFile, logger) {
    var configFileContent;
    try {
        configFileContent = fs.readFileSync(configFile, "utf8");
    } catch (e) {
        attester.logger.logError("Error while opening the configuration file: %s", [e]);
        return false;
    }
    try {
        return (/\.ya?ml$/i).test(configFile) ? yaml.load(configFileContent) : JSON.parse(configFileContent);
    } catch (e) {
        attester.logger.logError("Unable to parse configuration file %s : %s", [configFile, e]);
        return false;
    }
};

/**
 * Set the global configuration of attester.
 *
 * If only one parameter is specified it merges this object into the attester configuration
 *
 * If two parameters are given, the first must be a string specifying the first level key.
 */
exports.set = function (path, config) {
    config = config || path;
    if (typeof path === "string") {
        if (!internalConfig[path]) {
            internalConfig[path] = {};
        }
        merge(internalConfig[path], config);
    } else {
        merge(internalConfig, config);
    }
    cachedParsedConfig = null;
    defineProperties(exports, Object.keys(internalConfig));

    // set whether the logs output should be colored or not
    colors.mode = config["colors"] ? "console" : "none";

    attester.event.emit("attester.config.available");
};

/**
 * Parse a configuration object replacing templates with their actual values
 *
 * The configuration passed as parameter is merged with the internal configuration
 * to allow the template engine to access variables from the environment or global
 * configuration.
 *
 * However only the keys defined in the original configuration are returned.
 * If not config was defined then it returns the parsed internalConfiguration.
 */
exports.parse = function (config) {
    var scope = {};
    merge(scope, internalConfig);
    merge(scope, config || {});

    var parsed = recurse(scope, function (value) {
        return replace(value, scope);
    });
    if (config) {
        var result = {};
        Object.keys(config).forEach(function (key) {
            result[key] = parsed[key];
        });
        return result;
    } else {
        return parsed;
    }
};

/**
 * Get a value from the internal configuration, but make sure that it has been parsed
 */
exports.getParsed = function (property) {
    if (!cachedParsedConfig) {
        cachedParsedConfig = exports.parse();
    }
    var value = get(cachedParsedConfig, property);
    return value instanceof Error ? undefined : value;
};


// Match '<%= FOO %>' where FOO is a propString, eg. foo or foo.bar but not
// a method call like foo() or foo.bar().
var propStringTmplRe = /<%=\s*([a-z0-9_$]+(?:\.[a-z0-9_$]+)*)\s*%>/gi;

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

function defineProperties(host, properties) {
    for (var i = 0; i < properties.length; i += 1) {
        if (!(properties[i] in host)) {
            Object.defineProperty(host, properties[i], {
                configurable: false,
                enumerable: true,
                get: exports.getParsed.bind(host, properties[i])
            });
        }
        // else the getter is already working fine
    }
}

exports.__reset__ = function () {
    memoGet = {};
    internalConfig = exports.getDefaults();
    cachedParsedConfig = null;

    attester.logger.logDebug("__reset__ config done");
    return Q();
};