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

var email = require('emailjs');

var emailReports = function (config, callback) {
    var result = null;
    var expectedCallbacks = 1;
    var errors = null;
    var decreaseCallbacks = function (err) {
        if (err) {
            if (!errors) {
                errors = [];
            }
            errors.push(err);
        }
        expectedCallbacks--;
        if (expectedCallbacks === 0) {
            callback({
                err : errors
            });
        }
    };

    var server = email.server.connect({
        port : "25",
        host : "mucsmtp2.muc.amadeus.net",
        ssl : false
    });

    var message = {
        text : config.text,
        from : config.from, // "you <username@gmail.com>",
        subject : config.subject, // "testing emailjs",
        attachment : [{
                    data : config.html, // "<html>i <i>hope</i> this works!</html>",
                    alternative : true
                }]
    };

    if (config.to) {
        message.to = config.to.join(",");
    }
    if (config.cc) {
        message.cc = config.cc.join(",");
    }

    // send the message and get a callback with an error or details of the message that was sent
    server.send(message, function (err, message) {
        if (err) {
            callback({
                err : err
            });
        } else {
            callback({
                success : message
            });
        }
        decreaseCallbacks();
    });

};

module.exports = emailReports;