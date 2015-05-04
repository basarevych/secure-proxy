'use strict';

var ServiceLocator  = require('../src/service-locator.js'),
    Mail            = require('../src/mail.js');

module.exports = {
    setUp: function (callback) {
        this.sl = new ServiceLocator();
        this.mail = new Mail(this.sl);

        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    testSendWorks: function (test) {
        this.mail.server = {
            send: function (message, cb) {
                cb(null, message);

                test.equal(message['subject'], 'subject', "Subject is wrong");
                test.equal(message['to'], 'to', "To is wrong");
                test.equal(message['from'], 'from', "From is wrong");
                test.equal(message['text'], 'text', "Text is wrong");
                test.equal(message['attachment'][0]['data'], 'html', "Html is wrong");
                test.done();
            },
        };

        this.mail.send({
            subject:    'subject',
            to:         'to',
            from:       'from',
            text:       'text',
            html:       'html',
        });
    },
};
