angular.module('budgie.controllers', ['budgie.config'])

.controller('AppCtrl', function($scope, $rootScope, $ionicModal, $ionicPopup, $ionicHistory, $ionicLoading, $ionicScrollDelegate, $state, $http, $localStorage, User, Intercom) {

  $ionicScrollDelegate.freezeScroll( true );

  $rootScope.sideMenuVisible = true;

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

.controller('DailyCtrl', function($scope, $rootScope, $http, $state, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicPopup, $ionicLoading, User, Transactions, Intercom) {

  $scope.daily = { 'today': new Date(), 'toggleBounce': false };
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
      User.fetchBucketsFromParse(result.sessionToken);

      $scope.user = result;

      $scope.daily.todaysBudget = result.todaysBudget;
      $scope.daily.dailyBudget = result.dailyBudget;

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

  $scope.changeMonthlyBudget = function() {
    $scope.daily.mB = parseFloat($scope.user.monthlyBudget / 100).toFixed(2);
    $ionicPopup.show({
      template: '<label class="item item-input"><i class="icon ion-social-usd"></i><input type="tel" placeholder="00.00" ng-model="daily.mB" ui-number-mask="2" ui-hide-group-sep /></label>',
      title: 'Enter your monthly budget',
      subTitle: 'Just dollars, please.',
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: '<b>Save</b>',
          type: 'button-calm',
          onTap: function(e) {
            if (!$scope.daily.mB) {
              //don't allow the user to close unless he enters wifi password
              e.preventDefault();
            } else {
              return $scope.daily.mB;
            }
          }
        }
      ]
    })
    .then(function(newMonthlyBudget) {
      if(newMonthlyBudget) {
        $scope.user.monthlyBudget = newMonthlyBudget * 100;
        User.update($scope.user);

        $ionicPopup.alert({
          title: 'New money, suit and tie',
          template: 'Starting tomorrow, you\'ll get <strong>$' + parseFloat(newMonthlyBudget / 30).toFixed(2) + '</strong> per day.',
          buttons: [{ text: 'Got it', type: 'button-calm' }]
        });

        Intercom.trackEvent('changed-settings', {'setting': 'Monthly Budget'});
      }
    });
  }

  $scope.spendMoney = function(amount) {
    if(amount === undefined || amount == 0 || amount == '0.00') return false;

    User.currentUser().then(function(user) {
      var amountInCents = amount * 100;
      var newBalance = user.todaysBudget - amountInCents;

      // Update just local data
      User.update({ 'todaysBudget': newBalance }, true);

      // Add the transaction to parse
      Transactions.addTransaction(user, amount);

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

  $scope.getDaily();
})

.controller('GoalCtrl', function($scope, $http, $state, $localStorage, $ionicHistory, $ionicPopup, parseConfig, User, Intercom) {
  $scope.goal = {
    'amount': 0,
  };

  if(!$localStorage.seenSettingsPopup) {
    // An alert dialog
    $ionicPopup.alert({
      title: 'Did you know that...',
       template: 'You can change your goal value and title by tapping on them.',
       buttons: [{ text: 'Now I know!', type: 'button-calm' }]
     })
    .then(function() {
      $localStorage.seenSettingsPopup = true;
    });
  }

  User.currentUser().then(function(user) {

    $scope.goal.dailyBudget = user.dailyBudget;
    $scope.goal.todaysBudget = user.todaysBudget;
    $scope.goal.originalTodaysBudget = user.todaysBudget;

    $scope.updateSlider();

    User.getUserBuckets()
    .success(function(data) {
      $scope.goal.bucketProgress = data.progress;
      $scope.goal.originalBucketProgress = data.progress;
      $scope.goal.bucketGoal = data.goal;
      $scope.goal.bucketName = data.title;

      $scope.goal.goalComplete = $scope.goal.bucketProgress / $scope.goal.bucketGoal;
      if($scope.goal.goalComplete > 1) $scope.goal.goalComplete = 1;

      $scope.goal.maxBucketContribution = $scope.goal.bucketGoal - $scope.goal.bucketProgress;

      if($scope.goal.maxBucketContribution > $scope.goal.todaysBudget)
        $scope.goal.maxBucketContribution = $scope.goal.todaysBudget;

      $scope.$watch(function () { return User.getUserObj() }, function (newVal, oldVal) {
        if(newVal && newVal.todaysBudget && newVal.todaysBudget != oldVal.todaysBudget) {
          $scope.updateSlider();
        }
      });
    });
  });

  $scope.updateSlider = function() {
    $scope.goal.todaysBudget = $scope.goal.originalTodaysBudget - $scope.goal.amount;

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

    $scope.goal.bucketProgress = $scope.goal.originalBucketProgress + parseInt($scope.goal.amount);
    $scope.goal.goalComplete = $scope.goal.bucketProgress / $scope.goal.bucketGoal;
  }

  $scope.processForm = function() {
    User.currentUser().then(function(user) {
      User.update({ 'todaysBudget': user.todaysBudget - $scope.goal.amount }, true);
      Intercom.trackEvent('saved-money');
      $http({
        method  : 'POST',
        url     : 'https://api.parse.com/1/functions/AddBucketContribution',
        data    : 'amount=' + $scope.goal.amount / 100,
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

  $scope.changeBucketName = function() {
    var oldBucketName = $scope.goal.bucketName;
    $ionicPopup.show({
      template: '<label class="item item-input"><input type="text" ng-model="goal.bucketName"></label>',
      title: 'Enter new Goal Name',
      subTitle: 'Just text, please.',
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: '<b>Save</b>',
          type: 'button-calm',
          onTap: function(e) {
            if (!$scope.goal.bucketName) {
              e.preventDefault();
            } else {
              return $scope.goal.bucketName;
            }
          }
        }
      ]
    })
    .then(function(bucketName) {
      if(bucketName) {
        User.update({ 'bucketName': bucketName });
        Intercom.trackEvent('changed-settings', {'setting': 'Goal Title', 'Goal Title': bucketName});
      }
      else {
        $scope.goal.bucketName = oldBucketName;
      }
    });
  }

  $scope.changeBucketGoal = function() {
    $scope.goal.oldGoal = $scope.goal.bucketGoal;
    $scope.goal.bucketGoal = $scope.goal.bucketGoal / 100;
    $ionicPopup.show({
      template: '<label class="item item-input"><i class="icon ion-social-usd"></i><input type="tel" placeholder="00.00" ng-model="goal.bucketGoal" ui-number-mask="2" ui-hide-group-sep /></label>',
      title: 'Enter new Goal',
      subTitle: 'Just dollars, please.',
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: '<b>Save</b>',
          type: 'button-calm',
          onTap: function(e) {
            if (!$scope.goal.bucketGoal) {
              e.preventDefault();
            } else {
              return $scope.goal.bucketGoal;
            }
          }
        }
      ]
    })
    .then(function(newBucketGoal) {
      if(newBucketGoal) {
        $scope.goal.bucketGoal = newBucketGoal * 100;
        $scope.goal.maxBucketContribution = $scope.goal.bucketGoal - $scope.goal.bucketProgress;

        if($scope.goal.amount > $scope.goal.maxBucketContribution) $scope.goal.amount = $scope.goal.maxBucketContribution;

        Intercom.trackEvent('changed-settings', {'setting': 'Goal Amount'});
        User.update({ 'bucketGoal': $scope.goal.bucketGoal });
      }
      else {
        $scope.goal.bucketGoal = $scope.goal.oldGoal;
      }
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
  });
})

.controller('WelcomeCtrl', function($scope, $rootScope, $http, $state, $stateParams, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicViewSwitcher, User, Intercom) {

  $rootScope.sideMenuVisible = false;
  $ionicSideMenuDelegate.canDragContent(false);

  $scope.welcome = {};

  $scope.welcome.frugal = '25000';
  $scope.welcome.moderate = '40000';
  $scope.welcome.lavish = '50000';

  if($stateParams.monthlyBudget)
    $scope.welcome.monthlyBudget = $stateParams.monthlyBudget;

  if($stateParams.bucketGoal)
    $scope.welcome.bucketGoal = $stateParams.bucketGoal;

  if($stateParams.bucketTitle)
    $scope.welcome.bucketTitle = $stateParams.bucketTitle;

  $scope.processSetupForm = function(welcomeForm) {
    var monthlyBudget;

    if($scope.welcome.customBudgetAmount)
      monthlyBudget = $scope.welcome.customBudgetAmount * 100;
    else
      monthlyBudget = $scope.welcome.spendingHabits;
    $state.go('app.welcome.goals', { monthlyBudget: monthlyBudget });
  }

  $scope.processGoalForm = function() {
    $state.go('app.welcome.signup', { monthlyBudget: $scope.welcome.monthlyBudget, bucketGoal: $scope.welcome.bucketGoal, bucketTitle: $scope.welcome.bucketTitle });
  }

  $scope.processSignupForm = function() {
    $scope.welcome.email = $scope.welcome.username;
    $scope.welcome.monthlyBudget = parseInt($scope.welcome.monthlyBudget);
    $scope.welcome.dailyBudget = parseInt($scope.welcome.monthlyBudget / 30);
    $scope.welcome.todaysBudget = parseInt($scope.welcome.monthlyBudget / 30);
    $scope.welcome.bucketGoal = String(parseInt($scope.welcome.bucketGoal * 100));

    $scope.signUpData = {
      'email': $scope.welcome.email,
      'username': $scope.welcome.username,
      'password': $scope.welcome.password,
      'monthlyBudget': $scope.welcome.monthlyBudget,
      'dailyBudget': $scope.welcome.dailyBudget,
      'todaysBudget': $scope.welcome.todaysBudget
    }

    User.signup($scope.signUpData)
    .success(function(result) {
      User.update({ 'bucketName': $scope.welcome.bucketTitle, 'bucketGoal': $scope.welcome.bucketGoal });
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

})

.controller('SettingsCtrl', function($scope, $rootScope, $http, $state, $stateParams, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicViewSwitcher, User, Intercom) {

  $scope.settings = {
    'monthlyBudget': '',
    'bucketGoal': '',
    'bucketName': ''
  };

  User.currentUser().then(function(user) {
    $scope.settings.monthlyBudget = user.monthlyBudget / 100;
  });

  User.getUserBuckets().then(function(buckets) {
    $scope.settings.bucketGoal = buckets.goal / 100;
    $scope.settings.bucketName = buckets.title;
  });

  $scope.updateSettings = function() {
    User.update({ 'monthlyBudget': $scope.settings.monthlyBudget * 100 });
    User.updateBuckets({ 'bucketGoal': $scope.settings.bucketGoal * 100, 'bucketName': $scope.settings.bucketName });
    $ionicHistory.nextViewOptions({
      disableBack: true
    });
    $state.go('app.daily', {  }, { reload: true, inherit: false, notify: true });
  }
});
