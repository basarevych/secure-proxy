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

        this.db.createUser('login', 'password')
            .then(function () { return me.db.selectUser('login') })
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
                        test.equal(checkArray(output, /OTP Key:\s+(\S+)/, user['otp_key']), true, "otp_key is missing");
                        test.done();
                    }
                };
                me.cons.listUsers();
            });
    },

    testUpdateUserCreates: function (test) {
        var defer = q.defer(), newLogin, newPassword;
        this.db.createUser = function (login, password) {
            newLogin = login;
            newPassword = password;
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
                }
            },
            close: function () {
                test.equal(newLogin, 'login', "Login is wrong");
                test.equal(newPassword, 'password', "Password is wrong");
                test.done();
            }
        };

        this.cons.updateUser();
    },

    testUpdateUserModifies: function (test) {
        var me = this;

        var defer = q.defer(), newLogin, newPassword;
        this.db.setUserPassword = function (login, password) {
            newLogin = login;
            newPassword = password;
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
                }
            },
            close: function () {
                test.equal(newLogin, 'login', "Login is wrong");
                test.equal(newPassword, 'password', "Password is wrong");
                test.done();
            }
        };

        this.db.createUser('login', 'password')
            .then(function () {
                me.cons.updateUser();
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
