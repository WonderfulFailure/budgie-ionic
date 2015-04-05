angular.module('budgie', ['ionic', 'angular-progress-arc', 'ui.utils.masks', 'budgie.controllers', 'budgie.services', 'budgie.directives', 'budgie.config'])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      StatusBar.overlaysWebView(true);
      StatusBar.style(1);
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
    cache: false,
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
        templateUrl: "templates/goals.html",
        controller: 'GoalCtrl'
      }
    }
  })

  .state('app.welcome', {
    url: "/welcome",
    abstract: true,
    views: {
      'menuContent': {
        templateUrl: "templates/welcome/welcome.html",
        controller: 'WelcomeCtrl'
      }
    }
  })

  .state('app.welcome.budget', {
    url: "/budget",
    views: {
      'welcomeContent': {
        templateUrl: "templates/welcome/budget.html",
        controller: 'WelcomeCtrl'
      }
    }
  })

  .state('app.welcome.goals', {
    url: "/goals/:monthlyBudget",
    views: {
      'welcomeContent': {
        templateUrl: "templates/welcome/goals.html",
        controller: 'WelcomeCtrl'
      }
    }
  })

  .state('app.welcome.signup', {
    url: "/signup/:monthlyBudget/:bucketGoal/:bucketTitle",
    views: {
      'welcomeContent': {
        templateUrl: "templates/welcome/signup.html",
        controller: 'WelcomeCtrl'
      }
    }
  });
  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/daily');
});
