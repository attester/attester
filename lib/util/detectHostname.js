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

var Q = require("q");
var os = require("os");
var dns = require("dns");
var lookupService = Q.nfbind(dns.lookupService ||
    function (host, port, callback) {
        // nodejs 0.10 does not have the lookupService method
        callback(new Error("lookupService method is not available"));
    });

module.exports = function (ipv4Only) {
    var categories = {
        IPv4: [],
        internalIPv4: [],
        IPv6: [],
        internalIPv6: []
    };
    var networkInterfaces = os.networkInterfaces();
    Object.keys(networkInterfaces).forEach(function (interfaceName) {
        networkInterfaces[interfaceName].forEach(function (address) {
            var key = (address.internal ? "internal" : "") + address.family;
            var array = categories[key];
            if (array) {
                array.push(address.address);
            }
        });
    });
    if (ipv4Only) {
        // IPv6 is disabled in this case
        categories.IPv6 = categories.internalIPv6 = [];
    }
    var lookupAddresses = categories.IPv6.concat(categories.IPv4, categories.internalIPv6, categories.internalIPv4);
    return Q.allSettled(lookupAddresses.map(function (address) {
        return lookupService(address, 7777);
    })).then(function (array) {
        for (var i = 0, l = array.length; i < l; i++) {
            var curResult = array[i];
            if (curResult.state === "fulfilled") {
                return curResult.value[0];
            }
        }
        // so we currently only use IPv4 addresses when we cannot find the host name:
        var result = categories.IPv4.concat(categories.internalIPv4);
        return result[0];
    });
};
