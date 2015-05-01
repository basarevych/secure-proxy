'use strict'

var config = require('../config.js');

function ServiceLocator() {
    this.services = [];

    this.services['config'] = config;
}

ServiceLocator.prototype.has = function (name) {
    return typeof this.services[name] != 'undefined';
};

ServiceLocator.prototype.set = function (name, service) {
    if (typeof this.services[name] != 'undefined')
        throw new Error('Service ' + name + ' already exists');

    this.services[name] = service;
};

ServiceLocator.prototype.get = function (name) {
    if (typeof this.services[name] == 'undefined')
        throw new Error('Service ' + name + ' does not exists');

    return this.services[name];
};

module.exports = ServiceLocator;
