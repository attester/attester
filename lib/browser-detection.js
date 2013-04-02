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

var uaParser = require('ua-parser');

exports.detectBrowser = function (data) {
    var parsedAgent = uaParser.parse(data.userAgent);
    var ua = parsedAgent.userAgent;
    var res = {
        displayName: parsedAgent.toString(),
        family: ua.family,
        major: ua.major,
        minor: ua.minor,
        patch: ua.patch
    };
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
        }
    }
    return res;
};

exports.browserMatch = function (config, browserInfo) {
    var match = true;
    if (config.browserName != null) {
        match = match && (config.browserName == browserInfo.family);
    }
    if (match && config.majorVersion != null) {
        match = config.majorVersion == browserInfo.major;
    }
    if (match && config.minorVersion != null) {
        match = config.majorVersion == browserInfo.minor;
    }
    return match;

};