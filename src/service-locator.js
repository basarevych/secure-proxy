'use strict'

var config = require('../config.js');

function ServiceLocator() {
    this.services = [];
    this.services['config'] = config;

    this.allowOverride = false;
}

ServiceLocator.prototype.has = function (name) {
    return typeof this.services[name] != 'undefined';
};

ServiceLocator.prototype.set = function (name, service) {
    if (!this.allowOverride && typeof this.services[name] != 'undefined')
        throw new Error('Service ' + name + ' already exists');

    this.services[name] = service;
};

ServiceLocator.prototype.get = function (name) {
    if (typeof this.services[name] == 'undefined')
        throw new Error('Service ' + name + ' does not exists');

    return this.services[name];
};

ServiceLocator.prototype.setAllowOverride = function (allow) {
    this.allowOverride = allow;
};

module.exports = ServiceLocator;
