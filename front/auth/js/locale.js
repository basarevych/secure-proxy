'use strict';

var gl = null, currectLocale = null;

function globalizer(cldrBasePath, l10nBasePath, locale) {
    var resources = [
        cldrBasePath + '/main/' + locale + '/currencies.json',
        cldrBasePath + '/main/' + locale + '/ca-gregorian.json',
        cldrBasePath + '/main/' + locale + '/timeZoneNames.json',
        cldrBasePath + '/main/' + locale + '/numbers.json',
        cldrBasePath + '/supplemental/currencyData.json',
        cldrBasePath + '/supplemental/likelySubtags.json',
        cldrBasePath + '/supplemental/plurals.json',
        cldrBasePath + '/supplemental/timeData.json',
        cldrBasePath + '/supplemental/weekData.json',
    ];
    var data = [];
    var loaded = $.Deferred();

    function getResource(index) {
        $.getJSON(resources[index], function (result) {
            data[index] = result;

            for (var i = 0; i < resources.length; i++) {
                if (typeof data[i] == 'undefined')
                    return;
            }

            Globalize.load(data);

            $.getJSON(l10nBasePath + '/' + locale + '.json', function (messages) {
                Globalize.loadMessages(messages);
                loaded.resolve(Globalize(locale));
            });
        });
    }

    for (var i = 0; i < resources.length; i++)
        getResource(i);

    return loaded.promise();
}

function loadLocale(locale) {
    currentLocale = locale;

    var form = $('#main-form');
    if (form.css('display') != 'none')
        form.hide();

    var promise = globalizer(
        '/secure-proxy/static/auth/cldr',
        '/secure-proxy/static/auth/l10n',
        locale
    );

    promise
        .then(function (globalize) {
            gl = window['globalize'] = globalize;
            initPage();
        });
}

function setLocale(locale) {
    $.ajax({
        url: '/secure-proxy/api/locale',
        data: {
            set: locale,
        },
        success: function (data) {
            loadLocale(data.locale);
        }
    });
}
