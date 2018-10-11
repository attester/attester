var fs = require("fs");
var coverageServer = require('node-coverage').admin;
var path = require("path");

module.exports = function (attesterServer, serverRoot) {
    var listsPossibleReports = function () {
        var list = [];
        attesterServer.campaigns.forEach(function (campaign) {
            var result = campaign.getCoverageResult();
            if (result) {
                list.push({
                    id: "Live campaign: " + campaign.id,
                    type: "live",
                    data: result
                });
            }
            var previousReports = campaign.config['coverage-reports']['json-file'];
            if (previousReports) {
                previousReports.forEach(function (fileName) {
                    list.push({
                        id: "Stored report: " + path.basename(fileName, ".json"),
                        path: path.resolve(fileName),
                        type: "file"
                    });
                });
            }
        });
        return list;
    };

    var coverageViewer = coverageServer.createApp({
        canMerge: false,
        serverRoot: serverRoot,
        docRoot: 'attester',
        adminRoot: 'attester',
        reportsList: function (callback) {
            var possibleReports = listsPossibleReports();
            var now = new Date();
            var waitingCb = 1;
            var callCallback = function () {
                waitingCb--;
                if (waitingCb === 0) {
                    var list = [];
                    possibleReports.forEach(function (report) {
                        if (report.type === "live") {
                            list.push({
                                id: report.id,
                                time: now.getTime(),
                                date: now.toString()
                            });
                        } else if (report.type === "file" && report.stats) {
                            list.push({
                                id: report.id,
                                time: report.stats.mtime.getTime(),
                                date: report.stats.mtime.toString()
                            });
                        }
                    });
                    callback(null, list);
                }
            };
            possibleReports.forEach(function (possibleReport) {
                if (possibleReport.type === "file") {
                    waitingCb++;
                    fs.stat(possibleReport.path, function (err, stats) {
                        if (!err) {
                            possibleReport.stats = stats;
                        }
                        callCallback();
                    });
                }
            });
            callCallback();
        },
        readReport: function (reportId, callback) {
            var possibleReports = listsPossibleReports();
            var report = possibleReports.find(function (candidate) {
                return candidate.id === reportId;
            });
            if (report && report.type === "live") {
                callback(null, report.data);
            } else if (report && report.type === "file") {
                fs.readFile(report.path, 'utf-8', function (err, data) {
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
