'use strict'

var readline = require('readline');

function Console(serviceLocator) {
    this.sl = serviceLocator;

    this.sl.set('console', this);
};

module.exports = Console;

Console.prototype.getDatabase = function () {
    if (typeof this.db != 'undefined')
        return this.db;

    var db = this.sl.get('database');

    this.db = db;
    return db;
};

Console.prototype.getReadline = function () {
    if (typeof this.rl != 'undefined')
        return this.rl;

    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    this.rl = rl;
    return rl;
};

Console.prototype.listUsers = function (email) {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write(email ? "==> User list (" + email + ")\n" : "==> User list\n");

    var params = {};
    if (email)
        params['email'] = email;

    db.selectUsers(params)
        .then(function (users) {
            for (var i = 0; i < users.length; i++) {
                rl.write(
                    "\nID:\t\t" + users[i]['id']
                    + "\nLogin:\t\t" + users[i]['login']
                    + "\nPassword:\t" + users[i]['password']
                    + "\nEmail:\t\t" + users[i]['email']
                    + "\nSecret:\t\t" + users[i]['secret']
                    + "\nOTP Key:\t" + users[i]['otp_key']
                    + "\nOTP Confirmed:\t" + (users[i]['otp_confirmed'] ? 'true' : 'false')
                    + "\n"
                );
            }
            rl.close();
        });
};

Console.prototype.updateUser = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Update user\n");
    rl.question('-> Username? ', function (username) {
        rl.question('-> Password? ', function (password) {
            rl.question('-> Email? ', function (email) {
                db.userExists(username)
                    .then(function (exists) {
                        if (exists) {
                            db.setUserPassword(username, password)
                                .then(function () { return db.setUserEmail(username, email); })
                                .then(function () {
                                    rl.write("==> User exists, password and email changed\n");
                                    rl.close();
                                });
                        } else {
                            db.createUser(username, password, email)
                                .then(function () {
                                    rl.write("==> User created\n");
                                    rl.close();
                                });
                        }
                    });
            });
        });
    });
};

Console.prototype.deleteUser = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Delete user\n");
    rl.question('-> Username? ', function (username) {
        db.userExists(username)
            .then(function (exists) {
                if (exists) {
                    db.deleteUser(username)
                        .then(function () {
                            rl.write("==> User deleted\n");
                            rl.close();
                        });
                } else {
                    rl.write("==> User does not exists\n");
                    rl.close();
                }
            });
    });
};

Console.prototype.listSessions = function (login) {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write(login ? "==> Session list (" + login + ")\n" : "==> Session list\n");

    var params = {};
    if (login)
        params['login'] = login;

    db.selectSessions(params)
        .then(function (sessions) {
            for (var i = 0; i < sessions.length; i++) {
                var date = new Date(sessions[i]['last']);
                rl.write(
                    "\nID:\t\t\t" + sessions[i]['id']
                    + "\nLogin:\t\t\t" + sessions[i]['login']
                    + "\nSID:\t\t\t" + sessions[i]['sid']
                    + "\nLast seen:\t\t" + date.toString()
                    + "\nProvided password:\t" + (sessions[i]['auth_password'] ? 'true' : 'false')
                    + "\nProvided OTP:\t\t" + (sessions[i]['auth_otp'] ? 'true' : 'false')
                    + "\n"
                );
            }
            rl.close();
        });
};

Console.prototype.deleteSession = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Delete session\n");
    rl.question('-> SID? ', function (sid) {
        db.sessionExists(sid)
            .then(function (exists) {
                if (exists) {
                    db.deleteSession(sid)
                        .then(function () {
                            rl.write("==> Session deleted\n");
                            rl.close();
                        });
                } else {
                    rl.write("==> Session does not exists\n");
                    rl.close();
                }
            });
    });
};
