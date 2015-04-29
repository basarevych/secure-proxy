var argv        = require('minimist')(process.argv.slice(2)),
    http        = require('http'),
    https       = require('https'),
    httpProxy   = require('http-proxy'),
    url         = require('url')
    q           = require('q'),
    crypto      = require('crypto'),
    fs          = require('fs'),
    config      = require('../config.js')
    front       = require('./front.js')
    api         = require('./api.js'),
    db          = require('./db.js');

var httpOption = argv['h'] ? argv['h'] : argv['http'];
    httpsOption = argv['s'] ? argv['s'] : argv['https'];

if (typeof httpOption != 'string' && typeof httpsOption != 'string') {
    console.log("Usage: node src/index.js <options>\n");
    console.log("Options:");
    console.log("\t-h, --http=host:port\tCreate HTTP server");
    console.log("\t-s, --https=host:port\tCreate HTTPS server");
    console.log("\nAt least one -h or -s option must be provided");
    return;
}

if (httpOption) {
    httpOption = httpOption.split(':');
    if (httpOption.length != 2) {
        console.log('-h [--http] option expects "hostname:portnumber" string');
        return;
    }
}
if (httpsOption) {
    httpsOption = httpsOption.split(':');
    if (httpsOption.length != 2) {
        console.log('-s [--https] option expects "hostname:portnumber" string');
        return;
    }
}

var proxy = httpProxy.createProxyServer({
    target: config['target'],
    xfwd: true,
});
proxy.on('error', function (err, req, res) {
    console.error(err);
    front.returnInternalError(res);
});

if (httpOption) {
    httpServer = http.createServer(requestListener);
    httpServer.listen(httpOption[1], httpOption[0]);
}

if (httpsOption) {
    httpsServer = https.createServer(
        {
            key: fs.readFileSync(config['ssl']['key'], 'utf8'),
            cert: fs.readFileSync(config['ssl']['cert'], 'utf8')
        },
        requestListener
    );
    httpsServer.listen(httpsOption[1], httpsOption[0]);
}


function requestListener(req, res) {
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
                    if (ex)
                        defer.reject(ex);
                    else
                        defer.resolve(buf.toString('hex'));
                });

                defer.promise
                    .then(function (random) {
                        var header = config['cookie'] + 'sid=' + random + '; path=/';
                        res.setHeader('set-cookie', header);
                    })
                    .then(function () {
                        front.returnFile('auth/index.html', res);
                    })
                    .catch(function (err) {
                        console.error(err);
                        front.returnInternalError(res);
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
};
