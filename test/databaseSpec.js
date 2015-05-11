'use strict';

var q               = require('q'),
    speakeasy       = require('speakeasy'),
    ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js');

describe("Database", function () {
    var sl, db, engine;

    beforeEach(function () {
        sl = new ServiceLocator();
        db = new Database(sl);

        db.dbFile = ':memory:';
        engine = db.getEngine();
    });

    function createUser(params) {
        var defer = q.defer();

        if (typeof params != 'object')
            params = {};
        var data = {
            $login: params['$login'] || 'login',
            $password: params['$password'] || 'password',
            $email: params['$email'] || 'foo@bar',
            $secret: params['$secret'] || 'secret',
            $otp_key: params['$otp_key'] || 'key',
            $otp_confirmed: params['$otp_confirmed'] || false,
        };

        var ins = engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, secret, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $secret, $otp_key, $otp_confirmed)"
        );
        ins.run(
            data,
            function (err) {
                if (err)
                    defer.reject();
                else
                    defer.resolve();
            }
        );
        ins.finalize();
        return defer.promise;
    }

    function createSession(params) {
        var defer = q.defer();

        if (typeof params != 'object')
            params = {};
        var data = {
            $user_id: params['$user_id'] || 1,
            $sid: params['$sid'] || 'sid',
            $last: params['$last'] || new Date().getTime(),
            $auth_password: params['$auth_password'] || false,
            $auth_otp: params['$auth_otp'] || false,
        };

        var ins = engine.prepare(
            "INSERT INTO"
          + "   sessions(user_id, sid, last, auth_password, auth_otp)"
          + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
        );
        ins.run(
            data,
            function (err) {
                if (err)
                    defer.reject();
                else
                    defer.resolve();
            }
        );
        ins.finalize();
        return defer.promise;
    }

    it("user exists", function (done) {
        createUser()
            .then(function () {
                db.userExists('login')
                    .then(function (exists) {
                        expect(exists).toBeTruthy();
                        db.userExists('non-existing')
                            .then(function (exists) {
                                expect(exists).toBeFalsy();
                                done();
                            });
                    });
            });
    });

    it("selects users", function (done) {
        createUser()
            .then(function () {
                db.selectUsers()
                    .then(function (users) {
                        expect(users.length).toBe(1);
                        expect(users[0]).toEqual({
                            id: 1,
                            login: 'login',
                            password: 'password',
                            email: 'foo@bar',
                            secret: 'secret',
                            otp_key: 'key',
                            otp_confirmed: 0,
                        });
                        done();
                    });
            });
     });

    it("creates user", function (done) {
        db.createUser('login', 'password', 'foo@bar')
            .then(function () {
                var sel = engine.prepare(
                    "SELECT *"
                  + "   FROM users"
                );
                sel.all(
                    { },
                    function (err, rows) {
                        expect(err).toBeNull();

                        expect(rows.length).toBe(1);
                        expect(rows[0]['login']).toBe('login');
                        expect(rows[0]['email']).toBe('foo@bar');

                        db.checkUserPassword('login', 'password')
                            .then(function (match) {
                                expect(match).toBeTruthy();
                                done();
                            });
                    }
                );
                sel.finalize();
            });
    });

    it("deletes user", function (done) {
        createUser()
            .then(function () {
                db.deleteUser('login')
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT *"
                          + "   FROM users"
                        );
                        sel.all(
                            { },
                            function (err, rows) {
                                expect(err).toBeNull();
                                expect(rows.length).toBe(0);
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });

    it("sets and checks password", function (done) {
        createUser()
            .then(function () {
                db.setUserPassword('login', 'passwd')
                    .then(function () {
                        db.checkUserPassword('login', 'passwd')
                            .then(function (match) {
                                expect(match).toBeTruthy();
                                db.checkUserPassword('login', 'wrong password')
                                    .then(function (match) {
                                        expect(match).toBeFalsy();
                                        done();
                                    });
                            });
                    });
            });
    });

    it("sets user email", function (done) {
        createUser()
            .then(function () {
                db.setUserEmail('login', 'new@email')
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT email"
                          + "   FROM users"
                          + "   WHERE login = $login"
                        );
                        sel.get(
                            {
                                $login: 'login',
                            },
                            function (err, row) {
                                expect(err).toBeNull();
                                expect(row['email']).toBe('new@email');
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });

    it("generates user OTP key", function (done) {
        createUser({ $otp_key: 'DEADBEEF' })
            .then(function () {
                db.generateUserOtpKey('login')
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT otp_key"
                          + "   FROM users"
                          + "   WHERE login = $login"
                        );
                        sel.get(
                            {
                                $login: 'login',
                            },
                            function (err, row) {
                                expect(err).toBeNull();
                                expect(row['otp_key'].length).toBeGreaterThan(0);
                                expect(row['otp_key']).not.toBe('DEADBEEF');
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });

    it("checks user OTP key", function (done) {
        createUser({ $otp_key: 'DEADBEEF' })
            .then(function () {
                var correct = speakeasy.time({ key: 'DEADBEEF', encoding: 'base32' });
                db.checkUserOtpKey('login', correct)
                    .then(function (match) {
                        expect(match).toBeTruthy();
                        done();
                    });
            });
    });

    it("sets user OTP confirmed", function (done) {
        createUser()
            .then(function () {
                db.setUserOtpConfirmed('login', true)
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT otp_confirmed"
                          + "   FROM users"
                          + "   WHERE login = $login"
                        );
                        sel.get(
                            {
                                $login: 'login',
                            },
                            function (err, row) {
                                expect(err).toBeNull();
                                expect(row['otp_confirmed']).toBeTruthy();
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });

    it("session exists", function (done) {
        createUser()
            .then(function () { return createSession(); })
            .then(function () {
                db.sessionExists('sid')
                    .then(function (exists) {
                        expect(exists).toBeTruthy();
                        db.sessionExists('non-existing')
                            .then(function (exists) {
                                expect(exists).toBeFalsy();
                                done();
                            });
                    });
            });
    });

    it("selects session", function (done) {
        var time = new Date().getTime();

        createUser()
            .then(function () { return createSession({ $last: time }); })
            .then(function () {
                db.selectSessions()
                    .then(function (sessions) {
                        expect(sessions.length).toBe(1);
                        expect(sessions[0]).toEqual({
                            id: 1,
                            user_id: 1,
                            login: 'login',
                            sid: 'sid',
                            last: time,
                            auth_password: 0,
                            auth_otp: 0
                        });
                        done();
                    });
            });
    });

    it("creates session", function (done) {
        var time = new Date().getTime() - 1;

        createUser()
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () {
                var sel = engine.prepare(
                    "SELECT *"
                  + "   FROM sessions"
                );
                sel.all(
                    { },
                    function (err, rows) {
                        expect(err).toBeNull();
                        expect(rows.length).toBe(1);

                        expect(rows[0]['sid']).toBe('sid');
                        expect(rows[0]['last']).toBeGreaterThan(time);
                        expect(rows[0]['auth_password']).toBeFalsy();
                        expect(rows[0]['auth_otp']).toBeFalsy();

                        done();
                    }
                );
                sel.finalize();
            });
    });

    it("deletes session", function (done) {
        var time = new Date().getTime();

        createUser()
            .then(function () { return createSession({ $last: time }); })
            .then(function () {
                db.deleteSession('sid')
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT *"
                          + "   FROM sessions"
                        );
                        sel.all(
                            { },
                            function (err, rows) {
                                expect(err).toBeNull();
                                expect(rows.length).toBe(0);
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });

    it("refreshes session", function (done) {
        var time = new Date().getTime() - 1;

        createUser()
            .then(function () { return createSession({ $last: 0 }); })
            .then(function () {
                db.refreshSession('sid')
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT last"
                          + "   FROM sessions"
                          + "   WHERE sid = $sid"
                        );
                        sel.get(
                            {
                                $sid: 'sid'
                            },
                            function (err, row) {
                                expect(err).toBeNull();
                                expect(row['last']).toBeGreaterThan(time);
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });

    it("sets session password", function (done) {
        createUser()
            .then(function () { return createSession(); })
            .then(function () {
                db.setSessionPassword('sid', true)
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT auth_password"
                          + "   FROM sessions"
                          + "   WHERE sid = $sid"
                        );
                        sel.get(
                            {
                                $sid: 'sid'
                            },
                            function (err, row) {
                                expect(err).toBeNull();
                                expect(row['auth_password']).toBeTruthy();
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });

    it("sets session OTP", function (done) {
        createUser()
            .then(function () { return createSession(); })
            .then(function () {
                db.setSessionOtp('sid', true)
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT auth_otp"
                          + "   FROM sessions"
                          + "   WHERE sid = $sid"
                        );
                        sel.get(
                            {
                                $sid: 'sid'
                            },
                            function (err, row) {
                                expect(err).toBeNull();
                                expect(row['auth_otp']).toBeTruthy();
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });
});
