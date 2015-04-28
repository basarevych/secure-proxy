var http        = require('http'),
    httpProxy   = require('http-proxy'),
    url         = require('url')
    q           = require('q'),
    crypto      = require('crypto'),
    config      = require('../config.js')
    front       = require('./front.js')
    api         = require('./api.js'),
    db          = require('./db.js');

var proxy = httpProxy.createProxyServer({
    target: config['target'],
});

proxy.on('error', function (err, req, res) {
    console.error(err);
    front.returnInternalError(res);
});

server = http.createServer(function (req, res) {
    var cookies = front.parseCookies(req),
        sid = cookies[config['cookie'] + 'sid'],
        query = url.parse(req.url),
        urlParts = query.pathname.split('/');

    db.sessionExists(sid)
        .then(function (isAuthenticated) {
            if (urlParts.length >= 2 && urlParts[0] == '' && urlParts[1] == 'secure-proxy') {
                if (urlParts.length == 2 || urlParts[2] == '') {
                    return front.returnFile(isAuthenticated ? 'app/index.html' : 'auth/index.html', res);
                } else if (urlParts[2] == 'static') {
                    urlParts.shift();
                    urlParts.shift();
                    urlParts.shift();
                    return front.returnFile(urlParts.join('/'), res);
                } else if (urlParts[2] == 'api') {
                    if (urlParts.length < 4)
                        return front.returnNotFound(res);
                    return api.parse(sid, urlParts[3], req, res);
                }
            }

            if (typeof sid == 'undefined') {
                var defer = q.defer();

                crypto.randomBytes(16, function (ex, buf) {
                    defer.resolve(buf.toString('hex'));
                });

                defer.promise
                    .then(function (random) {
                        var header = config['cookie'] + 'sid=' + random + '; path=/';
                        res.setHeader('set-cookie', header);
                    })
                    .then(function () {
                        front.returnFile('auth/index.html', res);
                    });

                return;
            } else if (isAuthenticated) {
                proxy.web(req, res);
            } else {
                front.returnFile('auth/index.html', res);
            }
        })
        .catch(function (err) {
            console.error(err);
        });
});

server.listen(8000);
