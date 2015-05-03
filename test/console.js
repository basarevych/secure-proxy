'use strict';

var q               = require('q'),
    ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js'),
    Console         = require('../src/console.js');

module.exports = {
    setUp: function (callback) {
        this.sl = new ServiceLocator();
        this.db = new Database(this.sl);
        this.cons = new Console(this.sl);

        this.db.dbFile = ":memory:";

        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    testListUsers: function (test) {
        var me = this;

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.generateUserOtp('login'); })
            .then(function () { return me.db.selectUser('login'); })
            .then(function (user) {
                var output = [];
                me.cons.rl = { 
                    write: function (line) {
                        var sublines = line.split("\n");
                        for (var i = 0; i < sublines.length; i++)
                            output.push(sublines[i]);
                    },
                    close: function () {
                        test.equal(checkArray(output, /ID:\s+1$/), true, "id is missing");
                        test.equal(checkArray(output, /Login:\s+login$/), true, "login is missing");
                        test.equal(checkArray(output, /Password:\s+(\S+)/, user['password']), true, "password is missing");
                        test.equal(checkArray(output, /Email:\s+foo@bar$/), true, "email is missing");
                        test.equal(checkArray(output, /OTP Key:\s+(\S+)/, user['otp_key']), true, "otp_key is missing");
                        test.done();
                    }
                };
                me.cons.listUsers();
            });
    },

    testUpdateUserCreates: function (test) {
        var defer = q.defer(), newLogin, newPassword, newEmail;
        this.db.createUser = function (login, password, email) {
            newLogin = login;
            newPassword = password;
            newEmail = email;
            defer.resolve();
            return defer.promise;
        };

        var question = 0;
        this.cons.rl = {
            write: function () {},
            question: function(text, cb) {
                switch (++question) {
                    case 1: cb('login'); break;
                    case 2: cb('password'); break;
                    case 3: cb('foo@bar'); break;
                }
            },
            close: function () {
                test.equal(newLogin, 'login', "Login is wrong");
                test.equal(newPassword, 'password', "Password is wrong");
                test.equal(newEmail, 'foo@bar', "Email is wrong");
                test.done();
            }
        };

        this.cons.updateUser();
    },

    testUpdateUserModifies: function (test) {
        var me = this;

        var defer = q.defer(), newLogin, newPassword, newEmail;
        this.db.setUserPassword = function (login, password) {
            newLogin = login;
            newPassword = password;
            defer.resolve();
            return defer.promise;
        };
        this.db.setUserEmail = function (login, email) {
            newEmail = email;
            defer.resolve();
            return defer.promise;
        };

        var question = 0;
        this.cons.rl = {
            write: function () {},
            question: function(text, cb) {
                switch (++question) {
                    case 1: cb('login'); break;
                    case 2: cb('password'); break;
                    case 3: cb('foo@bar'); break;
                }
            },
            close: function () {
                test.equal(newLogin, 'login', "Login is wrong");
                test.equal(newPassword, 'password', "Password is wrong");
                test.equal(newEmail, 'foo@bar', "Email is wrong");
                test.done();
            }
        };

        this.db.createUser('login', 'old password', 'old foo@bar')
            .then(function () {
                me.cons.updateUser();
            });
    },

    testDeleteUser: function (test) {
        var me = this;

        var defer = q.defer(), deletedUser;
        this.db.deleteUser = function (login) {
            deletedUser = login;
            defer.resolve();
            return defer.promise;
        };

        this.cons.rl = {
            write: function () {},
            question: function(text, cb) {
                cb('login');
            },
            close: function () {
                test.equal(deletedUser, 'login', "Login is wrong");
                test.done();
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () {
                me.cons.deleteUser();
            });
    },

    testListSessions: function (test) {
        var me = this;

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid') })
            .then(function () { return me.db.selectSession('sid') })
            .then(function (session) {
                var output = [];
                me.cons.rl = { 
                    write: function (line) {
                        var sublines = line.split("\n");
                        for (var i = 0; i < sublines.length; i++)
                            output.push(sublines[i]);
                    },
                    close: function () {
                        test.equal(checkArray(output, /ID:\s+1$/), true, "id is missing");
                        test.equal(checkArray(output, /Login:\s+login$/), true, "login is missing");
                        test.equal(checkArray(output, /SID:\s+sid$/), true, "sid is missing");
                        test.equal(checkArray(output, /password:\s+false$/), true, "password is missing");
                        test.equal(checkArray(output, /OTP:\s+false$/), true, "otp is missing");
                        test.done();
                    }
                };
                me.cons.listSessions();
            });
    },

    testDeleteSession: function (test) {
        var me = this;

        var defer = q.defer(), deletedSession;
        this.db.deleteSession = function (sid) {
            deletedSession = sid;
            defer.resolve();
            return defer.promise;
        };

        this.cons.rl = {
            write: function () {},
            question: function(text, cb) {
                cb('sid');
            },
            close: function () {
                test.equal(deletedSession, 'sid', "SID is wrong");
                test.done();
            }
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid') })
            .then(function () {
                me.cons.deleteSession('sid');
            });
    },
};

function checkArray(arr, re, value)
{
    for (var i = 0; i < arr.length; i++) {
        if (typeof value == 'undfefined') {
            if (re.test(arr[i]))
                return true;
        } else {
            var result = re.exec(arr[i]);
            if (result && result[1] == value)
                return true;
        }
    }

    return false;
}
