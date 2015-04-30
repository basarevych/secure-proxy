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
        rl.write("\nID:Login:Password:OTP Key:LDAP\n\n");
        db.selectUsers()
            .then(function (users) {
                for (var i = 0; i < users.length; i++) {
                    rl.write(
                        users[i]['id']
                        + ':' + users[i]['login']
                        + ':' + users[i]['password']
                        + ':' + users[i]['otp_key']
                        + ':' + (users[i]['ldap'] ? '1' : '0')
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
                rl.question('-> Is this LDAP user? [y/n] ', function (ldap) {
                    db.userExists(username)
                        .then(function (exists) {
                            if (exists) {
                                db.setUserPassword(username, password)
                                    .then(db.setUserLdap(username, ldap == 'y'))
                                    .then(function () {
                                        rl.write("==> User exists, password and ldap flag are changed\n");
                                        rl.close();
                                    });
                            } else {
                                db.createUser(username, password, ldap == 'y')
                                    .then(function () {
                                        rl.write("==> User created\n");
                                        rl.close();
                                    });
                            }
                        });
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
        rl.write("\nID:Login:SID:Last:Password authenticated:OTP authenticated\n\n");
        db.selectSessions()
            .then(function (sessions) {
                for (var i = 0; i < sessions.length; i++) {
                    rl.write(
                        sessions[i]['id']
                        + ':' + sessions[i]['login']
                        + ':' + sessions[i]['sid']
                        + ':' + sessions[i]['last']
                        + ':' + (sessions[i]['auth_password'] ? '1' : '0')
                        + ':' + (sessions[i]['auth_otp'] ? '1' : '0')
                        + "\n"
                    );
                }
                rl.close();
            });
        break;

    case 'delete-session:
        rl.write("==> Delete session\n");
        rl.question('-> SID? ', function (sid) {
            db.seesionExists(sid)
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
