'use strict'

var fs          = require('fs'),
    sqlite3     = require('sqlite3'),
    q           = require('q'),
    crypto      = require('crypto'),
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
          + "  secret TEXT NOT NULL,"
          + "  otp_key TEXT NOT NULL,"
          + "  otp_confirmed BOOLEAN NOT NULL,"
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

Database.prototype.selectUsers = function (params) {
    var engine = this.getEngine(),
        defer = q.defer();

    var bind = {}, where = [];
    if (typeof params != 'undefined') {
        if (typeof params['login'] != 'undefined') {
            bind['$login'] = params['login'];
            where.push(" login = $login");
        }
        if (typeof params['email'] != 'undefined') {
            bind['$email'] = params['email'];
            where.push(" email = $email");
        }
        if (typeof params['secret'] != 'undefined') {
            bind['$secret'] = params['secret'];
            where.push(" secret = $secret");
        }
    }

    var sql = "SELECT * FROM users";
    if (where.length)
        sql += " WHERE " + where.join(' AND ');
    sql += " ORDER BY id ASC";

    var sel = engine.prepare(sql);
    sel.all(
        bind,
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
      + "   users(login, password, email, secret, otp_key, otp_confirmed)"
      + "   VALUES($login, $password, $email, $secret, $otp_key, $otp_confirmed)"
    );
    ins.run(
        {
            $login: login,
            $password: "* NOT SET *",
            $email: email,
            $secret: "* NOT SET *",
            $otp_key: '',
            $otp_confirmed: false,
        },
        function (err) {
            if (err) {
                defer.reject(err);
                return;
            }

            me.generateUserSecret(login)
                .then(function () { return me.generateUserOtpKey(login); })
                .then(function () {
                    if (password) {
                        me.setUserPassword(login, password)
                            .then(function () {
                                defer.resolve();
                            })
                            .catch(function (err) {
                                defer.reject(err);
                            });
                    } else {
                        defer.resolve();
                    }
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

    this.selectUsers({ login: login })
        .then(function (users) {
            var user = users.length && users[0];
            if (!user) {
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

Database.prototype.generateUserSecret = function (login) {
    var me = this,
        engine = this.getEngine(),
        defer = q.defer();

    crypto.randomBytes(16, function (ex, buf) {
        if (ex) {
            defer.reject(ex);
            return;
        }

        var token = buf.toString('hex');
        var upd = engine.prepare(
            "UPDATE users"
          + "  SET secret = $secret"
          + "  WHERE login = $login"
        );
        upd.run(
            {
                $secret: token,
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
    });

    return defer.promise;
};

Database.prototype.generateUserOtpKey = function (login) {
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

Database.prototype.checkUserOtpKey = function (login, otp) {
    var engine = this.getEngine(),
        defer = q.defer();

    this.selectUsers({ login: login })
        .then(function (users) {
            var user = users.length && users[0];
            if (!user) {
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

Database.prototype.setUserOtpConfirmed = function (login, confirmed) {
    var engine = this.getEngine(),
        defer = q.defer();

    var upd = engine.prepare(
        "UPDATE users"
      + "   SET otp_confirmed = $otp_confirmed"
      + "   WHERE login = $login"
    );
    upd.run(
        {
            $otp_confirmed: confirmed,
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

Database.prototype.selectSessions = function (params) {
    var engine = this.getEngine(),
        defer = q.defer();

    var bind = {}, where = [];
    if (typeof params != 'undefined') {
        if (typeof params['sid'] != 'undefined') {
            bind['$sid'] = params['sid'];
            where.push(" s.sid = $sid");
        }
    }

    var sql = "SELECT s.id, s.user_id, u.login, s.sid, s.last, s.auth_password, s.auth_otp"
      + "   FROM sessions s"
      + "   LEFT JOIN users u"
      + "       ON s.user_id = u.id";
    if (where.length)
        sql += " WHERE " + where.join(' AND ');
    sql += " ORDER BY s.id ASC";

    var sel = engine.prepare(sql);
    sel.all(
        bind,
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

    this.selectUsers({ login: login })
        .then(function (users) {
            var user = users.length && users[0];
            if (!user) {
                defer.reject("No such user: " + login);
                return;
            }

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
