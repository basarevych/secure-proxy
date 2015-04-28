var fs = require("fs"),
    sqlite3 = require("sqlite3"),
    q = require('q'),
    bcrypt = require("bcrypt");

var dbFile = __dirname + "/../data/secure-proxy.db";
if (!fs.existsSync(dbFile))
    fs.closeSync(fs.openSync(dbFile, "w"));

var db = new sqlite3.Database(dbFile);
db.serialize(function () {
    db.run(
        "CREATE TABLE IF NOT EXISTS users ("
      + "  id INTEGER PRIMARY KEY ASC NOT NULL,"
      + "  login VARCHAR(255) NOT NULL,"
      + "  password VARCHAR(255) NOT NULL,"
      + "  ldap BOOLEAN NOT NULL,"
      + "  CONSTRAINT user_login_unique UNIQUE (login)"
      + ")"
    );
    db.run(
        "CREATE TABLE IF NOT EXISTS sessions ("
      + "  id INTEGER PRIMARY KEY ASC NOT NULL,"
      + "  user_id INTERGER NOT NULL,"
      + "  cookie VARCHAR(255) NOT NULL,"
      + "  CONSTRAINT session_cookie_unique UNIQUE (cookie),"
      + "  CONSTRAINT session_user_fk FOREIGN KEY (user_id)"
      + "    REFERENCES users(id)"
      + "    ON DELETE CASCADE ON UPDATE CASCADE"
      + ")"
    );
});

module.exports = {};

module.exports.userExists = function (login) {
    var defer = q.defer();

    var check = db.prepare(
        "SELECT COUNT(*) AS count"
      + "   FROM users"
      + "   WHERE login = $login"
    );
    check.get(
        {
            $login: login
        },
        function (err, row) {
            if (err) {
                defer.reject(err);
                return;
            }
            defer.resolve(row["count"] != 0);
        }
    );
    check.finalize();

    return defer.promise;
};

module.exports.selectUser = function (login) {
    var defer = q.defer();

    var sel = db.prepare(
        "SELECT *"
      + "   FROM users"
      + "   WHERE login = $login"
    );
    sel.get(
        {
            $login: login
        },
        function (err, row) {
            if (err) {
                defer.reject(err);
                return;
            }
            defer.resolve(row);
        }
    );
    check.finalize();

    return defer.promise;
};

module.exports.createUser = function (login, password, ldap) {
    var defer = q.defer();

    var ins = db.prepare(
        "INSERT INTO"
      + "   users(login, password, ldap)"
      + "   VALUES($login, $password, $ldap)"
    );
    ins.run(
        {
            $login: login,
            $password: "* NOT SET *",
            $ldap: ldap,
        },
        function (err) {
            if (err) {
                defer.reject(err);
                return;
            }

            module.exports.setPassword(login, password)
                .then(function (data) {
                    defer.resolve(data);
                })
                .catch(function (err) {
                    defer.reject(err);
                });
        }
    );
    ins.finalize();

    return defer.promise;
};

module.exports.deleteUser = function (login) {
    var defer = q.defer();

    var del = db.prepare(
        "DELETE FROM users"
      + "   WHERE login = $login"
    );
    del.run(
        {
            $login: login
        },
        function (err) {
            if (err)
                defer.reject(err);
            else
                defer.resolve();
        }
    );
    del.finalize();

    return defer.promise;
};

module.exports.setPassword = function (login, password) {
    var defer = q.defer();

    bcrypt.genSalt(10, function (err, salt) {
        if (err) {
            defer.reject(err);
            return;
        }

        bcrypt.hash(password, salt, function (err, hash) {
            if (err) {
                defer.reject(err);
                return;
            }

            var upd = db.prepare(
                "UPDATE users"
              + "   SET password = $password"
              + "   WHERE login = $login"
            );
            upd.run(
                {
                    $password: hash,
                    $login: login
                },
                function (err) {
                    if (err)
                        defer.reject(err);
                    else
                        defer.resolve();
                }
            );
            upd.finalize();
        });
    });

    return defer.promise;
};

module.exports.checkPassword = function (login, password) {
    var defer = q.defer();

    var user = db.prepare(
        "SELECT *"
      + "   FROM users"
      + "   WHERE login = $login"
    );
    user.get(
        {
            $login: login
        },
        function (err, row) {
            if (err) {
                defer.reject(err);
                return;
            }

            if (typeof row == 'undefined') {
                defer.resolve(false);
                return;
            }

            bcrypt.compare(password, row['password'], function (err, match) {
                if (err) {
                    defer.reject(err);
                    return;
                }

                defer.resolve(match);
            });
        }
    );
    user.finalize();

    return defer.promise;
};

module.exports.setLdap = function (login, ldap) {
    var defer = q.defer();

    var upd = db.prepare(
        "UPDATE users"
      + "   SET ldap = $ldap"
      + "   WHERE login = $login"
    );
    upd.run(
        {
            $ldap: ldap,
            $login: login
        },
        function (err) {
            if (err)
                defer.reject(err);
            else
                defer.resolve();
        }
    );
    upd.finalize();

    return defer.promise;
};

module.exports.sessionExists = function (cookie) {
    var defer = q.defer();

    var check = db.prepare(
        "SELECT COUNT(*) AS count"
      + "   FROM sessions"
      + "   WHERE cookie = $cookie"
    );
    check.get(
        {
            $cookie: cookie
        },
        function (err, row) {
            if (err) {
                defer.reject(err);
                return;
            }
            defer.resolve(row["count"] != 0);
        }
    );
    check.finalize();

    return defer.promise;
};

module.exports.selectSession = function (cookie) {
    var defer = q.defer();

    var sel = db.prepare(
        "SELECT *"
      + "   FROM sessions"
      + "   WHERE cookie = $cookie"
    );
    sel.get(
        {
            $cookie: cookie
        },
        function (err, row) {
            if (err) {
                defer.reject(err);
                return;
            }
            defer.resolve(row);
        }
    );
    check.finalize();

    return defer.promise;
};

module.exports.createSession = function (login, cookie) {
    var defer = q.defer();

    moudle.exports.selectUser(login)
        .then(function (user) {
            var ins = db.prepare(
                "INSERT INTO"
              + "   sessions(user_id, cookie)"
              + "   VALUES($user_id, $cookie)"
            );
            ins.run(
                {
                    $user_id: user['id'],
                    $cookie: cookie,
                },
                function (err) {
                    if (err) {
                        defer.reject(err);
                        return;
                    }

                    defer.resolve();
                }
            );
            ins.finalize();
        })
        .catch(function (err) {
            defer.reject(err);
        });

    return defer.promise;
};

module.exports.deleteSession = function (cookie, cb) {
    var defer = q.defer();

    var del = db.prepare(
        "DELETE FROM sessions"
      + "   WHERE cookie = $cookie"
    );
    del.run(
        {
            $cookie: cookie
        },
        function (err) {
            if (err)
                defer.reject(err);
            else
                defer.resolve();
        }
    );
    del.finalize();

    return defer.promise;
};
