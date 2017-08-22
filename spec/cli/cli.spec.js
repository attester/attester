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

var utils = require("../test-utils");

describe('cli', function () {
    var defaultTimeout = 10000;
    var path = require('path');
    var atFrameworkPath = path.dirname(path.dirname(require.resolve('ariatemplates')));
    var atTestsRoot = path.join(__dirname, 'at-root');

    var findErrorMessage = function (needle, haystack) {
        // Some errors logged can be verbose and env-dependent, hence we check if there's
        // an error starting with particular string rather than being equal to it.
        for (var idx = 0; idx < haystack.length; idx++) {
            var item = haystack[idx];
            if (item.indexOf(needle) === 0) { // item.startsWith(needle)
                return idx;
            }
        }
        return -1;
    };

    var itRuns = function (options) {
        it(options.testCase, function () {
            var finished = false;

            runs(function () {
                utils.runFromCommandLine(options, function (code, testExecution, errorMessages) {
                    expect(code).toEqual(options.exitCode);
                    if (options.results) {
                        expect(testExecution).toEqual(options.results);
                    }
                    if (options.hasErrors) {
                        for (var i = 0; i < options.hasErrors.length; i += 1) {
                            var indexOfError = findErrorMessage(options.hasErrors[i], errorMessages);
                            if (indexOfError === -1) {
                                throw new Error("Error " + options.hasErrors[i] + " was not found in logs.");
                            } else {
                                // error found, remove it
                                errorMessages.splice(indexOfError, 1);
                            }
                        }
                        if (errorMessages.length > 0) {
                            throw new Error("Unexpected error message " + errorMessages[0]);
                        }
                    }

                    finished = true;
                });
            });
            waitsFor(function () {
                return finished;
            }, (options.timeout || defaultTimeout) + 100, 'attester to complete');
        });
    };

    itRuns({
        testCase: 'succeeds',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldSucceed', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
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
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldFail', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 1,
            failures: 1,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'extraScripts properly inserted (1+1)',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ExtraScriptsTest', '--tests.aria-templates.extraScripts.before', '/test/attester/testFiles/before.js', '--tests.aria-templates.extraScripts.after', '/test/attester/testFiles/after2.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'extraScripts properly inserted (0+2)',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ExtraScriptsTest', '--tests.aria-templates.extraScripts.after', '/test/attester/testFiles/after1.js', '--tests.aria-templates.extraScripts.after', '/test/attester/testFiles/after2.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'extraScripts properly inserted (legacy)',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ExtraScriptsTest', '--tests.aria-templates.extraScripts', '/test/attester/testFiles/after1.js', '--tests.aria-templates.extraScripts', '/test/attester/testFiles/after2.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'extraScripts properly inserted (legacy; only one passed)',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ExtraScriptsSingleTest', '--tests.aria-templates.extraScripts', '/test/attester/testFiles/afterSingle.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'ignoreFailure',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldFail', '--ignore-failures', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
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
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldRaiseError', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'hasErrorInConstructor',
        exitCode: 1,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldRaiseErrorInConstructor', '--phantomjs-instances', '1', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 0,
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'ignoreError',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldRaiseError', '--ignore-errors', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'missingClasspath',
        exitCode: 1,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'classpath.which.does.not.exist', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js'],
        results: {
            run: 0,
            failures: 0,
            errors: 1,
            skipped: 0
        },
        hasErrors: ["Missing classpath"]
    });

    itRuns({
        testCase: 'failsOnPhantomJSNoExclude',
        phantomjs: false,
        exitCode: 1,
        timeout: 20000,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldFailOnPhantomJS', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.browsers', 'PhantomJS', '--config.browsers', 'Firefox', '--launcher-config', path.join(__dirname, 'attester-launcher', 'local-browsers.yml')],
        results: {
            run: 2,
            failures: 1,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'failsOnPhantomJSExcludesClasspath',
        phantomjs: false,
        exitCode: 0,
        timeout: 20000,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldFailOnPhantomJS', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.browsers', 'PhantomJS', '--config.browsers', 'Firefox', '--config.tests.aria-templates.classpaths.browserExcludes.PhantomJS', 'test.attester.ShouldFailOnPhantomJS', '--launcher-config', path.join(__dirname, 'attester-launcher', 'local-browsers.yml')],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 1
        }
    });

    itRuns({
        testCase: 'failsOnPhantomJSExcludesPattern',
        phantomjs: false,
        exitCode: 0,
        timeout: 20000,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.files.rootDirectory', atTestsRoot, '--config.tests.aria-templates.files.includes', 'test/attester/*FailOnPhantomJS.js', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.browsers', 'PhantomJS', '--config.browsers', 'Firefox', '--config.tests.aria-templates.files.browserExcludes.PhantomJS', 'test/attester/Should*OnPhantomJS.js', '--launcher-config', path.join(__dirname, 'attester-launcher', 'local-browsers.yml')],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 1
        }
    });

    itRuns({
        testCase: 'mochaFailsOnPhantomJSNoExclude',
        phantomjs: false,
        exitCode: 1,
        timeout: 20000,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/shouldFailOnPhantomJS.js', '--config.browsers', 'PhantomJS', '--config.browsers', 'Firefox', '--launcher-config', path.join(__dirname, 'attester-launcher', 'local-browsers.yml')],
        results: {
            run: 2,
            failures: 0,
            errors: 1,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'mochaFailsOnPhantomJSExcludesPattern',
        phantomjs: false,
        exitCode: 0,
        timeout: 20000,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/shouldFailOnPhantomJS.js', '--config.tests.mocha.files.browserExcludes.PhantomJS', 'spec/test-type/mocha/extraScripts/*OnPhantomJS.js', '--config.browsers', 'PhantomJS', '--config.browsers', 'Firefox', '--launcher-config', path.join(__dirname, 'attester-launcher', 'local-browsers.yml')],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 1
        }
    });

    itRuns({
        testCase: 'mocha succeeds',
        exitCode: 0,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/sample-tests/**/*.js', '--config.tests.mocha.files.excludes', '**/syntaxError*', '--config.tests.mocha.files.excludes', '**/*.txt'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/bdd.js'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/qunit.js', '--config.tests.mocha.ui', 'qunit'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/tdd.js', '--config.tests.mocha.ui', 'tdd'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/chai/bdd.js', '--config.tests.mocha.assertion', 'chai'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/globals.js'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/globals.js', '--config.tests.mocha.ignoreLeaks'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/globals.js', '--config.tests.mocha.globals', 'globalOne', '--config.tests.mocha.globals', 'globalTwo'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/fixtures.js'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/expect/globalErrors.js'],
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
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/actualTest.js', '--config.resources./', 'spec/test-type/mocha/extraScripts', '--config.tests.mocha.extraScripts', '/require_one.js', '--config.tests.mocha.extraScripts', '/require_two.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'test timeout',
        exitCode: 1,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/timeout.js', '--task-timeout', '1000'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        },
        hasErrors: ["Task timeout."]
    });

    itRuns({
        testCase: 'browser disconnected (no restart)',
        timeout: 20000,
        exitCode: 1,
        args: ['--max-task-restarts', '0', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/disconnect.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        },
        hasErrors: ["Browser was disconnected"]
    });

    itRuns({
        testCase: 'browser disconnected (1 restart)',
        timeout: 20000,
        exitCode: 1,
        args: ['--max-task-restarts', '1', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/disconnect.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        },
        hasErrors: ["Browser was disconnected", "Browser was disconnected"]
    });

    itRuns({
        testCase: 'no restart on failure',
        exitCode: 1,
        args: ['--max-task-restarts', '2', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/failsTwice.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        },
        hasErrors: ["expected false to equal true"]
    });

    itRuns({
        testCase: 'restart on failure (2 restarts)',
        exitCode: 0,
        args: ['--max-task-restarts', '2', '--task-restart-on-failure', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/failsTwice.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        },
        hasErrors: ["expected false to equal true", "expected false to equal true"]
    });

    itRuns({
        testCase: 'restart on failure (1 restart)',
        exitCode: 1,
        args: ['--max-task-restarts', '1', '--task-restart-on-failure', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/failsTwice.js'],
        results: {
            run: 1,
            failures: 0,
            errors: 1,
            skipped: 0
        },
        hasErrors: ["expected false to equal true", "expected false to equal true"]
    });

    // There are 3 tests lasting ~1s, with a timeout of 2s everything should be fine
    itRuns({
        testCase: 'clear timeout',
        exitCode: 0,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/slowTests/*.js', '--task-timeout', '2000'],
        results: {
            run: 3,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    // There are 3 tests lasting ~1s, with a timeout of <1s all of them should fail
    itRuns({
        testCase: 'timeout more tests',
        exitCode: 1,
        args: ['--config.tests.mocha.files.includes', 'spec/test-type/mocha/slowTests/*.js', '--task-timeout', '900'],
        results: {
            run: 3,
            failures: 0,
            errors: 3,
            skipped: 0
        },
        // Expecting 3 errors
        hasErrors: ["Task timeout.", "Task timeout.", "Task timeout."]
    });

    itRuns({
        testCase: 'single browser specified on the command line',
        exitCode: 0,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldSucceed', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js', '--config.browsers', 'PhantomJS'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    itRuns({
        testCase: 'attester-launcher with phantomjs',
        exitCode: 0,
        phantomjs: false,
        args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldSucceed', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js', '--launcher-config', path.join(__dirname, 'attester-launcher', 'phantomjs.yml'), '--config.browsers', 'PhantomJS'],
        results: {
            run: 1,
            failures: 0,
            errors: 0,
            skipped: 0
        }
    });

    if (process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY) {
        var saucelabsBrowsers = [];
        ["Firefox >= 41 as Firefox", "Chrome", "Safari", "Edge", "IE 11", "IE 10", "IE 9", "IE 8", "Firefox 11"].forEach(function (browserName) {
            saucelabsBrowsers.push("--config.browsers");
            saucelabsBrowsers.push(browserName);
        });
        itRuns({
            testCase: 'tests on Sauce Labs',
            exitCode: 0,
            timeout: 300000,
            phantomjs: false,
            args: ['--config.resources./', atTestsRoot, '--config.resources./', atFrameworkPath, '--config.tests.aria-templates.classpaths.includes', 'test.attester.ShouldSucceed', '--config.coverage.files.rootDirectory', atTestsRoot, '--config.coverage.files.includes', '**/*.js', '--launcher-config', path.join(__dirname, 'attester-launcher', 'sauce-labs.yml')].concat(saucelabsBrowsers),
            results: {
                run: 9,
                failures: 0,
                errors: 0,
                skipped: 0
            }
        });
    }
});
