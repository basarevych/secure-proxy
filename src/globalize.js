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
        require("../node_modules/cldr-data/supplemental/currencyData"),
        require("../node_modules/cldr-data/supplemental/likelySubtags"),
        require("../node_modules/cldr-data/supplemental/plurals"),
        require("../node_modules/cldr-data/supplemental/timeData"),
        require("../node_modules/cldr-data/supplemental/weekData"),
        require("../node_modules/cldr-data/main/" + locale + "/ca-gregorian"),
        require("../node_modules/cldr-data/main/" + locale + "/currencies"),
        require("../node_modules/cldr-data/main/" + locale + "/dateFields"),
        require("../node_modules/cldr-data/main/" + locale + "/numbers")
    );
    globalize.loadMessages(require("../front/l10n/" + locale));
    globalize.locale(locale);

    this.locales[locale] = globalize;
    return globalize;
};
