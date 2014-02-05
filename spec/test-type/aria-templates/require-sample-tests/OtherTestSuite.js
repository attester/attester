module.exports = require("ariatemplates/Aria").classDefinition({
    $classpath : 'MainTestSuite',
    $extends : require("ariatemplates/jsunit/TestSuite"),
    $constructor : function () {
        this.$TestSuite.constructor.call(this);
        this._tests = ["x.y.z.MyTest1","y.z.MyOtherTest2"];
    }
});
