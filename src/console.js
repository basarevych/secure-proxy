'use strict'

var readline    = require('readline'),
    db          = require('./db.js');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

var commands = [
    'add-user',
    'delete-user',
];
if (process.argv.length != 3 || commands.indexOf(process.argv[2]) == -1) {
    rl.write("Usage: node src/console.js <command>\n");
    rl.write("\n");
    rl.write("Commands:\n");
    rl.write("\tadd-user\tAdds new user to the database\n");
    rl.write("\tdelete-user\tDeletes existing user from the database\n");
    rl.close();
    return;
}

switch (process.argv[2]) {
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
    default:
        rl.write("Command '" + process.argv[2] + "' not implemented\n");
        rl.close();
}
