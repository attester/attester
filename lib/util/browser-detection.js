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

var semver = require('semver');
var UAParser = require('ua-parser-js');

// semver-compliant version must be x.y.z
var toSemVer = function (version) {
    var splitDots = version.split(".");
    var nbDots = splitDots.length - 1;
    if (nbDots === 0) {
        return version + ".0.0";
    } else if (nbDots === 1) {
        return version + ".0";
    } else if (nbDots === 2) {
        return version;
    } else {
        return splitDots.slice(0, 3).join(".") + "-" + splitDots.slice(3).join(".");
    }
};

exports.detectBrowser = function (data) {
    var parser = new UAParser(data.userAgent);
    var browser = parser.getBrowser();
    var browserName = browser.name || "Unknown browser";
    var browserVersion = browser.version;

    if (browserName == "IE") {
        // always something specific for IE!
        // documentMode is what really matters in IE, not the userAgent

        var documentMode = data.documentMode;
        if (documentMode) {
            browserVersion = String(documentMode);
        }
    }

    var os = parser.getOS();
    var osName = os.name || "Unknown OS";

    var res = {
        displayName: browserName + (browserVersion ? " " + browserVersion : ""),
        semverString: toSemVer(browserVersion || "0"),
        family: browserName,
        os: {
            displayName: osName + (os.version ? " " + os.version : ""),
            family: osName
        }
    };
    return res;
};

exports.browserMatch = function (config, browserInfo) {
    var match = true;
    if (config.browserName != null) {
        match = match && (config.browserName == browserInfo.family);
    }
    if (match && config.browserVersion != null) {
        // user may pass version as a number, hence using String()
        match = semver.satisfies(browserInfo.semverString, String(config.browserVersion));
    }
    if (match && config.os != null) {
        match = (config.os == browserInfo.os.family) || (config.os == browserInfo.os.displayName);
    }
    return match;
};
