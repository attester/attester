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
var uaParser = require('ua-parser-snapshot');

// semver-compliant version must be x.y.z
var toSemVer = function (version) {
    var nbDots = (version.match(/\./g) || "").length;
    if (nbDots === 0) {
        return version + ".0.0";
    } else if (nbDots === 1) {
        return version + ".0";
    } else {
        return version;
    }
};

exports.detectBrowser = function (data) {
    var parsedAgent = uaParser.parse(data.userAgent);
    var ua = parsedAgent.ua;
    var osFamily = parsedAgent.os.family;
    var res = {
        displayName: parsedAgent.toString(),
        semverString: toSemVer(parsedAgent.toVersionString()),
        family: ua.family,
        major: ua.major,
        minor: ua.minor,
        patch: ua.patch,
        os: {
            name: osFamily,
            isDesktopLinux: /Linux/.test(data.userAgent.match) && (osFamily != "Android") && (osFamily != "webOS"),
            isDesktopWindows: /Windows/.test(osFamily.match) && (osFamily != "Windows Phone")
        }
    };

    // Regarding operating system, ua-parser is inconsistent, returns {family: "Windows 7"} but {family: "Windows
    // Phone", major: "8"} etc. The only reliable part is the "family" string then.
    // See https://github.com/tobie/ua-parser/blob/master/test_resources/test_user_agent_parser_os.yaml

    if (res.family == "IE") {
        // always something specific for IE!
        // documentMode is what really matters in IE, not the userAgent

        var documentMode = data.documentMode;
        res.browserModeMajor = res.major;
        res.browserModeMinor = res.minor;
        res.browserModePatch = res.patch;
        if (documentMode) {
            res.major = documentMode;
            res.minor = 0;
            res.patch = null;
            res.displayName = "IE " + documentMode + ".0";
            res.semverString = documentMode + ".0.0";
        }
    }
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
        // a little bit verbose to have readable code
        match = false;
        if (config.os == "Desktop Linux" && browserInfo.os.isDesktopLinux) {
            match = true;
        } else if (config.os == "Desktop Windows" && browserInfo.os.isDesktopWindows) {
            match = true;
        } else {
            match = (config.os == browserInfo.os.name);
        }
    }
    return match;
};