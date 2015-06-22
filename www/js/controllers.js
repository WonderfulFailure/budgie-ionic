angular.module('budgie.controllers', ['budgie.config'])

.controller('AppCtrl', function($scope, $rootScope, $window, $ionicModal, $ionicPopup, $ionicHistory, $ionicLoading, $ionicScrollDelegate, $state, $http, $localStorage, $ionicPlatform, $ionicUser, $ionicPush, User, Intercom, Currency, Transactions) {

  $ionicScrollDelegate.freezeScroll( true );

  $rootScope.registeredForPush = false;

  // Currency
  Currency.setCurrency('usd');

  // Update Intercom status upon every view change, if the user
  // is logged in
  $rootScope.$on( "$ionicView.enter", function( scopes, states ) {
      User.currentUser().then(function(result) {
        Intercom.update(result.email);
      });
  });

  // Populate the transactions
  User.currentUser().then(function(user) {
    Transactions.fetchTransactionsFromParse(user.sessionToken);

    // Set the user's timezone from momentjs
    if(!user.utcOffset) {
      User.update({ 'utcOffset': moment().utcOffset() });
    }
  }, function(error) {
    $localStorage.completedWelcomeProcess = false;
    $localStorage.sessionToken = null;
    $scope.showLogin();
  });

  // Form data for the login modal
  $scope.loginData = {};

  $scope.registerForPush = function() {
    if(window.cordova && !$rootScope.registeredForPush) {
      User.currentUser().then(function(user) {
        console.log('Identifying user with Ionic');
        var ionicUser = $ionicUser.get();
        if(!ionicUser.user_id) {
          // Set your user_id here, or generate a random one
          ionicUser.user_id = user.objectId
        };

        angular.extend(ionicUser, {
          email: user.email
        });

        $ionicUser.identify(ionicUser).then(function() {
          console.log('Successfully identified with Ionic');

          $ionicPush.register({
            canShowAlert: true,
            canSetBadge: false, //Can pushes update app icon badges?
            canPlaySound: true, //Can notifications play a sound?
            canRunActionsOnWake: true, //Can run actions outside the app,
            onNotification: function(notification) {
              console.log(notification);
              return true;
            }
          }).then(function(deviceToken) {
            console.log('Registered with push, device token: ' + deviceToken);
            $rootScope.registeredForPush = true;

            if(deviceToken != "OK") {
              User.update({ 'deviceToken': deviceToken });
            }
          });
        });
      });
    }
  }

  $rootScope.$on('$cordovaPush:tokenReceived', function(event, data) {
    console.log('$cordovaPush:tokenReceived', data.token, data.platform);
    if(deviceToken != "OK") {
      User.update({ 'deviceToken': deviceToken });
    }
  });

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

        User.fetchFromParse(result.sessionToken);
        User.fetchBucketsFromParse(result.sessionToken);
        Transactions.fetchTransactionsFromParse(result.sessionToken);

        $rootScope.settingsVisible = true;
        $ionicHistory.nextViewOptions({
          disableBack: true,
          disableAnimate: true
        });
        $state.go('app.daily', {  }, { reload: true, inherit: false, notify: true });
      })
      .error(function(error) {
        $ionicPopup.alert({
          title: 'Whoops!',
          template: 'Bwraak!  That login info didn\'t work!',
          buttons: [{ text: 'Give me another shot', type: 'button-calm' }]
        });
      });
    }
  }

  $scope.goToWelcome = function() {
    if($scope.modal) {
      $scope.closeLogin();
    }
    $ionicHistory.nextViewOptions({
      disableAnimate: true,
      disableBack: true
    });
    $state.go('app.welcome.budget', {}, { reload: true, location: "replace" });
    $localStorage.completedWelcomeProcess = false;
  }

  $scope.doLogout = function() {
    $scope.loginData = {};
    Intercom.shutdown();
    User.logout();
    $rootScope.registeredForPush = false;
    $scope.showLogin();
    $ionicHistory.clearHistory();
    $ionicHistory.clearCache();
  }
})

.controller('DailyCtrl', function($scope, $rootScope, $http, $state, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicPopup, $ionicLoading, $timeout, User, Transactions, Intercom, Currency) {

  $scope.daily = { 'today': new Date(), 'toggleBounce': false, 'label_placeholder': 'Note (optional)' };
  $scope.daily.currency = Currency.getCurrency();
  $scope.user = {};

  // Show the welcome wizard on first run
  if(!$localStorage.completedWelcomeProcess) {
    $scope.goToWelcome();
  }

  $scope.getDaily = function() {
    $rootScope.settingsVisible = true;
    $scope.registerForPush();
    User.currentUser().then(function(result) {
      Currency.setCurrency(result.currency);
      $scope.daily.currency = Currency.getCurrency();

      $scope.user = result;

      $scope.daily.todaysBudget = result.todaysBudget;
      $scope.daily.dailyBudget = result.dailyBudget;
      $scope.daily.todaysBudgetDisplay = Currency.toDisplay(result.todaysBudget);
      $scope.daily.dailyBudgetDisplay = Currency.toDisplay(result.dailyBudget);

      $scope.daily.toggleBounce = false;
      $timeout(function() {
        $scope.daily.toggleBounce = true;
      }, 10);

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
    });
  }

  $scope.spendMoney = function(amount, label) {
    if(amount === undefined || amount == 0 || amount == '0.00') return false;

    User.currentUser().then(function(user) {
      var amountInCents = Currency.toStorageFormat(amount);
      var newBalance = user.todaysBudget - amountInCents;
      var transactionLabel = label;

      // Update just local data
      User.update({ 'todaysBudget': newBalance }, true);

      // Add the transaction to parse
      Transactions.addTransaction(user, amount, transactionLabel);

      $scope.getDaily();
      $scope.daily.label = '';

      Intercom.trackEvent('spent-money');

    });
  }

  $scope.blurInput = function() {
    $scope.daily.toggleFlip = !$scope.daily.toggleFlip;
    $scope.daily.toggleClose = 'yes';
    $scope.daily.amount = '';
    $scope.daily.label = '';
    $scope.daily.hideGoalsButton = false;
  }

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {
    User.currentUser().then(function(user) {
      if($scope.daily.todaysBudget != user.todaysBudget)
        $scope.getDaily();

      if(user.todaysDate) {
        $scope.daily.today = user.todaysDate;
      }
    });
  });

  // Get fresh transactions after logging in
  $scope.$on('modal.hidden', function(modal) {
    $scope.getDaily();
  });

  // Animation cleanup
  $scope.$on('$ionicView.afterLeave', function(scope, states) {
    $scope.daily.toggleBounce = false;
    $scope.daily.toggleClose = false;
  });

  $scope.$on('userUpdate', function(event, args) {
    User.currentUser().then(function(user) {
      if(user.todaysBudget != $scope.daily.todaysBudget) {
        $timeout(function() {
          $scope.daily.todaysBudgetDisplay = '';
          $scope.getDaily();
        }, 200);
      }

      if(user.todaysDate) {
        $scope.daily.today = user.todaysDate;
      }
    });
  });
})

.controller('GoalCtrl', function($scope, $http, $state, $localStorage, $ionicHistory, $ionicPopup, $timeout, parseConfig, User, Intercom, Currency) {
  $scope.goal = {
    'amount': 0,
    'disableSlider': false
  };

  $scope.updateSlider = function() {
    $scope.goal.goalComplete = $scope.goal.bucketProgress / $scope.goal.bucketGoal;
    if($scope.goal.goalComplete > 1) $scope.goal.goalComplete = 1;

    $scope.goal.todaysBudget = $scope.goal.originalTodaysBudget - $scope.goal.amount;

    $scope.goal.todaysBudgetDisplay = Currency.toDisplay($scope.goal.todaysBudget);
    $scope.goal.amountDisplay = Currency.toDisplay($scope.goal.amount);

    //$scope.goal.amountDisplay = Currency.toDisplay($scope.goal.amount);

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
      User.updateBuckets({ 'progress': $scope.goal.bucketProgress }, true);
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

  $scope.calcGoalData = function() {
    User.currentUser().then(function(user) {

      Currency.setCurrency(user.currency);
      $scope.goal.currency = Currency.getCurrency();

      $scope.goal.dailyBudget = user.dailyBudget;
      $scope.goal.todaysBudget = user.todaysBudget;
      $scope.goal.originalTodaysBudget = user.todaysBudget;

      $scope.goal.todaysBudgetDisplay = Currency.toDisplay(user.todaysBudget);
      $scope.goal.amountDisplay = Currency.toDisplay($scope.goal.amount);

      // Disable slider if the user is negative and there is no goal progress
      // to take from
      if($scope.goal.todaysBudget <= 0 && $scope.goal.bucketProgress == 0) {
        $scope.goal.disableSlider = true;
      }

      User.getUserBuckets()
      .success(function(buckets) {
        $scope.goal.min = -buckets.progress || 0;
        $scope.goal.max = buckets.goal - buckets.progress;

        $scope.goal.bucketProgress = buckets.progress;
        $scope.goal.originalBucketProgress = buckets.progress;
        $scope.goal.bucketGoal = buckets.goal;
        $scope.goal.bucketName = buckets.title;

        $scope.goal.bucketProgressDisplay = Currency.toDisplay(buckets.progress);

        $scope.goal.min = Math.round(-$scope.goal.bucketProgress) || 0;
        $scope.goal.max = $scope.goal.bucketGoal - $scope.goal.bucketProgress;

        if($scope.goal.max > $scope.goal.originalTodaysBudget) {
          $scope.goal.max = Math.round($scope.goal.originalTodaysBudget);

          if($scope.goal.max < 0) {
            $scope.goal.max = 0;
          }
        }

        $scope.updateSlider();
      });
    });
  }

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {
    $scope.calcGoalData();
  });

  $scope.$on('userUpdate', function(event, args) {
    $scope.calcGoalData();
  });
})

.controller('WelcomeCtrl', function($scope, $rootScope, $http, $state, $stateParams, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicViewSwitcher, User, Intercom, Currency) {

  $rootScope.settingsVisible = false;
  $ionicSideMenuDelegate.canDragContent(false);

  $scope.welcome = {};

  $scope.welcome.currencies = Currency.getCurrencies();

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
    $state.go('app.welcome.signup', { monthlyBudget: monthlyBudget, bucketGoal: Currency.toStorageFormat('100'), bucketTitle: 'Piggy Bank', selectedCurrency: $scope.welcome.selectedCurrency });
  }

  $scope.processSignupForm = function() {
    $scope.welcome.email = $scope.welcome.username;
    $scope.welcome.monthlyBudget = parseInt($scope.welcome.monthlyBudget);
    $scope.welcome.dailyBudget = parseInt($scope.welcome.monthlyBudget / 30);
    $scope.welcome.todaysBudget = parseInt($scope.welcome.monthlyBudget / 30);
    $scope.welcome.bucketGoal = String(parseInt($scope.welcome.bucketGoal));

    $scope.signUpData = {
      'email': $scope.welcome.email,
      'username': $scope.welcome.username,
      'password': $scope.welcome.password,
      'monthlyBudget': $scope.welcome.monthlyBudget,
      'dailyBudget': $scope.welcome.dailyBudget,
      'todaysBudget': $scope.welcome.todaysBudget,
      'currency': $scope.welcome.selectedCurrency,
      'utcOffset': String(moment().utcOffset())
    }

    User.signup($scope.signUpData)
    .success(function(result) {
      User.update({ 'bucketName': $scope.welcome.bucketTitle, 'bucketGoal': $scope.welcome.bucketGoal });
      Currency.setCurrency($scope.welcome.selectedCurrency);
      $localStorage.completedWelcomeProcess = true;
      $ionicHistory.nextViewOptions({
        disableBack: true
      });
      $state.go('app.daily', {}, { reload: true, inherit: false, notify: true });
    });
  }

  $scope.skipWelcome = function() {
    $localStorage.completedWelcomeProcess = true;
    $scope.showLogin();
  }

  $scope.changeCurrency = function(newCurrency) {
    Currency.setCurrency(newCurrency);
    $scope.welcome.currency = Currency.getCurrency();
    $scope.welcome.frugalFormatted = Currency.toDisplay($scope.welcome.frugal);
    $scope.welcome.moderateFormatted = Currency.toDisplay($scope.welcome.moderate);
    $scope.welcome.lavishFormatted = Currency.toDisplay($scope.welcome.lavish);
  }

})

.controller('SettingsCtrl', function($scope, $rootScope, $http, $state, $stateParams, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicViewSwitcher, $ionicPopup, User, Intercom, Currency) {

  $scope.settings = {
    'monthlyBudget': '',
    'bucketGoal': '',
    'bucketName': '',
    'allowanceReminders': true,
    'reminderTime': '00',
    'user': {}
  };

  User.currentUser().then(function(user) {
    Currency.setCurrency(user.currency);
    $scope.settings.currency = Currency.getCurrency();

    $scope.settings.monthlyBudget = Currency.toWhole(user.monthlyBudget);

    $scope.settings.user = user;
    $scope.settings.reminderTime = user.reminderTime || $scope.settings.reminderTime;
  });

  User.getUserBuckets().then(function(buckets) {
    $scope.settings.bucketGoal = Currency.toWhole(buckets.goal);
    $scope.settings.bucketName = buckets.title;
  });

  $scope.updateSettings = function() {
    var newMonthlyBudget = Currency.toStorageFormat($scope.settings.monthlyBudget);
    var newDailyBalance = parseFloat(newMonthlyBudget / 30);
    var reminderTime = $scope.settings.reminderTime;
    User.currentUser().then(function(user) {
      if(user.monthlyBudget != newMonthlyBudget) {
        $ionicPopup.alert({
          title: 'New money, suit and tie',
          template: 'Starting tomorrow, your daily allowance will be <strong>' + Currency.toDisplay(parseInt(newDailyBalance)) + '</strong>!' ,
          buttons: [{ text: 'Oh yeah!', type: 'button-calm' }]
        });
      }
      User.update({ 'monthlyBudget': Currency.toStorageFormat($scope.settings.monthlyBudget), 'dailyBudget': Currency.toStorageFormat($scope.settings.monthlyBudget) / 30, 'allowanceReminders': $scope.settings.allowanceReminders, 'reminderTime': $scope.settings.reminderTime });
    });

    User.updateBuckets({ 'bucketGoal': Currency.toStorageFormat($scope.settings.bucketGoal), 'bucketName': $scope.settings.bucketName });
    $ionicHistory.nextViewOptions({
      disableBack: true
    });
    $state.go('app.daily', {  }, { reload: true, inherit: false, notify: true });
  }
})

.controller('TransactionsCtrl', function($scope, $rootScope, $http, $state, $stateParams, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicViewSwitcher, $ionicPopup, $ionicListDelegate, User, Intercom, Currency, Transactions) {

  $scope.transactions = {
    list: {}
  };

  $scope.removeTransaction = function(date, index) {
    $ionicListDelegate.closeOptionButtons();
    var transaction = $scope.transactions.list[date][index];
    $ionicPopup.confirm({
      title: 'Hold up',
      template: 'Are you sure you want to delete this <strong>' + transaction.amountDisplay + '</strong> transaction?',
      okText: '<strong>Yeah</strong>',
      okType: 'button-calm',
      cancelText: 'Nah'
    })
    .then(function(res) {
      if(res) {
        User.currentUser().then(function(user) {
          Transactions.removeTransaction(user, $scope.transactions.list[date][index].transId);
          var newBalance = user.todaysBudget + $scope.transactions.list[date][index].amount;
          User.update({ 'todaysBudget': newBalance }, true);
          $scope.transactions.list[date].splice(index, 1);

          if($scope.transactions.list[date].length == 0) {
            delete $scope.transactions.list[date];
          }
        });
      }
    });
  }

  User.currentUser().then(function(user) {
    Transactions.getTransactions(user).then(function(transactions) {
      for(var i in transactions) {
        var when = moment(transactions[i].createdAt).format('dddd, MMMM Do YYYY');
        if(!$scope.transactions.list[when]) $scope.transactions.list[when] = [];
        $scope.transactions.list[when].push(
          {
            amountDisplay: Currency.toDisplay(transactions[i].amount),
            amount: transactions[i].amount,
            transId: transactions[i].objectId,
            whenRaw: transactions[i].createdAt,
            when: when,
            label: transactions[i].label == 'Cash via app' ? 'No label' : transactions[i].label
          }
        );
      }
    });
  });

});
