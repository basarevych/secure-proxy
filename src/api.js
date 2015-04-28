var url = require('url'),
    locale = require('locale'),
    front = require('./front.js'),
    db = require('./db.js');

module.exports = {};

module.exports.parse = function (cookie, command, req, res) {
    switch (command) {
        case 'locale':
            locale.Locale["default"] = 'en';
            var supported = new locale.Locales([ 'en', 'ru' ]),
                locales = new locale.Locales(req.headers["accept-language"])

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ locale: locales.best(supported) }));
            break;
        case 'auth':
            var query = url.parse(req.url, true),
                login = query.query['login'],
                password = query.query['password'];

            if (typeof cookie == 'undefined' || typeof login == 'undefined' || typeof password == 'undefined')
                return front.returnBadRequest(res);

            db.checkPassword(login, password)
                .then(function (match) {
                    if (match) {
                        db.createSession(login, cookie)
                            .then(function () {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    success: true,
                                    next: 'done',
                                }));
                            })
                            .catch(function (err) {
                                console.error(err);
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
