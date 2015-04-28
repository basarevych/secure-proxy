'use strict';

var directives = angular.module('directives', []);

directives.directive('onKeyEnter',
    [ function() {
        return {
            restrict: 'A',
            link: function(scope, element, attrs, ngModelCtrl) {
                element.bind('keypress', function(event) {
                    if (event.keyCode === 13) {
                        event.preventDefault();
                        scope.$apply(function () {
                            scope.$eval(attrs.onKeyEnter);
                        });
                    }
                });
            }
        };
    } ]
);

directives.directive('focusOn',
    [ '$parse', '$timeout',
    function($parse, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var model = $parse(attrs.focusOn);
                scope.$watch(model, function (value) {
                    if (value === true) {
                        $timeout(function() {
                            element.focus();
                            scope.$apply(model.assign(scope, false));
                        });
                    }
                });
            }
        };
    } ]
);

directives.directive('sidebar',
    [ function() {
        return {
            link: function(scope, element, attrs) {
                var win = $(window), edge = attrs.sidebar;
                var sizes = ['xs', 'sm', 'md', 'lg'];

                var onResize = function() {
                    element.css({ position: 'fixed' });

                    var bottom = element.position().top + element.outerHeight(true),
                        position = win.height() < bottom ? 'static' : undefined;

                    if (angular.isUndefined(position)) {
                        var test = $('<div>'), current;
                        test.appendTo($('body'));

                        for (var i = sizes.length - 1; i >= 0; i--) {
                            test.addClass('hidden-' + sizes[i]);
                            if (test.is(':hidden')) {
                                current = sizes[i];
                                break;
                            }
                        };
                        test.remove();

                        if (angular.isDefined(current))
                            position = sizes.indexOf(edge) > sizes.indexOf(current) ? 'static' : 'fixed';
                    }

                    if (angular.isDefined(position))
                        element.css({ position: position });

                    element.css({ width: element.parent().width() });
                };

                win.bind('resize', onResize);
                onResize();
            }
        };
    } ]
);
