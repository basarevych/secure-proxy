var ServiceLocator  = require('../src/service-locator.js');

module.exports = {
    setUp: function (callback) {
        this.sl = new ServiceLocator();

        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    testHas: function (test) {
        this.sl.set('name', true);

        test.ok(this.sl.has('name'), "Existing service check failed");
        test.ok(this.sl.has('non-existing') == false, "Non-existing service check failed");

        test.done();
    },

    testSetGet: function (test) {
        var me = this,
            val = { value: true };

        this.sl.set('name', val);

        test.ok(this.sl.has('name'));
        test.deepEqual(this.sl.get('name'), val, "Get returns wrong object");

        test.throws(
            function () {
                me.sl.set('name', false);
            },
            "Does not throw on modifying existing service"
        );

        this.sl.setAllowOverride(true);
        test.doesNotThrow(
            function () {
                me.sl.set('name', false);
            },
            "Throws on allowed modification of existing service"
        );

        test.throws(
            function () {
                me.sl.get('non-existing');
            },
            "Does not throw on unknown service"
        );

        test.done();
    },
};
