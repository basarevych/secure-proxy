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
    Globalize       = require('./globalize.js'),
    Console         = require('./console.js');

if (argv['_'].length == 0) {
    console.log("Usage: node src/index.js <command> [options]");
    console.log("\nCommands:");
    console.log("\tstart\t\t\tStarts the daemon");
    console.log("\tlist-users\t\tList all the users in the database");
    console.log("\tupdate-user\t\tCreates new user or modifies existing");
    console.log("\tdelete-user\t\tDeletes a user");
    console.log("\tlist-sessions\t\tLists existing sessions");
    console.log("\tdelete-session\t\tDeletes a session");
    console.log("\n'list-users' options:");
    console.log("\t-e, --email=name@host\tOptional. Limit query to this email");
    console.log("\n'list-sessions' options:");
    console.log("\t-l, --login=name\tOptional. Limit query to this login");
    console.log("");
    return;
}

var sl          = new ServiceLocator(),
    db          = new Database(sl),
    front       = new Front(sl),
    api         = new Api(sl),
    globalize   = new Globalize(sl),
    cons        = new Console(sl),
    config      = sl.get('config');

switch (argv['_'][0]) {
    case 'start':
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

        if (config['http']['enable']) {
            var httpDefer = q.defer();
            bindPromises.push(httpDefer.promise);

            var httpServer = http.createServer(function (req, res) { front.requestListener(req, res); });
            httpServer.listen(config['http']['port'], config['http']['host'], function () { httpDefer.resolve(); });
        }

        if (config['https']['enable']) {
            var httpsDefer = q.defer();
            bindPromises.push(httpsDefer.promise);

            var httpsServer = https.createServer(
                {
                    key: fs.readFileSync(config['https']['key'], 'utf8'),
                    cert: fs.readFileSync(config['https']['cert'], 'utf8')
                },
                function (req, res) { front.requestListener(req, res); }
            );
            httpsServer.listen(config['https']['port'], config['https']['host'], function () { httpDefer.resolve(); });
        }

        q.all(bindPromises)
            .then(function () {
                try {
                    if (process.getuid() === 0) {
                        process.setgid(config['user']);
                        process.setuid(config['group']);
                    }
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            });
        break;

    case 'list-users':
        var email = argv['e'] ? argv['e'] : argv['email'];
        cons.listUsers(email);
        break;

    case 'update-user':
        cons.updateUser();
        break;

    case 'delete-user':
        cons.deleteUser();
        break;

    case 'list-sessions':
        var login = argv['l'] ? argv['l'] : argv['login'];
        cons.listSessions(login);
        break;

    case 'delete-session':
        cons.deleteSession();
        break;
}
