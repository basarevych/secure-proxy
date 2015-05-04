'use strict';

var ServiceLocator  = require('../src/service-locator.js'),
    Globalize       = require('../src/globalize.js');

module.exports = {
    setUp: function (callback) {
        this.sl = new ServiceLocator();
        this.globalize = new Globalize(this.sl);

        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    testTranslation: function (test) {
        var gl = this.globalize.getLocale('en');
        test.equal(gl.formatMessage('PAGE_TITLE'), 'Restricted area');
        test.done();
    },
};
