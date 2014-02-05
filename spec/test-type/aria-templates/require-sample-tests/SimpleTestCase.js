var Aria = require("ariatemplates/Aria");
var ariaJsunitTestCase = require("ariatemplates/jsunit/TestCase");
module.exports = Aria.classDefinition({
    $classpath : 'test.myCompany.MyTestCase',
    $extends : ariaJsunitTestCase,
    $constructor : function () {
        this.$TestCase.constructor.call(this);
    },
    $prototype : {
        testOne : function () {

        },

        testAsyncTwo : function () {

        }
    }
});
