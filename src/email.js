'use strict'

var email   = require('emailjs'),
    q       = require('q');

function Email(serviceLocator) {
    this.sl = serviceLocator;

    this.sl.set('email', this);
}

module.exports = Email;

Email.prototype.getServer = function () {
    if (typeof this.server != 'undefined')
        return this.server;

    var config = this.sl.get('config');

    var server = email.server.connect({
        host:   config['email']['host'],
        port:   config['email']['port'],
        ssl:    config['email']['ssl'],
    });

    this.server = server;
    return server;
};

Email.prototype.send = function (params) {
    var config = this.sl.get('config'),
        logger = this.sl.get('logger'),
        server = this.getServer(),
        defer = q.defer();

    var message = {
       subject: params['subject'],
       to:      params['to'],
       from:    params['from'] || config['email']['from'],
       text:    params['text'],
       attachment: [ { data: params['html'], alternative:true }, ],
    };

    server.send(message, function (err, message) {
        if (err) {
            logger.error('email send', err);
            defer.reject(err);
            return;
        }

        defer.resolve(message);
    });

    return defer.promise;
};
