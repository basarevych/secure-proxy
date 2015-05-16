'use strict'

var fs          = require('fs'),
    q           = require('q'),
    crypto      = require('crypto'),
    path        = require('path'),
    url         = require('url');

function Front(serviceLocator) {
    this.sl = serviceLocator;

    this.sl.set('front', this);
}

module.exports = Front;

Front.prototype.returnInternalError = function (res) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(
        '<html><body>'
        + '<h1>500 Internal Server Error</h1>'
        + '<h3>An error occured</h3>'
        + '</body></html>'
    );
};

Front.prototype.returnNotFound = function (res) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(
        '<html><body>'
        + '<h1>404 Not Found</h1>'
        + '<h3>Requested resource was not found</h3>'
        + '</body></html>'
    );
};

Front.prototype.returnBadRequest = function (res) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(
        '<html><body>'
        + '<h1>400 Bad Request</h1>'
        + '<h3>Invalid request parameters</h3>'
        + '</body></html>'
    );
};

Front.prototype.returnFile = function (filename, res) {
    var me = this,
        logger = this.sl.get('logger');

    var realPath = getRealPath(filename);
    if (realPath === false)
        return this.returnNotFound(res);

    var type = 'application/octet-stream';
    switch (path.extname(filename)) {
        case '.html':   type = 'text/html'; break;
        case '.css':    type = 'text/css'; break;
        case '.js':     type = 'application/javascript'; break;
        case '.gif':    type = 'image/gif'; break;
    }

    fs.readFile(realPath, function (err, data) {
        if (err) {
            logger.error('fs readFile', err);
            return me.returnInternalError(res);
        }

        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
    });
};

Front.prototype.requestListener = function (protocol, req, res) {
    var me = this,
        db = this.sl.get('database'),
        api = this.sl.get('api'),
        proxy = this.sl.get('proxy'),
        config = this.sl.get('config'),
        logger = this.sl.get('logger'),
        cookies = this.parseCookies(req),
        query = url.parse(req.url, true),
        sid = query.query['sid'],
        urlParts = query.pathname.split('/');

    if (typeof sid == 'undefined')
        sid = cookies[config['namespace'] + 'sid'];

    if (urlParts.length >= 2 && urlParts[0] == '' && urlParts[1] == 'secure-proxy') {
        if (urlParts.length == 2 || urlParts[2] == '') {
            return me.returnNotFound(res);
        } else if (urlParts[2] == 'static') {
            urlParts.shift();
            urlParts.shift();
            urlParts.shift();
            return me.returnFile(urlParts.join('/'), res);
        } else if (urlParts[2] == 'api') {
            if (urlParts.length < 4)
                return me.returnNotFound(res);
            switch (urlParts[3]) {
                case 'locale':
                    return api.locale(protocol, sid, req, res);
                case 'status':
                    return api.status(protocol, sid, req, res);
                case 'logout':
                    return api.logout(protocol, sid, req, res);
                case 'auth':
                    return api.auth(protocol, sid, req, res);
                case 'otp':
                    return api.otp(protocol, sid, req, res);
                case 'reset-request':
                    return api.resetRequest(protocol, sid, req, res);
                default:
                    return me.returnNotFound(res);
            }
        }
        return me.returnNotFound(res);
    }

    if (!sid) {
        var defer = q.defer();

        crypto.randomBytes(16, function (ex, buf) {
            if (ex) {
                logger('crypto randomBytes', ex);
                defer.reject(ex);
                return;
            }

            defer.resolve(buf.toString('hex'));
        });

        defer.promise
            .then(function (random) {
                var header = config['namespace'] + 'sid=' + random + '; path=/';
                res.setHeader('set-cookie', header);
                me.returnFile('auth/index.html', res);
            })
            .catch(function (err) {
                me.returnInternalError(res);
            });

        return;
    }

    db.selectSessions({ sid: sid })
        .then(function (sessions) {
            var session = sessions.length && sessions[0];

            var isAuthenticated = false;
            if (session) {
                if (config['otp']['enable'])
                    isAuthenticated = session.auth_password && session.auth_otp;
                else
                    isAuthenticated = session.auth_password;
            }

            if (isAuthenticated) {
                db.refreshSession(sid)
                    .then(function () {
                        proxy.web(req, res);
                    })
                    .catch(function (err) {
                        me.returnInternalError(res);
                    });
            } else {
                me.returnFile('auth/index.html', res);
            }
        })
        .catch(function (err) {
            logger.error(err);
        });
};

Front.prototype.parseCookies = function (req) {
    var list = {},
        rc = req.headers.cookie;

    rc && rc.split(';').forEach(function (cookie) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
};

function getRealPath(filename) {
    if (filename.indexOf('..') != -1)
        return false;

    var path = __dirname + '/../public/' + filename;
    if (!fs.existsSync(path))
        return false;

    return path;
}
