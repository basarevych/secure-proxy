'use strict';

var ServiceLocator  = require('../src/service-locator.js'),
    Email           = require('../src/email.js');

describe("Email", function () {
    var sl, email;

    beforeEach(function () {
        sl = new ServiceLocator();
        email = new Email(sl);
    });

    it("sends letter", function (done) {
        email.server = {
            send: function (message, cb) {
                cb(null, message);

                expect(message['subject']).toBe('subject');
                expect(message['to']).toBe('to');
                expect(message['from']).toBe('from');
                expect(message['text']).toBe('text');
                expect(message['attachment'][0]['data']).toBe('html');
                done();
            },
        };

        email.send({
            subject:    'subject',
            to:         'to',
            from:       'from',
            text:       'text',
            html:       'html',
        });
    });
});
