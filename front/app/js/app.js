'use strict';

var app = angular.module('App', [
    'ngRoute',
    'globalizeWrapper',
    'directives',
    'controllers',
]);

app.config(
    [ '$routeProvider',
    function($routeProvider) {
        $routeProvider.
            when('/', {
                controller: 'IndexCtrl',
                templateUrl: '/secure-proxy/static/app/views/index.html',
            }).
            otherwise({
                redirectTo: '/'
            });
    } ]
);

app.config(
    [ 'globalizeWrapperProvider',
    function (globalizeWrapperProvider) {
        globalizeWrapperProvider.setCldrBasePath('/secure-proxy/static/bower_components/cldr-data');
        globalizeWrapperProvider.setL10nBasePath('/secure-proxy/static/l10n');

        globalizeWrapperProvider.setMainResources([
            '/currencies.json',
            '/ca-gregorian.json',
            '/timeZoneNames.json',
            '/numbers.json'
        ]);

        globalizeWrapperProvider.setSupplementalResources([
            '/currencyData.json',
            '/likelySubtags.json',
            '/plurals.json',
            '/timeData.json',
            '/weekData.json'
        ]);
    } ]
);

app.run(
    [ '$rootScope', '$route', '$filter', 'globalizeWrapper',
    function ($rootScope, $route, $filter, globalizeWrapper) {
        $rootScope.$on('GlobalizeLoadSuccess', function () {
            $rootScope.pageTitle = $filter('glMessage')('PAGE_TITLE');
            $route.reload();
        });
        globalizeWrapper.setLocale('en');
    } ]
);
