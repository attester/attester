# Test Type

Test types are the classes that allow to serve test cases during a campaign.

A test type should export a constructor function with the signature

````js
function (campaign, config)
````

Where

* `campaign` is the `TestCampaign` object
* `config` is the configuration part specific to the test type

A test type must have the following properties

* `handleRequest` it'll be used by the server to serve test cases
* `name` to identify the test type
* `init` initialization function called by the test campaign. This is an asynchronous method, it receives a callback that must be called when the class has build a list of all test cases to be served.
* `testsTrees` the list of test cases to be executed, it's an array of JSON objects with the following structure

````
{
	name : Mandatory test name
	url : Test URL, this defines how the slave can access this test. It can be omitted only if the object contains `subTests`
	subTests : Optional list of sub tests. This is useful for defining test suites (group of test cases). `subTests` and `url` are mutually exclusive.
	results : Optional list of result events raised by this test. A test with results won't be served but instead the events will be raised.
}
````

# Handle Request

The method `handleRequest` is responsible for sending to the client an HTML page able to load and execute a test case and to report its result to `attester`.

The generated page is opened by `attester` inside an `iframe` and must therefore include a connector between the unit testing framework (test type) and `attester`. The communication is done through the global `attester` object injected by `attester` in the parent frame.

The global `attester` object is implemented in [lib/test-server/client/slave.js](https://github.com/ariatemplates/attester/blob/master/lib/test-server/client/slave.js), it has the following public methods

* `testStart` Notify that a test started
* `testEnd` Notify that a test ended
* `testError` Notify that a test raised an error
* `taskFinished` Notify that a test task is complete
* `stackTrace` Helper for getting the stack trace of an error or of the current execution line
* `coverage` Send the coverage report

The methods `testStart`, `testEnd` and `testError` have the following signature

````js
function (info)
````

The info object is treated as a `result` and it's passed from a test campaign to the attached reports.
Each report might use some of the properties of `info` that might look like the following

````js
info = {
	error : {
		message : "An error message string",
		failure : true,    // Whether the test failed an assertion or a generic error happened
		stack : []         // Stack trace, an array of object containing `function`, `file` and `line`
	},
	name : "Test name",
	testId : "Test identifier",
	parentTestId : "Identifier of the parent test suite",
	method : "Test method being executed",
	asserts : 1            // Number of assertion
}
````
For a list of properties you can read the documentation on [reports](https://github.com/ariatemplates/attester/tree/master/lib/reports).

It's important to understand the difference between a `test` and a `method`.
A `test` is a collection of methods all testing the same unit. For instance

````js
suite("test unit A", function () {
	test("getSomething", function () {});

	test("setSomething", function () {})
});
````
`test unit A` is a `test` while `getSomething` and `setSomething` are `methods`.

A test should have at least one method. From your custom test type you can notify both the beginning of your test and of each of your method, although this is just needed for generating proper statistics.

For each end every error or failing assert that occurs in the test you can call `attester.testError`, this will notify reports that an error happened, but not the test ended.
To notify the complete execution of the whole list of tests in the served page you must call `attester.taskFinished`.

`attester.coverage` should be called just before notifying `taskFinished`.


# Development

When writing a new test type you can try out your `handleRequest` method by running `attester` in server mode (no browser attached).
````
attester --config.tests.myAdapter.files.includes tests/**
````

You'll then be able to connect your browser and ask for a test URL.