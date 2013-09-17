Attester
========

*attester* is a command line tool allowing to run JavaScript tests in several web browsers.

It starts an internal web server, then starts a set of web browsers, makes them execute the
tests, and finally writes test reports.

It is written in JavaScript, to be run with [node.js](http://nodejs.org/).

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
* Supports [Aria Templates](http://ariatemplates.com/) unit tests and [Mocha](http://visionmedia.github.com/mocha/) with either [Chai](http://chaijs.com/) or [Expect.js](https://github.com/LearnBoost/expect.js/).
* Adding support for other test frameworks is as simple as adding an adapter for that test framework.
* [![Build Status](https://secure.travis-ci.org/attester/attester.png)](http://travis-ci.org/attester/attester)

License
-------

[Apache License 2.0](https://github.com/attester/attester/blob/master/LICENSE)

Dependencies & installation
---------------------------

You'll need [node.js](http://nodejs.org/download/). Attester is available in [npm repository](https://npmjs.org/package/attester); you can use `npm install attester` in your console, or clone this repository and then issue `npm install`.

If you want to make use of PhantomJS headless testing, you'll additionally need to [install PhantomJS](http://phantomjs.org/download.html) and make sure it's in your `PATH`.

### Installing PhantomJS on Windows

1. Download [phantomjs-1.9.1-windows.zip](https://phantomjs.googlecode.com/files/phantomjs-1.9.1-windows.zip) and extract it.
2. Move the contents of `phantomjs-1.9.1-windows` to `C:\bin\phantomjs`
3. Add `C:\bin\phantomjs` to `PATH`
4. Check that it works by issuing `phantomjs --version` in `cmd`

### Installing PhantomJS on Ubuntu

Quick setup on 64bit Ubuntu:

    cd /usr/local/share/
    sudo wget http://phantomjs.googlecode.com/files/phantomjs-1.9.1-linux-x86_64.tar.bz2
    sudo tar jxvf phantomjs-1.9.1-linux-x86_64.tar.bz2
    sudo ln -s /usr/local/share/phantomjs-1.9.1-linux-x86_64/ /usr/local/share/phantomjs
    sudo ln -s /usr/local/share/phantomjs/bin/phantomjs /usr/local/bin/phantomjs

If you have 32bit version, replace `x86_64` with `i686` in the commands above.

Check that it works by issuing `phantomjs --version` in console.

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
  extraScripts: # Path to extra scripts to be inserted in the test page just after the Aria Templates bootstrap file.
   - '/test/testEnvConfig.js'
  rootFolderPath : '/' # Root folder path (Aria.rootFolderPath variable) This is the default value.
  debug : true # Enables or disables Aria Templates debug mode (Aria.debug variable). This is the default value.
  memCheckMode : true # Enables or disables memory check mode (Aria.memCheckMode variable). This is the default value.
 mocha:
  files:
   includes:
    - 'test/example/*.js'
   excludes:
    - 'test/example/*.conf.js'
  ui: 'bdd' # User-interface (bdd|tdd|exports). Defaults to bdd
  ignoreLeaks: false # Optional to ignore global variable leaks
  globals: # Optional, allow the given list of global [names]
   - 'myGlobal'
  assertion: 'expect' # Assertion library to be included. It could be either expect or chai or any external url
coverage:
 files: # Specifies which files will be instrumented for code coverage
  rootDirectory: 'src/main/js'
  includes:
   - '**/*.js'
test-reports: # Path for each test report type:
  json-file: 'report.json'
  xml-file: 'report.xml'
  xml-directory: 'reports'
coverage-reports: # Path for each coverage test report type:
  json-file: 'coverage.json'
  lcov-file: 'coverage.lcov'
browsers:
  # If the browsers section is not present, attester will not make any difference between browsers
  # and run each test only once (in whatever browser is connected)
  # However, if the browsers section is present, each test will be run once in each browser listed here.
  # (and browsers not listed here will have nothing to do if they are connected)
  - browserName: 'PhantomJS'
  - browserName: 'Chrome'
  # It's possible to distinguish browsers by operating systems, read more below
  - browserName: 'Firefox'
    os: 'Windows 7'
  - browserName: 'Firefox'
    os: 'Desktop Linux'
  - browserName: 'Firefox'
    os: 'Android'
  - browserName: 'Opera'
  - browserName: 'Safari'
  # It is also possible to distinguish several versions of the same browser:
  - browserName: 'IE'
    majorVersion: 7
  - browserName: 'IE'
    majorVersion: 8
  - browserName: 'IE'
    majorVersion: 9
  - browserName: 'IE'
    majorVersion: 10
  # Note that 'minorVersion' and 'revision' are also available
  # The 'name' property allows to change the display name of the browser in the reports.
```

#### Regarding browser detection by operating system:
Attester uses [ua-parser](https://github.com/tobie/ua-parser/) for that and supports operating system families as returned by ua-parser, e.g.:

- 'Windows XP'
- 'Windows Vista'
- 'Windows 7'
- 'Windows 8'
- 'Mac OS X'
- 'Ubuntu'
- 'Debian'
- 'Fedora'
- 'Chrome OS'
- 'iOS'
- 'Android'
- 'Windows Phone'
- 'Firefox OS'
- 'BlackBerry OS'

For convenience, two additional values are accepted by Attester:

- 'Desktop Linux' (Linux, but not Android or webOS)
- 'Desktop Windows' (Windows, but not Windows Phone)

For a bigger (though not complete) list of options, you can have a look at the test resources in ua-parser: [resource 1](https://raw.github.com/tobie/ua-parser/master/test_resources/test_user_agent_parser_os.yaml) and [resource 2](https://raw.github.com/tobie/ua-parser/master/test_resources/additional_os_tests.yaml).


**Environment Variables**
It is possible to build a special portion of the configuration object from an external file using `--env` option.

````
attester --env package.json
````

This puts the content of `package.json` inside the `env` section of attester configuration. It is then possible to reference such values with simple templates.

`<%= prop.subprop %>` Expands to the value of `prop.subprop` in the config. Such templates can only be used inside string values, either in arrays or objects

````json
{
  "resources": {
    "/": "src"
  },
  "tests": {
    "mocha": {
      "files": {
        "includes": ["spec/**/*"]
      }
    }
  },
  "coverage": {
    "files": {
      "rootDirectory": "src",
      "includes": ["**/*.js"]
    }
  },
  "coverage-reports": {
    "json-file": "/reports/coverage-<%= env.version %>.json"
  }
}
````

The configuration above generates a coverage report file called `coverage-x.y.z.json` where `x.y.z` is the value taken from `package.json` or any other file passed referenced by `--env`.

Template options can be used both in `yaml` and `json` file and the environment file can be of any of the two format.


**Usual options:**

`--phantomjs-path <path>` Path to the [PhantomJS](http://phantomjs.org/) executable (default: `phantomjs`).

- *Important note: you have to install PhantomJS by yourself if you want to use it. Then, you must either
pass `--phantomjs-path` argument, or add the folder containing `phantomjs.exe` to your system's `PATH`.
Otherwise, you'll get runtime errors.*

`--phantomjs-instances <number>` Number of instances of [PhantomJS](http://phantomjs.org/) to start (default: `0`).
Additionally, a string `auto` can be passed to let the program use the optimal number of instances for best performance (max. 1 per CPU thread).

`--browser <path>` Path to any browser executable to execute the tests. Can be repeated multiple times to start multiple
browsers or multiple instances of the same browser. Each browser is started with one parameter: the URL to open to start tests.
At the end of the tests, all started processes are killed.

`--env <path>` Path to a `yaml` or `json` file containing environment options. See section above.

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

`--json-console` When enabled, JSON objects will be sent to `stdout` to provide information about tests.
This is used by the [junit bridge](https://github.com/attester/attester-junit).

`--heartbeats` Delay (in ms) for heartbeats messages sent when `--json-console` is enabled. Use `0` to disable them.

`--task-timeout` Maximum duration (in ms) for a test task.

`--shutdown-on-campaign-end <boolean>` When set to false, will not shut the server down nor exit the process upon finishing the campaign.
Might be useful for debugging.

`--predictable-urls <boolean>` If true, resources served by the campaign have predictable URLs (campaign1, campaign2...). Otherwise, the campaign part in the URL is campaign ID.

**Configuration file options**

Any option configurable through the configuration file can also be specified from the command line with the `--config` prefix.
For example, to configure resources, it is possible to use:

    attester --config.resources./ path1/root1 --config.resources./ path2/root2 --config.resources./aria path/to/aria


Test Page
---------

It's important to understand exactly what is served by attester to a connected browser.

A slave browser receives a page with a single test and the files necessary to run it.
The test page has access to anything that is listed in `resources`.

From the configuration file
`tests` is used to build a list of tests for each testing framework
`resources` simply defines what is accessible by the page, none of these files is automatically added to the page

Inside `test` there are two parameters that deal with files
* `files` used to generate the list of test files
* `extraScripts` resources to be included in the test page

It's worth noticing that `extraScripts` must be an absolute path from the server root (what is configured in the resources).

Let's see one example

````json
{
  "resources" : {
    "/" : ["src"],
    "/test" : ["spec"]
  }
}
````

The block above configures attester to serve any file inside `src` folder from the server root, and files from `spec` from `/test`.

````json
{
  "resources" : {
    "/" : ["src"],
    "/test" : ["spec"]
  },
  "tests" : {
    "mocha" : {
      "files" : {
        "includes" : ["spec/**/*.js"]
      }
    }
  }
}
````

This block tells attester that each JavaScript file in the spec folder is a `mocha` test. When dispatching them to connected browsers, each will receive a page containing
* mocha
* an attester adapter to mocha tests
* a single test file

Including source files it's up to the test that can use script loaders like [noder](https://github.com/ariatemplates/noder), [curl](https://github.com/cujojs/curl), [head.js](http://headjs.com/) or similar.
Using a script loader allows to include in the tested page only what's strictly necessary for the test.

It's also possible to configure attester to include other scripts then the test through `extraScripts`.

````json
{
  "resources": {
    "/": ["src"],
    "/test": ["spec"]
  },
  "tests": {
    "mocha": {
      "files": {
        "includes": ["spec/**/*.js"]
      },
      "extraScripts": ["/sourceCode.js", "/utilities.js"]
    }
  }
}
````

The paths specified in `extraScripts` are resources URL. In the example above `sourceCode.js` must be physically located inside `src` folder.

The files specified in `extraScripts` are included in each and every test.
