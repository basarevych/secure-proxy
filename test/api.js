'use strict';

var q               = require('q'),
    ServiceLocator  = require('../src/service-locator.js'),
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

    testLocaleSetsCookie: function (test) {
        var req = {
            headers: {},
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

    testLocaleGetsCookie: function (test) {
        var req = {
            headers: {
                cookie: 'foobarlocale=en',
            },
            url: '/secure-proxy/api/locale',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['locale'] != 'undefined', "Locale is not returned");
                test.equal(result['locale'], 'en', "Wrong locale is returned");
                test.done();
            }
        };

        this.api.locale(undefined, req, res);
    },

    testLocaleGetsAutoselected: function (test) {
        var req = {
            headers: {
                'accept-language': 'ru_RU,ru;q=0.8,en_US;q=0.6'
            },
            url: '/secure-proxy/api/locale',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['locale'] != 'undefined', "Locale is not returned");
                test.equal(result['locale'], 'ru', "Wrong locale is returned");
                test.done();
            }
        };

        this.api.locale(undefined, req, res);
    },

    testLogout: function (test) {
        var me = this;

        var sessionDeleted = false;
        this.db.deleteSession = function (sid) {
            sessionDeleted = sid;

            var defer = q.defer();
            defer.resolve();
            return defer.promise;
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['success'] != 'undefined', "success is not returned");
                test.equal(result['success'], true, "success is not set");
                test.equal(sessionDeleted, 'sid', "Wrong session deleted");
                test.done();
            }
        };

        this.db.createUser('login', 'password')
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () {
                me.api.logout('sid', undefined, res);
            });
    },
};
