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

var http = require("http");
var connect = require("connect");
var path = require("path");

var spawn = require("child_process").spawn;
var child_process = require("../lib/util/child-processes");

exports.createServer = function (fromType, extraPath, callback) {
    var handler = fromType.getHandler();
    var app = connect();
    // The test server might add some other pats (like /__attester__/:campaign/:test-type)
    app.use(extraPath, handler);
    var server = http.createServer(app).listen(0, function () {
        var address = server.address();
        callback("http://localhost:" + address.port + extraPath, function (done) {
            server.close(done);
        });
    });
};

// Deprecated, use /attester/lib/launchers/phantom-launcher:bootPhantom which is more generic
exports.startPhantom = function (args, onData, onExit) {
    var phantomProcess = spawn("phantomjs", args, {
        stdio: "pipe"
    });
    // Pipe to standard out only if you want to have verbose tests
    // phantomProcess.stdout.pipe(process.stdout);
    phantomProcess.stdout.on("data", function (data) {
        onData(data.toString().trim());
    });
    phantomProcess.on("exit", function (code) {
        onExit(code);
    });
    return phantomProcess;
};

var execPath = path.join(__dirname, '../bin/attester.js');
exports.runFromCommandLine = function (options, onExit) {
    console.log('\n---------------------------------------');
    console.log('Starting test: ' + options.testCase);
    console.log('---------------------------------------');
    var args = [execPath].concat(options.args || []).concat(["--colors"]);
    if (options.phantomjs !== false) {
        args.push("--phantomjs-instances", "1");
    }
    var spawnOpts = options.spawnOpts || {};
    var timeoutID = null;
    var timedout = false;
    var defaultTimeout = 10000;
    var exitCode = -1;
    spawnOpts.stdio = ['ignore', 'pipe', 'pipe'];
    var childProcess = child_process.spawn('node', args, spawnOpts);
    var testExecution = null;
    var errorMessages = [];
    childProcess.on('exit', function (code) {
        if (!timedout) {
            exitCode = code;
            clearTimeout(timeoutID);
            onExit(code, testExecution, errorMessages);
        }
    });
    childProcess.stdout.pipe(process.stdout, {
        end: false
    });
    childProcess.stderr.pipe(process.stderr, {
        end: false
    });
    childProcess.stdout.on('data', function (data) {
        // data is a buffer
        data = data.toString().replace(/\033\[[0-9]*m/ig, ""); // strip ANSI color codes
        var result = data.match(/tests run\s?\:\s?(\d+)\s?,\s?failures\s?\:\s?(\d+)\s?,\s?errors\s?\:\s?(\d+)\s?,\s?skipped\s?\:\s?(\d+)\s?/i);
        if (result) {
            testExecution = {
                run: parseInt(result[1], 10),
                failures: parseInt(result[2], 10),
                errors: parseInt(result[3], 10),
                skipped: parseInt(result[4], 10)
            };
        }
        var errors = data.match(/Error( in .*?)?:(.*)/); // non-greedy match in case error has more :
        if (errors) {
            errorMessages.push(errors[2].trim());
        }
    });
    timeoutID = setTimeout(function () {
        timedout = true;
        child_process.closeAll();
    }, options.timeout || defaultTimeout);
};
