'use strict';

var ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js'),
    Front           = require('../src/front.js'),
    Api             = require('../src/api.js');

module.exports = {
    setUp: function (callback) {
        this.sl = new ServiceLocator();
        this.db = new Database(this.sl);
        this.front = new Front(this.sl);
        this.api = new Api(this.sl);

        this.db.dbFile = ":memory:";

        this.sl.setAllowOverride(true);

        this.config = {
            namespace: 'foobar',
            otp: {
                enable: true,
            },
        };
        this.sl.set('config', this.config);

        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    testLocaleSet: function (test) {
        var req = {
            headers: {
                'accept-language': 'ru_RU;ru;q=0.8,en_US;q=0.6'
            },
            url: '/secure-proxy/api/locale?set=en',
        };

        var returnedHeaders = {};
        var res = {
            setHeader: function (name, content) {
                returnedHeaders[name] = content;
            },
            writeHead: function (code, headers) {
            },
            end: function (html) {
                test.ok(typeof returnedHeaders['set-cookie'] != 'undefined', "Cookie is not set");
                test.ok(returnedHeaders['set-cookie'].indexOf('foobarlocale=en') != -1, "Wrong cookie is set");
                test.done();
            }
        };

        this.api.locale(undefined, req, res);
    },
};
