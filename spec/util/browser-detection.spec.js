/*
 * Copyright 2015 Amadeus s.a.s.
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

var Browser = require('../../lib/test-campaign/browser');
var browserDetection = require('../../lib/util/browser-detection.js');

describe('browser-detection', function () {

    var getMatchingBrowsers = function (browserObjects, userAgent, documentMode) {
        var res = [];
        var browserInfo = browserDetection.detectBrowser({
            userAgent: userAgent,
            documentMode: documentMode
        });
        browserObjects.forEach(function (browser) {
            var isMatch = browserDetection.browserMatch(browser.config, browserInfo);
            if (isMatch) {
                res.push(browser.name);
            }
        });
        return res;
    };

    var createBrowserObjects = function (browsersList) {
        return browsersList.map(function (browserSpec) {
            return new Browser(browserSpec);
        });
    };

    it('should detect common browsers correctly', function () {
        var browserNames = ["Firefox 39", "Firefox 3", "Firefox 11", "Chrome 43", "IE 7", "IE 8", "IE 9", "IE 10", "IE 11", "Edge", "Safari"];
        var browsers = createBrowserObjects(browserNames);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (Windows NT 6.1; rv:39.0) Gecko/20100101 Firefox/39.0")).toEqual(["Firefox 39"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US; rv:1.9.2.15) Gecko/20110303 Firefox/3.6.15")).toEqual(["Firefox 3"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (Windows NT 6.1; rv:11.0) Gecko/20100101 Firefox/11.0")).toEqual(["Firefox 11"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.81 Safari/537.36")).toEqual(["Chrome 43"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729)", 7)).toEqual(["IE 7"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0)", 8)).toEqual(["IE 8"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0)", 9)).toEqual(["IE 9"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0)", 10)).toEqual(["IE 10"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; rv:11.0) like Gecko")).toEqual(["IE 11"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10162")).toEqual(["Edge"]);
        expect(getMatchingBrowsers(browsers, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/600.5.17 (KHTML, like Gecko) Version/8.0.5 Safari/600.5.17")).toEqual(["Safari"]);
    });
});
