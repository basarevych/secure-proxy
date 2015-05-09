'use strict'

describe("Locale", function () {
    it("instantiates globalizer", function (done) {
        var promise = globalizer('bower_components/cldr-data', 'l10n', 'en');

        promise
            .then(function (instance) {
                expect(instance.formatMessage).toBeDefined();
                done();
            });
    });
});
