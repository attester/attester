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

describe("selenium-java-robot test", function () {
    var button;
    var buttonClicked;

    beforeEach(function () {
        // create a button:
        button = document.createElement("button");
        var myButtonStyle = button.style;
        myButtonStyle.position = "absolute";
        myButtonStyle.left = "200px";
        myButtonStyle.top = "300px";
        myButtonStyle.width = "32px";
        myButtonStyle.height = "16px";
        document.body.appendChild(button);
        button.onclick = function () {
            buttonClicked++;
        };
    });

    afterEach(function () {
        // remove the button
        button.onclick = null;
        button.parentNode.removeChild(button);
        button = null;
    });

    it("should click on the button", function (callback) {
        var SeleniumJavaRobot = window.top.SeleniumJavaRobot;
        buttonClicked = 0;
        expect(SeleniumJavaRobot).to.be.ok();
        SeleniumJavaRobot.getOffset(function (response) {
            expect(response.success).to.be(true);
            var offset = response.result;
            var attesterHeaderHeight = 32;
            var LEFT_MOUSE_BUTTON = 16;
            SeleniumJavaRobot.mouseMove(offset.x + 216, offset.y + 308 + attesterHeaderHeight, function () {
                SeleniumJavaRobot.mousePress(LEFT_MOUSE_BUTTON, function () {
                    SeleniumJavaRobot.mouseRelease(LEFT_MOUSE_BUTTON, function () {
                        expect(buttonClicked).to.be(1);
                        callback();
                    });
                });
            });
        });
    });

});
