'use strict'

var url         = require('url'),
    locale      = require('locale'),
    q           = require('q');

function Api(serviceLocator) {
    this.sl = serviceLocator;

    this.sl.set('api', this);

    locale.Locale["default"] = 'en';
}

module.exports = Api;

Api.prototype.locale = function (sid, req, res) {
    var front = this.sl.get('front'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        set = query.query['set'],
        cookies = front.parseCookies(req),
        cookie = cookies[config['namespace'] + 'locale'],
        supported = [ 'en', 'ru' ],
        locales = new locale.Locales(req.headers["accept-language"])

    var result = null;
    if (typeof set != 'undefined' && supported.indexOf(set) != -1) {
        result = set;

        var header = config['namespace'] + 'locale=' + set + '; path=/';
        res.setHeader('set-cookie', header);
    }

    if (!result) {
        if (typeof cookie != 'undefined' && supported.indexOf(cookie) != -1)
            result = cookie;
        else
            result = locales.best(new locale.Locales(supported));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ locale: result }));
};

Api.prototype.logout = function (sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front');

    db.sessionExists(sid)
        .then(function (exists) {
            if (exists) {
                db.deleteSession(sid)
                    .then(function () {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    })
                    .catch(function (err) {
                        console.error(err);
                        front.returnInternalError(res);
                    });
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
        })
        .catch(function (err) {
            console.error(err);
        });
};

Api.prototype.auth = function (sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        login = query.query['login'],
        password = query.query['password'];

    if (typeof sid == 'undefined' || typeof login == 'undefined' || typeof password == 'undefined')
        return front.returnBadRequest(res);

    db.checkUserPassword(login, password)
        .then(function (match) {
            if (match) {
                db.selectSession(sid)
                    .then(function (session) {
                        var defer = q.defer();

                        defer.promise
                            .then(function () { return db.createSession(login, sid) })
                            .then(function () { return db.setSessionPassword(sid, true) })
                            .then(function () {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    success: true,
                                    next: config['otp']['enable'] ? 'otp' : 'done',
                                }));
                            })
                            .catch(function (err) {
                                console.error(err);
                                front.returnInternalError(res);
                            });

                        if (typeof session == 'undefined') {
                            defer.resolve();
                        } else {
                            db.deleteSession(sid)
                                .then(function () {
                                    defer.resolve();
                                })
                                .catch(function (err) {
                                    console.error(err);
                                    front.returnInternalError(res);
                                });
                        }
                    })
                    .catch(function (err) {
                        console.error(err);
                        front.returnInternalError(res);
                    });
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
        });
};

Api.prototype.otp = function (sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        action = query.query['action'],
        otp = query.query['otp'];

    if (typeof sid == 'undefined' || typeof action == 'undefined')
        return front.returnBadRequest(res);

    db.selectSession(sid)
        .then(function (session) {
            if (!session || !session.auth_password) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    next: 'password',
                }));
                return;
            }

            if (action == 'get') {
                db.selectUser(session['login'])
                    .then(function (user) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            qr_code: 'otpauth://totp/'
                                + encodeURIComponent(config['otp']['name'])
                                + '?secret=' + user['otp_key'],
                        }));
                    })
                    .catch(function (err) {
                        console.error(err);
                        front.returnInternalError(res);
                    });
            } else if (action = 'check') {
                db.checkUserOtp(session['login'], otp)
                    .then(function (correct) {
                        if (correct) {
                            db.setSessionOtp(sid, true)
                                .then(function () {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({
                                        success: true,
                                        next: 'done',
                                    }));
                                })
                                .catch(function (err) {
                                    console.error(err);
                                    front.returnInternalError(res);
                                });
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: false
                            }));
                        }
                    })
                    .catch(function (err) {
                        console.error(err);
                        front.returnInternalError(res);
                    });
            } else {
                return front.returnBadRequest(res);
            }
        })
        .catch(function (err) {
            console.error(err);
            front.returnInternalError(res);
        });
};
