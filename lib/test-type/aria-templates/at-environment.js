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

var path = require('path');
var fs = require('fs');

var readATFileContent = require('./at-file-reader.js');

var ATEnvironment = function (config) {
    this.resources = config.resources;
    this.rootFolderPath = config.rootFolderPath || '/';
    this._files = {};
    this._classpaths = {};
};

ATEnvironment.prototype = {};

ATEnvironment.prototype.readATFile = function (file, callback) {
    file = path.normalize(file);
    var fileInfo = this._files[file];
    if (!fileInfo) {
        var waitingCallbacks = [callback];
        fileInfo = {
            loading: true,
            waitingCallbacks: waitingCallbacks,
            result: null
        };
        this._files[file] = fileInfo;
        fs.readFile(file, 'utf8', function (err, data) {
            var result;
            if (err) {
                result = {
                    error: {
                        message: "Error while reading file '%s': %s.",
                        args: [file, err + ''],
                        object: err
                    }
                };
            } else {
                result = readATFileContent(data, file);
            }
            fileInfo.result = result;
            fileInfo.loading = false;
            fileInfo.waitingCallbacks = null;
            for (var i = 0, l = waitingCallbacks.length; i < l; i++) {
                waitingCallbacks[i](result);
            }
        });
    } else if (fileInfo.loading) {
        fileInfo.waitingCallbacks.push(callback);
    } else {
        callback(fileInfo.result);
    }
};

ATEnvironment.prototype.readATClasspath = function (classpath, callback) {
    var classpathInfo = this._classpaths[classpath];
    var self = this;
    var filePath = null;
    if (!classpathInfo) {
        classpathInfo = {
            loading: true,
            waitingCallbacks: [callback],
            result: null
        };
        var handleResult = function (result) {
            if (filePath && result.classpath != classpath) {
                var msg;
                if (!result.classpath) {
                    msg = "File '%s' doesn't contain the class '%s'. Check for the syntax errors in the file.";
                    result.classpath = "";
                } else {
                    msg = "File '%s' should contain classpath '%s' but it contains '%s'.";
                }

                result = {
                    error: {
                        message: msg,
                        args: [filePath, classpath, result.classpath]
                    }
                };
            }
            classpathInfo.loading = false;
            classpathInfo.result = result;
            var waitingCallbacks = classpathInfo.waitingCallbacks;
            classpathInfo.waitingCallbacks = null;
            for (var i = 0, l = waitingCallbacks.length; i < l; i++) {
                waitingCallbacks[i](result);
            }
        };
        self.classpathToFilepath(classpath, function (file) {
            if (file) {
                filePath = file;
                self.readATFile(file, handleResult);
            } else {
                handleResult({
                    error: {
                        message: "Missing classpath: '%s'.",
                        args: [classpath]
                    }
                });
            }
        });
        this._classpaths[classpath] = classpathInfo;
    } else if (classpathInfo.loading) {
        classpathInfo.waitingCallbacks.push(callback);
    } else {
        callback(classpathInfo.result);
    }
};

ATEnvironment.prototype.classpathToFilepath = function (classpath, callback) {
    // with the following line, we assume that there is no root map / url map
    var relativePath = this.rootFolderPath + classpath.replace(/\./g, '/') + '.js';

    this.resources.resolvePath(relativePath, function (res) {
        callback(res ? res.absolutePath : null);
    });
};

module.exports = ATEnvironment;