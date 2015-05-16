angular.module('budgie.directives', ['ngStorage'])

.directive('focusMe', function($timeout) {
  var timeout;
  return {
    link: function(scope, element, attrs) {
      scope.$watch(attrs.focusMe, function(value) {
        if(value === true) {
          if(timeout) clearTimeout(timeout);
          timeout = setTimeout(function() {
            if(scope[attrs.focusMe] === true) {
              element[0].focus();
              scope[attrs.focusMe] = false;
            }
          }, 350);
        }
      });
    }
  };
})

.filter('toArray', function () {
    'use strict';

    return function (obj) {
        if (!(obj instanceof Object)) {
            return obj;
        }

        return Object.keys(obj).map(function (key) {
            return Object.defineProperty(obj[key], '$key', {__proto__: null, value: key});
        });
    }
});