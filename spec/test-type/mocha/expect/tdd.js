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

suite("One test suite", function () {
	test("should pass true assertions", function () {
		expect(true).to.be.ok();
		expect(12).to.be.a("number");
		expect({
			a : false
		}).to.have.property("a");
	});

	test("should fail false assertions", function () {
		expect({
			a : false
		}).to.have.key("c");
	});

	test("should pass asynchronous true test", function (callback) {
		setTimeout(function () {
			expect(5).to.be.lessThan(10);
			callback();
		}, 40);
	});

	test("should fail asynchronous false tests", function (callback) {
		setTimeout(function () {
			expect(3).to.be.within(10, 100);
			callback();
		}, 40);
	});
});
