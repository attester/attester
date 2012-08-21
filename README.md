Aria Templates Javascript Test Runner
=====================================

*atjstestrunner* is a command line tool allowing to run javascript tests in a web browser.

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
* [![Build Status](https://secure.travis-ci.org/ariatemplates/atjstestrunner-nodejs.png)](http://travis-ci.org/ariatemplates/atjstestrunner-nodejs)

Usage
-----

*Documentation about this tool will be added in the coming weeks.*

