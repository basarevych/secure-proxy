'use strict'

var fs          = require('fs'),
    sqlite3     = require('sqlite3'),
    q           = require('q'),
    bcrypt      = require('bcrypt'),
    speakeasy   = require('speakeasy'),
    config      = require('../config.js');

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
      + "  otp_key TEXT NOT NULL,"
      + "  CONSTRAINT user_login_unique UNIQUE (login)"
      + ")"
    );
    db.run(
        "CREATE TABLE IF NOT EXISTS sessions ("
      + "  id INTEGER PRIMARY KEY ASC NOT NULL,"
      + "  user_id INTERGER NOT NULL,"
      + "  sid VARCHAR(255) NOT NULL,"
      + "  last TIMESTAMP NOT NULL,"
      + "  auth_password BOOLEAN NOT NULL,"
      + "  auth_otp BOOLEAN NOT NULL,"
      + "  CONSTRAINT session_sid_unique UNIQUE (sid),"
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
    sel.finalize();

    return defer.promise;
};

module.exports.selectUsers = function () {
    var defer = q.defer();

    var sel = db.prepare(
        "SELECT *"
      + "   FROM users"
      + "   ORDER BY id ASC"
    );
    sel.all(
        { },
        function (err, rows) {
            if (err) {
                defer.reject(err);
                return;
            }
            defer.resolve(rows);
        }
    );
    sel.finalize();

    return defer.promise;
};

module.exports.createUser = function (login, password) {
    var defer = q.defer();

    var key = speakeasy.generate_key({
        length: 20,
        name: config['namespace'],
    });

    var ins = db.prepare(
        "INSERT INTO"
      + "   users(login, password, otp_key)"
      + "   VALUES($login, $password, $otp_key)"
    );
    ins.run(
        {
            $login: login,
            $password: "* NOT SET *",
            $otp_key: key.base32,
        },
        function (err) {
            if (err) {
                defer.reject(err);
                return;
            }

            module.exports.setUserPassword(login, password)
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

module.exports.setUserPassword = function (login, password) {
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

module.exports.checkUserPassword = function (login, password) {
    var defer = q.defer();

    module.exports.selectUser(login)
        .then(function (user) {
            if (typeof user == 'undefined') {
                defer.resolve(false);
                return;
            }

            bcrypt.compare(password, user['password'], function (err, match) {
                if (err) {
                    defer.reject(err);
                    return;
                }

                defer.resolve(match);
            });
        })
        .catch(function (err) {
            defer.reject(err);
        });

    return defer.promise;
};

module.exports.checkUserOtp = function (login, otp) {
    var defer = q.defer();

    module.exports.selectUser(login)
        .then(function (user) {
            if (typeof user == 'undefined') {
                defer.resolve(false);
                return;
            }

            var correct = speakeasy.time({key: user['otp_key'], encoding: 'base32'});
            defer.resolve(correct == otp);
        })
        .catch(function (err) {
            defer.reject(err);
        });

    return defer.promise;
};

module.exports.sessionExists = function (sid) {
    var defer = q.defer();

    var check = db.prepare(
        "SELECT COUNT(*) AS count"
      + "   FROM sessions"
      + "   WHERE sid = $sid"
    );
    check.get(
        {
            $sid: sid
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

module.exports.selectSession = function (sid) {
    var defer = q.defer();

    var sel = db.prepare(
        "SELECT s.id, s.user_id, u.login, s.sid, s.auth_password, s.auth_otp"
      + "   FROM sessions s"
      + "   LEFT JOIN users u"
      + "       ON s.user_id = u.id"
      + "   WHERE s.sid = $sid"
    );
    sel.get(
        {
            $sid: sid
        },
        function (err, row) {
            if (err) {
                defer.reject(err);
                return;
            }
            defer.resolve(row);
        }
    );
    sel.finalize();

    return defer.promise;
};

module.exports.selectSessions = function () {
    var defer = q.defer();

    var sel = db.prepare(
        "SELECT s.id, s.user_id, u.login, s.sid, s.auth_password, s.auth_otp"
      + "   FROM sessions s"
      + "   LEFT JOIN users u"
      + "       ON s.user_id = u.id"
      + "   ORDER BY s.id ASC"
    );
    sel.all(
        { },
        function (err, rows) {
            if (err) {
                defer.reject(err);
                return;
            }
            defer.resolve(rows);
        }
    );
    sel.finalize();

    return defer.promise;
};

module.exports.createSession = function (login, sid) {
    var defer = q.defer(),
        now = new Date().getTime();

    module.exports.selectUser(login)
        .then(function (user) {
            var ins = db.prepare(
                "INSERT INTO"
              + "   sessions(user_id, sid, last, auth_password, auth_otp)"
              + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
            );
            ins.run(
                {
                    $user_id: user['id'],
                    $sid: sid,
                    $last: now,
                    $auth_password: false,
                    $auth_otp: false,
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

module.exports.deleteSession = function (sid) {
    var defer = q.defer();

    var del = db.prepare(
        "DELETE FROM sessions"
      + "   WHERE sid = $sid"
    );
    del.run(
        {
            $sid: sid
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

module.exports.refreshSession = function (sid) {
    var defer = q.defer(),
        now = new Date().getTime();

    var upd = db.prepare(
        "UPDATE sessions"
      + "   SET last = $last"
      + "   WHERE sid = $sid"
    );
    upd.run(
        {
            $last: now,
            $sid: sid
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

module.exports.setSessionPassword = function (sid, password) {
    var defer = q.defer();

    var upd = db.prepare(
        "UPDATE sessions"
      + "   SET auth_password = $auth_password"
      + "   WHERE sid = $sid"
    );
    upd.run(
        {
            $auth_password: password,
            $sid: sid
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

module.exports.setSessionOtp = function (sid, otp) {
    var defer = q.defer();

    var upd = db.prepare(
        "UPDATE sessions"
      + "   SET auth_otp = $auth_otp"
      + "   WHERE sid = $sid"
    );
    upd.run(
        {
            $auth_otp: otp,
            $sid: sid
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
