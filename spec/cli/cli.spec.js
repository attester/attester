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

describe('cli', function () {
    var defaultTimeout = 10000;
    var path = require('path');
    var child_process = require('../../lib/child-processes.js');
    var atFrameworkPath = path.dirname(path.dirname(require.resolve('ariatemplates')));
    var atTestsRoot = path.join(__dirname, 'at-root');
    var execPath = path.join(__dirname, '../../bin/atjstestrunner.js');

    var itRuns = function (options) {
        it(options.testCase, function () {
            var exitCode = -1;
            var finished = false;
            var timedout = false;
            runs(function () {
                console.log('\n---------------------------------------');
                console.log('Starting test: ' + options.testCase);
                console.log('---------------------------------------');
                var args = [execPath].concat(options.args || []);
                var spawnOpts = options.spawnOpts || {};
                var timeout = null;
                spawnOpts.stdio = 'inherit';
                var childProcess = child_process.spawn('node', args, spawnOpts);
                childProcess.on('exit', function (code) {
                    if (!timedout) {
                        finished = true;
                        exitCode = code;
                        clearTimeout(timeout);
                    }
                });
                timeout = setTimeout(function () {
                    timedout = true;
                    child_process.closeAll();
                }, options.timeout || defaultTimeout);
            });
            waitsFor(function () {
                return finished;
            }, (options.timeout || defaultTimeout) + 100, 'atjstestrunner to complete');
            runs(function () {
                expect(exitCode).toEqual(options.exitCode);
            });
        });
    };

    itRuns({
        testCase : 'succeeds',
        exitCode : 0,
        args : ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath,
                '--config.tests.aria-templates.classpaths.includes', 'test.atjstestrunner.ShouldSucceed',
                '--phantomjs-instances', '1']
    });

    itRuns({
        testCase : 'hasFailure',
        exitCode : 1,
        args : ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath,
                '--config.tests.aria-templates.classpaths.includes', 'test.atjstestrunner.ShouldFail',
                '--phantomjs-instances', '1']
    });

    itRuns({
        testCase : 'ignoreFailure',
        exitCode : 0,
        args : ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath,
                '--config.tests.aria-templates.classpaths.includes', 'test.atjstestrunner.ShouldFail',
                '--phantomjs-instances', '1', '--ignore-failures']
    });

    itRuns({
        testCase : 'hasError',
        exitCode : 1,
        args : ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath,
                '--config.tests.aria-templates.classpaths.includes', 'test.atjstestrunner.ShouldRaiseError',
                '--phantomjs-instances', '1']
    });

    itRuns({
        testCase : 'ignoreError',
        exitCode : 0,
        args : ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath,
                '--config.tests.aria-templates.classpaths.includes', 'test.atjstestrunner.ShouldRaiseError',
                '--phantomjs-instances', '1', '--ignore-errors']
    });

});
