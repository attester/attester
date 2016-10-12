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

var util = require('util');

var ATEnvironment = require('./at-environment.js');

var arrayToMap = function (array) {
    var map = {};
    for (var i = 0, l = array.length; i < l; i++) {
        var value = array[i];
        map[value] = true;
    }
    return map;
};

var formatError = function (error) {
    var args = error.args;
    var msg = error.message;
    if (args) {
        args = args.slice(0);
        args.unshift(msg);
        msg = util.format.apply(util, args);
    }
    return msg;
};

var processBrowserExclude = function (browserExcludesClasspaths) {
    var res = Object.create(null);
    Object.keys(browserExcludesClasspaths).forEach(function (browserName) {
        var classpathsToExclude = browserExcludesClasspaths[browserName];
        if (!classpathsToExclude) {
            classpathsToExclude = [];
        } else if (!Array.isArray(classpathsToExclude)) {
            classpathsToExclude = [classpathsToExclude];
        }
        classpathsToExclude.forEach(function (classpath) {
            var classpathInfo = res[classpath];
            if (!classpathInfo) {
                classpathInfo = res[classpath] = Object.create(null);
            }
            classpathInfo[browserName] = true;
        });
    });
    return res;
};

var TestEnumerator = function (config, logger, attester) {
    this.logger = new attester.classes.Logger('TestEnumerator', logger);
    if (config.files) {
        this.fileSet = new attester.classes.FileSet(config.files);
        this.browserExcludesFileSet = new attester.classes.BrowserExcludesFileSet(config.files.browserExcludes);
    }
    this.atEnvironment = new ATEnvironment({
        resources: config.resources,
        rootFolderPath: config.rootFolderPath
    });
    var classpaths = config.classpaths || {};
    this.exploredClasspaths = {};
    this.includeClasspaths = classpaths.includes || [];
    this.excludeClasspaths = arrayToMap(classpaths.excludes || []);
    this.browserExcludeClasspaths = processBrowserExclude(classpaths.browserExcludes || {});
    this.testCases = [];
    this.testsTrees = [];
    this._waitingCallbacks = 0;
};

TestEnumerator.prototype._checkClasspath = function (testInfo) {
    var classpath = testInfo.name;
    if (this.excludeClasspaths.hasOwnProperty(classpath)) {
        testInfo.results = [{
            event: "taskIgnored"
        }];
        return false;
    }
    if (this.exploredClasspaths.hasOwnProperty(classpath)) {
        testInfo.name += " (duplicate)";
        testInfo.results = [{
            event: "taskIgnored"
        }];
        return false;
    }
    var browserExcludeClasspath = this.browserExcludeClasspaths[classpath];
    if (browserExcludeClasspath) {
        var browserResults = testInfo.browserResults = Object.create(null);
        Object.keys(browserExcludeClasspath).forEach(function (browserName) {
            browserResults[browserName] = [{
                event: "taskIgnored"
            }];
        });
    }
    this.exploredClasspaths[classpath] = testInfo;
    return true;
};

TestEnumerator.prototype._addFileResult = function (filepath, testInfo, res) {
    var classpath = testInfo.name = res.classpath;
    var browserExcludeClasspath = this.browserExcludeClasspaths[classpath];
    var self = this;
    this.browserExcludesFileSet.forEachExcludedBrowser(filepath, function (browserName) {
        if (!browserExcludeClasspath) {
            browserExcludeClasspath = self.browserExcludeClasspaths[classpath] = Object.create(null);
        }
        browserExcludeClasspath[browserName] = true;
    });
    if (!this._checkClasspath(testInfo)) {
        return this._decreaseCallbacks();
    }
    this._addResult(testInfo, res);
};

TestEnumerator.prototype._addResult = function (testInfo, res) {
    var classpath = testInfo.name;
    var testSuite = res.testSuite;
    var error = res.error;
    if (error) {
        if (res.hasOwnProperty('testSuite')) {
            // this means the error occurred in the constructor,
            // it may not happen in the browser (that's why it is a warning)
            this.logger.logWarn(error.message, error.args, error.object);
            // even if this is a test suite, register it as a test case so that
            // it is run as a single task (and the constructor will be executed in the browser)
            testSuite = false;
        } else {
            testInfo.results = [{
                event: 'taskStarted'
            }, {
                event: 'error',
                name: classpath,
                error: {
                    message: formatError(error)
                }
            }, {
                event: 'taskFinished'
            }];
            return this._decreaseCallbacks();
        }
    }
    if (testSuite) {
        testInfo.subTests = this._exploreClasspathsArray(res.subTests);
    } else {
        this.testCases.push(testInfo);
    }
    return this._decreaseCallbacks();
};

TestEnumerator.prototype._exploreClasspath = function (classpath) {
    var testInfo = {
        name: classpath
    };
    if (this._checkClasspath(testInfo)) {
        this._waitingCallbacks++;
        this.atEnvironment.readATClasspath(classpath, this._addResult.bind(this, testInfo));
    }
    return testInfo;
};

TestEnumerator.prototype._exploreClasspathsArray = function (classpathsArray) {
    var res = [];
    for (var i = 0, l = classpathsArray.length; i < l; i++) {
        res[i] = this._exploreClasspath(classpathsArray[i]);
    }
    return res;
};

TestEnumerator.prototype._exploreFilepath = function (filepath) {
    var testInfo = {};
    this._waitingCallbacks++;
    this.atEnvironment.readATFile(this.fileSet.getAbsolutePath(filepath), this._addFileResult.bind(this, filepath, testInfo));
    this.testsTrees.push(testInfo);
    return testInfo;
};

TestEnumerator.prototype._decreaseCallbacks = function () {
    this._waitingCallbacks--;
    if (this._waitingCallbacks <= 0) {
        var callback = this._callback;
        callback();
    }
};

TestEnumerator.prototype.init = function (callback) {
    this._waitingCallbacks++;
    this._callback = callback;
    this.testsTrees = this._exploreClasspathsArray(this.includeClasspaths);
    if (this.fileSet) {
        this._waitingCallbacks++;
        this.fileSet.iterate(this._exploreFilepath.bind(this), this._decreaseCallbacks.bind(this));
    }
    this._decreaseCallbacks();
};

TestEnumerator.prototype.dispose = function () {
    this.logger.dispose();
};

module.exports = TestEnumerator;
