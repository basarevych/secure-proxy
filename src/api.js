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

Api.prototype.init = function (sid, req, res) {
    var front = this.sl.get('front'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        setLocale = query.query['set_locale'],
        cookies = front.parseCookies(req),
        localeCookie = cookies[config['namespace'] + 'locale'],
        supported = [ 'en', 'ru' ],
        locales = new locale.Locales(req.headers["accept-language"])

    var result = null;
    if (typeof setLocale != 'undefined' && supported.indexOf(setLocale) != -1) {
        result = setLocale;

        var header = config['namespace'] + 'locale=' + result + '; path=/';
        res.setHeader('set-cookie', header);
    }

    if (!result) {
        if (typeof localeCookie != 'undefined' && supported.indexOf(localeCookie) != -1)
            result = localeCookie;
        else
            result = locales.best(new locale.Locales(supported));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        locale: result,
        sid: sid,
    }));
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
        otp = query.query['otp'],
        key = query.query['key'];

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
                        if (user['otp_confirmed']) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: true,
                            }));
                        } else {
                            db.selectUser(session['login'])
                                .then(function (user) {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({
                                        success: true,
                                        qr_code: 'otpauth://totp/'
                                            + encodeURIComponent(config['otp']['name'])
                                            + '?secret=' + user['otp_key'],
                                    }));
                                });
                        }
                    })
                    .catch(function (err) {
                        console.error(err);
                        front.returnInternalError(res);
                    });
            } else if (action == 'check') {
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
            } else if (action == 'reset') {
                db.selectUser(session['login'])
                    .then(function (user) {
                        if (typeof key == 'undefined' || user['otp_key'] != key)
                            return front.returnBadRequest(res);

                        db.setUserOtpConfirmed(session['login'], false)
                            .then(function () { return db.generateUserOtpKey(session['login']); })
                            .then(function () {
                                res.writeHead(302, { 'Location': '/' });
                                res.end();
                            })
                            .catch(function (err) {
                                console.error(err);
                                front.returnInternalError(res);
                            });
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
