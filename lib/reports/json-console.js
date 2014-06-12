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

var packageJson = require('../../package.json');

var JsonConsole = function (stdout, heartbeatsDelay) {
    this.stdout = stdout;
    if (heartbeatsDelay > 0) {
        this._heartbeatDelay = heartbeatsDelay;
        this._heartbeatFunction = this.onHeartbeat.bind(this);
    }
    this._heartbeatTimeout = null;
    this.send({
        application: packageJson.name,
        version: packageJson.version
    });
};

JsonConsole.prototype = {};

JsonConsole.prototype.send = function (json) {
    if (this._heartbeatTimeout != null) {
        clearTimeout(this._heartbeatTimeout);
        this._heartbeatTimeout = null;
    }
    this.stdout.write(JSON.stringify(json));
    if (this._heartbeatFunction) {
        this._heartbeatTimeout = setTimeout(this._heartbeatFunction, this._heartbeatDelay);
    }
};

JsonConsole.prototype.addResult = JsonConsole.prototype.send;

JsonConsole.prototype.onHeartbeat = function (value) {
    this._heartbeatTimeout = null;
    this.send({
        event: 'heartbeat'
    });
};

module.exports = JsonConsole;