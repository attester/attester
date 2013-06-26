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

var fs = require('fs');
var path = require('path');

var xmlReport = require('./xml-report.js');
var lcovReport = require('./lcov-report.js');

var writeReports = function (config, results, callback) {
    var mkdirsCache = {};
    var expectedCallbacks = 1;
    var errors = null;
    var decreaseCallbacks = function (err) {
        if (err) {
            if (!errors) {
                errors = [];
            }
            errors.push(err);
        }
        expectedCallbacks--;
        if (expectedCallbacks === 0) {
            callback(errors);
        }
    };

    var mkdirs = function (directory, callback) {
        var cacheEntry = mkdirsCache[directory];
        if (cacheEntry === true) {
            return callback();
        } else if (cacheEntry) {
            cacheEntry.push(callback);
            return;
        }
        cacheEntry = [callback];
        mkdirsCache[directory] = cacheEntry;
        var end = function () {
            mkdirsCache[directory] = true;
            for (var i = 0, l = cacheEntry.length; i < l; i++) {
                cacheEntry[i]();
            }
        };
        fs.exists(directory, function (doesExist) {
            if (doesExist) {
                return end();
            }
            mkdirs(path.dirname(directory), function () {
                fs.mkdir(directory, end);
            });
        });
    };

    var writeFile = function (file, fileContent) {
        expectedCallbacks++;
        mkdirs(path.dirname(file), function () {
            fs.writeFile(file, fileContent, 'utf8', decreaseCallbacks);
        });
    };

    var writeMultipleFiles = function (files, fileContent) {
        for (var i = 0, l = files.length; i < l; i++) {
            writeFile(files[i], fileContent);
        }
    };

    var writeJson = function (files, json) {
        if (json && files.length > 0) {
            writeMultipleFiles(files, JSON.stringify(json));
        }
    };

    var writeXMLFile = function (files, root) {
        if (files.length > 0) {
            var xmlContent = xmlReport.xmlFileReport(root);
            writeMultipleFiles(files, xmlContent);
        }
    };

    var writeXMLDirectory = function (directories, flatReport) {
        var nbDirectories = directories.length;
        if (nbDirectories > 0) {
            var xmlReports = xmlReport.xmlDirectoryReport(flatReport);
            for (var i = 0, l = xmlReports.length; i < l; i++) {
                for (var j = 0; j < nbDirectories; j++) {
                    writeFile(path.join(directories[j], xmlReports[i].name), xmlReports[i].content);
                }
            }
        }
    };

    var writeLcovFile = function (files, report) {
        if (files.length > 0 && report) {
            var lcovContent = lcovReport(report);
            writeMultipleFiles(files, lcovContent);
        }
    };

    var testConfig = config.test;
    var coverageConfig = config.coverage;
    var testResults = results.test;
    var coverageResults = results.coverage;

    writeJson(testConfig['json-file'], testResults.report);
    writeXMLFile(testConfig['xml-file'], {
        name: "Campaign " + testResults.report.campaignId,
        subTasks: testResults.report.tasks
    });
    writeXMLDirectory(testConfig['xml-directory'], testResults.flatReport);
    if (coverageResults) {
        writeJson(coverageConfig['json-file'], coverageResults);
        writeLcovFile(coverageConfig['lcov-file'], coverageResults);
    }

    decreaseCallbacks();
};

module.exports = writeReports;
