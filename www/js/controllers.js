angular.module('budgie.controllers', ['budgie.config'])

.controller('AppCtrl', function($scope, $rootScope, $ionicModal, $ionicPopup, $ionicHistory, $ionicLoading, $ionicScrollDelegate, $state, $http, $localStorage, User, Intercom) {

  $ionicScrollDelegate.freezeScroll( true );

  $rootScope.sideMenuVisible = true;

  // Update Intercom status upon every view change, if the user
  // is logged in
  $rootScope.$on( "$ionicView.enter", function( scopes, states ) {
      User.currentUser().then(function(result) {
        Intercom.update(result.email);

        // Fetch new data from Parse
        User.fetchFromParse(result.sessionToken);
      });

      // Keep our local user up to date when it changes
      // (useful for when Parse finishes its update)
      $rootScope.$watch(function () { return User.getUserObj() }, function (newVal, oldVal) {
          User.update(newVal, true);
      });
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

  $scope.daily = { 'today': new Date() };
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
      $scope.user = result;

      // d3
      var rp1 = radialProgress(document.getElementById('daily'))
                .diameter(300)
                .value(result.todaysBudget)
                .maxValue(result.dailyBudget)
                .render();


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

      // d3
      var rp1 = radialProgress(document.getElementById('daily'))
                .diameter(300)
                .value(newBalance)
                .maxValue(user.dailyBudget)
                .render();

    }, function(error) {
      $scope.showLogin();
    });
  }

  // Get fresh transactions after logging in
  $scope.$on('modal.hidden', function(modal) {
    $scope.getDaily();
  });

  $scope.getDaily();
})

.controller('GoalCtrl', function($scope, $http, $state, $localStorage, $ionicHistory, $ionicPopup, parseConfig, User, Intercom) {
  $scope.goal = {};
  $scope.goal.amount = "00.00";

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

    var contributedToBucket;
    var newContribution = 0;
    var bucketGoal;

    var dailyBudget;
    var remainingBudget;
    var newBudget = 0;

    User.currentUser().then(function(user) {
      dailyBudget = user.dailyBudget;
      remainingBudget = user.todaysBudget;
      newBudget = remainingBudget;

      $scope.remainingBudget = remainingBudget;

      $http({
        method  : 'POST',
        url     : 'https://api.parse.com/1/functions/GetUserBuckets',
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'X-Parse-Session-Token': user.sessionToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      .success(function(data) {
          if(!data.error) {
              contributedToBucket = data.result.progress;
              newContribution = contributedToBucket;
              bucketGoal = data.result.goal;

              $scope.goal.contributedToBucket = contributedToBucket;
              $scope.goal.bucketName = data.result.title;

              var rp1 = radialProgressSmall(document.getElementById('goal'))
                      .diameter(150)
                      .value(contributedToBucket)
                      .maxValue(bucketGoal)
                      .render();
              var rp2 = radialProgressSmall(document.getElementById('budget'))
                      .diameter(150)
                      .value(remainingBudget)
                      .maxValue(dailyBudget)
                      .innerLabel(remainingBudget)
                      .render();
          }

          $scope.$watch(function () { return User.getUserObj() }, function (newVal, oldVal) {
            if(newVal && newVal.todaysBudget && newVal.todaysBudget != oldVal.todaysBudget) {
              remainingBudget = newVal.todaysBudget;
              $scope.updateSlider();
            }
          });
      });
    });

    $scope.updateSlider = function(event) {
        var rp1 = radialProgressSmall(document.getElementById('goal'))
            .diameter(150)
            .currentArc(parseFloat(newContribution / bucketGoal) * (2*Math.PI))
            .value(parseInt($scope.goal.amount) + parseInt(contributedToBucket))
            .maxValue(parseInt(bucketGoal))
            .render();
        newContribution = parseInt($scope.goal.amount) + parseInt(contributedToBucket);
        var rp2 = radialProgressSmall(document.getElementById('budget'))
            .diameter(150)
            .currentArc(parseFloat(newBudget / dailyBudget) * (2*Math.PI))
            .currentArc2(0)
            .value(remainingBudget - parseInt($scope.goal.amount))
            .maxValue(dailyBudget)
            .innerLabel(remainingBudget)
            .render();
        newBudget = remainingBudget - parseInt($scope.goal.amount);
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

        $ionicHistory.nextViewOptions({
          disableBack: true
        });
        $state.go('app.daily', { transactions: [] }, { reload: true, inherit: false, notify: true });
      });
    }

    $scope.changeBucketName = function() {
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
                //don't allow the user to close unless he enters wifi password
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
          IntercomTrackEvent('changed-settings', {'setting': 'Goal Title', 'Goal Title': bucketName});
        }
      });
    }

    $scope.changeBucketGoal = function() {
      $scope.goal.bucketGoal = parseFloat(bucketGoal / 100).toFixed(2);
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
                //don't allow the user to close unless he enters wifi password
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
          bucketGoal = newBucketGoal * 100;
          User.update({ 'bucketGoal': newBucketGoal * 100 });
          $scope.updateSlider();
          IntercomTrackEvent('changed-settings', {'setting': 'Goal Amount'});
        }
      });
    }
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
    $state.go('app.daily', {  }, { reload: true, inherit: false, notify: true });
  }

});
