Attester
========

*attester* is a command line tool allowing to run Javascript tests in several web browsers.

It starts an internal web server, then starts a set of web browsers, makes them execute the
tests, and finally writes test reports.

It is written in Javascript, to be run with [node.js](http://nodejs.org/).

Features
--------

* Supports multiple browser instances to run **tests in parallel**
* Includes instrumentation for **code coverage** with [node-coverage](https://github.com/piuccio/node-coverage)
* Supports [PhantomJS](http://phantomjs.org/) for fully **headless tests**
* Compatible with most other web browsers
* Test results output formats:
   * Json file
   * JUnit-style single XML file
   * JUnit-style set of files, format accepted by [Sonar](http://www.sonarsource.org/)
* Code coverage output formats:
   * [node-coverage](https://github.com/piuccio/node-coverage) json file
   * [lcov](http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php) file, accepted by [Sonar](http://www.sonarsource.org/) *(currently only for line coverage)*
* Supports [Aria Templates](http://ariatemplates.com/) unit tests.
* Adding support for other test frameworks is as simple as adding an adapter for that test framework.
* [![Build Status](https://secure.travis-ci.org/ariatemplates/attester.png)](http://travis-ci.org/ariatemplates/attester)

Usage
-----

**attester [&lt;options&gt;] [&lt;configuration file&gt;]**

**Configuration file**

The configuration file describes the test campaign to execute. It can be either in the [YAML](http://en.wikipedia.org/wiki/YAML)
(with a `.yml` or `.yaml` extension) or in the [JSON](http://en.wikipedia.org/wiki/Json) format (with a `.json` extension).

Here is a sample `.yml` configuration file with explanations about each setting:

```yaml
resources:  # Specifies which files will be accessible through the web server:
 '/': # This configures resources for the root of the web server:
  - 'src/main/js'   # It is possible to specify one or more directories for each path.
  - 'src/tests'     # When requesting a file, the first directory which contains it is used.
 '/aria': # This configures resources for the /aria path on the server:
  - 'libraries/aria'
tests:
# Describes test configuration for each type of test
# Only Aria Templates tests are supported currently, but other types of tests will be added in the future
 aria-templates:
  # There are two ways to specify which tests have to be executed:
  # either by their classpath or by their file path
  # It is possible to combine both.
  # With file paths, it is possible to use patterns.
  classpaths:
   includes:
    - MainTestSuite
   excludes:
    - test.sample.MyUnfinishedTest
  files:
   rootDirectory: 'src/tests'
   includes:
    - 'test/example/*TestCase.js'
   excludes:
    - 'test/example/*SpecialTestCase.js'
  bootstrap : '/aria/bootstrap.js' # Path to the bootstrap file of Aria Templates. This is the default value.
  rootFolderPath : '/' # Root folder path (Aria.rootFolderPath variable) This is the default value.
  debug : true # Enables or disables Aria Templates debug mode (Aria.debug variable). This is the default value.
  memCheckMode : true # Enables or disables memory check mode (Aria.memCheckMode variable). This is the default value.
coverage:
 files: # Specifies which files will be instrumented for code coverage
  rootDirectory: 'src/main/js'
  includes:
   - '**/*.js'
test-reports: # Path for each test report type:
  json-file: report.json
  xml-file: report.xml
  xml-directory: reports
coverage-reports: # Path for each coverage test report type:
  json-file: coverage.json
  lcov-file: coverage.lcov
```

**Usual options:**

`--phantomjs-path <path>` Path to the [PhantomJS](http://phantomjs.org/) executable (default: `phantomjs`).

`--phantomjs-instances <number>` Number of instances of [PhantomJS](http://phantomjs.org/) to start (default: `0`).

`--browser <path>` Path to any browser executable to execute the tests. Can be repeated multiple times to start multiple
browsers or multiple instances of the same browser. Each browser is started with one parameter: the URL to open to start tests.
At the end of the tests, all started processes are killed.

`--ignore-errors` When enabled, test errors (not including failures) will not cause this process to return a non-zero value.

`--ignore-failures` When enabled, test failures (anticipated errors) will not cause this process to return a non-zero value.

`--port <number>` Port used for the internal web server. If set to `0` (default), an available port is automatically selected.

`--server-only` Only starts the web server, and configure it for the test campaign but do not start the campaign. This is useful to
run tests manually.

`--log-level <number>` Level of logging: integer from `0` (no logging) to `4` (debug).

`--colors` Uses colors (disable with --no-colors).

`--help` Displays a help message and exits.

`--version` Displays the version number and exits.

**Advanced options**

`--json-console` When enabled, JSON objects will be sent to stdout to provide information about tests.
This is used by the [junit bridge](https://github.com/ariatemplates/attester-junit).

`--heartbeats` Delay (in ms) for heartbeats messages sent when --json-console is enabled. Use 0 to disable them.

**Configuration file options**

Any option configurable through the configuration file can also be specified from the command line with the `--config` prefix.
For example, to configure resources, it is possible to use:

    attester --config.resources./ path1/root1 --config.resources./ path2/root2 --config.resources./aria path/to/aria
