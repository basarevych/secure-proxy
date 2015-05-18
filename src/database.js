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
          + "  password VARCHAR(255) NULL,"
          + "  email VARCHAR(255) NULL,"
          + "  secret TEXT NULL,"
          + "  otp_key TEXT NULL,"
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

Database.prototype.selectUsers = function (params) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var bind = {}, where = [];
    if (typeof params != 'undefined') {
        if (typeof params['id'] != 'undefined') {
            bind['$id'] = params['id'];
            where.push(" id = $id");
        }
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
                logger.error('sqlite all', err);
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
        logger = this.sl.get('logger'),
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
            $password: null,
            $email: email,
            $secret: null,
            $otp_key: null,
            $otp_confirmed: false,
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            var id = this.lastID;
            me.generateUserSecret(id)
                .then(function () { return me.generateUserOtpKey(id); })
                .then(function () {
                    if (password) {
                        me.setUserPassword(id, password)
                            .then(function () {
                                defer.resolve(id);
                            })
                            .catch(function (err) {
                                defer.reject(err);
                            });
                    } else {
                        defer.resolve(id);
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

Database.prototype.deleteUser = function (id) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var del = engine.prepare(
        "DELETE FROM users"
      + "   WHERE id = $id"
    );
    del.run(
        {
            $id: id
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    del.finalize();

    return defer.promise;
};

Database.prototype.setUserPassword = function (id, password) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    bcrypt.genSalt(10, function (err, salt) {
        if (err) {
            logger.error('bcrypt genSalt', err);
            defer.reject(err);
            return;
        }

        bcrypt.hash(password, salt, function (err, hash) {
            if (err) {
                logger.error('bcrypt hash', err);
                defer.reject(err);
                return;
            }

            var upd = engine.prepare(
                "UPDATE users"
              + "   SET password = $password"
              + "   WHERE id = $id"
            );
            upd.run(
                {
                    $password: hash,
                    $id: id
                },
                function (err) {
                    if (err) {
                        logger.error('sqlite run', err);
                        defer.reject(err);
                        return;
                    }

                    defer.resolve();
                }
            );
            upd.finalize();
        });
    });

    return defer.promise;
};

Database.prototype.checkUserPassword = function (id, password) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    this.selectUsers({ id: id })
        .then(function (users) {
            var user = users.length && users[0];
            if (!user || !user['password']) {
                defer.resolve(false);
                return;
            }

            bcrypt.compare(password, user['password'], function (err, match) {
                if (err) {
                    logger.error('bcrypt compare', err);
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

Database.prototype.setUserEmail = function (id, email) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var upd = engine.prepare(
        "UPDATE users"
      + "   SET email = $email"
      + "   WHERE id = $id"
    );
    upd.run(
        {
            $email: email,
            $id: id
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    upd.finalize();

    return defer.promise;
};

Database.prototype.generateUserSecret = function (id) {
    var me = this,
        logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    crypto.randomBytes(16, function (ex, buf) {
        if (ex) {
            logger.error('crypto randomBytes', ex);
            defer.reject(ex);
            return;
        }

        var token = buf.toString('hex');
        var upd = engine.prepare(
            "UPDATE users"
          + "  SET secret = $secret"
          + "  WHERE id = $id"
        );
        upd.run(
            {
                $secret: token,
                $id: id,
            },
            function (err) {
                if (err) {
                    logger.error('sqlite run', err);
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

Database.prototype.generateUserOtpKey = function (id) {
    var me = this,
        logger = this.sl.get('logger'),
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
      + "  WHERE id = $id"
    );
    upd.run(
        {
            $otp_key: key.base32,
            $id: id,
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    upd.finalize();

    return defer.promise;
};

Database.prototype.checkUserOtpKey = function (id, otp) {
    var engine = this.getEngine(),
        defer = q.defer();

    this.selectUsers({ id: id })
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

Database.prototype.setUserOtpConfirmed = function (id, confirmed) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var upd = engine.prepare(
        "UPDATE users"
      + "   SET otp_confirmed = $otp_confirmed"
      + "   WHERE id = $id"
    );
    upd.run(
        {
            $otp_confirmed: confirmed,
            $id: id
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    upd.finalize();

    return defer.promise;
};

Database.prototype.selectSessions = function (params) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var bind = {}, where = [];
    if (typeof params != 'undefined') {
        if (typeof params['id'] != 'undefined') {
            bind['$id'] = params['id'];
            where.push(" s.id = $id");
        }
        if (typeof params['sid'] != 'undefined') {
            bind['$sid'] = params['sid'];
            where.push(" s.sid = $sid");
        }
        if (typeof params['login'] != 'undefined') {
            bind['$login'] = params['login'];
            where.push(" u.login = $login");
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
                logger.error('sqlite all', err);
                defer.reject(err);
                return;
            }

            defer.resolve(rows);
        }
    );
    sel.finalize();

    return defer.promise;
};

Database.prototype.createSession = function (userId, sid) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer(),
        now = Math.round((new Date().getTime()) / 1000);

    this.selectUsers({ id: userId })
        .then(function (users) {
            var user = users.length && users[0];
            if (!user) {
                defer.reject("No such user: " + userId);
                return;
            }

            var ins = engine.prepare(
                "INSERT INTO"
              + "   sessions(user_id, sid, last, auth_password, auth_otp)"
              + "   VALUES($user_id, $sid, $last, $auth_password, $auth_otp)"
            );
            ins.run(
                {
                    $user_id: userId,
                    $sid: sid,
                    $last: now,
                    $auth_password: false,
                    $auth_otp: false,
                },
                function (err) {
                    if (err) {
                        logger.error('sqlite run', err);
                        defer.reject(err);
                        return;
                    }

                    var id = this.lastID;
                    defer.resolve(id);
                }
            );
            ins.finalize();
        })
        .catch(function (err) {
            defer.reject(err);
        });

    return defer.promise;
};

Database.prototype.deleteSession = function (id) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var del = engine.prepare(
        "DELETE FROM sessions"
      + "   WHERE id = $id"
    );
    del.run(
        {
            $id: id
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    del.finalize();

    return defer.promise;
};

Database.prototype.deleteOldSessions = function (age) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var last = Math.round((new Date().getTime()) / 1000) - age;

    var del = engine.prepare(
        "DELETE FROM sessions"
      + "   WHERE last < $last"
    );
    del.run(
        {
            $last: last
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    del.finalize();

    return defer.promise;
};

Database.prototype.refreshSession = function (id) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer(),
        now = Math.round((new Date().getTime()) / 1000);

    var upd = engine.prepare(
        "UPDATE sessions"
      + "   SET last = $last"
      + "   WHERE id = $id"
    );
    upd.run(
        {
            $last: now,
            $id: id
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    upd.finalize();

    return defer.promise;
};

Database.prototype.setSessionPassword = function (id, password) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var upd = engine.prepare(
        "UPDATE sessions"
      + "   SET auth_password = $auth_password"
      + "   WHERE id = $id"
    );
    upd.run(
        {
            $auth_password: password,
            $id: id
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }
    
            defer.resolve();
        }
    );
    upd.finalize();

    return defer.promise;
};

Database.prototype.setSessionOtp = function (id, otp) {
    var logger = this.sl.get('logger'),
        engine = this.getEngine(),
        defer = q.defer();

    var upd = engine.prepare(
        "UPDATE sessions"
      + "   SET auth_otp = $auth_otp"
      + "   WHERE id = $id"
    );
    upd.run(
        {
            $auth_otp: otp,
            $id: id
        },
        function (err) {
            if (err) {
                logger.error('sqlite run', err);
                defer.reject(err);
                return;
            }

            defer.resolve();
        }
    );
    upd.finalize();

    return defer.promise;
};
