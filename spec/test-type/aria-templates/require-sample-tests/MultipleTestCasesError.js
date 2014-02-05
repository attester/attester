var Aria = require("ariatemplates/Aria");
var ariaJsunitTestCase = require("ariatemplates/jsunit/TestCase");

module.exports = Aria.classDefinition({
    $classpath : 'test.myCompany.MyTestCase1',
    $extends : ariaJsunitTestCase,
    $prototype : {
        testOne : function () {

        },

        testAsyncTwo : function () {

        }
    }
});

module.exports = Aria.classDefinition({
    $classpath : 'test.myCompany.MyTestCase2',
    $extends : ariaJsunitTestCase,
    $prototype : {
        testOne : function () {

        },

        testAsyncTwo : function () {

        }
    }
});
