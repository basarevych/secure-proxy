'use strict'

var fs              = require('fs'),
    q               = require('q'),
    http            = require('http'),
    https           = require('https'),
    httpProxy       = require('http-proxy'),
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
    console.log("\tupdate-user\t\tCreates new user or modifies existing");
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
        sl.set('proxy', proxy);

        var bindPromises = [];

        if (httpOption) {
            var httpDefer = q.defer();
            bindPromises.push(httpDefer.promise);

            var httpServer = http.createServer(function (req, res) { front.requestListener(req, res); });
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
                function (req, res) { front.requestListener(req, res); }
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

    case 'update-user':
        cons.updateUser();
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
