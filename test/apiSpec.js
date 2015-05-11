'use strict';

var q               = require('q'),
    speakeasy       = require('speakeasy'),
    ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js'),
    Front           = require('../src/front.js'),
    Api             = require('../src/api.js'),
    Email           = require('../src/email.js'),
    Globalize       = require('../src/globalize.js');

describe("API", function () {
    var sl, db, front, api, email, globalize;
    var res;

    beforeEach(function () {
        sl = new ServiceLocator();
        db = new Database(sl);
        front = new Front(sl);
        api = new Api(sl);
        email = new Email(sl);
        globalize = new Globalize(sl);

        db.dbFile = ":memory:";

        var config = {
            namespace: 'foobar',
            otp: {
                enable: true,
                name: 'Example',
            },
            http: {
                base_url: 'http://coffin.lan:8000/',
            }
        };
        sl.setAllowOverride(true);
        sl.set('config', config);

        res = createSpyObj('res', [ 'setHeader', 'writeHead', 'end' ]);
    });

    it("locale sets cookie", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/locale?set=en',
        };

        var returnedHeaders = {};
        res.setHeader.andCallFake(function (name, content) {
            returnedHeaders[name] = content;
        });

        res.end.andCallFake(function (html) {
            expect(res.setHeader).toHaveBeenCalled();
            expect(returnedHeaders['set-cookie'].indexOf('foobarlocale=en')).not.toBe(-1);
            done();
        });

        api.locale('http', 'sid', req, res);
    });

    it("locale reads cookie", function (done) {
        var req = {
            headers: {
                cookie: 'foobarlocale=en',
            },
            url: '/secure-proxy/api/locale',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['locale']).toBe('en');
            done();
        });

        api.locale('http', 'sid', req, res);
    });

    it("locale autoselect works", function (done) {
        var req = {
            headers: {
                'accept-language': 'ru_RU,ru;q=0.8,en_US;q=0.6'
            },
            url: '/secure-proxy/api/locale',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['locale']).toBe('ru');
            done();
        });

        api.locale('http', 'sid', req, res);
    });

    it("logout", function (done) {
        spyOn(db, 'deleteSession').andCallThrough();

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['success']).toBeTruthy();
            expect(db.deleteSession).toHaveBeenCalledWith('sid');
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () {
                api.logout('http', 'sid', undefined, res);
            });
    });

    it("auth with valid password", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/auth?action=check&login=login&password=password',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['success']).toBeTruthy();
            expect(result['next']).toBe('otp');
            db.selectSessions({ sid: 'sid' })
                .then(function (sessions) {
                    var session = sessions.length && sessions[0];
                    expect(session['auth_password']).toBeTruthy();
                    done();
                });
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () {
                api.auth('http', 'sid', req, res);
            });
    });

    it("auth with invalid password", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/auth?action=check&login=login&password=password',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['success']).toBeFalsy();
            done();
        });

        db.createUser('login', 'other password', 'foo@bar')
            .then(function () {
                api.auth('http', 'sid', req, res);
            });
    });

    it("auth sets password", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/auth?action=set&password=password&secret=foobar',
        };

        var oldSecret;
        res.end.andCallFake(function (html) {
            db.selectUsers({ login: 'login' })
                .then(function (users) {
                    var user = users.length && users[0];
                    db.checkUserPassword('login', 'password')
                        .then(function (match) {
                            var result = JSON.parse(html);
                            expect(result['success']).toBeTruthy();
                            expect(user['secret']).not.toBe(oldSecret);
                            expect(match).toBeTruthy();
                            done();
                        });
                });
        });

        db.createUser('login', 'old password', 'foo@bar')
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () { return db.selectUsers({ login: 'login' }); })
            .then(function (users) {
                var user = users.length && users[0];
                oldSecret = user['secret'];
                req.url = '/secure-proxy/api/auth?action=set&password=password&secret=' + user['secret'],
                api.auth('http', 'sid', req, res);
            });
    });

    it("otp with invalid session", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=get',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['success']).toBeFalsy();
            expect(result['next']).toBe('password');
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () {
                api.otp('http', 'sid', req, res);
            });
    });

    it("otp returns qr code", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=get',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            db.selectUsers({ login: 'login' })
                .then(function (users) {
                    var user = users.length && users[0];
                    expect(result['qr_code']).toBe('otpauth://totp/Example?secret=' + user['otp_key'], "Wrong qr_code");
                    done();
                });
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () { return db.setSessionPassword('sid', true); })
            .then(function () {
                api.otp('http', 'sid', req, res);
            });
    });

    it("otp no qr code second time", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=get',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['qr_code']).not.toBeDefined();
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.setUserOtpConfirmed('login', true); })
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () { return db.setSessionPassword('sid', true); })
            .then(function () {
                api.otp('http', 'sid', req, res);
            });
    });

    it("otp with correct code", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=check&otp=foobar',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['success']).toBeTruthy();
            expect(result['next']).toBe('done');
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () { return db.setSessionPassword('sid', true); })
            .then(function () { return db.selectUsers({ login: 'login' }); })
            .then(function (users) {
                var user = users.length && users[0];
                var correct = speakeasy.time({ key: user['otp_key'], encoding: 'base32' });
                req.url = '/secure-proxy/api/otp?action=check&otp=' + correct;
                api.otp('http', 'sid', req, res);
            });
    });

    it("otp with incorrect code", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=check&otp=foobar',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['success']).toBeFalsy();
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () { return db.setSessionPassword('sid', true); })
            .then(function () {
                api.otp('http', 'sid', req, res);
            });
    });

    it("otp resets code", function (done) {
        var req = {
            headers: {},
            url: '/secure-proxy/api/otp?action=reset&secret=foobar',
        };

        var oldSecret;
        res.end.andCallFake(function (html) {
            db.selectUsers({ login: 'login' })
                .then(function (users) {
                    var user = users.length && users[0];
                    var result = JSON.parse(html);
                    expect(result['success']).toBeTruthy();
                    expect(user['secret']).not.toBe(oldSecret);
                    expect(user['otp_confirmed']).toBeFalsy();
                    done();
                });
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.setUserOtpConfirmed('login', true); })
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () { return db.setSessionPassword('sid', true); })
            .then(function () { return db.selectUsers({ login: 'login' }); })
            .then(function (users) {
                var user = users.length && users[0];
                oldSecret = user['secret'];
                req.url = '/secure-proxy/api/otp?action=reset&secret=' + user['secret'];
                api.otp('http', 'sid', req, res);
            });
    });

    it("reset password request works", function (done) {
        var hasText = false, hasHtml = false;
        spyOn(email, 'send').andCallFake(function (params) {
            hasText = params['text'] && params['text'].length > 0;
            hasHtml = params['html'] && params['html'].length > 0;

            var defer = q.defer();
            defer.resolve();
            return defer.promise;
        });

        var req = {
            headers: {
                host: 'localhost:8000',
            },
            url: 'http://localhost:8000/secure-proxy/api/reset-request?type=password'
                + '&email=' + encodeURIComponent('foo@bar')
                + '&lang=en',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['success']).toBeTruthy();
            expect(hasText).toBeTruthy();
            expect(hasHtml).toBeTruthy();
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () {
                api.resetRequest('http', 'sid', req, res);
            });
    });

    it("reset otp request works", function (done) {
        var hasText = false, hasHtml = false;
        spyOn(email, 'send').andCallFake(function (params) {
            hasText = params['text'] && params['text'].length > 0;
            hasHtml = params['html'] && params['html'].length > 0;

            var defer = q.defer();
            defer.resolve();
            return defer.promise;
        });

        var req = {
            headers: {
                host: 'localhost:8000',
            },
            url: 'http://localhost:8000/secure-proxy/api/reset-request?type=otp'
                + '&email=' + encodeURIComponent('foo@bar')
                + '&lang=en',
        };

        res.end.andCallFake(function (html) {
            var result = JSON.parse(html);
            expect(result['success']).toBeTruthy();
            expect(hasText).toBeTruthy();
            expect(hasHtml).toBeTruthy();
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () {
                api.resetRequest('http', 'sid', req, res);
            });
    });
});
