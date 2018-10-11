/*
 * Copyright 2012 Amadeus s.a.s. Licensed under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

var fs = require('fs');
var pathUtils = require('path');
var coverage = require('node-coverage');
var instrument = coverage.instrument;
var coverageReport = coverage.report;
var coverageServer = coverage.admin;

var FileSet = require('../util/files/fileset.js');

var merge = require('../util/merge.js');

var emptyResult = function () {
    return {
        name: "",
        run: {},
        runFunctions: []
    };
};

var Coverage = function (inputCfg, logger, rootDirectory) {
    this.logger = logger;
    var hasFilesToInstrument = !!inputCfg.files;
    var cfg = {
        files: {
            includes: [],
            excludes: []
        },
        infoFiles: []
    };
    merge(cfg, inputCfg);
    this._staticInfo = {};
    this._updatedStaticInfo = false;
    this._result = null;
    this._infoFiles = cfg.infoFiles.map(function (filePath) {
        return pathUtils.resolve(rootDirectory, filePath);
    });
    if (hasFilesToInstrument) {
        cfg.files.rootDirectory = pathUtils.resolve(rootDirectory, cfg.files.rootDirectory || "");
        this._fileSet = new FileSet(cfg.files);
        this._cache = {};
    }
};

function callcallbacks(callbacks, err, res) {
    for (var i = 0, l = callbacks.length; i < l; i++) {
        callbacks[i](err, res);
    }
}

function osIndependentFileName(fileName) {
    return fileName.split(pathUtils.sep).join("/");
}

Coverage.prototype.addResult = function (report) {
    var processedCoverage = coverageReport.generateAll(report, this._staticInfo);
    if (this._result) {
        this._result = coverageReport.mergeReports([this._result, processedCoverage]);
    } else {
        this._result = processedCoverage;
    }
};

Coverage.prototype.addStaticInfo = function (staticInfo) {
    if (Object.keys(staticInfo).length > 0) {
        Object.assign(this._staticInfo, staticInfo);
        this._updatedStaticInfo = true;
    }
};

Coverage.prototype.getResult = function () {
    if (this._updatedStaticInfo) {
        this.addResult(emptyResult());
    }
    return this._result;
};

Coverage.prototype.resultsSender = function (serverRoot, previousReports) {
    var self = this;
    var firstPrevReport = previousReports[0];
    var coverageViewer = coverageServer.createApp({
        canMerge: false,
        serverRoot: serverRoot,
        docRoot: 'attester',
        adminRoot: 'attester',
        reportsList: function (callback) {
            var now = new Date();
            var result = self.getResult();
            var list = [];
            if (result) {
                list.push({
                    id: 'Current',
                    time: now.getTime(),
                    date: now.toString()
                });
            }
            fs.stat(firstPrevReport, function (err, stats) {
                if (!err) {
                    var mtime = stats.mtime;
                    list.push({
                        id: 'Previous',
                        time: mtime.getTime(),
                        date: mtime.toString()
                    });
                }
                callback(null, list);
            });
        },
        readReport: function (reportId, callback) {
            if (reportId == 'Current') {
                callback(null, self.getResult());
            } else if (reportId == 'Previous') {
                fs.readFile(firstPrevReport, 'utf-8', function (err, data) {
                    if (err) {
                        callback(err);
                    } else {
                        try {
                            var result = JSON.parse(data);
                            callback(null, result);
                        } catch (ex) {
                            callback(ex);
                        }
                    }
                });
            } else {
                callback('Not found');
            }
        }
    });
    return coverageViewer.handle.bind(coverageViewer);
};

Coverage.prototype.instrumentAll = function (endCallback) {
    var self = this;
    var fileSet = this._fileSet;
    var waitingCallbacks = 1;
    var callback = function () {
        waitingCallbacks--;
        if (waitingCallbacks !== 0) {
            return;
        }
        endCallback();
    };
    fileSet.iterate(function (relativePath) {
        waitingCallbacks++;
        var absolutePath = fileSet.getAbsolutePath(relativePath);
        relativePath = osIndependentFileName(relativePath);
        self.instrument(absolutePath, relativePath, callback);
    }, callback);
};

Coverage.prototype.readInfoFile = function (infoFile, endCallback) {
    var self = this;
    fs.readFile(infoFile, 'utf-8', function (err, data) {
        try {
            if (!err) {
                var infoFileContent = JSON.parse(data);
                self.addStaticInfo(infoFileContent);
            }
        } catch (error) {
            err = error || new Error('Unknown error while processing ' + infoFile);
        } finally {
            if (err) {
                self.logger.logError('Error while loading coverage information from %s: %s', [infoFile, err.stack || err]);
            }
            endCallback(err);
        }
    });
};

Coverage.prototype.init = function (endCallback) {
    var waitingCallbacks = 1;
    var callback = function () {
        waitingCallbacks--;
        if (waitingCallbacks === 0) {
            endCallback();
        }
    };
    this._infoFiles.forEach(function (infoFile) {
        waitingCallbacks++;
        this.readInfoFile(infoFile, callback);
    }, this);
    if (this._fileSet) {
        waitingCallbacks++;
        this.instrumentAll(callback);
    }
    callback();
};

Coverage.prototype.instrument = function (absoluteFileName, displayFileName, callback) {
    var self = this;
    var cacheEntry = this._cache[displayFileName];
    if (cacheEntry) {
        if (cacheEntry.callbacks) {
            cacheEntry.callbacks.push(callback);
        } else {
            callback(cacheEntry.err, cacheEntry.clientCode);
        }
    } else {
        var allCallbacks = [callback];
        cacheEntry = {
            callbacks: allCallbacks
        };
        this._cache[displayFileName] = cacheEntry;
        fs.readFile(absoluteFileName, 'utf-8', function (err, data) {
            cacheEntry.callbacks = null;
            if (err) {
                cacheEntry.err = err;
                return callcallbacks(allCallbacks, err, null);
            }
            var result = instrument(displayFileName, data, {
                conditions: true,
                functions: true,
                staticInfo: false,
                submit: false
            });
            cacheEntry.clientCode = result.clientCode;
            if (result.staticInfo) {
                var staticInfo = {};
                staticInfo[displayFileName] = result.staticInfo;
                self.addStaticInfo(staticInfo);
            }
            callcallbacks(allCallbacks, null, result.clientCode);
        });
    }
};

Coverage.prototype.instrumentedSender = function () {
    var self = this;
    return this._fileSet ? function (req, res, next) {
        var resolvedPath = req.resolvedPath;
        if (resolvedPath) {
            var absolutePath = resolvedPath.absolutePath;
            var fileSet = self._fileSet;
            var relativePath = fileSet.getRelativePath(absolutePath);
            relativePath = osIndependentFileName(relativePath);
            if (self._cache[relativePath] || fileSet.isFileNameIncluded(relativePath)) {
                self.instrument(absolutePath, relativePath, function (err, data) {
                    if (err) {
                        return next();
                    }
                    res.setHeader('Content-type', 'text/javascript');
                    res.setHeader('Expires', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString());
                    res.end(data);
                });
                return;
            }
        }
        return next();
    } : function (req, res, next) {
        return next();
    };
};

module.exports = Coverage;
