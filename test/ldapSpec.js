'use strict';

var q               = require('q'),
    ServiceLocator  = require('../src/service-locator.js'),
    Ldap            = require('../src/ldap.js');

describe("Ldap", function () {
    var sl, ldap, db;

    beforeEach(function () {
        sl = new ServiceLocator();
        ldap = new Ldap(sl);
        ldap.client = createSpyObj('client', [ 'bind', 'search', 'unbind' ]);

        db = createSpyObj('db', [ 'selectUsers', 'createUser', 'setUserEmail' ]);
        db.createUser.andCallFake(function () {
            var defer = q.defer();
            defer.resolve();
            return defer.promise;
        });
        db.setUserEmail.andCallFake(function () {
            var defer = q.defer();
            defer.resolve();
            return defer.promise;
        });
        sl.set('database', db);

        var config = {
            ldap: {
                enable: true,
                url: 'ldap://192.168.0.1',
                domain: 'HQ',
                users_group: 'ou=users, ou=company, dc=hq, dc=company, dc=local',
                email_attr_name: 'mail',
            },
        };
        sl.setAllowOverride(true);
        sl.set('config', config);
    });

    it("creates user", function (done) {
        db.selectUsers.andCallFake(function () {
            var defer = q.defer();
            defer.resolve([]);
            return defer.promise;
        });

        ldap.client.bind.andCallFake(function (login, password, cb) {
            expect(login).toBe('login@HQ');
            expect(password).toBe('password');
            cb(null);
        });
        ldap.client.search.andCallFake(function (group, opts, cb) {
            expect(group).toBe('ou=users, ou=company, dc=hq, dc=company, dc=local');
            expect(opts).toEqual({
                filter: '(&(objectclass=user)(samaccountname=login))',
                scope: 'sub',
                attributes: ['mail']
            });

            var search = {
                on: function (event, cb) {
                    if (event == 'searchEntry')
                        cb({ object: { mail: 'foo@bar' }});
                    else if (event == 'end')
                        cb();
                },
            };

            cb(null, search);
        });

        ldap.authenticate('login', 'password')
            .then(function (success) {
                expect(success).toBeTruthy();
                expect(db.selectUsers).toHaveBeenCalledWith({ login: 'login' });
                expect(db.createUser).toHaveBeenCalledWith('login', null, 'foo@bar');
                expect(ldap.client.bind).toHaveBeenCalled();
                expect(ldap.client.search).toHaveBeenCalled();
                expect(ldap.client.unbind).toHaveBeenCalled();
                done();
            });
    });

    it("updates user", function (done) {
        db.selectUsers.andCallFake(function () {
            var defer = q.defer();
            defer.resolve([ { id: 1 } ]);
            return defer.promise;
        });

        ldap.client.bind.andCallFake(function (login, password, cb) {
            expect(login).toBe('login@HQ');
            expect(password).toBe('password');
            cb(null);
        });
        ldap.client.search.andCallFake(function (group, opts, cb) {
            expect(group).toBe('ou=users, ou=company, dc=hq, dc=company, dc=local');
            expect(opts).toEqual({
                filter: '(&(objectclass=user)(samaccountname=login))',
                scope: 'sub',
                attributes: ['mail']
            });

            var search = {
                on: function (event, cb) {
                    if (event == 'searchEntry')
                        cb({ object: { mail: 'foo@bar' }});
                    else if (event == 'end')
                        cb();
                },
            };

            cb(null, search);
        });

        ldap.authenticate('login', 'password')
            .then(function (success) {
                expect(success).toBeTruthy();
                expect(db.selectUsers).toHaveBeenCalledWith({ login: 'login' });
                expect(db.setUserEmail).toHaveBeenCalledWith(1, 'foo@bar');
                expect(ldap.client.bind).toHaveBeenCalled();
                expect(ldap.client.search).toHaveBeenCalled();
                expect(ldap.client.unbind).toHaveBeenCalled();
                done();
            });
    });
});
