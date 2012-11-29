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

var http = require('http');

module.exports = {
    // This function is a wrapper around http.createServer to also close all connections
    // when the server close method is called
    createServer: function () {
        var server = http.createServer.apply(http, arguments);

        var connections = [];
        server.on('connection', function (socket) {
            connections.push(socket);
            socket.on('close', function () {
                var i = connections.indexOf(socket);
                if (i > -1) {
                    connections.splice(i, 1);
                }
            });
        });

        var realClose = server.close;
        server.close = function (cb) {
            realClose.call(this, cb);

            for (var i = connections.length - 1; i >= 0; i--) {
                connections[i].end();
            }
        };

        return server;
    }
};