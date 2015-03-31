angular.module('budgie', ['ionic', 'budgie.controllers', 'budgie.services', 'budgie.config'])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }
  });
})

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider

  .state('app', {
    url: "/app",
    abstract: true,
    templateUrl: "templates/menu.html",
    controller: 'AppCtrl'
  })

  .state('app.daily', {
    cache: false,
    url: "/daily",
    views: {
      'menuContent': {
        templateUrl: "templates/daily.html",
        controller: 'DailyCtrl'
      }
    }
  })

  .state('app.spend', {
    url: "/spend",
    views: {
      'menuContent': {
        templateUrl: "templates/spend.html",
        controller: 'SpendCtrl'
      }
    }
  })

  .state('app.goals', {
    url: "/goals",
    views: {
      'menuContent': {
        templateUrl: "templates/goals.html"
      }
    }
  });
  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/daily');
});
