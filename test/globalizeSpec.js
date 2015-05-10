'use strict';

var ServiceLocator  = require('../src/service-locator.js'),
    Globalize       = require('../src/globalize.js');

describe("Globalize", function () {
    var sl, globalize;

    beforeEach(function () {
        sl = new ServiceLocator();
        globalize = new Globalize(sl);
    });

    it("translates", function () {
        var gl = globalize.getLocale('en');
        expect(gl.formatMessage('RESET_PASSWORD_SUBJECT')).toBe('Reset password confirmation');
    });
});
