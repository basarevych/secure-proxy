var url         = require('url'),
    locale      = require('locale'),
    config      = require('../config.js')
    front       = require('./front.js'),
    db          = require('./db.js');

module.exports = {};

module.exports.parse = function (sid, command, req, res) {
    switch (command) {
        case 'locale':
            locale.Locale["default"] = 'en';
            var query = url.parse(req.url, true),
                set = query.query['set'],
                cookies = front.parseCookies(req),
                cookie = cookies[config['cookie'] + 'locale'],
                supported = [ 'en', 'ru' ],
                locales = new locale.Locales(req.headers["accept-language"])

            var result = null;
            if (typeof set != 'undefined' && supported.indexOf(set) != -1) {
                result = set;

                var header = config['cookie'] + 'locale=' + set + '; path=/';
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
            break;

        case 'logout':
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
            break;

        case 'auth':
            var query = url.parse(req.url, true),
                login = query.query['login'],
                password = query.query['password'];

            if (typeof sid == 'undefined' || typeof login == 'undefined' || typeof password == 'undefined')
                return front.returnBadRequest(res);

            db.checkPassword(login, password)
                .then(function (match) {
                    if (match) {
                        db.selectSession(sid)
                            .then(function (session) {
                                var promise = null;
                                if (typeof session == 'undefined')
                                    promise = db.createSession(login, sid);
                                else
                                    promise = db.refreshSession(sid);

                                promise
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
            break;

        default:
            return front.returnNotFound(res);
    }
}
