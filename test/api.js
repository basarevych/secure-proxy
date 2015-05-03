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
                name: 'Example',
            },
        };
        this.sl.set('config', this.config);

        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    testInitSetsLocaleCookie: function (test) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/init?set_locale=en',
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

        this.api.init('sid', req, res);
    },

    testInitReadsCookie: function (test) {
        var req = {
            headers: {
                cookie: 'foobarlocale=en',
            },
            url: '/secure-proxy/api/init',
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

        this.api.init('sid', req, res);
    },

    testInitAutoselectsLocale: function (test) {
        var req = {
            headers: {
                'accept-language': 'ru_RU,ru;q=0.8,en_US;q=0.6'
            },
            url: '/secure-proxy/api/init',
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

        this.api.init('sid', req, res);
    },

    testInitSetsSid: function (test) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/init',
        };

        var res = {
            writeHead: function (code, headers) {
            },
            end: function (html) {
                var result = JSON.parse(html);
                test.ok(typeof result['sid'] != 'undefined', "SID is not returned");
                test.equal(result['sid'], 'sid', "Wrong SID is returned");
                test.done();
            }
        };

        this.api.init('sid', req, res);
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

    testAuthValidPassword: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/auth?login=login&password=password',
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

    testAuthInvalidPassword: function (test) {
        var me = this;

        var req = {
            headers: {},
            url: '/secure-proxy/api/auth?login=login&password=password',
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

        this.db.createUser('login', 'invalid password', 'foo@bar')
            .then(function () {
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
                me.db.selectUser('login')
                    .then(function (user) {
                        test.ok(typeof result['qr_code'] == 'undefined', "qr_code should not be returned");
                        test.done();
                    });
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

    testOtpCheckCorrectPassword: function (test) {
        var me = this;

        var checkedLogin, checkedOtp;
        this.db.checkUserOtp = function (login, otp) {
            checkedLogin = login;
            checkedOtp = otp;

            var defer = q.defer();
            defer.resolve(true);
            return defer.promise;
        };

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
                test.equal(checkedLogin, 'login', 'Wrong login checked for OTP');
                test.equal(checkedOtp, 'foobar', 'Wrong password checked for OTP');
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

    testOtpCheckIncorrectPassword: function (test) {
        var me = this;

        var checkedLogin, checkedOtp;
        this.db.checkUserOtp = function (login, otp) {
            checkedLogin = login;
            checkedOtp = otp;

            var defer = q.defer();
            defer.resolve(false);
            return defer.promise;
        };

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
                test.equal(checkedLogin, 'login', 'Wrong login checked for OTP');
                test.equal(checkedOtp, 'foobar', 'Wrong password checked for OTP');
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
            url: '/secure-proxy/api/otp?action=reset&key=foobar',
        };

        var returnedCode, oldKey;
        var res = {
            writeHead: function (code, headers) {
                returnedCode = code;
            },
            end: function (html) {
                test.equal(returnedCode, 302, "Wrong HTTP code returned");
                me.db.selectUser('login')
                    .then(function (user) {
                        test.notEqual(user['otp_key'], oldKey, "otp_key was not changed");
                        test.equal(user['otp_confirmed'], false, "otp_confirmed was not reset");
                        test.done();
                    });
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid'); })
            .then(function () { return me.db.setSessionPassword('sid', true); })
            .then(function () { return me.db.selectUser('login'); })
            .then(function (user) {
                oldKey = user['otp_key'];
                req.url = '/secure-proxy/api/otp?action=reset&key=' + user['otp_key'];
                me.api.otp('sid', req, res);
            });
    },
};
