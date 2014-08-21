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

var pathUtils = require('path');
var fs = require('fs');
var parse = require('url').parse;

var connect = require('connect');
var send = require('send');

var Logger = require('../logging/logger.js');

var normalizeContext = function (context) {
    if (context.charAt(0) != '/') {
        context = '/' + context;
    }
    if (context.charAt(context.length - 1) != '/') {
        context = context + '/';
    }
    return context;
};

var byLongestContext = function (context1, context2) {
    context1 = normalizeContext(context1);
    context2 = normalizeContext(context2);
    return context2.length - context1.length;
};

var processContextsConfig = function (globalRootPath, contextsConfig) {
    var rootsArray = [];
    var currentIndex = 0;
    var keys = Object.keys(contextsConfig);
    keys.sort(byLongestContext);
    for (var keysIndex = 0, keysLength = keys.length; keysIndex < keysLength; keysIndex++) {
        var context = keys[keysIndex];
        var pathsArray = contextsConfig[context];
        context = normalizeContext(context);
        for (var i = 0, l = pathsArray.length; i < l; i++) {
            rootsArray[currentIndex] = {
                context: context,
                root: pathUtils.resolve(globalRootPath, pathsArray[i]),
                nextContextIndex: currentIndex - i + l
            };
            currentIndex++;
        }
    }
    return rootsArray;
};

var getPathInContext = function (context, path) {
    if (path.length < context.length || path.substr(0, context.length) != context) {
        return null;
    }
    return path.substr(context.length);
};

var decode = function (component) {
    try {
        return decodeURIComponent(component);
    } catch (e) {
        return null;
    }
};

var Resources = function (config, logger) {
    this.logger = new Logger("Resources", logger);
    if (config) {
        this.configure(config);
    } else {
        this.resetConfig();
    }
};

Resources.prototype = {};

Resources.prototype.configure = function (config) {
    this._rootsArray = processContextsConfig(config.baseDirectory, config.contexts);
};

Resources.prototype.resetConfig = function () {
    this._rootsArray = [];
};

Resources.prototype.resolvePath = function (path, callback) {
    var rootsArray = this._rootsArray;
    var checkFileExistence = function (pathInContext, currentIndex) {
        var entry = rootsArray[currentIndex];
        var absolutePath = pathUtils.join(entry.root, pathInContext);
        fs.stat(absolutePath, function (err, stats) {
            if (!err && stats.isFile()) {
                callback({
                    path: path,
                    absolutePath: absolutePath,
                    context: entry.context,
                    pathInContext: pathInContext,
                    contextRoot: entry.root
                });
            } else {
                helper(currentIndex + 1);
            }
        });
    };
    var helper = function (startIndex) {
        for (var i = startIndex, l = rootsArray.length; i < l; i++) {
            var entry = rootsArray[i];
            var pathInContext = getPathInContext(entry.context, path);
            if (pathInContext) {
                return checkFileExistence(pathInContext, i);
            } else {
                i = entry.nextContextIndex - 1;
            }
        }
        callback(null); // not found
    };
    helper(0);
};

Resources.prototype.staticSender = function () {
    return function (req, res, next) {
        var resolvedPath = req.resolvedPath;
        if (resolvedPath) {
            var error = function error(err) {
                if (404 == err.status) {
                    return next();
                }
                next(err);
            };
            send(req, encodeURIComponent(resolvedPath.pathInContext), {
                root: resolvedPath.contextRoot
            }).on('error', error).pipe(res);
        } else {
            next();
        }
    };
};

Resources.prototype.pathResolver = function () {
    var self = this;
    return function (req, res, next) {
        var url = parse(req.url);
        var decodedPath = decode(url.pathname);
        if (decodedPath == null) {
            next(connect.utils.error(400));
        } else {
            self.resolvePath(decodedPath, function (resolvedPath) {
                req.resolvedPath = resolvedPath;
                next();
            });
        }
    };
};

Resources.prototype.dispose = function () {
    this.resetConfig();
    this.logger.dispose();
};

module.exports = Resources;