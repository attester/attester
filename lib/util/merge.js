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

var merge = function (destination, source, exclude) {
    if (!source) {
        return;
    }
    if (!exclude) {
        exclude = [];
    }
    for (var key in source) {
        if (source.hasOwnProperty(key) && exclude.indexOf(key) === -1) {
            var srcValue = source[key];
            var dstValue = destination[key];
            if (Array.isArray(dstValue)) {
                destination[key] = dstValue.concat(srcValue);
            } else if (typeof dstValue == "object" && dstValue) {
                merge(dstValue, srcValue);
            } else {
                destination[key] = srcValue;
            }
        }
    }
};

module.exports = merge;
