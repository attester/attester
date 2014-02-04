Aria.classDefinition({
    $classpath : 'MainTestSuite',
    $extends : 'aria.jsunit.TestSuite',
    $constructor : function () {
        this.$TestSuite.constructor.call(this);
        this._tests = ["x.y.z.MyTest1","y.z.MyOtherTest2"];
    }
});
