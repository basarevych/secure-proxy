'use strict';

var speakeasy       = require('speakeasy'),
    ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js');

module.exports = {
    setUp: function (callback) {
        this.sl = new ServiceLocator();
        this.db = new Database(this.sl);

        this.db.dbFile = ':memory:';
        this.engine = this.db.getEngine();

        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    testUserExists: function (test) {
        var me = this;

        var ins = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                me.db.userExists('login')
                    .then(function (exists) {
                        test.equal(exists, true, "User reported as non-existing");
                        me.db.userExists('non-existing')
                            .then(function (exists) {
                                test.equal(exists, false, "User reported as existing");
                                test.done();
                            });
                    });
            }
        );
        ins.finalize();
    },

    testSelectUser: function (test) {
        var me = this;

        var ins = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                me.db.selectUser('login')
                    .then(function (user) {
                        test.deepEqual(
                            user,
                            {
                                id: 1,
                                login: 'login',
                                password: 'password',
                                email: 'foo@bar',
                                otp_key: 'key',
                                otp_confirmed: false,
                            },
                            "Wrong data returned"
                        );
                        test.done();
                    });
            }
        );
        ins.finalize();
     },

    testCreateUser: function (test) {
        var me = this;

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () {
                var sel = me.engine.prepare(
                    "SELECT *"
                  + "   FROM users"
                );
                sel.all(
                    { },
                    function (err, rows) {
                        test.ifError(err);
                        test.equal(rows.length, 1, "One row should be returned");

                        test.equal(rows[0]['login'], 'login', "Incorrect login was saved");
                        test.equal(rows[0]['email'], 'foo@bar', "Incorrect email was saved");

                        me.db.checkUserPassword('login', 'password')
                            .then(function (match) {
                                test.equal(match, true, "Incorrect password was saved");
                                test.done();
                            });
                    }
                );
                sel.finalize();
            });
    },

    testDeleteUser: function (test) {
        var me = this;

        var ins = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                me.db.deleteUser('login')
                    .then(function () {
                        var sel = me.engine.prepare(
                            "SELECT *"
                          + "   FROM users"
                        );
                        sel.all(
                            { },
                            function (err, rows) {
                                test.ifError(err);
                                test.equal(rows.length, 0, "Zero rows should be returned");
                                test.done();
                            }
                        );
                        sel.finalize();
                    });
            }
        );
        ins.finalize();
    },

    testSetCheckPassword: function (test) {
        var me = this;

        var ins = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                me.db.setUserPassword('login', 'passwd')
                    .then(function () {
                        me.db.checkUserPassword('login', 'passwd')
                            .then(function (match) {
                                test.equal(match, true, "Correct password not passed");
                                me.db.checkUserPassword('login', 'wrong password')
                                    .then(function (match) {
                                        test.equal(match, false, "Incorrect password passed");
                                        test.done();
                                    });
                            });
                    });
            }
        );
        ins.finalize();
    },

    testGenerateUserOtpKey: function (test) {
        var me = this;

        var ins = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'DEADBEEF',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                me.db.generateUserOtpKey('login')
                    .then(function () {
                        var sel = me.engine.prepare(
                            "SELECT otp_key"
                          + "   FROM users"
                          + "   WHERE login = $login"
                        );
                        sel.get(
                            {
                                $login: 'login',
                            },
                            function (err, row) {
                                test.ifError(err);
                                test.equal(row['otp_key'].length > 0, true, "otp_key is incorrect");
                                test.notEqual(row['otp_key'], 'DEADBEEF', "otp_key is not changed");
                                test.done();
                            }
                        );
                        sel.finalize();
                    });
            }
        );
        ins.finalize();
     },

    testCheckUserOtpKey: function (test) {
        var me = this;

        var ins = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'DEADBEEF',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                var correct = speakeasy.time({ key: 'DEADBEEF', encoding: 'base32' });
                me.db.checkUserOtpKey('login', correct)
                    .then(function (match) {
                        test.equal(match, true, "Correct OTP not passed");
                        test.done();
                    });
            }
        );
        ins.finalize();
     },

    testSessionExists: function (test) {
        var me = this;

        var ins1 = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins1.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                var ins2 = me.engine.prepare(
                    "INSERT INTO"
                  + "   sessions(user_id, sid, last, auth_password, auth_otp)"
                  + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
                );
                ins2.run(
                    {
                        $user_id: 1,
                        $sid: 'sid',
                        $last: new Date().getTime(),
                        $auth_password: false,
                        $auth_otp: false,
                    },
                    function (err) {
                        test.ifError(err);
                        me.db.sessionExists('sid')
                            .then(function (exists) {
                                test.equal(exists, true, "Session reported as non-existing");
                                me.db.sessionExists('non-existing')
                                    .then(function (exists) {
                                        test.equal(exists, false, "Session reported as existing");
                                        test.done();
                                    });
                            });
                    }
                );
                ins2.finalize();
            }
        );
        ins1.finalize();
    },

    testSelectSession: function (test) {
        var me = this,
            time = new Date().getTime();

        var ins1 = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins1.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                var ins2 = me.engine.prepare(
                    "INSERT INTO"
                  + "   sessions(user_id, sid, last, auth_password, auth_otp)"
                  + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
                );
                ins2.run(
                    {
                        $user_id: 1,
                        $sid: 'sid',
                        $last: time,
                        $auth_password: false,
                        $auth_otp: false,
                    },
                    function (err) {
                        test.ifError(err);
                        me.db.selectSession('sid')
                            .then(function (session) {
                                test.deepEqual(
                                    session,
                                    {
                                        id: 1,
                                        user_id: 1,
                                        login: 'login',
                                        sid: 'sid',
                                        last: time,
                                        auth_password: false,
                                        auth_otp: false
                                    },
                                    "Wrong data returned"
                                );
                                test.done();
                            });
                    }
                );
                ins2.finalize();
            }
        );
        ins1.finalize();
    },

    testCreateSession: function (test) {
        var me = this,
            time = new Date().getTime();

        var ins = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                me.db.createSession('login', 'sid')
                    .then(function () {
                        var sel = me.engine.prepare(
                            "SELECT *"
                          + "   FROM sessions"
                        );
                        sel.all(
                            { },
                            function (err, rows) {
                                test.ifError(err);
                                test.equal(rows.length, 1, "One row should be returned");

                                test.equal(rows[0]['sid'], 'sid', "sid is incorrect");
                                test.ok(rows[0]['last'] >= time, "last is incorrect");
                                test.equal(rows[0]['auth_password'], false, "auth_password is incorrect");
                                test.equal(rows[0]['auth_otp'], false, "auth_otp is incorrect");

                                test.done();
                            }
                        );
                        sel.finalize();
                    });
            }
        );
        ins.finalize();
    },

    testDeleteSession: function (test) {
        var me = this,
            time = new Date().getTime();

        var ins1 = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins1.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                var ins2 = me.engine.prepare(
                    "INSERT INTO"
                  + "   sessions(user_id, sid, last, auth_password, auth_otp)"
                  + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
                );
                ins2.run(
                    {
                        $user_id: 1,
                        $sid: 'sid',
                        $last: time,
                        $auth_password: false,
                        $auth_otp: false,
                    },
                    function (err) {
                        test.ifError(err);
                        me.db.deleteSession('sid')
                            .then(function () {
                                var sel = me.engine.prepare(
                                    "SELECT *"
                                  + "   FROM sessions"
                                );
                                sel.all(
                                    { },
                                    function (err, rows) {
                                        test.ifError(err);
                                        test.equal(rows.length, 0, "Zero rows should be returned");
                                        test.done();
                                    }
                                );
                                sel.finalize();
                            });
                    }
                );
                ins2.finalize();
            }
        );
        ins1.finalize();
    },

    testRefreshSession: function (test) {
        var me = this,
            time = new Date().getTime();

        var ins1 = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins1.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                var ins2 = me.engine.prepare(
                    "INSERT INTO"
                  + "   sessions(user_id, sid, last, auth_password, auth_otp)"
                  + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
                );
                ins2.run(
                    {
                        $user_id: 1,
                        $sid: 'sid',
                        $last: 0,
                        $auth_password: false,
                        $auth_otp: false,
                    },
                    function (err) {
                        test.ifError(err);
                        me.db.refreshSession('sid')
                            .then(function () {
                                var sel = me.engine.prepare(
                                    "SELECT last"
                                  + "   FROM sessions"
                                  + "   WHERE sid = $sid"
                                );
                                sel.get(
                                    {
                                        $sid: 'sid'
                                    },
                                    function (err, row) {
                                        test.ifError(err);
                                        test.equal(row['last'] >= time, true, "last is incorrect");
                                        test.done();
                                    }
                                );
                                sel.finalize();
                            });
                    }
                );
                ins2.finalize();
            }
        );
        ins1.finalize();
    },

    testSetSessionPassword: function (test) {
        var me = this,
            time = new Date().getTime();

        var ins1 = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins1.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                var ins2 = me.engine.prepare(
                    "INSERT INTO"
                  + "   sessions(user_id, sid, last, auth_password, auth_otp)"
                  + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
                );
                ins2.run(
                    {
                        $user_id: 1,
                        $sid: 'sid',
                        $last: 0,
                        $auth_password: false,
                        $auth_otp: false,
                    },
                    function (err) {
                        test.ifError(err);
                        me.db.setSessionPassword('sid', true)
                            .then(function () {
                                var sel = me.engine.prepare(
                                    "SELECT auth_password"
                                  + "   FROM sessions"
                                  + "   WHERE sid = $sid"
                                );
                                sel.get(
                                    {
                                        $sid: 'sid'
                                    },
                                    function (err, row) {
                                        test.ifError(err);
                                        test.equal(row['auth_password'], true, "auth_password is incorrect");
                                        test.done();
                                    }
                                );
                                sel.finalize();
                            });
                    }
                );
                ins2.finalize();
            }
        );
        ins1.finalize();
    },

    testSetSessionOtp: function (test) {
        var me = this,
            time = new Date().getTime();

        var ins1 = this.engine.prepare(
            "INSERT INTO"
          + "   users(login, password, email, otp_key, otp_confirmed)"
          + "   VALUES($login, $password, $email, $otp_key, $otp_confirmed)"
        );
        ins1.run(
            {
                $login: 'login',
                $password: "password",
                $email: 'foo@bar',
                $otp_key: 'key',
                $otp_confirmed: false,
            },
            function (err) {
                test.ifError(err);
                var ins2 = me.engine.prepare(
                    "INSERT INTO"
                  + "   sessions(user_id, sid, last, auth_password, auth_otp)"
                  + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
                );
                ins2.run(
                    {
                        $user_id: 1,
                        $sid: 'sid',
                        $last: 0,
                        $auth_password: false,
                        $auth_otp: false,
                    },
                    function (err) {
                        test.ifError(err);
                        me.db.setSessionOtp('sid', true)
                            .then(function () {
                                var sel = me.engine.prepare(
                                    "SELECT auth_otp"
                                  + "   FROM sessions"
                                  + "   WHERE sid = $sid"
                                );
                                sel.get(
                                    {
                                        $sid: 'sid'
                                    },
                                    function (err, row) {
                                        test.ifError(err);
                                        test.equal(row['auth_otp'], true, "auth_otp is incorrect");
                                        test.done();
                                    }
                                );
                                sel.finalize();
                            });
                    }
                );
                ins2.finalize();
            }
        );
        ins1.finalize();
    },

};
