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

var Minimatch = require('minimatch').Minimatch;
var fs = require('fs');
var pathUtils = require('path');
var util = require('util');
var Enumerator = require('./enumerator.js');

var createMinimatches = function (array) {
    var res = [];
    for (var i = 0, l = array.length; i < l; i++) {
        res[i] = new Minimatch(array[i]);
    }
    return res;
};

var matchesArray = function (minimatchesArray, fileName) {
    for (var i = 0, l = minimatchesArray.length; i < l; i++) {
        if (minimatchesArray[i].match(fileName)) {
            return true;
        }
    }
    return false;
};

var FileSet = function (config) {
    this._root = config.rootDirectory;
    this._includes = createMinimatches(config.includes || []);
    this._excludes = createMinimatches(config.excludes || []);
};

util.inherits(FileSet, Enumerator);

FileSet.prototype.isFileNameIncluded = function (fileName) {
    return matchesArray(this._includes, fileName) && !matchesArray(this._excludes, fileName);
};

FileSet.prototype.getRelativePath = function (absolutePath) {
    return pathUtils.relative(this._root, absolutePath);
};

FileSet.prototype.getAbsolutePath = function (relativePath) {
    return pathUtils.join(this._root, relativePath);
};

FileSet.prototype.isAbsolutePathIncluded = function (absoluteFilePath) {
    return this.isFileNameIncluded(this.getRelativePath(absoluteFilePath));
};

FileSet.prototype.iterate = function (entryCallback, endCallback) {
    var self = this;
    var root = this._root || "";
    var waitingCallbacks = 0;
    var decreaseCallbacks = function () {
        waitingCallbacks--;
        if (waitingCallbacks <= 0) {
            endCallback();
        }
    };
    var processFile = function (path) {
        waitingCallbacks++;
        fs.stat(pathUtils.join(root, path), function (err, stats) {
            if (err) {
                return decreaseCallbacks();
            }
            if (stats.isDirectory()) {
                if (path.length > 0 && path.charAt(path.length - 1) != '/') {
                    path = path + '/';
                }
                processDirectory(path);
            } else if (stats.isFile()) {
                if (self.isFileNameIncluded(path)) {
                    entryCallback(path);
                }
            }
            decreaseCallbacks();
        });
    };
    var processDirectory = function (path) {
        waitingCallbacks++;
        fs.readdir(pathUtils.join(root, path), function (err, files) {
            if (err) {
                return decreaseCallbacks();
            }
            for (var i = 0, l = files.length; i < l; i++) {
                processFile(path + files[i]);
            }
            decreaseCallbacks();
        });
    };
    processFile("");
};

module.exports = FileSet;