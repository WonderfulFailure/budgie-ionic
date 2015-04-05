angular.module('budgie.directives', ['ngStorage'])

.directive('focusAfterLoad', function($timeout) {
  return {
    link: function(scope, element, attrs) {
      $timeout(function() {
        element[0].focus();
      }, 150);
    }
  };
});