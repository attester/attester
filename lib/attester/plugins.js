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

var attester = require("../attester");
var logger = attester.logger;
var merge = require("../merge");

/**
 * This module describe the interface of plugins.
 *
 * A plugin has two interfaces:
 * - the user, she needs to load a plugin and configure it
 * - the plugin developer, she needs to get the user configuration and modify attester behavior
 */

var pluginsConfig = {};
var requiredPlugins = {};
var pendingRequire = [];

/**
 * Set the plugin configuration.
 * It returns a copy of the configuration set or the previous one if no config was specified.
 * The configuration is not merged but it simply replaces any old configuration.
 */
exports.config = function (name, config) {
    if (config) {
        var newConfig = {};
        merge(newConfig, config);
        pluginsConfig[name] = newConfig;
    }

    var returnValue = {};
    merge(returnValue, pluginsConfig[name] || {});
    return returnValue;
};

/**
 * Require a plugin.
 * It tells attester to load and execute the corresponding plugin.
 *
 * The second parameter, config, is optional, if specified it's the plugin configuration
 */
exports.require = function (name, config) {
    // Do it here so that it's available for the plugin even before it gets called
    var pluginConfig = exports.config(name, config);

    var pending = function () {
        // Try to resolve the plugin name using node require, it'll work with npm as well
        logger.logDebug("Requiring plugin " + name);

        if (requiredPlugins[name]) {
            return logger.logDebug("already required");
        }

        var plugin;
        try {
            plugin = require(name);
        } catch (ex) {
            logger.logError("Unable to load plugin " + name);
        }

        if (plugin) {
            try {
                plugin(attester, pluginConfig);
                requiredPlugins[name] = true;
            } catch (ex) {
                logger.logError("Exception while executing plugin: " + name + "\nMessage: " + ex.message);
            }
        }
    };
    pendingRequire.push(pending);
    attester.event.on("attester.server.started", pending);
};

exports.__reset__ = function () {
    pluginsConfig = {};
    requiredPlugins = {};
    for (var i = 0; i < pendingRequire.length; i += 1) {
        attester.event.off("attester.server.started", pendingRequire[i]);
    }
    pendingRequire = [];
};