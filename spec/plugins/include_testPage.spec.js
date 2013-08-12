/* globals describe, it, beforeEach, afterEach, expect */
/*
 * Copyright 2013 Amadeus s.a.s.
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

var attester = require("../../lib/attester");

describe("include testPage", function () {
    beforeEach(function () {
        attester.testPage.__reset__();
    });
    afterEach(function () {
        attester.testPage.__reset__();
    });

    it("some content", function () {
        // Include a string
        attester.testPage.include("some content");

        var content = attester.testPage.getAll();
        expect(content).toEqual({
            head: [],
            body: ["some content"]
        });

        // Include some other content, it should be merged with the previous
        attester.testPage.include({
            head: {
                tagName: "meta"
            }
        });

        content = attester.testPage.getAll();
        expect(content).toEqual({
            head: [{
                tagName: "meta"
            }],
            body: ["some content"]
        });
    });
});