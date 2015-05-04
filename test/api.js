'use strict';

var q               = require('q'),
    speakeasy       = require('speakeasy'),
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
                name: 'Example',
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

        this.api.locale('sid', req, res);
    },

    testLocaleReadsCookie: function (test) {
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

        this.api.locale('sid', req, res);
    },

    testLocaleAutoselectWorks: function (test) {
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

        this.api.locale('sid', req, res);
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
                test.equal(result['success'], true, "success is incorrect");
                test.equal(sessionDeleted, 'sid', "Wrong session deleted");
                test.done();
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () {
                me.api.logout('sid', undefined, res);
            });
    },

    testAuthCheckValidPassword: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/auth?action=check&login=login&password=password',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['success'] != 'undefined', "success is not returned");
                test.equal(result['success'], true, "success is incorrect");
                test.ok(typeof result['next'] != 'undefined', "next is not returned");
                test.equal(result['next'], 'otp', "next is not set to otp");
                me.db.selectSession('sid')
                    .then(function (session) {
                        test.equal(session['auth_password'], true, "auth_password is not set");
                        test.done();
                    });
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () {
                me.api.auth('sid', req, res);
            });
    },

    testAuthCheckInvalidPassword: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/auth?action=check&login=login&password=password',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['success'] != 'undefined', "success is not returned");
                test.equal(result['success'], false, "success is incorrect");
                test.done();
            }
        };

        this.db.createUser('login', 'other password', 'foo@bar')
            .then(function () {
                me.api.auth('sid', req, res);
            });
    },

    testAuthSet: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/auth?action=set&login=login&password=password&secret=foobar',
        };

        var oldSecret;
        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                me.db.selectUser('login')
                    .then(function (user) {
                        me.db.checkUserPassword('login', 'password')
                            .then(function (match) {
                                var result = JSON.parse(html);
                                test.ok(typeof result['success'] != 'undefined', "success is not returned");
                                test.equal(result['success'], true, "success is incorrect");
                                test.notEqual(user['secret'], oldSecret, "secret was not changed");
                                test.ok(match, "New password is wrong");
                                test.done();
                            });
                    });
            }
        };

        this.db.createUser('login', 'old password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () { return me.db.selectUser('login'); })
            .then(function (user) {
                oldSecret = user['secret'];
                req.url = '/secure-proxy/api/auth?action=set&login=login&password=password&secret=' + user['secret'],
                me.api.auth('sid', req, res);
            });
    },

    testOtpInvalidSession: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=get',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['success'] != 'undefined', "success is not returned");
                test.equal(result['success'], false, "success is incorrect");
                test.ok(typeof result['next'] != 'undefined', "next is not returned");
                test.equal(result['next'], 'password', "next is not set to password");
                test.done();
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () {
                me.api.otp('sid', req, res);
            });
    },

    testOtpGetNew: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=get',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                me.db.selectUser('login')
                    .then(function (user) {
                        test.ok(typeof result['qr_code'] != 'undefined', "qr_code is not returned");
                        test.equal(result['qr_code'], 'otpauth://totp/Example?secret=' + user['otp_key'], "Wrong qr_code");
                        test.done();
                    });
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () { return me.db.setSessionPassword('sid', true); })
            .then(function () {
                me.api.otp('sid', req, res);
            });
    },

    testOtpReGet: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=get',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['qr_code'] == 'undefined', "qr_code should not be returned");
                test.done();
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.setUserOtpConfirmed('login', true); })
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () { return me.db.setSessionPassword('sid', true); })
            .then(function () {
                me.api.otp('sid', req, res);
            });
    },

    testOtpCheckCorrectCode: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=check&otp=foobar',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['success'] != 'undefined', "success is not returned");
                test.equal(result['success'], true, "success is incorrect");
                test.ok(typeof result['next'] != 'undefined', "next is not returned");
                test.equal(result['next'], 'done', "next is not set to done");
                test.done();
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () { return me.db.setSessionPassword('sid', true); })
            .then(function () { return me.db.selectUser('login'); })
            .then(function (user) {
                var correct = speakeasy.time({ key: user['otp_key'], encoding: 'base32' });
                req.url = '/secure-proxy/api/otp?action=check&otp=' + correct;
                me.api.otp('sid', req, res);
            });
    },

    testOtpCheckIncorrectCode: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=check&otp=foobar',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['success'] != 'undefined', "success is not returned");
                test.equal(result['success'], false, "success is incorrect");
                test.done();
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () { return me.db.setSessionPassword('sid', true); })
            .then(function () {
                me.api.otp('sid', req, res);
            });
    },

    testOtpReset: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=reset&secret=foobar',
        };

        var oldSecret;
        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                me.db.selectUser('login')
                    .then(function (user) {
                        test.notEqual(user['secret'], oldSecret, "secret was not changed");
                        test.equal(user['otp_confirmed'], false, "otp_confirmed was not reset");
                        test.done();
                    });
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.setUserOtpConfirmed('login', true); })
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () { return me.db.setSessionPassword('sid', true); })
            .then(function () { return me.db.selectUser('login'); })
            .then(function (user) {
                oldSecret = user['secret'];
                req.url = '/secure-proxy/api/otp?action=reset&secret=' + user['secret'];
                me.api.otp('sid', req, res);
            });
    },
};
