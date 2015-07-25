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

    return rl;
};

Console.prototype.listUsers = function (email) {
    var db = this.getDatabase(),
        rl = this.getReadline(),
        table = this.sl.get('table');

    rl.write("==> User list" + (email ? " (" + email + ")\n\n" : "\n\n"));
    rl.close();

    var params = {};
    if (email)
        params['email'] = email;

    db.selectUsers(params)
        .then(function (users) {
            var header = [ 'ID', 'Login', 'eMail' ],
                rows = [];

            for (var i = 0; i < users.length; i++) {
                var row = [];
                row.push(users[i]['id']);
                row.push(users[i]['login']);
                row.push(users[i]['email']);
                rows.push(row);
            }

            table.print(header, rows);
        });
};

Console.prototype.dumpUser = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Dump user\n");
    rl.question('-> ID? ', function (id) {
        if (!id) {
            rl.write("*  Need ID\n");
            rl.close();
            return;
        }

        db.selectUsers({ id: id })
            .then(function (users) {
                if (users.length == 0) {
                    rl.write("==> User does not exist\n");
                    rl.close();
                    return;
                }

                rl.write(
                    "\nID:\t\t" + users[0]['id']
                    + "\nLogin:\t\t" + users[0]['login']
                    + "\nPassword:\t" + users[0]['password']
                    + "\nEmail:\t\t" + users[0]['email']
                    + "\nSecret:\t\t" + users[0]['secret']
                    + "\nOTP Key:\t" + users[0]['otp_key']
                    + "\nOTP Confirmed:\t" + (users[0]['otp_confirmed'] ? 'true' : 'false')
                    + "\n"
                );
                rl.close();
            });
    });
};

Console.prototype.createUser = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Create user\n");
    rl.question('-> Username? ', function (username) {
        if (!username) {
            rl.write("*  Need username\n");
            rl.close();
            return;
        }

        rl.question('-> Password? ', function (password) {
            rl.question('-> Email? ', function (email) {
                db.selectUsers({ login: username })
                    .then(function (users) {
                        if (users.length > 0) {
                            rl.write("==> User already exists\n");
                            rl.close();
                            return;
                        }

                        if (!password)
                            password = null;
                        if (!email)
                            email = null;
                            
                        db.createUser(username, password, email)
                            .then(function () {
                                rl.write("==> User created\n");
                                rl.close();
                            });
                    });
            });
        });
    });
};

Console.prototype.updateUser = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Update user\n");
    rl.question('-> ID? ', function (id) {
        if (!id) {
            rl.write("*  Need ID\n");
            rl.close();
            return;
        }

        rl.question('-> New password? ', function (password) {
            rl.question('-> New email? ', function (email) {
                db.selectUsers({ id: id })
                    .then(function (users) {
                        if (users.length == 0) {
                            rl.write("==> User does not exist\n");
                            rl.close();
                            return;
                        }

                        if (!password)
                            password = null;
                        if (!email)
                            email = null;
                            
                        db.setUserPassword(id, password)
                            .then(function () { return db.setUserEmail(id, email); })
                            .then(function () {
                                rl.write("==> Password and email changed\n");
                                rl.close();
                            });
                    });
            });
        });
    });
};

Console.prototype.deleteUser = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Delete user\n");
    rl.question('-> ID? ', function (id) {
        if (!id) {
            rl.write("*  Need ID\n");
            rl.close();
            return;
        }

        db.selectUsers({ id: id })
            .then(function (users) {
                if (users.length == 0) {
                    rl.write("==> User does not exist\n");
                    rl.close();
                    return;
                }

                db.deleteUser(id)
                    .then(function () {
                        rl.write("==> User deleted\n");
                        rl.close();
                    });
            });
    });
};

Console.prototype.listSessions = function (login) {
    var db = this.getDatabase(),
        rl = this.getReadline(),
        table = this.sl.get('table');

    rl.write("==> Session list" + (login ? " (" + login + ")\n\n" : "\n\n"));
    rl.close();

    var params = {};
    if (login)
        params['login'] = login;

    db.selectSessions(params)
        .then(function (sessions) {
            var header = [ 'ID', 'Login', 'IP' ],
                rows = [];

            for (var i = 0; i < sessions.length; i++) {
                var date = new Date(sessions[i]['last']);

                var row = [];
                row.push(sessions[i]['id']);
                row.push(sessions[i]['login']);
                row.push(sessions[i]['ip_address']);
                row.push(date.toString());
                rows.push(row);
            }
        });
};

Console.prototype.dumpSession = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Dump session\n");
    rl.question('-> ID? ', function (id) {
        if (!id) {
            rl.write("*  Need ID\n");
            rl.close();
            return;
        }

        db.selectSessions({ id: id })
            .then(function (sessions) {
                if (sessions.length == 0) {
                    rl.write("==> Session does not exist\n");
                    rl.close();
                    return;
                }

                var date = new Date(sessions[0]['last']);
                rl.write(
                    "\nID:\t\t\t" + sessions[0]['id']
                    + "\nLogin:\t\t\t" + sessions[0]['login']
                    + "\nSID:\t\t\t" + sessions[0]['sid']
                    + "\nIP address:\t\t" + sessions[0]['ip_address']
                    + "\nLast seen:\t\t" + date.toString()
                    + "\nProvided password:\t" + (sessions[0]['auth_password'] ? 'true' : 'false')
                    + "\nProvided OTP:\t\t" + (sessions[0]['auth_otp'] ? 'true' : 'false')
                    + "\n"
                );
                rl.close();
            });
    });
};


Console.prototype.deleteSession = function () {
    var db = this.getDatabase(),
        rl = this.getReadline();

    rl.write("==> Delete session\n");
    rl.question('-> ID? ', function (id) {
        if (!id) {
            rl.write("*  Need ID\n");
            rl.close();
            return;
        }

        db.selectSessions({ id: id })
            .then(function (sessions) {
                if (sessions.length == 0) {
                    rl.write("==> Session does not exist\n");
                    rl.close();
                    return;
                }

                db.deleteSession(id)
                    .then(function () {
                        rl.write("==> Session deleted\n");
                        rl.close();
                    });
            });
    });
};
