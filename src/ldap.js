'use strict'

var ldap    = require('ldapjs'),
    q       = require('q');

function Ldap(serviceLocator) {
    this.sl = serviceLocator;

    this.sl.set('ldap', this);
}

module.exports = Ldap;

Ldap.prototype.getClient = function () {
    if (typeof this.client != 'undefined')  // for tests
        return this.client;

    var config = this.sl.get('config');

    var client = ldap.createClient({
        url: config['ldap']['url'],
        timeout: 5000,
    });

    // we are not saving client to 'this' because
    // client must be recreated before each bind
    return client;
};

Ldap.prototype.authenticate = function (login, password) {
    var config = this.sl.get('config'),
        db = this.sl.get('database'),
        logger = this.sl.get('logger'),
        client = this.getClient(),
        defer = q.defer();

    if (!config['ldap']['enable']) {
        defer.resolve(false);
        return defer.promise;
    }

    var fullLogin = login;
    if (config['ldap']['domain'])
        fullLogin += '@' + config['ldap']['domain'];

    client.bind(fullLogin, password, function (err) {
        if (err) {
            if (err.name == 'InvalidCredentialsError') {
                logger.info('LDAP: Invalid credentials for ' + login);
                defer.resolve(false);
            } else {
                logger.error('LDAP bind', err);
                defer.reject(err);
            }
            client.unbind();
            return;
        }

        var opts = {
            filter: '(&(objectclass=user)(samaccountname='+login+'))',
            scope: 'sub',
            attributes: [config['ldap']['email_attr_name']]
        };

        client.search(config['ldap']['users_group'], opts, function (err, search) {
            if (err) {
                logger.error('LDAP search', err);
                defer.reject(err);
                client.unbind();
                return;
            }

            var email = null;
            search.on('searchEntry', function (entry) {
                if (!entry.object)
                    return;

                email = entry.object[config['ldap']['email_attr_name']];
                if (typeof email == 'undefined')
                    email = null;
                else
                    email = email.trim().toLowerCase();
            });

            search.on('end', function (result) {
                db.selectUsers({ login: login })
                    .then(function (users) {
                        var user = users.length && users[0];
                        if (user) {
                            db.setUserEmail(user['id'], email);
                            defer.resolve(true);
                            client.unbind();
                            return;
                        }

                        db.createUser(login, null, email)
                            .then(function () {
                                defer.resolve(true);
                                client.unbind();
                            })
                            .catch(function (err) {
                                defer.reject(err);
                                client.unbind();
                            });
                    })
                    .catch(function (err) {
                        defer.reject(err);
                        client.unbind();
                    });
            });

            search.on('error', function (err) {
                logger.error('LDAP search error event', err);
                defer.reject(err);
                client.unbind();
            });
        });
    });

    return defer.promise;
};
