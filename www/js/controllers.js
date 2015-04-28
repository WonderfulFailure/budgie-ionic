angular.module('budgie.controllers', ['budgie.config'])

.controller('AppCtrl', function($scope, $rootScope, $ionicModal, $ionicPopup, $ionicHistory, $ionicLoading, $ionicScrollDelegate, $state, $http, $localStorage, User, Intercom, Currency) {

  $ionicScrollDelegate.freezeScroll( true );

  $rootScope.sideMenuVisible = true;

  // Currency
  Currency.setCurrency('usd');

  // Update Intercom status upon every view change, if the user
  // is logged in
  $rootScope.$on( "$ionicView.enter", function( scopes, states ) {
      User.currentUser().then(function(result) {
        Intercom.update(result.email);
      });
  });

  // Keep our local user up to date when it changes
  // (useful for when Parse finishes its update)
  $rootScope.$watch(function () { return User.getUserObj() }, function (newVal, oldVal) {
    User.update(newVal, true);
  });

  // Form data for the login modal
  $scope.loginData = {};

  // Triggered in the login modal to close it
  $scope.closeLogin = function() {
    $scope.modal.hide();
  };

  // Open the login modal
  $scope.showLogin = function() {
    $ionicLoading.hide();
    $ionicModal.fromTemplateUrl('templates/login.html', {
      scope: $scope
    }).then(function(modal) {
      if($localStorage.completedWelcomeProcess) {
        $scope.modal = modal;
        $scope.modal.show();
      }
    });
  };

  // Perform the login action when the user submits the login form
  $scope.doLogin = function(loginForm) {
    if(loginForm.$valid) {
      User.login($scope.loginData.email, $scope.loginData.password)
      .success(function(result) {
        // This is for the case when a user logs in immediately after logging out
        $ionicHistory.clearHistory();
        $ionicHistory.clearCache();
        $scope.closeLogin();

        Intercom.authenticate(result.email);
      })
      .error(function(error) {
        $ionicPopup.alert({
          title: 'Whoops!',
          template: 'Bwraak!  That login info didn\'t work!',
          buttons: [{ text: 'Try again', type: 'button-calm' }]
        });
      });
    }
  }

  $scope.goToWelcome = function() {
    $ionicHistory.nextViewOptions({
      disableAnimate: true,
      disableBack: true
    });
    $rootScope.sideMenuVisible = false;
    $state.go('app.welcome.budget', {}, { reload: true, inherit: false, notify: true });
    $scope.modal.hide();
    $localStorage.completedWelcomeProcess = false;
  }

  $scope.doLogout = function() {
    $scope.loginData = {};
    Intercom.shutdown();
    User.logout();
    $ionicHistory.nextViewOptions({
      disableAnimate: true,
      disableBack: true
    });
    $state.go('app.daily', {}, { reload: true, inherit: false, notify: true, location: true });
    $ionicHistory.clearHistory();
    $ionicHistory.clearCache();
  }
})

.controller('DailyCtrl', function($scope, $rootScope, $http, $state, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicPopup, $ionicLoading, User, Transactions, Intercom, Currency) {

  $scope.daily = { 'today': new Date(), 'toggleBounce': false };
  $scope.daily.currency = Currency.getCurrency();
  $scope.user = {};

  $rootScope.sideMenuVisible = true;
  $ionicSideMenuDelegate.canDragContent(true);

  // Show the welcome wizard on first run
  if(!$localStorage.completedWelcomeProcess) {
    $rootScope.sideMenuVisible = false;
    $ionicSideMenuDelegate.canDragContent(false);
    $ionicHistory.nextViewOptions({
      disableAnimate: true,
      disableBack: true
    });
    $state.go('app.welcome.budget', {}, { reload: true, inherit: false, notify: true });
  }

  $scope.getDaily = function() {
    User.currentUser().then(function(result) {
      Currency.setCurrency(result.currency);
      $scope.daily.currency = Currency.getCurrency();

      $scope.user = result;

      $scope.daily.todaysBudget = result.todaysBudget;
      $scope.daily.dailyBudget = result.dailyBudget;
      $scope.daily.todaysBudgetDisplay = Currency.toDisplay(result.todaysBudget);
      $scope.daily.dailyBudgetDisplay = Currency.toDisplay(result.dailyBudget);

      $scope.daily.toggleBounce = false;
      $scope.daily.toggleBounce = true;

      if($scope.daily.todaysBudget > $scope.daily.dailyBudget) {
        $scope.daily.dailyComplete = 1.0;
        $scope.daily.rollover = $scope.daily.todaysBudget - $scope.daily.dailyBudget;
        $scope.daily.rolloverComplete = $scope.daily.rollover / $scope.daily.dailyBudget;
        if($scope.daily.rolloverComplete > 1) {
          $scope.daily.rolloverComplete = 1;
          $scope.daily.secondaryRollover = $scope.daily.rollover - $scope.daily.dailyBudget;
          $scope.daily.secondaryRolloverComplete = $scope.daily.secondaryRollover / $scope.daily.dailyBudget;
          if($scope.daily.secondaryRolloverComplete > 1) $scope.daily.secondaryRolloverComplete = 1.0;
        }
        else {
          $scope.daily.secondaryRolloverComplete = 0.0;
        }
      }
      else {
        $scope.daily.dailyComplete = $scope.daily.todaysBudget / $scope.daily.dailyBudget;
        if($scope.daily.dailyComplete < -1) $scope.daily.dailyComplete = -1;
        $scope.daily.rolloverComplete = 0.0;
        $scope.daily.secondaryRolloverComplete = 0.0;
      }

    }, function(error) {
      $scope.showLogin();
    });
  }

  $scope.spendMoney = function(amount) {
    if(amount === undefined || amount == 0 || amount == '0.00') return false;

    User.currentUser().then(function(user) {
      var amountInCents = Currency.toStorageFormat(amount);
      var newBalance = user.todaysBudget - amountInCents;

      // Update just local data
      User.update({ 'todaysBudget': newBalance }, true);

      // Add the transaction to parse
      Transactions.addTransaction(user, amount);

      $scope.getDaily();

      Intercom.trackEvent('spent-money');

    }, function(error) {
      $scope.showLogin();
    });
  }

  $scope.$watch(function () { return User.getUserObj() }, function (newVal, oldVal) {
    if((typeof newVal !== 'undefined' && typeof oldVal !== 'undefined' && newVal && oldVal && newVal.todaysBudget && oldVal.todaysBudget && newVal.todaysBudget != oldVal.todaysBudget) || (typeof newVal !== 'undefined' && newVal && (!oldVal || typeof oldVal === 'undefined'))) {
      $scope.getDaily();
    }
  }, true);

  // Get fresh transactions after logging in
  $scope.$on('modal.hidden', function(modal) {
    $scope.getDaily();
  });

  // Animation cleanup
  $scope.$on('$ionicView.afterLeave', function(scope, states) {
    $scope.daily.toggleBounce = false;
  });

  $scope.getDaily();
})

.controller('GoalCtrl', function($scope, $http, $state, $localStorage, $ionicHistory, $ionicPopup, parseConfig, User, Intercom, Currency) {
  $scope.goal = {
    'amount': 0,
  };

  User.currentUser().then(function(user) {

    Currency.setCurrency(user.currency);
    $scope.goal.currency = Currency.getCurrency();

    $scope.goal.dailyBudget = user.dailyBudget;
    $scope.goal.todaysBudget = user.todaysBudget;
    $scope.goal.originalTodaysBudget = user.todaysBudget;

    $scope.goal.todaysBudgetDisplay = Currency.toDisplay(user.todaysBudget);
    $scope.goal.amountDisplay = Currency.toDisplay($scope.goal.amount);

    $scope.updateSlider();

    User.getUserBuckets()
    .success(function(data) {
      $scope.updateSlider();

      $scope.$watch(function () { return User.getUserObj() }, function (newVal, oldVal) {
        if(newVal && newVal.todaysBudget && newVal.todaysBudget != oldVal.todaysBudget) {
          $scope.updateSlider();
        }
      });
    });
  });

  $scope.updateSlider = function() {
    $scope.goal.goalComplete = $scope.goal.bucketProgress / $scope.goal.bucketGoal;
    if($scope.goal.goalComplete > 1) $scope.goal.goalComplete = 1;

    $scope.goal.maxBucketContribution = $scope.goal.bucketGoal - $scope.goal.bucketProgress;

    if($scope.goal.maxBucketContribution > $scope.goal.todaysBudget)
      $scope.goal.maxBucketContribution = $scope.goal.todaysBudget;

    $scope.goal.todaysBudget = $scope.goal.originalTodaysBudget - $scope.goal.amount;

    $scope.goal.todaysBudgetDisplay = Currency.toDisplay($scope.goal.todaysBudget);
    $scope.goal.amountDisplay = Currency.toDisplay($scope.goal.amount);

    if($scope.goal.todaysBudget > $scope.goal.dailyBudget) {
      $scope.goal.dailyComplete = 1.0;
      $scope.goal.rollover = $scope.goal.todaysBudget - $scope.goal.dailyBudget;
      $scope.goal.rolloverComplete = $scope.goal.rollover / $scope.goal.dailyBudget;
      if($scope.goal.rolloverComplete > 1) {
        $scope.goal.rolloverComplete = 1;
        $scope.goal.secondaryRollover = $scope.goal.rollover - $scope.goal.dailyBudget;
        $scope.goal.secondaryRolloverComplete = $scope.goal.secondaryRollover / $scope.goal.dailyBudget;
        if($scope.goal.secondaryRolloverComplete > 1) $scope.goal.secondaryRolloverComplete = 1.0;
      }
      else {
        $scope.goal.secondaryRolloverComplete = 0.0;
      }
    }
    else {
      $scope.goal.dailyComplete = $scope.goal.todaysBudget / $scope.goal.dailyBudget;
      if($scope.goal.dailyComplete < -1) $scope.goal.dailyComplete = -1;
      $scope.goal.rolloverComplete = 0.0;
    }

    $scope.goal.bucketProgress = $scope.goal.originalBucketProgress + parseFloat($scope.goal.amount);
    $scope.goal.goalComplete = parseFloat($scope.goal.bucketProgress / $scope.goal.bucketGoal);
    $scope.goal.bucketProgressDisplay = Currency.toDisplay($scope.goal.bucketProgress);
  }

  $scope.processForm = function() {
    User.currentUser().then(function(user) {
      User.update({ 'todaysBudget': user.todaysBudget - $scope.goal.amount }, true);
      Intercom.trackEvent('saved-money');
      $http({
        method  : 'POST',
        url     : 'https://api.parse.com/1/functions/AddBucketContribution',
        data    : 'amount=' + Currency.toWhole($scope.goal.amount),
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'X-Parse-Session-Token': user.sessionToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      $scope.goal.originalTodaysBudget = $scope.goal.originalTodaysBudget - $scope.goal.amount;
      $scope.goal.amount = 0;

      $ionicHistory.nextViewOptions({
        disableBack: true
      });
      $state.go('app.daily', { transactions: [] }, { reload: true, inherit: false, notify: true });
    });
  }

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {
      User.currentUser().then(function(result) {
        if(result.todaysBudget == 0) {
          $scope.goal.showTomorrowMessage = true;
        }
        else {
          $scope.goal.showTomorrowMessage = false;
        }
      });

      User.getUserBuckets().success(function(buckets) {
        $scope.goal.bucketProgress = buckets.progress;
        $scope.goal.originalBucketProgress = buckets.progress;
        $scope.goal.bucketGoal = buckets.goal;
        $scope.goal.bucketName = buckets.title;

        $scope.goal.bucketProgressDisplay = Currency.toDisplay(buckets.progress);
        $scope.updateSlider();
      });
  });
})

.controller('WelcomeCtrl', function($scope, $rootScope, $http, $state, $stateParams, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicViewSwitcher, User, Intercom, Currency) {

  $rootScope.sideMenuVisible = false;
  $ionicSideMenuDelegate.canDragContent(false);

  $scope.welcome = {};

  if($stateParams.selectedCurrency) {
    $scope.welcome.currency = Currency.getCurrency($stateParams.selectedCurrency);
    $scope.welcome.selectedCurrency = $scope.welcome.currency.currency;
  }
  else {
    $scope.welcome.currency = Currency.getCurrency();
    $scope.welcome.selectedCurrency = $scope.welcome.currency.currency;
  }

  $scope.welcome.frugal = '25000';
  $scope.welcome.moderate = '40000';
  $scope.welcome.lavish = '50000';

  $scope.welcome.frugalFormatted = Currency.toDisplay($scope.welcome.frugal);
  $scope.welcome.moderateFormatted = Currency.toDisplay($scope.welcome.moderate);
  $scope.welcome.lavishFormatted = Currency.toDisplay($scope.welcome.lavish);

  if($stateParams.monthlyBudget)
    $scope.welcome.monthlyBudget = $stateParams.monthlyBudget;

  if($stateParams.bucketGoal)
    $scope.welcome.bucketGoal = $stateParams.bucketGoal;

  if($stateParams.bucketTitle)
    $scope.welcome.bucketTitle = $stateParams.bucketTitle;

  $scope.processSetupForm = function(welcomeForm) {
    var monthlyBudget;

    if($scope.welcome.customBudgetAmount)
      monthlyBudget = Currency.toStorageFormat($scope.welcome.customBudgetAmount);
    else
      monthlyBudget = $scope.welcome.spendingHabits;
    $state.go('app.welcome.goals', { monthlyBudget: monthlyBudget, selectedCurrency: $scope.welcome.selectedCurrency });
  }

  $scope.processGoalForm = function() {
    $scope.welcome.bucketGoal = $scope.welcome.bucketGoal;
    $state.go('app.welcome.signup', { monthlyBudget: $scope.welcome.monthlyBudget, bucketGoal: $scope.welcome.bucketGoal, bucketTitle: $scope.welcome.bucketTitle, selectedCurrency: $scope.welcome.selectedCurrency });
  }

  $scope.processSignupForm = function() {
    $scope.welcome.email = $scope.welcome.username;
    $scope.welcome.monthlyBudget = parseInt($scope.welcome.monthlyBudget);
    $scope.welcome.dailyBudget = parseInt($scope.welcome.monthlyBudget / 30);
    $scope.welcome.todaysBudget = parseInt($scope.welcome.monthlyBudget / 30);
    $scope.welcome.bucketGoal = String(parseInt(Currency.toStorageFormat($scope.welcome.bucketGoal)));

    $scope.signUpData = {
      'email': $scope.welcome.email,
      'username': $scope.welcome.username,
      'password': $scope.welcome.password,
      'monthlyBudget': $scope.welcome.monthlyBudget,
      'dailyBudget': $scope.welcome.dailyBudget,
      'todaysBudget': $scope.welcome.todaysBudget,
      'currency': $scope.welcome.selectedCurrency
    }

    User.signup($scope.signUpData)
    .success(function(result) {
      User.update({ 'bucketName': $scope.welcome.bucketTitle, 'bucketGoal': $scope.welcome.bucketGoal });
      Currency.setCurrency($scope.welcome.selectedCurrency);
      $rootScope.sideMenuVisible = true;
      $localStorage.completedWelcomeProcess = true;
      $ionicHistory.nextViewOptions({
        disableBack: true
      });
      $state.go('app.daily', {}, { reload: true, inherit: false, notify: true });
    });
  }

  $scope.skipWelcome = function() {
    $localStorage.completedWelcomeProcess = true;
    $ionicHistory.nextViewOptions({
      disableBack: true
    });
    $scope.showLogin();
    $rootScope.sideMenuVisible = true;
    $state.go('app.daily', {  }, { reload: true, inherit: false, notify: true });
  }

  $scope.changeCurrency = function(newCurrency) {
    Currency.setCurrency(newCurrency);
    $scope.welcome.currency = Currency.getCurrency();
    $scope.welcome.frugalFormatted = Currency.toDisplay($scope.welcome.frugal);
    $scope.welcome.moderateFormatted = Currency.toDisplay($scope.welcome.moderate);
    $scope.welcome.lavishFormatted = Currency.toDisplay($scope.welcome.lavish);
  }

})

.controller('SettingsCtrl', function($scope, $rootScope, $http, $state, $stateParams, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicViewSwitcher, User, Intercom, Currency) {

  $scope.settings = {
    'monthlyBudget': '',
    'bucketGoal': '',
    'bucketName': ''
  };

  User.currentUser().then(function(user) {
    Currency.setCurrency(user.currency);
    $scope.settings.currency = Currency.getCurrency();

    $scope.settings.monthlyBudget = Currency.toWhole(user.monthlyBudget);
  });

  User.getUserBuckets().then(function(buckets) {
    $scope.settings.bucketGoal = Currency.toWhole(buckets.goal);
    $scope.settings.bucketName = buckets.title;
  });

  $scope.updateSettings = function() {
    User.update({ 'monthlyBudget': Currency.toStorageFormat($scope.settings.monthlyBudget), 'dailyBudget': Currency.toStorageFormat($scope.settings.monthlyBudget) / 30 });
    User.updateBuckets({ 'bucketGoal': Currency.toStorageFormat($scope.settings.bucketGoal), 'bucketName': $scope.settings.bucketName });
    $ionicHistory.nextViewOptions({
      disableBack: true
    });
    $state.go('app.daily', {  }, { reload: true, inherit: false, notify: true });
  }
});
