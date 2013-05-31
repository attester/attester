/*globals describe, it, runs, waitsFor, expect*/
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
    var execPath = path.join(__dirname, '../../bin/attester.js');

    var itRuns = function (options) {
        it(options.testCase, function () {
            var exitCode = -1;
            var finished = false;
            var timedout = false;
            var testExecution = null;
            runs(function () {
                console.log('\n---------------------------------------');
                console.log('Starting test: ' + options.testCase);
                console.log('---------------------------------------');
                var args = [execPath].concat(options.args || []);
                var spawnOpts = options.spawnOpts || {};
                var timeout = null;
                spawnOpts.stdio = ['ignore', 'pipe', 'pipe'];
                var childProcess = child_process.spawn('node', args, spawnOpts);
                childProcess.on('exit', function (code) {
                    if (!timedout) {
                        finished = true;
                        exitCode = code;
                        clearTimeout(timeout);
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
                });
                timeout = setTimeout(function () {
                    timedout = true;
                    child_process.closeAll();
                }, options.timeout || defaultTimeout);
            });
            waitsFor(function () {
                return finished;
            }, (options.timeout || defaultTimeout) + 100, 'attester to complete');
            runs(function () {
                expect(exitCode).toEqual(options.exitCode);
                if (options.results) {
                    expect(testExecution).toEqual(options.results);
                }
            });
        });
    };

    itRuns({
        testCase: 'succeeds',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldSucceed', '--phantomjs-instances', '1', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'hasFailure',
        exitCode: 1,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldFail', '--phantomjs-instances', '1', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 1,
            failures: 1,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'ignoreFailure',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldFail', '--phantomjs-instances', '1', '--ignore-failures', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 1,
            failures: 1,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'hasError',
        exitCode: 1,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldRaiseError', '--phantomjs-instances', '1', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'ignoreError',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldRaiseError', '--phantomjs-instances', '1', '--ignore-errors', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha succeeds',
        exitCode: 0,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/sample-tests/**/*.js', '--config.tests.mocha.files.excludes', '**/syntaxError*', '--config.tests.mocha.files.excludes', '**/*.txt', '--phantomjs-instances', '1'],
        results: {
            run: 2,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha in bdd with expect.js',
        exitCode: 1,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/bdd.js', '--phantomjs-instances', '1'],
        results: {
            run: 1,
            failures: 0,
            errors: 2,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha in qunit with expect.js',
        exitCode: 1,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/qunit.js', '--config.tests.mocha.ui', 'qunit', '--phantomjs-instances', '1'],
        results: {
            run: 1,
            failures: 0,
            errors: 2,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha in tdd with expect.js',
        exitCode: 1,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/tdd.js', '--config.tests.mocha.ui', 'tdd', '--phantomjs-instances', '1'],
        results: {
            run: 1,
            failures: 0,
            errors: 2,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha in bdd with chai.js',
        exitCode: 0,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/chai/bdd.js', '--config.tests.mocha.assertion', 'chai', '--phantomjs-instances', '1'],
        results: {
            run: 2,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha detect global leaks',
        exitCode: 1,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/globals.js', '--phantomjs-instances', '1'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha ignore all global leaks',
        exitCode: 0,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/globals.js', '--config.tests.mocha.ignoreLeaks', '--phantomjs-instances', '1'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha ignore some global leaks',
        exitCode: 0,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/globals.js', '--config.tests.mocha.globals', 'globalOne', '--config.tests.mocha.globals', 'globalTwo', '--phantomjs-instances', '1'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha errors in fixtures',
        exitCode: 1,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/fixtures.js', '--phantomjs-instances', '1'],
        results: {
            run: 0,
            // because failure in the hook stop the test execution
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha global errors',
        exitCode: 1,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/globalErrors.js', '--phantomjs-instances', '1'],
        results: {
            run: 0,
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mocha with external scripts',
        exitCode: 0,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/actualTest.js', '--config.resources./', 'spec/test-type/mocha/extraScripts', '--config.tests.mocha.extraScripts', '/require_one.js', '--config.tests.mocha.extraScripts', '/require_two.js', '--phantomjs-instances', '1'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });
});