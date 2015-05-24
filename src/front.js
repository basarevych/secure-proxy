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

Front.prototype.returnFile = function (filename, res, httpCode) {
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

        res.writeHead(httpCode ? httpCode : 200, { 'Content-Type': type });
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
        ipAddress = req.connection.remoteAddress,
        cookies = this.parseCookies(req),
        sid = cookies[config['namespace'] + 'sid'],
        query = url.parse(req.url, true),
        urlParts = query.pathname.split('/');

    if (!ipAddress) {
        logger.error("No IP address");
        return front.returnInternalError(res);
    }

    if (randomValue(1, 100) <= config['session']['gc_probability'])
        db.deleteOldSessions(config['session']['lifetime']);

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
        this.generateSid(res);
        return;
    }

    db.selectSessions({ sid: sid })
        .then(function (sessions) {
            var session = sessions.length && sessions[0];

            var isAuthenticated = false;
            if (session) {
                if (config['session']['ip_protection'] && session['ip_address'] != ipAddress) {
                    me.generateSid(res);
                    return;
                }

                if (config['otp']['enable'])
                    isAuthenticated = session['auth_password'] && session['auth_otp'];
                else
                    isAuthenticated = session['auth_password'];
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
                me.returnFile('auth/index.html', res, 418);
            }
        })
        .catch(function (err) {
            me.returnInternalError(res);
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

Front.prototype.generateSid = function (res) {
    var me = this,
        config = this.sl.get('config'),
        defer = q.defer();

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
            me.returnFile('auth/index.html', res, 418);
        })
        .catch(function (err) {
            me.returnInternalError(res);
        });
};

function getRealPath(filename) {
    if (filename.indexOf('..') != -1)
        return false;

    var path = __dirname + '/../public/' + filename;
    if (!fs.existsSync(path))
        return false;

    return path;
}

function randomValue(low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}
