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
        globalize = this.sl.get('globalize'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        setLocale = query.query['set'],
        cookies = front.parseCookies(req),
        localeCookie = cookies[config['namespace'] + 'locale'],
        locales = new locale.Locales(req.headers["accept-language"])

    var result = null;
    if (typeof setLocale != 'undefined' && globalize.supportedLocales.indexOf(setLocale) != -1) {
        result = setLocale;

        var header = config['namespace'] + 'locale=' + result + '; path=/';
        res.setHeader('set-cookie', header);
    }

    if (!result) {
        if (typeof localeCookie != 'undefined' && globalize.supportedLocales.indexOf(localeCookie) != -1)
            result = localeCookie;
        else
            result = locales.best(new locale.Locales(globalize.supportedLocales));
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
        action = query.query['action'],
        login = query.query['login'],
        password = query.query['password'],
        secret = query.query['secret'];

    if (typeof sid == 'undefined' || typeof action == 'undefined'
            || typeof login == 'undefined' || typeof password == 'undefined') {
        return front.returnBadRequest(res);
    }

    if (action == 'check') {
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
    } else if (action == 'set') {
        if (typeof secret == 'undefined')
            return front.returnBadRequest(res);

        db.selectUser(login)
            .then(function (user) {
                if (secret == user['secret']) {
                    db.setUserPassword(login, password)
                        .then(function () { return db.generateUserSecret(login); })
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
                front.returnInternalError(res);
            });
    } else {
        return front.returnBadRequest(res);
    }
};

Api.prototype.otp = function (sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        action = query.query['action'],
        otp = query.query['otp'],
        secret = query.query['secret'];

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
                        var result = { success: true };
                        if (!user['otp_confirmed']) {
                            result['qr_code'] = 'otpauth://totp/'
                                + encodeURIComponent(config['otp']['name'])
                                + '?secret=' + user['otp_key'];
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    })
                    .catch(function (err) {
                        console.error(err);
                        front.returnInternalError(res);
                    });
            } else if (action == 'check') {
                if (typeof otp == 'undefined')
                    return front.returnBadRequest(res);

                db.checkUserOtpKey(session['login'], otp)
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
                            return;
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false }));
                    })
                    .catch(function (err) {
                        console.error(err);
                        front.returnInternalError(res);
                    });
            } else if (action == 'reset') {
                if (typeof secret == 'undefined')
                    return front.returnBadRequest(res);

                db.selectUser(session['login'])
                    .then(function (user) {
                        if (secret == user['secret']) {
                            db.setUserOtpConfirmed(session['login'], false)
                                .then(function () { return db.generateUserOtpKey(session['login']); })
                                .then(function () { return db.generateUserSecret(session['login']); })
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

Api.prototype.resetRequest = function (sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front'),
        email = this.sl.get('email'),
        globalize = this.sl.get('globalize'),
        query = url.parse(req.url, true),
        type = query.query['type'],
        email = query.query['email'],
        lang = query.query['lang'];

    if (typeof type == 'undefined' || typeof email == 'undefined' || typeof lang == 'undefined')
        return front.returnBadRequest(res);

    if (globalize.supportedLocales.indexOf(lang) == -1)
        return front.returnBadRequest(res);

    db.selectUserByEmail(email)
        .then(function (user) {
            if (!user || !user['email'] || !req.headers.host) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }

            var gl = globalize.getLocale(lang);
            if (type == 'auth') {
                if (user['password'] == '* NOT SET *') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        reason: 'extern-password',
                    }));
                    return;
                }
                email.send({
                    subject:    gl.formatMessage('RESET_PASSWORD_SUBJECT'),
                    to:         user['email'],
                    text:       gl.formatMessage('RESET_PASSWORD_TEXT', { host: host, link: link }),
                    html:       gl.formatMessage('RESET_PASSWORD_HTML', { host: host, link: link }),
                });
            } else if (type == 'otp') {
                email.send({
                    subject:    gl.formatMessage('RESET_OTP_SUBJECT'),
                    to:         user['email'],
                    text:       gl.formatMessage('RESET_OTP_TEXT', { host: host, link: link }),
                    html:       gl.formatMessage('RESET_OTP_HTML', { host: host, link: link }),
                });
            } else {
                return front.returnBadRequest(res);
            }
        });
};
