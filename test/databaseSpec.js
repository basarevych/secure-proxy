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
            $last: params['$last'] || Math.round((new Date().getTime()) / 1000),
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

                        db.checkUserPassword(1, 'password')
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
                db.deleteUser(1)
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
                db.setUserPassword(1, 'passwd')
                    .then(function () {
                        db.checkUserPassword(1, 'passwd')
                            .then(function (match) {
                                expect(match).toBeTruthy();
                                db.checkUserPassword(1, 'wrong password')
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
                db.setUserEmail(1, 'new@email')
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT email"
                          + "   FROM users"
                          + "   WHERE id = $id"
                        );
                        sel.get(
                            {
                                $id: 1,
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
                db.generateUserOtpKey(1)
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT otp_key"
                          + "   FROM users"
                          + "   WHERE id = $id"
                        );
                        sel.get(
                            {
                                $id: 1,
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
                db.checkUserOtpKey(1, correct)
                    .then(function (match) {
                        expect(match).toBeTruthy();
                        done();
                    });
            });
    });

    it("sets user OTP confirmed", function (done) {
        createUser()
            .then(function () {
                db.setUserOtpConfirmed(1, true)
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT otp_confirmed"
                          + "   FROM users"
                          + "   WHERE id = $id"
                        );
                        sel.get(
                            {
                                $id: 1,
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

    it("selects session", function (done) {
        var time = Math.round((new Date().getTime()) / 1000);

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
        var time = Math.round((new Date().getTime()) / 1000) - 1;

        createUser()
            .then(function () { return db.createSession(1, 'sid'); })
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
        var time = Math.round((new Date().getTime()) / 1000);

        createUser()
            .then(function () { return createSession({ $last: time }); })
            .then(function () {
                db.deleteSession(1)
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

    it("deletes old sessions", function (done) {
        var time = Math.round((new Date().getTime()) / 1000);

        createUser()
            .then(function () { return createSession({ $sid: 'sid1', $last: time - 100 }); })
            .then(function () { return createSession({ $sid: 'sid2', $last: time - 10 }); })
            .then(function () {
                db.deleteOldSessions(50)
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
                                expect(rows[0]['sid']).toBe('sid2');
                                done();
                            }
                        );
                        sel.finalize();
                    });
            });
    });

    it("refreshes session", function (done) {
        var time = Math.round((new Date().getTime()) / 1000) - 1;

        createUser()
            .then(function () { return createSession({ $last: 0 }); })
            .then(function () {
                db.refreshSession(1)
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT last"
                          + "   FROM sessions"
                          + "   WHERE id = $id"
                        );
                        sel.get(
                            {
                                $id: 1
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
                db.setSessionPassword(1, true)
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT auth_password"
                          + "   FROM sessions"
                          + "   WHERE id = $id"
                        );
                        sel.get(
                            {
                                $id: 1
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
                db.setSessionOtp(1, true)
                    .then(function () {
                        var sel = engine.prepare(
                            "SELECT auth_otp"
                          + "   FROM sessions"
                          + "   WHERE id = $id"
                        );
                        sel.get(
                            {
                                $id: 1
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
