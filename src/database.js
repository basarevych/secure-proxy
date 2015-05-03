'use strict'

var fs          = require('fs'),
    sqlite3     = require('sqlite3'),
    q           = require('q'),
    bcrypt      = require('bcrypt'),
    speakeasy   = require('speakeasy');

function Database(serviceLocator) {
    this.sl = serviceLocator;
    this.dbFile = __dirname + "/../data/secure-proxy.db";

    this.sl.set('database', this);
};

module.exports = Database;

Database.prototype.getEngine = function () {
    if (typeof this.engine != 'undefined')
        return this.engine;
    
    if (this.dbFile != ':memory:') {
        if (!fs.existsSync(this.dbFile))
            fs.closeSync(fs.openSync(this.dbFile, "w"));
    }

    var engine = new sqlite3.Database(this.dbFile);
    engine.serialize(function () {
        engine.run(
            "CREATE TABLE IF NOT EXISTS users ("
          + "  id INTEGER PRIMARY KEY ASC NOT NULL,"
          + "  login VARCHAR(255) NOT NULL,"
          + "  password VARCHAR(255) NOT NULL,"
          + "  email VARCHAR(255) NOT NULL,"
          + "  otp_key TEXT NULL,"
          + "  CONSTRAINT user_login_unique UNIQUE (login)"
          + ")"
        );
        engine.run(
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

    this.engine = engine;
    return engine;
};

Database.prototype.userExists = function (login) {
    var engine = this.getEngine(),
        defer = q.defer();

    var check = engine.prepare(
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

Database.prototype.selectUser = function (login) {
    var engine = this.getEngine(),
        defer = q.defer();

    var sel = engine.prepare(
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

Database.prototype.selectUsers = function () {
    var engine = this.getEngine(),
        defer = q.defer();

    var sel = engine.prepare(
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

Database.prototype.createUser = function (login, password, email) {
    var me = this,
        engine = this.getEngine(),
        defer = q.defer();

    var ins = engine.prepare(
        "INSERT INTO"
      + "   users(login, password, email, otp_key)"
      + "   VALUES($login, $password, $email, $otp_key)"
    );
    ins.run(
        {
            $login: login,
            $password: "* NOT SET *",
            $email: email,
            $otp_key: null,
        },
        function (err) {
            if (err) {
                defer.reject(err);
                return;
            }

            me.setUserPassword(login, password)
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

Database.prototype.deleteUser = function (login) {
    var engine = this.getEngine(),
        defer = q.defer();

    var del = engine.prepare(
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

Database.prototype.setUserPassword = function (login, password) {
    var engine = this.getEngine(),
        defer = q.defer();

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

            var upd = engine.prepare(
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

Database.prototype.checkUserPassword = function (login, password) {
    var engine = this.getEngine(),
        defer = q.defer();

    this.selectUser(login)
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

Database.prototype.setUserEmail = function (login, email) {
    var engine = this.getEngine(),
        defer = q.defer();

    var upd = engine.prepare(
        "UPDATE users"
      + "   SET email = $email"
      + "   WHERE login = $login"
    );
    upd.run(
        {
            $email: email,
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

Database.prototype.generateUserOtp = function (login) {
    var me = this,
        engine = this.getEngine(),
        defer = q.defer(),
        config = this.sl.get('config');

    var key = speakeasy.generate_key({
        length: 20,
        name: config['namespace'],
    });

    var upd = engine.prepare(
        "UPDATE users"
      + "  SET otp_key = $otp_key"
      + "  WHERE login = $login"
    );
    upd.run(
        {
            $otp_key: key.base32,
            $login: login,
        },
        function (err) {
            if (err) {
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    upd.finalize();

    return defer.promise;
};


Database.prototype.checkUserOtp = function (login, otp) {
    var engine = this.getEngine(),
        defer = q.defer();

    this.selectUser(login)
        .then(function (user) {
            if (typeof user == 'undefined') {
                defer.resolve(false);
                return;
            }

            var correct = speakeasy.time({ key: user['otp_key'], encoding: 'base32' });
            defer.resolve(correct == otp);
        })
        .catch(function (err) {
            defer.reject(err);
        });

    return defer.promise;
};

Database.prototype.sessionExists = function (sid) {
    var engine = this.getEngine(),
        defer = q.defer();

    var check = engine.prepare(
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

Database.prototype.selectSession = function (sid) {
    var engine = this.getEngine(),
        defer = q.defer();

    var sel = engine.prepare(
        "SELECT s.id, s.user_id, u.login, s.sid, s.last, s.auth_password, s.auth_otp"
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

Database.prototype.selectSessions = function () {
    var engine = this.getEngine(),
        defer = q.defer();

    var sel = engine.prepare(
        "SELECT s.id, s.user_id, u.login, s.sid, s.last, s.auth_password, s.auth_otp"
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

Database.prototype.createSession = function (login, sid) {
    var engine = this.getEngine(),
        defer = q.defer(),
        now = new Date().getTime();

    this.selectUser(login)
        .then(function (user) {
            var ins = engine.prepare(
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

Database.prototype.deleteSession = function (sid) {
    var engine = this.getEngine(),
        defer = q.defer();

    var del = engine.prepare(
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

Database.prototype.refreshSession = function (sid) {
    var engine = this.getEngine(),
        defer = q.defer(),
        now = new Date().getTime();

    var upd = engine.prepare(
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

Database.prototype.setSessionPassword = function (sid, password) {
    var engine = this.getEngine(),
        defer = q.defer();

    var upd = engine.prepare(
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

Database.prototype.setSessionOtp = function (sid, otp) {
    var engine = this.getEngine(),
        defer = q.defer();

    var upd = engine.prepare(
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
