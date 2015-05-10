'use strict';

var ServiceLocator  = require('../src/service-locator.js');

describe("ServiceLocator", function () {
    var sl;

    beforeEach(function () {
        sl = new ServiceLocator();
    });

    it("has works", function () {
        sl.set('name', true);

        expect(sl.has('name')).toBeTruthy();
        expect(sl.has('non-existing')).toBeFalsy();
    });

    it("set/get work", function () {
        var val = { value: true };

        sl.set('name', val);

        expect(sl.has('name')).toBeTruthy();
        expect(sl.get('name')).toEqual(val);
        expect(function () { sl.set('name', false ); }).toThrow();

        sl.setAllowOverride(true);
        expect(function () { sl.set('name', false); }).not.toThrow();

        expect(function () { sl.get('non-existing', false); }).toThrow();
    });
});
