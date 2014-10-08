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

describe("a test that disconnects the browser", function () {
	it("should log an error", function (callback) {
		// This is done asynchronously so that the socket.io manager has time to send
		// what's already prepared to be sent.
		setTimeout(function () {
			// Try to get the socket to close from the top iframe
			var managers = window.parent.io.managers;
			for (var host in managers) {
				// There should be only one
				managers[host].disconnect();
			}
			callback();
		}, 10);
	});
});
