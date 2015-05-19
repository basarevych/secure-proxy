'use strict';

var ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js'),
    Front           = require('../src/front.js');

describe("Front", function () {
    var sl, db, front, config, api, proxy;

    beforeEach(function () {
        sl = new ServiceLocator();
        db = new Database(sl);
        front = new Front(sl);

        db.dbFile = ":memory:";

        sl.setAllowOverride(true);

        config = {
            namespace: 'foobar',
            session: {
                lifetime: 100,
                gc_probability: 0,
            },
            otp: {
                enable: true,
            },
        };
        sl.set('config', config);

        api = createSpyObj('api', [ 'locale' ]);
        sl.set('api', api);

        proxy = createSpyObj('proxy', [ 'web' ]);
        sl.set('proxy', proxy);
    });

    it("returns 500 Internal Error", function () {
        var res = createSpyObj('res', [ 'writeHead', 'end' ]);

        var actualCode, actualHeaders;
        res.writeHead.andCallFake(function (code, headers) {
            actualCode = code;
            actualHeaders = headers;
        });

        front.returnInternalError(res);

        expect(res.writeHead).toHaveBeenCalled();
        expect(actualCode).toBe(500);
        expect(actualHeaders['Content-Type']).toBeDefined();
    });

    it("returns 404 Not Found", function () {
        var res = createSpyObj('res', [ 'writeHead', 'end' ]);

        var actualCode, actualHeaders;
        res.writeHead.andCallFake(function (code, headers) {
            actualCode = code;
            actualHeaders = headers;
        });

        front.returnNotFound(res);

        expect(res.writeHead).toHaveBeenCalled();
        expect(actualCode).toBe(404);
        expect(actualHeaders['Content-Type']).toBeDefined();
    });

    it("returns 400 Bad Request", function () {
        var res = createSpyObj('res', [ 'writeHead', 'end' ]);

        var actualCode, actualHeaders;
        res.writeHead.andCallFake(function (code, headers) {
            actualCode = code;
            actualHeaders = headers;
        });

        front.returnBadRequest(res);

        expect(res.writeHead).toHaveBeenCalled();
        expect(actualCode).toBe(400);
        expect(actualHeaders['Content-Type']).toBeDefined();
    });

    it("returns 404 for non-existing file", function () {
        spyOn(front, 'returnNotFound');

        front.returnFile('non-existing', undefined);

        expect(front.returnNotFound).toHaveBeenCalled();
    });

    it("returns 404 for invalid file", function () {
        spyOn(front, 'returnNotFound');

        front.returnFile('../config.js', undefined);

        expect(front.returnNotFound).toHaveBeenCalled();
    });

    it("returns valid file", function (done) {
        var res = createSpyObj('res', [ 'writeHead', 'end' ]);

        var actualCode, actualHeaders;
        res.writeHead.andCallFake(function (code, headers) {
            actualCode = code;
            actualHeaders = headers;
        });

        res.end.andCallFake(function (content) {
            expect(actualCode).toBe(200);
            expect(actualHeaders['Content-Type']).toBeDefined();
            expect(content.length).toBeGreaterThan(0);
            done();
        });

        front.returnFile('auth/index.html', res);
    });

    it("requestListener collects garbage", function (done) {
        var req = {
            connection: { remoteAddress: '127.0.0.1' },
            headers: {},
            url: '/some/path',
        };

        var res = createSpyObj('res', [ 'setHeader' ]);

        config['session']['gc_probability'] = 100;
        spyOn(db, 'deleteOldSessions');

        spyOn(front, 'returnFile').andCallFake(function (name) {
            expect(db.deleteOldSessions).toHaveBeenCalledWith(100);
            expect(name).toBe('auth/index.html');
            done();
        });

        front.requestListener('http', req, res);
    });

    it("requestListener sets sid", function (done) {
        var req = {
            connection: { remoteAddress: '127.0.0.1' },
            headers: {},
            url: '/some/path',
        };

        var res = createSpyObj('res', [ 'setHeader' ]);

        var actualHeaders = {};
        res.setHeader.andCallFake(function (header, value) {
            actualHeaders[header] = value;
        });

        spyOn(front, 'returnFile').andCallFake(function (name) {
            expect(res.setHeader).toHaveBeenCalled();
            expect(actualHeaders['set-cookie'].indexOf('foobarsid=')).not.toBe(-1);
            expect(name).toBe('auth/index.html');
            done();
        });

        front.requestListener('http', req, res);
    });

    it("requestListener serves static file", function (done) {
        var req = {
            connection: { remoteAddress: '127.0.0.1' },
            headers: { cookie: 'foobarsid=sid' },
            url: '/secure-proxy/static/auth/css/index.css',
        };

        spyOn(front, 'returnFile').andCallFake(function (name) {
            expect(name).toBe('auth/css/index.css');
            done();
        });

        front.requestListener('http', req, {});
    });

    it("requestListener serves API request", function (done) {
        var req = {
            connection: { remoteAddress: '127.0.0.1' },
            headers: { cookie: 'foobarsid=sid' },
            url: '/secure-proxy/api/locale',
        };

        api.locale.andCallFake(function () {
            done();
        });

        front.requestListener('http', req, {});
    });

    it("requestListener forwards guest to Auth app", function (done) {
        var req = {
            connection: { remoteAddress: '127.0.0.1' },
            headers: { cookie: 'foobarsid=sid' },
            url: '/random/path',
        };

        spyOn(front, 'returnFile').andCallFake(function (name) {
            expect(name).toBe('auth/index.html');
            expect(proxy.web).not.toHaveBeenCalled();
            done();
        });

        front.requestListener('http', req, {});
    });

    it("requestListener proxies authenticated user request", function (done) {
        var req = {
            connection: { remoteAddress: '127.0.0.1' },
            headers: { cookie: 'foobarsid=sid' },
            url: '/random/path',
        };

        proxy.web.andCallFake(function () {
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession(1, 'sid', '127.0.0.1') })
            .then(function () { return db.setSessionPassword(1, true) })
            .then(function () { return db.setSessionOtp(1, true) })
            .then(function () {
                front.requestListener('http', req, {});
            });
    });

    it("requestListener checks IP", function (done) {
        var req = {
            connection: { remoteAddress: '10.0.0.1' },
            headers: { cookie: 'foobarsid=sid' },
            url: '/random/path',
        };

        var res = createSpyObj('res', [ 'setHeader' ]);

        spyOn(front, 'returnFile').andCallFake(function (name) {
            expect(name).toBe('auth/index.html');
            expect(proxy.web).not.toHaveBeenCalled();
            done();
        });

        db.createUser('login', 'password', 'foo@bar')
            .then(function () { return db.createSession(1, 'sid', '127.0.0.1') })
            .then(function () { return db.setSessionPassword(1, true) })
            .then(function () { return db.setSessionOtp(1, true) })
            .then(function () {
                front.requestListener('http', req, res);
            });
    });

    it("parses cookies", function () {
        var req = {
            connection: { remoteAddress: '127.0.0.1' },
            headers: { cookie: 'cookie1=value1; cookie2=value2', }
        };

        var result = front.parseCookies(req);

        expect(result['cookie1']).toBe('value1');
        expect(result['cookie2']).toBe('value2');
    });

    it("generates SID", function (done) {
        var res = createSpyObj('res', [ 'setHeader' ]);

        var headerName, headerValue;
        res.setHeader.andCallFake(function (name, value) {
            headerName = name;
            headerValue = value;
        });

        spyOn(front, 'returnFile').andCallFake(function (name) {
            expect(headerName).toBe('set-cookie');
            expect(headerValue.indexOf('foobarsid=')).not.toBe(-1);
            expect(name).toBe('auth/index.html');
            done();
        });

        front.generateSid(res);
    });
});
