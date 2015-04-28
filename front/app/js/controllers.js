'use strict';

var controllers = angular.module('controllers', []);

controllers.controller('IndexCtrl',
    [ '$scope',
    function($scope) {
        $scope.processing = false;
        $scope.model = {
            login: {
                value: '',
                focus: true,
                errors: [],
            },
            password: {
                value: '',
                focus: false,
                errors: [],
            },
        };

        $scope.resetValidation = function () {
        };

        $scope.validate = function (name) {
        };

        $scope.submit = function () {
        };
    } ]
);
