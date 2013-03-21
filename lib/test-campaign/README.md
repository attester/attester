A test campaign describes the bundle of tests that must be executed on a set of browsers.

`TestCampaign` class generates a list of tasks following this rule

- if `browsers` was not specified in the configuration a single task is created for every test case
- if `browsers` was specified, a task is created for each combination of test case and browser

`TestCampaign` is an [`EventEmitter`](http://nodejs.org/api/events.html) raising the following events

* `result-coverage`
* `result-taskStarted`
* `result-taskFinished`
* `result-taskIgnored`
* `result-tasksList` When all tests are initialized (preparing tests is asynchronous)
* `result-campaignFinished` Raised when there are no task remaining
* `result` Immediately after any of the `result-*` is raised
* `finished` When the test campaign ends
* `error`


`TestCampaign` has the following public properties

* `id`
* `logger`
* `rootDirectory`
* `config`
* `browsers` List of browsers for the campaign
* `resources` an object with two connect handlers to serve static resource files `pathResolver` and `staticSender`
* `tests` helper for initializing (create tasks) and serving tests regardless of the testing framework
* `handleRequest` Handler used by `TestServer` to serve test files and resources
* `tasks`
* `tasksTrees`
* `remainingTasks`
* `remainingCoverageResults`
* `finished`

and methods

* `init` Initialize the tests
* `addResult` Dispatch a result event. It's used for instance by the test server to raise the result events listened by registered [reports](https://github.com/ariatemplates/attester/tree/master/lib/reports).
* `checkFinished` Check if the campaign is complete, in that case emit the `finished` event
* `addCoverageResult` Called when the coverage data of a task is available
* `getCoverageResult` Getter for coverage data