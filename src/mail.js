'use strict'

var email   = require('emailjs'),
    q       = require('q');

function Mail(serviceLocator) {
    this.sl = serviceLocator;

    this.sl.set('mail', this);
}

module.exports = Mail;

Mail.prototype.getServer = function () {
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

Mail.prototype.send = function (params) {
    var config = this.sl.get('config'),
        server = this.getServer(),
        defer = q.defer();

    var message = {
       text:    params['text'],
       from:    params['from'] || config['email']['from'],
       to:      params['to'],
       subject: params['subject'],
       attachment: [ { data: params['html'], alternative:true }, ],
    };

    server.send(message, function (err, message) {
        if (err) {
            defer.reject(err);
            return;
        }

        defer.resolve(message);
    });

    return defer.promise;
};
