'use strict'

function Globalize(serviceLocator) {
    this.sl = serviceLocator;
    this.locales = [];
    this.supportedLocales = [ 'en', 'ru' ],

    this.sl.set('globalize', this);
}

module.exports = Globalize;

Globalize.prototype.getLocale = function (locale) {
    if (this.supportedLocales.indexOf(locale) == -1)
        throw new Error('Unsupported locale');

    if (typeof this.locales[locale] != 'undefined')
        return this.locales[locale];

    var globalize = require('globalize');

    globalize.load(
        require("../front/bower_components/cldr-data/supplemental/currencyData"),
        require("../front/bower_components/cldr-data/supplemental/likelySubtags"),
        require("../front/bower_components/cldr-data/supplemental/plurals"),
        require("../front/bower_components/cldr-data/supplemental/timeData"),
        require("../front/bower_components/cldr-data/supplemental/weekData"),
        require("../front/bower_components/cldr-data/main/" + locale + "/ca-gregorian"),
        require("../front/bower_components/cldr-data/main/" + locale + "/currencies"),
        require("../front/bower_components/cldr-data/main/" + locale + "/dateFields"),
        require("../front/bower_components/cldr-data/main/" + locale + "/numbers")
    );
    globalize.loadMessages(require("../front/l10n/" + locale));
    globalize.locale(locale);

    this.locales[locale] = globalize;
    return globalize;
};
