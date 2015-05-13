'use strict'

var ldap    = require('ldapjs'),
    q       = require('q');

function Ldap(serviceLocator) {
    this.sl = serviceLocator;

    this.sl.set('ldap', this);
}

module.exports = Ldap;

Ldap.prototype.getClient = function () {
    if (typeof this.client != 'undefined')
        return this.client;

    var config = this.sl.get('config');

    var client = ldap.createClient({
        url: config['ldap']['url'],
        timeout: 3000,
        connectTimeout: 3000,
    });

    this.client = client;
    return client;
};

Ldap.prototype.authenticate = function (login, password) {
    var config = this.sl.get('config'),
        db = this.sl.get('database'),
        client = this.getClient(),
        defer = q.defer();

    if (!config['ldap']['enable']) {
        defer.resolve(false);
        return defer.promise;
    }

    client.bind(login + '@' + config['ldap']['domain'], password, function (err) {
        if (err) {
            defer.resolve(false);
            return;
        }

        var opts = {
            filter: '(&(objectclass=user)(samaccountname='+login+'))',
            scope: 'sub',
            attributes: [config['ldap']['email_attr_name']]
        };

        client.search(config['ldap']['users_group'], opts, function (err, search) {
            if (err) {
                client.unbind();
                defer.reject(err);
                return;
            }

            search.on('searchEntry', function (entry) {
                if (!entry.object) {
                    defer.resolve(false);
                    return;
                }

                var email = entry.object[config['ldap']['email_attr_name']];
                if (email.indexOf('@') == -1) {
                    defer.resolve(false);
                    return;
                }

                db.userExists(login)
                    .then(function (exists) {
                        if (exists) {
                            defer.resolve(true);
                            return;
                        }

                        db.createUser(login, null, email)
                            .then(function () {
                                defer.resolve(true);
                            })
                            .catch(function (err) {
                                defer.reject(err);
                            });
                    })
                    .catch(function (err) {
                        defer.reject(err);
                    });
            });

            search.on('error', function (err) {
                defer.reject(err);
            });

            client.unbind();
        });
    });

    return defer.promise;
};
