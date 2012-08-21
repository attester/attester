Aria.classDefinition({
    $classpath : 'MainTestSuite',
    $extends : 'aria.jsunit.TestSuite',
    $constructor : function () {
        this.$TestSuite.constructor.call(this);
        this.addTests(this.$classpath + "Test1");
        this.addTests(this.$package + "Test2");
        this.addTests(this.$class + "Test3");
    }
});
