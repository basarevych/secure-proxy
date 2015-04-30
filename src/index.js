'use strict'

var fs              = require('fs'),
    http            = require('http'),
    https           = require('https'),
    httpProxy       = require('http-proxy'),
    crypto          = require('crypto'),
    url             = require('url'),
    q               = require('q'),
    argv            = require('minimist')(process.argv.slice(2)),
    ServiceLocator  = require('./service-locator.js'),
    Database        = require('./database.js'),
    Front           = require('./front.js'),
    Api             = require('./api.js'),
    Console         = require('./console.js');

var httpOption = argv['h'] ? argv['h'] : argv['http'],
    httpsOption = argv['s'] ? argv['s'] : argv['https'];

if (argv['_'].length == 0
        || (argv['_'][0] == 'start' && !httpOption && !httpsOption)) {
    console.log("Usage: node src/index.js <command> [options]");
    console.log("\nCommands:");
    console.log("\tstart\t\t\tStarts the daemon");
    console.log("\tlist-users\t\tList all the users in the database");
    console.log("\tadd-user\t\tCreates new user or modifies existing");
    console.log("\tdelete-user\t\tDeletes a user");
    console.log("\tlist-sessions\t\tLists existing sessions");
    console.log("\tdelete-session\t\tDeletes a session");
    console.log("\n'start' options:");
    console.log("\t-h, --http=host:port\tCreate HTTP proxy");
    console.log("\t-s, --https=host:port\tCreate HTTPS proxy");
    console.log("\n\tAt least one -h or -s option must be provided");
    console.log("");
    return;
}

var sl          = new ServiceLocator(),
    db          = new Database(sl),
    front       = new Front(sl),
    api         = new Api(sl),
    cons        = new Console(sl),
    config      = sl.get('config');

switch (argv['_'][0]) {
    case 'start':
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

        var bindPromises = [];

        if (httpOption) {
            var httpDefer = q.defer();
            bindPromises.push(httpDefer.promise);

            var httpServer = http.createServer(requestListener);
            httpServer.listen(httpOption[1], httpOption[0], function () { httpDefer.resolve(); });
        }

        if (httpsOption) {
            var httpsDefer = q.defer();
            bindPromises.push(httpsDefer.promise);

            var httpsServer = https.createServer(
                {
                    key: fs.readFileSync(config['ssl']['key'], 'utf8'),
                    cert: fs.readFileSync(config['ssl']['cert'], 'utf8')
                },
                requestListener
            );
            httpsServer.listen(httpsOption[1], httpsOption[0], function () { httpsDefer.resolve(); });
        }

        q.all(bindPromises)
            .then(function () {
                try {
                    process.setgid(config['user']);
                    process.setuid(config['group']);
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            });
        break;

    case 'list-users':
        cons.listUsers();
        break;

    case 'add-user':
        cons.addUser();
        break;

    case 'delete-user':
        cons.deleteUser();
        break;

    case 'list-sessions':
        cons.listSessions();
        break;

    case 'delete-session':
        cons.deleteSession();
        break;
}

function requestListener(req, res) {
    var cookies = front.parseCookies(req),
        sid = cookies[config['namespace'] + 'sid'],
        query = url.parse(req.url),
        urlParts = query.pathname.split('/');

    db.selectSession(sid)
        .then(function (session) {
            var isAuthenticated = false;
            if (session) {
                if (config['otp']['enable'])
                    isAuthenticated = session.auth_password && session.auth_otp;
                else
                    isAuthenticated = session.auth_password;
            }

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
                    switch (urlParts[3]) {
                        case 'locale':
                            return api.locale(sid, req, res);
                        case 'logout':
                            return api.logout(sid, req, res);
                        case 'auth':
                            return api.auth(sid, req, res);
                        case 'otp':
                            return api.otp(sid, req, res);
                        default:
                            return front.returnNotFound(res);
                    }
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
                        var header = config['namespace'] + 'sid=' + random + '; path=/';
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
                db.refreshSession(sid)
                    .then(function () {
                        proxy.web(req, res);
                    });
            } else {
                front.returnFile('auth/index.html', res);
            }
        })
        .catch(function (err) {
            console.error(err);
        });
};
