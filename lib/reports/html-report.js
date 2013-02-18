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

var HtmlReport = function () {
    this.stats = {
        failures : 0,
        errors : 0
    };
    this.report = [];
    this.errors = [];

    this.htmlPrologue = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd"><html><head>'
            + '<title>HTML4 Minimal Markup Example</title></head><body>';
    this.htmlEpilogue = '</body></html>';

};

var eventTypes = {
    tasksList : function tasksList (event) {
        console.log(">>>>START");
    },
    error : function error (event) {
        // var task = getRunningTask.call(this, event);
        if (event.name) {
            var err = {};
            err.name = event.name;
            err.method = event.method;
            err.message = (event.error) ? event.error.message : null;

            this.errors.push(err);

            console.log("*********JSON.stringify(err) --> %s", JSON.stringify(err));

        }
    },
    taskFinished : function taskFinished (event) {

        var numErrors = this.errors.length;

        var footer = (this.stats.errors > 0) ? this.report.pop() : this.htmlEpilogue;

        for (var err; err = this.errors.shift();) {
            var name = err.name || "";
            if (name && err.method) {
                name = name + "." + err.method;
            }
            this.report.push(name);
            if (err.message) {
                this.report.push(err.message);
            }
            this.report.push("<br>");
        }
        __setHeader.call(this, numErrors);
        this.report.push(footer);

        console.log("@@@@@@@@ report - JSON.stringify(this.report) --> %s", JSON.stringify(this.report));

        this.errors = [];
    }

};

var __setHeader = function (numErrors) {
    var totalErrors = this.stats.errors + numErrors;
    this.report.splice(0, (this.stats.errors > 0) ? 2 : 0, (this.htmlPrologue + totalErrors + " test" + ((totalErrors != 1) ? "s " : " ") + "failed"), "<br>");
    this.stats.errors = totalErrors;
}

HtmlReport.prototype = {};

HtmlReport.prototype.getContent = function () {
    return this.report.join('');
}

HtmlReport.prototype.addResult = function (event) {
    var eventName = event.event;
    var eventHandler = eventTypes[eventName];
    if (eventHandler) {
        eventHandler.call(this, event);
    }
};

module.exports = HtmlReport;
