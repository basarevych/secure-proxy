'use strict';

var ServiceLocator  = require('../src/service-locator.js'),
    Database        = require('../src/database.js'),
    Front           = require('../src/front.js');

module.exports = {
    setUp: function (callback) {
        this.sl = new ServiceLocator();
        this.db = new Database(this.sl);
        this.front = new Front(this.sl);

        this.db.dbFile = ":memory:";

        this.sl.setAllowOverride(true);

        this.config = {
            namespace: 'foobar',
            otp: {
                enable: true,
            },
        };
        this.sl.set('config', this.config);

        this.api = {};
        this.sl.set('api', this.api);

        this.proxy = {};
        this.sl.set('proxy', this.proxy);

        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    testReturnInternalError: function (test) {
        var returnedCode, returnedHeaders, returnedHtml;
        var res = {
            writeHead: function (code, headers) {
                returnedCode = code;
                returnedHeaders = headers;
            },
            end: function (html) {
                returnedHtml = html;
            },
        };

        this.front.returnInternalError(res);

        test.equal(returnedCode, 500, "Incorrect HTTP code returned");
        test.ok(typeof returnedHeaders['Content-Type'] != 'undefined', "No Content-Type header");
        test.ok(returnedHtml.length > 0, "Zero size response detected");
        test.done();
    },

    testReturnNotFound: function (test) {
        var returnedCode, returnedHeaders, returnedHtml;
        var res = {
            writeHead: function (code, headers) {
                returnedCode = code;
                returnedHeaders = headers;
            },
            end: function (html) {
                returnedHtml = html;
            },
        };

        this.front.returnNotFound(res);

        test.equal(returnedCode, 404, "Incorrect HTTP code returned");
        test.ok(typeof returnedHeaders['Content-Type'] != 'undefined', "No Content-Type header");
        test.ok(returnedHtml.length > 0, "Zero size response detected");
        test.done();
    },

    testReturnBadRequest: function (test) {
        var returnedCode, returnedHeaders, returnedHtml;
        var res = {
            writeHead: function (code, headers) {
                returnedCode = code;
                returnedHeaders = headers;
            },
            end: function (html) {
                returnedHtml = html;
            },
        };

        this.front.returnBadRequest(res);

        test.equal(returnedCode, 400, "Incorrect HTTP code returned");
        test.ok(typeof returnedHeaders['Content-Type'] != 'undefined', "No Content-Type header");
        test.ok(returnedHtml.length > 0, "Zero size response detected");
        test.done();
    },

    testReturnNonExistingFile: function (test) {
        var returnedNotFound = false;
        this.front.returnNotFound = function (res) {
            returnedNotFound = true;
        };

        this.front.returnFile('non-existing', undefined);

        test.equal(returnedNotFound, true, "HTTP Not Found should be returned");
        test.done();
    },

    testReturnInvalidFile: function (test) {
        var returnedNotFound = false;
        this.front.returnNotFound = function (res) {
            returnedNotFound = true;
        };

        this.front.returnFile('../config.js', undefined);

        test.equal(returnedNotFound, true, "HTTP Not Found should be returned");
        test.done();
    },

    testReturnValidFile: function (test) {
        var returnedCode, returnedHeaders;
        var res = {
            writeHead: function (code, headers) {
                returnedCode = code;
                returnedHeaders = headers;
            },
            end: function (content) {
                test.equal(returnedCode, 200, "Incorrect HTTP code returned");
                test.ok(typeof returnedHeaders['Content-Type'] != 'undefined', "No Content-Type header");
                test.ok(content.length > 0, "Zero size response detected");
                test.done();
            },
        };

        this.front.returnFile('auth/index.html', res);
    },

    testRequestListenerSetsSid: function (test) {
        var req = {
            headers: {},
            url: '/some/path',
        };

        var returnedHeaders = {};
        var res = {
            setHeader: function (name, content) {
                returnedHeaders[name] = content;
            },
        };

        var returnedFile;
        this.front.returnFile = function (filename, res) {
            test.ok(typeof returnedHeaders['set-cookie'] != 'undefined', "Cookie header not set");
            test.ok(returnedHeaders['set-cookie'].indexOf('foobarsid=') != -1, "SID is not set");
            test.equal(filename, 'auth/index.html', "Returned file is wrong");
            test.done();
        };

        this.front.requestListener('http', req, res);
    },

    testStaticFileRequestListener: function (test) {
        var req = {
            headers: {
                cookie: 'foobarsid=sid'
            },
            url: '/secure-proxy/static/auth/css/index.css',
        };

        this.front.returnFile = function (filename, res) {
            test.equal(filename, 'auth/css/index.css', "Wrong static file returned");
            test.done();
        };

        this.front.requestListener('http', req, {});
    },

    testApiRequestListener: function (test) {
        var req = {
            headers: {
                cookie: 'foobarsid=sid'
            },
            url: '/secure-proxy/api/locale',
        };

        this.api.locale = function (sid, req2, res2) {
            test.done();
        };

        this.front.requestListener('http', req, {});
    },

    testGuestProxyRequestListener: function (test) {
        var req = {
            headers: {
                cookie: 'foobarsid=sid'
            },
            url: '/random/path',
        };

        this.front.returnFile = function (filename, res) {
            test.equal(filename, 'auth/index.html', "Authentication index.html should be returned");
            test.done();
        };

        this.front.requestListener('http', req, {});
    },

    testUserProxyRequestListener: function (test) {
        var me = this;

        var req = {
            headers: {
                cookie: 'foobarsid=sid'
            },
            url: '/random/path',
        };

        this.proxy.web = function (req, res) {
            test.done();
        };

        this.db.createUser('login', 'password', 'foo@bar')
            .then(function () { return me.db.createSession('login', 'sid') })
            .then(function () { return me.db.setSessionPassword('sid', true) })
            .then(function () { return me.db.setSessionOtp('sid', true) })
            .then(function () {
                me.front.requestListener('http', req, {});
            });
    },

    testParseCookies: function (test) {
        var req = {
            headers: {
                cookie: 'cookie1=value1; cookie2=value2',
            }
        };

        var result = this.front.parseCookies(req);

        test.ok(typeof result['cookie1'] != 'undefined', "Cookie1 is not returned");
        test.equal(result['cookie1'], 'value1', "Cookie1 is incorrect");
        test.ok(typeof result['cookie2'] != 'undefined', "Cookie2 is not returned");
        test.equal(result['cookie2'], 'value2', "Cookie2 is incorrect");
        test.done();
    },
};
