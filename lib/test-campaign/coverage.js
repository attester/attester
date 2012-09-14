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

var coverage = require('node-coverage');
var instrument = coverage.instrument;
var coverageReport = coverage.report;
var coverageServer = coverage.admin;
var fs = require('fs');
var pathUtils = require('path');
var FileSet = require('../fileset.js');
var merge = require('../merge.js');

var Coverage = function (inputCfg) {
    var cfg = {
        files : {
            includes : [],
            excludes : []
        }
    };
    merge(cfg, inputCfg);
    this._cache = {};
    this._result = null;
    this._fileSet = new FileSet(cfg.files);
};

function callcallbacks (callbacks, err, res) {
    for (var i = 0, l = callbacks.length; i < l; i++) {
        callbacks[i](err, res);
    }
}

function osIndependentFileName (fileName) {
    return fileName.split(pathUtils.sep).join("/");
}

Coverage.prototype.addResult = function (report) {
    var processedCoverage = coverageReport.generateAll(report);
    if (this._result) {
        this._result = coverageReport.mergeReports([this._result, processedCoverage]);
    } else {
        this._result = processedCoverage;
    }
};

Coverage.prototype.getResult = function () {
    var result = this._result;
    if (result) {
        var files = result.files;
        for (var curFile in files) {
            if (files.hasOwnProperty(curFile)) {
                files[curFile].code = this._cache[curFile].highlightedCode;
            }
        }
    }
    return result;
};

Coverage.prototype.resultsSender = function (serverRoot, previousReports) {
    var self = this;
    var firstPrevReport = previousReports[0];
    var coverageViewer = coverageServer.createApp({
        canMerge : false,
        serverRoot : serverRoot,
        docRoot : 'attester',
        adminRoot : 'attester',
        reportsList : function (callback) {
            var now = new Date();
            var result = self.getResult();
            var list = [];
            if (result) {
                list.push({
                    id : 'Current',
                    time : now.getTime(),
                    date : now.toString()
                });
            }
            fs.stat(firstPrevReport, function (err, stats) {
                if (!err) {
                    var mtime = stats.mtime;
                    list.push({
                        id : 'Previous',
                        time : mtime.getTime(),
                        date : mtime.toString()
                    });
                }
                callback(null, list);
            });
        },
        readReport : function (reportId, callback) {
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

Coverage.prototype.instrument = function (absoluteFileName, displayFileName, callback) {
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
            callbacks : allCallbacks
        };
        this._cache[displayFileName] = cacheEntry;
        fs.readFile(absoluteFileName, 'utf-8', function (err, data) {
            cacheEntry.callbacks = null;
            if (err) {
                cacheEntry.err = err;
                return callcallbacks(allCallbacks, err, null);
            }
            var result = instrument(displayFileName, data);
            cacheEntry.clientCode = result.clientCode;
            cacheEntry.highlightedCode = result.highlightedCode;
            callcallbacks(allCallbacks, null, result.clientCode);
        });
    }
};

Coverage.prototype.instrumentedSender = function () {
    var self = this;
    return function (req, res, next) {
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
                    res.write(data, function () {
                        res.end();
                    });
                });
                return;
            }
        }
        return next();
    };
};

module.exports = Coverage;
