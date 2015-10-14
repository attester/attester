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

var getLocalIpAddresses = function (family) {
    var external = [];
    var internal = [];
    var networkInterfaces = os.networkInterfaces();
    Object.keys(networkInterfaces).forEach(function (interfaceName) {
        networkInterfaces[interfaceName].forEach(function (address) {
            if (address.family == family) {
                (address.internal ? internal : external).push(address.address);
            }
        });
    });
    return external.concat(internal);
};

var getIpAddresses = function (host) {
    var addresses = [host];
    if (host == '0.0.0.0') {
        addresses = getLocalIpAddresses("IPv4");
    } else if (host == '::') {
        addresses = getLocalIpAddresses("IPv6");
    }
    return addresses;
};

module.exports = function (host) {
    var ipAddresses = getIpAddresses(host);
    return Q.allSettled(ipAddresses.map(function (address) {
        return lookupService(address, 7777);
    })).then(function (array) {
        for (var i = 0, l = array.length; i < l; i++) {
            var curResult = array[i];
            if (curResult.state === "fulfilled") {
                return curResult.value[0];
            }
        }
        return ipAddresses[0];
    });
};