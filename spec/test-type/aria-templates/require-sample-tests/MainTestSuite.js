var Aria = require("ariatemplates/Aria");
var ariaJsunitTestSuite = require("ariatemplates/jsunit/TestSuite");
module.exports = Aria.classDefinition({
    $classpath : 'MainTestSuite',
    $extends : ariaJsunitTestSuite,
    $constructor : function () {
        this.$TestSuite.constructor.call(this);
        this.addTests(this.$classpath + "Test1");
        this.addTests(this.$package + "Test2");
        this.addTests(this.$class + "Test3");
    }
});
