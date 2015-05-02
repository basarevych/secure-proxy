'use strict';

var ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js'),
    Console         = require('../src/console.js');

module.exports = {
    setUp: function (callback) {
        this.sl = new ServiceLocator();
        this.db = new Database(this.sl);
        this.cons = new Console(this.sl);

        this.db.dbFile = ":memory:";
        this.cons.rl.close();

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
