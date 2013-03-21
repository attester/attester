# Reports

Reports are objects that receive result events from a test campaign and generate a complete report of the campaign execution.

The interface of a report is very simple as it only has to implement the method

* `addResult : function (event)`

This method receives an event object of one of the following types

* `tasksList`
* `taskStarted`
* `taskFinished`
* `taskIgnored`
* `testStarted`
* `testFinished`
* `error`
* `coverage`


## Console Report

This report acts as an interface toward the `console`.

It uses the following properties of a result event

* `name` Task (or test) name
* `method` If set, the event is ignored
* `asserts` Number of asserts executed, optional in `testFinished`
* `error` Error or exception, it should contain a `message` property, it's only used in case of `error` results
* `homeURL` used in `serverAttached` to display the server address


## Json Report

This reports acts as a storage. It contains all test results and is used by other reports to generate their output

On receiving the event `tasksList` it uses the properties

* `name` Task name
* `url` Task address
* `taskId` Task identifier, created by attester
* `subTasks` An array of tasks with the same properties defined here
* `campaignId` Campaign identifier, created by attester


On receiving a `result-*` event it uses the following properties

* `time` Date object or time-stamp in milliseconds
* `name` Test name
* `method` Test method, see [test-type](https://github.com/ariatemplates/attester/tree/master/lib/test-type)
* `taskId` Task identifier, added by attester
* `testId` Test identifier, it can be added by the test-type to identify tests
* `parentTestId` Parent test identifier, it can be used to nest tests into parent-child structures
* `asserts` Number of assert run, it's only used on `taskFinished`
* `error` The object is stored as is and might contain the boolean property `failure` that is used only for statistics