'use strict'

var logger = require('tracer').console(),
    config = require('../config.js');

function ServiceLocator() {
    this.services = [];
    this.services['logger'] = logger;
    this.services['config'] = config;

    this.allowOverride = false;
}

module.exports = ServiceLocator;

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
