'use strict'

var readline = require('readline');

function Console(serviceLocator) {
    this.sl = serviceLocator;
    this.db = this.sl.get('database');
    this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    this.sl.set('console', this);
};

Console.prototype.listUsers = function () {
    var db = this.db,
        rl = this.rl;

    rl.write("==> User list\n");
    db.selectUsers()
        .then(function (users) {
            for (var i = 0; i < users.length; i++) {
                rl.write(
                    "\nID:\t\t" + users[i]['id']
                    + "\nLogin:\t\t" + users[i]['login']
                    + "\nPassword:\t" + users[i]['password']
                    + "\nOTP Key:\t" + users[i]['otp_key']
                    + "\n"
                );
            }
            rl.close();
        });
};

Console.prototype.updateUser = function () {
    var db = this.db,
        rl = this.rl;

    rl.write("==> Update user\n");
    rl.question('-> Username? ', function (username) {
        rl.question('-> Password? ', function (password) {
            db.userExists(username)
                .then(function (exists) {
                    if (exists) {
                        db.setUserPassword(username, password)
                            .then(function () {
                                rl.write("==> User exists, password changed\n");
                                rl.close();
                            });
                    } else {
                        db.createUser(username, password)
                            .then(function () {
                                rl.write("==> User created\n");
                                rl.close();
                            });
                    }
                });
        });
    });
};

Console.prototype.deleteUser = function () {
    var db = this.db,
        rl = this.rl;

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

Console.prototype.listSessions = function () {
    var db = this.db,
        rl = this.rl;

    rl.write("==> Session list\n");
    db.selectSessions()
        .then(function (sessions) {
            for (var i = 0; i < sessions.length; i++) {
                var date = new Date(sessions[i]['last']);
                rl.write(
                    "\nID:\t\t\t" + sessions[i]['id']
                    + "\nLogin:\t\t\t" + sessions[i]['login']
                    + "\nSID\t\t\t" + sessions[i]['sid']
                    + "\nLast seen\t\t" + date.toString()
                    + "\nProvided password:\t" + (sessions[i]['auth_password'] ? 'true' : 'false')
                    + "\nProvided OTP\t\t" + (sessions[i]['auth_otp'] ? 'true' : 'false')
                    + "\n"
                );
            }
            rl.close();
        });
};

Console.prototype.deleteSession = function () {
    var db = this.db,
        rl = this.rl;

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

module.exports = Console;
