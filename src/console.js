'use strict'

var readline    = require('readline'),
    db          = require('./db.js');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

var commands = [
    'list-users',
    'add-user',
    'delete-user',
    'list-sessions',
    'delete-sessions',
];
if (process.argv.length != 3 || commands.indexOf(process.argv[2]) == -1) {
    rl.write("Usage: node src/console.js <command>\n");
    rl.write("\n");
    rl.write("Commands:\n");
    rl.write("\tlist-users\tLists all the users\n");
    rl.write("\tadd-user\tAdds new user to the database\n");
    rl.write("\tdelete-user\tDeletes existing user from the database\n");
    rl.write("\tlist-sessions\tLists all the sessions\n");
    rl.write("\tdelete-session\tDelete session from the database\n");
    rl.close();
    return;
}

switch (process.argv[2]) {
    case 'list-users':
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
        break;

    case 'add-user':
        rl.write("==> Add new user\n");
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
        break;

    case 'delete-user':
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
        break;

    case 'list-sessions':
        rl.write("==> Session list\n");
        db.selectSessions()
            .then(function (sessions) {
                for (var i = 0; i < sessions.length; i++) {
                    rl.write(
                        "\nID:\t\t\t" + sessions[i]['id']
                        + "\nLogin:\t\t\t" + sessions[i]['login']
                        + "\nSID\t\t\t" + sessions[i]['sid']
                        + "\nLast seen\t\t" + sessions[i]['last']
                        + "\nProvided password:\t" + (sessions[i]['auth_password'] ? 'true' : 'false')
                        + "\nProvided OTP\t\t" + (sessions[i]['auth_otp'] ? 'true' : 'false')
                        + "\n"
                    );
                }
                rl.close();
            });
        break;

    case 'delete-session':
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
        break;

    default:
        rl.write("Command '" + process.argv[2] + "' not implemented\n");
        rl.close();
}
