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

Api.prototype.locale = function (protocol, sid, req, res) {
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

Api.prototype.logout = function (protocol, sid, req, res) {
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

Api.prototype.auth = function (protocol, sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        action = query.query['action'],
        login = query.query['login'],
        password = query.query['password'],
        secret = query.query['secret'];

    if (typeof sid == 'undefined' || typeof action == 'undefined' || typeof password == 'undefined')
        return front.returnBadRequest(res);

    if (action == 'check') {
        if (typeof login == 'undefined')
            return front.returnBadRequest(res);

        db.checkUserPassword(login, password)
            .then(function (match) {
                if (match) {
                    db.selectSessions({ sid: sid })
                        .then(function (sessions) {
                            var session = sessions.length && sessions[0];
                            var defer = q.defer();

                            if (session) {
                                db.deleteSession(sid)
                                    .then(function () {
                                        defer.resolve();
                                    })
                                    .catch(function (err) {
                                        console.error(err);
                                        front.returnInternalError(res);
                                    });
                            } else {
                                defer.resolve();
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

        db.selectUsers({ secret: secret })
            .then(function (users) {
                var user = users.length && users[0];
                if (user) {
                    if (user['password'] != '* NOT SET *' && user['secret'] == secret) {
                        db.setUserPassword(user['login'], password)
                            .then(function () { return db.generateUserSecret(user['login']); })
                            .then(function () {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true }));
                            })
                            .catch(function (err) {
                                console.error(err);
                                front.returnInternalError(res);
                            });
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false }));
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        reason: 'expired',
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
};

Api.prototype.otp = function (protocol, sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        action = query.query['action'],
        otp = query.query['otp'],
        secret = query.query['secret'];

    if (typeof sid == 'undefined' || typeof action == 'undefined')
        return front.returnBadRequest(res);

    db.selectSessions({ sid: sid })
        .then(function (sessions) {
            var session = sessions.length && sessions[0];
            if (!session || !session.auth_password) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    next: 'password',
                }));
                return;
            }

            if (action == 'get') {
                db.selectUsers({ login: session['login'] })
                    .then(function (users) {
                        var user = users.length && users[0];
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
                            db.setUserOtpConfirmed(session['login'], true)
                                .then(function () { return db.setSessionOtp(sid, true); })
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

                db.selectUsers({ login: session['login'] })
                    .then(function (users) {
                        var user = users.length && users[0];
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
                        res.end(JSON.stringify({
                            success: false,
                            reason: 'expired',
                        }));
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

Api.prototype.resetRequest = function (protocol, sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front'),
        email = this.sl.get('email'),
        globalize = this.sl.get('globalize'),
        config = this.sl.get('config'),
        query = url.parse(req.url, true),
        type = query.query['type'],
        userEmail = query.query['email'],
        lang = query.query['lang'];

    if (typeof type == 'undefined' || typeof userEmail == 'undefined' || typeof lang == 'undefined')
        return front.returnBadRequest(res);

    if (globalize.supportedLocales.indexOf(lang) == -1)
        return front.returnBadRequest(res);

    var gl = globalize.getLocale(lang);

    var baseUrlQuery = url.parse(config[protocol]['base_url']);

    if (type == 'password') {
        db.selectUsers({ email: userEmail })
            .then(function (users) {
                var externPassword = false, promises = [];
                users.forEach(function (user) {
                    if (user['password'] == '* NOT SET *') {
                        externPassword = true;
                        return;
                    }

                    var link = baseUrlQuery.protocol + '//' + baseUrlQuery.host
                        + '/secure-proxy/static/auth/reset-password.html#' + user['secret'];
                    promises.push(email.send({
                        subject:    gl.formatMessage('RESET_PASSWORD_SUBJECT'),
                        to:         user['email'],
                        text:       gl.formatMessage('RESET_PASSWORD_TEXT', { host: baseUrlQuery.hostname, account: user['login'], link: link }),
                        html:       gl.formatMessage('RESET_PASSWORD_HTML', { host: baseUrlQuery.hostname, account: user['login'], link: link }),
                    }));
                });

                q.all(promises)
                    .then(function () {
                        if (externPassword) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: false,
                                reason: 'extern-password',
                            }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: (promises.length > 0) }));
                        }
                    });
            });
    } else if (type == 'otp') {
        db.selectUsers({ email: userEmail })
            .then(function (users) {
                var promises = [];
                users.forEach(function (user) {
                    var link = baseUrlQuery.protocol + '//' + baseUrlQuery.host
                        + '/secure-proxy/static/auth/reset-otp.html#' + user['secret'];
                    promises.push(email.send({
                        subject:    gl.formatMessage('RESET_OTP_SUBJECT'),
                        to:         user['email'],
                        text:       gl.formatMessage('RESET_OTP_TEXT', { host: baseUrlQuery.hostname, account: user['login'], link: link }),
                        html:       gl.formatMessage('RESET_OTP_HTML', { host: baseUrlQuery.hostname, account: user['login'], link: link }),
                    }));
                });

                q.all(promises)
                    .then(function () {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: (promises.length > 0) }));
                    });
            });
    } else {
        return front.returnBadRequest(res);
    }
};
