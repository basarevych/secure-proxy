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
    if (setLocale && globalize.supportedLocales.indexOf(setLocale) != -1) {
        result = setLocale;

        var header = config['namespace'] + 'locale=' + result + '; path=/';
        res.setHeader('set-cookie', header);
    }

    if (!result) {
        if (localeCookie && globalize.supportedLocales.indexOf(localeCookie) != -1)
            result = localeCookie;
        else
            result = locales.best(new locale.Locales(globalize.supportedLocales));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ locale: result }));
};

Api.prototype.status = function (protocol, sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front');

    if (!sid)
        return front.returnBadRequest(res);

    db.selectSessions({ sid: sid })
        .then(function (sessions) {
            var session = sessions.length && sessions[0];
            if (!session) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ authenticated: false }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                authenticated: true,
                login: session['login'],
            }));
        })
        .catch(function (err) {
            front.returnInternalError(res);
        });
};

Api.prototype.logout = function (protocol, sid, req, res) {
    var db = this.sl.get('database'),
        front = this.sl.get('front'),
        ipAddress = req.connection.remoteAddress;

    if (!ipAddress)
        return front.returnInternalError(res);

    if (!sid)
        return front.returnBadRequest(res);

    db.selectSessions({ sid: sid })
        .then(function (sessions) {
            var session = sessions.length && sessions[0];
            if (!session || session['ip_address'] != ipAddress) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
                return;
            }

            db.deleteSession(session['id'])
                .then(function () {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                })
                .catch(function (err) {
                    front.returnInternalError(res);
                });
        })
        .catch(function (err) {
            front.returnInternalError(res);
        });
};

Api.prototype.auth = function (protocol, sid, req, res) {
    var db = this.sl.get('database'),
        ldap = this.sl.get('ldap'),
        front = this.sl.get('front'),
        config = this.sl.get('config'),
        ipAddress = req.connection.remoteAddress,
        query = url.parse(req.url, true),
        action = query.query['action'],
        password = query.query['password'];

    if (!ipAddress)
        return front.returnInternalError(res);

    if (!sid || !action || !password)
        return front.returnBadRequest(res);

    if (action == 'check') {
        var login = query.query['login'];
        if (!login)
            return front.returnBadRequest(res);

        db.selectUsers({ login: login })
            .then(function (users) {
                var user = users.length && users[0];
                var passwordDefer = q.defer();

                if (user) {
                    db.checkUserPassword(user['id'], password)
                        .then(function (match) {
                            passwordDefer.resolve(match);
                        })
                        .catch(function (err) {
                            passwordDefer.reject(err);
                        });
                } else {
                    passwordDefer.resolve(false);
                }

                passwordDefer.promise
                    .then(function (match) {
                        if (match)
                            return match;

                        return ldap.authenticate(login, password);
                    })
                    .then(function (match) {
                        if (!match) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false }));
                            return;
                        }

                        db.selectSessions({ sid: sid })
                            .then(function (sessions) {
                                var session = sessions.length && sessions[0];
                                var prepareDefer = q.defer();

                                if (session) {
                                    db.deleteSession(session['id'])
                                        .then(function () {
                                            prepareDefer.resolve();
                                        })
                                        .catch(function (err) {
                                            prepareDefer.reject(err);
                                        });
                                } else {
                                    prepareDefer.resolve();
                                }

                                prepareDefer.promise
                                    .then(function () { return db.createSession(user['id'], sid, ipAddress) })
                                    .then(function (id) { return db.setSessionPassword(id, true) })
                                    .then(function () {
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({
                                            success: true,
                                            reload: !config['otp']['enable'],
                                        }));
                                    })
                                    .catch(function (err) {
                                        front.returnInternalError(res);
                                    });
                            })
                            .catch(function (err) {
                                front.returnInternalError(res);
                            });
                    })
                    .catch(function (err) {
                        front.returnInternalError(res);
                    });
            });
    } else if (action == 'set') {
        var secret = query.query['secret'];
        if (!secret)
            return front.returnBadRequest(res);

        db.selectUsers({ secret: secret })
            .then(function (users) {
                var user = users.length && users[0];
                if (!user) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        reason: 'expired',
                    }));
                    return;
                }

                if (!user['password']) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false }));
                    return;
                }

                db.setUserPassword(user['id'], password)
                    .then(function () { return db.generateUserSecret(user['id']); })
                    .then(function () {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    })
                    .catch(function (err) {
                        front.returnInternalError(res);
                    });
            })
            .catch(function (err) {
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
        ipAddress = req.connection.remoteAddress,
        query = url.parse(req.url, true),
        action = query.query['action'];

    if (!ipAddress)
        return front.returnInternalError(res);

    if (!sid || !action)
        return front.returnBadRequest(res);

    if (action == 'get') {
        db.selectSessions({ sid: sid })
            .then(function (sessions) {
                var session = sessions.length && sessions[0];
                if (!session || session['ip_address'] != ipAddress || !session['auth_password']) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        reload: true,
                    }));
                    return;
                }

                db.selectUsers({ id: session['user_id'] })
                    .then(function (users) {
                        var user = users.length && users[0];
                        if (!user)
                            return front.returnInternalError(res);

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
                        front.returnInternalError(res);
                    });
            })
            .catch(function (err) {
                front.returnInternalError(res);
            });
    } else if (action == 'check') {
        var otp = query.query['otp'];
        if (!otp)
            return front.returnBadRequest(res);

        db.selectSessions({ sid: sid })
            .then(function (sessions) {
                var session = sessions.length && sessions[0];
                if (!session || session['ip_address'] != ipAddress || !session['auth_password']) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        reload: true,
                    }));
                    return;
                }

                db.checkUserOtpKey(session['user_id'], otp)
                    .then(function (correct) {
                        if (!correct) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false }));
                            return;
                        }

                        db.setUserOtpConfirmed(session['user_id'], true)
                            .then(function () { return db.setSessionOtp(session['id'], true); })
                            .then(function () {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    success: true,
                                    reload: true,
                                }));
                            })
                            .catch(function (err) {
                                front.returnInternalError(res);
                            });
                    })
                    .catch(function (err) {
                        front.returnInternalError(res);
                    });
            })
            .catch(function (err) {
                front.returnInternalError(res);
            });
    } else if (action == 'reset') {
        var secret = query.query['secret'];
        if (!secret)
            return front.returnBadRequest(res);

        db.selectUsers({ secret: secret })
            .then(function (users) {
                var user = users.length && users[0];
                if (!user) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        reason: 'expired',
                    }));
                    return;
                }

                db.setUserOtpConfirmed(user['id'], false)
                    .then(function () { return db.generateUserOtpKey(user['id']); })
                    .then(function () { return db.generateUserSecret(user['id']); })
                    .then(function () {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    })
                    .catch(function (err) {
                        front.returnInternalError(res);
                    });
            })
            .catch(function (err) {
                front.returnInternalError(res);
            });
    } else {
        return front.returnBadRequest(res);
    }

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

    if (!type || !userEmail || !lang)
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
                    if (!user['password']) {
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
                    })
                    .catch(function (err) {
                        front.returnInternalError(res);
                    });
            })
            .catch(function (err) {
                front.returnInternalError(res);
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
                    })
                    .catch(function (err) {
                        front.returnInternalError(res);
                    });
            })
            .catch(function (err) {
                front.returnInternalError(res);
            });
    } else {
        return front.returnBadRequest(res);
    }
};
