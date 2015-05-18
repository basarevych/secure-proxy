'use strict';

var q               = require('q'),
    ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js'),
    Console         = require('../src/console.js');

describe("Console", function () {
    var sl, db, cons, output;

    beforeEach(function () {
        sl = new ServiceLocator();
        db = new Database(sl);
        cons = new Console(sl);

        db.dbFile = ":memory:";

        cons.rl = createSpyObj('rl', [ 'write', 'question', 'close' ]);

        output = [];
        cons.rl.write.andCallFake(function (line) {
            var sublines = line.split("\n");
            for (var i = 0; i < sublines.length; i++)
                output.push(sublines[i]);
        });
    });

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

    it("lists users", function (done) {
        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.selectUsers({ login: 'login' }); })
            .then(function (users) {
                var user = users.length && users[0];
                cons.rl.close.andCallFake(function () {
                    expect(checkArray(output, /ID:\s+1$/)).toBeTruthy();
                    expect(checkArray(output, /Login:\s+login$/)).toBeTruthy();
                    expect(checkArray(output, /Password:\s+(\S+)/, user['password'])).toBeTruthy();
                    expect(checkArray(output, /Email:\s+foo@bar$/)).toBeTruthy();
                    expect(checkArray(output, /OTP Key:\s+(\S+)/, user['otp_key'])).toBeTruthy();
                    expect(checkArray(output, /OTP Confirmed:\s+false$/)).toBeTruthy();
                    done();
                });
                cons.listUsers();
            });
    });

    it("lists users by email", function (done) {
        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createUser('login2', 'password2', 'foo@bar2'); })
            .then(function () { return db.selectUsers({ login: 'login' }); })
            .then(function (users) {
                var user = users.length && users[0];
                cons.rl.close.andCallFake(function () {
                    expect(checkArray(output, /ID:\s+1$/)).toBeTruthy();
                    expect(checkArray(output, /Login:\s+login$/)).toBeTruthy();
                    expect(checkArray(output, /Password:\s+(\S+)/, user['password'])).toBeTruthy();
                    expect(checkArray(output, /Email:\s+foo@bar$/)).toBeTruthy();
                    expect(checkArray(output, /OTP Key:\s+(\S+)/, user['otp_key'])).toBeTruthy();
                    expect(checkArray(output, /OTP Confirmed:\s+false$/)).toBeTruthy();
                    done();
                });
                cons.listUsers('foo@bar');
            });
    });

    it("creates user", function (done) {
        spyOn(db, 'createUser').andCallThrough();

        var question = 0;
        cons.rl.question.andCallFake(function(text, cb) {
            switch (++question) {
                case 1: cb('login'); break;
                case 2: cb('password'); break;
                case 3: cb('foo@bar'); break;
            }
        });

        cons.rl.close.andCallFake(function () {
            expect(db.createUser).toHaveBeenCalledWith('login', 'password', 'foo@bar');
            done();
        });

        cons.createUser();
    });

    it("updates user", function (done) {
        spyOn(db, 'setUserPassword').andCallThrough();
        spyOn(db, 'setUserEmail').andCallThrough();

        var question = 0;
        cons.rl.question.andCallFake(function(text, cb) {
            switch (++question) {
                case 1: cb(1); break;
                case 2: cb('password'); break;
                case 3: cb('foo@bar'); break;
            }
        });

        cons.rl.close.andCallFake(function () {
            expect(db.setUserPassword).toHaveBeenCalledWith(1, 'password');
            expect(db.setUserEmail).toHaveBeenCalledWith(1, 'foo@bar');
            done();
        });

        db.createUser('login', 'old password', 'old foo@bar')
            .then(function () {
                cons.updateUser();
            });
    });

    it("deletes user", function (done) {
        spyOn(db, 'deleteUser').andCallThrough();

        cons.rl.question.andCallFake(function(text, cb) {
            cb(1);
        });

        cons.rl.close.andCallFake(function () {
            expect(db.deleteUser).toHaveBeenCalledWith(1);
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () {
                cons.deleteUser();
            });
    });

    it("lists sessions", function (done) {
        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession(1, 'sid') })
            .then(function () { return db.selectSessions({ sid: 'sid' }) })
            .then(function (sessions) {
                var session = sessions.length && sessions[0];
                cons.rl.close.andCallFake(function () {
                    expect(checkArray(output, /ID:\s+1$/)).toBeTruthy();
                    expect(checkArray(output, /Login:\s+login$/)).toBeTruthy();
                    expect(checkArray(output, /SID:\s+sid$/)).toBeTruthy();
                    expect(checkArray(output, /password:\s+false$/)).toBeTruthy();
                    expect(checkArray(output, /OTP:\s+false$/)).toBeTruthy();
                    done();
                });
                cons.listSessions();
            });
    });

    it("lists sessions by login", function () {
        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createUser('login2', 'password2', 'foo@bar2'); })
            .then(function () { return db.createSession('login', 'sid'); })
            .then(function () { return db.createSession('login2', 'sid2'); })
            .then(function () { return db.selectSessions({ sid: 'sid' }); })
            .then(function (sessions) {
                var session = sessions.length && sessions[0];
                cons.rl.close.andCallFake(function () {
                    expect(checkArray(output, /ID:\s+1$/)).toBeTruthy();
                    expect(checkArray(output, /Login:\s+login$/)).toBeTruthy();
                    expect(checkArray(output, /SID:\s+sid$/)).toBeTruthy();
                    expect(checkArray(output, /password:\s+false$/)).toBeTruthy();
                    expect(checkArray(output, /OTP:\s+false$/)).toBeTruthy();
                    done();
                });
                cons.listSessions('login');
            });
    });

    it("deletes session", function (done) {
        spyOn(db, 'deleteSession').andCallThrough();

        cons.rl.question.andCallFake(function(text, cb) {
            cb(1);
        });

        cons.rl.close.andCallFake(function () {
            expect(db.deleteSession).toHaveBeenCalledWith(1);
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession(1, 'sid') })
            .then(function () {
                cons.deleteSession();
            });
    });
});
