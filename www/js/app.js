angular.module('budgie', ['ionic', 'angular-progress-arc', 'ui.utils.masks', 'budgie.controllers', 'budgie.services', 'budgie.directives', 'budgie.config'])

.run(function($ionicPlatform, User, Intercom) {
  $ionicPlatform.ready(function() {
    ionic.Platform.fullScreen();
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      //cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if (window.StatusBar) {
      StatusBar.hide();
    }

    $ionicPlatform.on("resume", function() {
      setTimeout(function() {
        User.currentUser().then(function(result) {
          Intercom.update(result.email);
          User.fetchFromParse(result.sessionToken);
          User.fetchBucketsFromParse(result.sessionToken);
        });
      }, 0);
    });
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
    url: "/daily",
    views: {
      'menuContent': {
        templateUrl: "templates/daily.html",
        controller: 'DailyCtrl'
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
    url: "/goals/:monthlyBudget/:selectedCurrency",
    views: {
      'welcomeContent': {
        templateUrl: "templates/welcome/goals.html",
        controller: 'WelcomeCtrl'
      }
    }
  })

  .state('app.welcome.signup', {
    url: "/signup/:monthlyBudget/:selectedCurrency/:bucketGoal/:bucketTitle",
    views: {
      'welcomeContent': {
        templateUrl: "templates/welcome/signup.html",
        controller: 'WelcomeCtrl'
      }
    }
  })

  .state('app.settings', {
    url: "/settings",
    abstract: true,
    views: {
      'menuContent': {
        templateUrl: "templates/settings/settings.html",
        controller: 'SettingsCtrl'
      }
    }
  })

  .state('app.settings.menu', {
    url: "/menu",
    views: {
      'settingsContent': {
        templateUrl: "templates/settings/menu.html",
        controller: 'SettingsCtrl'
      }
    }
  })

  .state('app.settings.change', {
    url: "/change",
    views: {
      'settingsContent': {
        templateUrl: "templates/settings/change.html",
        controller: 'SettingsCtrl'
      }
    }
  })

  .state('app.settings.feedback', {
    url: "/feedback",
    views: {
      'settingsContent': {
        templateUrl: "templates/settings/feedback.html",
        controller: 'SettingsCtrl'
      }
    }
  });
  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/daily');
});
