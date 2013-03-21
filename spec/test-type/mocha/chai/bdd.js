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

describe("Chai - Assert style", function () {
	var assert = chai.assert;

	it("should use assert style", function () {
		assert.equal(true, true);
	});
});


describe("Chai - BDD", function () {
	var expect = chai.expect;
	var should = chai.should();

	it("should use expect style", function () {
		expect(12).to.be.a("number");
	});

	it("should use should style", function () {
		var value = "a string";
		value.should.be.a("string");
	});
});