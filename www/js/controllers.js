angular.module('budgie.controllers', ['budgie.config'])

.controller('AppCtrl', function($scope, $rootScope, $ionicModal, $ionicPopup, $http, $location, $localStorage, ActiveUser, parseConfig) {

  $rootScope.sideMenuVisible = true;

  // Form data for the login modal
  $scope.loginData = {};

  // Triggered in the login modal to close it
  $scope.closeLogin = function() {
    $scope.modal.hide();
  };

  // Open the login modal
  $scope.showLogin = function() {
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
      $http({
        method  : 'GET',
        url     : 'https://api.parse.com/1/login?username=' + $scope.loginData.email + '&password=' + $scope.loginData.password,
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      .success(function(response, status) {
        if(status == 200) {
          ActiveUser(response);
          $scope.closeLogin();
        }
      })
      .error(function(response, status) {
        var alertPopup = $ionicPopup.alert({
          title: 'Whoops!',
          template: 'Bwraak!  That login info didn\'t work!  Please try again.'
        });
      });
    }
  };
})

.controller('DailyCtrl', function($scope, $rootScope, $http, $state, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicPopup, ActiveUser, parseConfig, IntercomAuthenticate, IntercomTrackEvent) {

  $scope.daily = {};

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

  $scope.getTransactions = function() {
    var currentUser = ActiveUser();
    if(currentUser) {
      $http({
        method  : 'POST',
        url     : 'https://api.parse.com/1/functions/GetUserTransactions',
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'X-Parse-Session-Token': currentUser.sessionToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      .success(function(response) {
        $scope.transactions = response.result;
        $scope.getTotal = function() {
          var total = 0;
          for(var i = 0; i < $scope.transactions.length; i++){
              total += $scope.transactions[i].amount / 100;
          }
          return total;
        }
      })
      .then(function() {
        return $http({
          method  : 'GET',
          url     : 'https://api.parse.com/1/users/me',
          headers : {
            'X-Parse-Application-Id': parseConfig.appid,
            'X-Parse-REST-API-Key': parseConfig.rest_key,
            'X-Parse-Session-Token': currentUser.sessionToken,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
        .success(function(response) {
          IntercomAuthenticate(response.email);
          $scope.daily.monthlyBudget = response.monthlyBudget;
          $scope.daily.todaysBudget = response.todaysBudget;
          var rp1 = radialProgress(document.getElementById('daily'))
                    .diameter(300)
                    .value(response.todaysBudget)
                    .maxValue(response.dailyBudget)
                    .render();
        });
      });
    }
    else {
      $scope.showLogin();
    }
  }

  $scope.changeMonthlyBudget = function() {
    var currentUser = ActiveUser();
      $scope.daily.mB = parseFloat($scope.daily.monthlyBudget / 100).toFixed(2);
      $ionicPopup.show({
        template: '<input type="text" ng-model="daily.mB">',
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
          $scope.daily.monthlyBudget = newMonthlyBudget * 100;
          $http({
            method  : 'POST',
            url     : 'https://api.parse.com/1/functions/UpdateUserSettings',
            data    : 'monthlyBudget=' + newMonthlyBudget * 100,
            headers : {
              'X-Parse-Application-Id': parseConfig.appid,
              'X-Parse-REST-API-Key': parseConfig.rest_key,
              'X-Parse-Session-Token': currentUser.sessionToken,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }).success(function() {
            $ionicPopup.alert({
              title: 'Updated!',
               template: 'Starting tomorrow, you\'ll get $' + parseFloat(newMonthlyBudget / 30).toFixed(2) + ' per day.  Sweet.',
               buttons: [{ text: 'Bwraaak!', type: 'button-calm' }]
             });
            IntercomTrackEvent('changed-settings');
          });
        }
      });
    }

  // Get fresh transactions after logging in
  $scope.$on('modal.hidden', function(modal) {
    $scope.getTransactions();
  });

  $scope.getTransactions();
})

.controller('SpendCtrl', function($scope, $http, $state, $localStorage, $ionicHistory, $ionicPopup, ActiveUser, parseConfig, IntercomTrackEvent) {

  $scope.spend = { amount: '' };
  $scope.amountCents = "";

  $scope.updateDollars = function(event) {
    var num = event.which || event.keyCode;
    if(num > 47 && num < 58) {
        $scope.amountCents = $scope.amountCents.concat(String.fromCharCode(num));
    }
    else if(num == 8) {
        $scope.amountCents = $scope.amountCents.substring(0, $scope.amountCents.length - 1);
    }

    var amount = parseFloat($scope.amountCents / 100).toFixed(2);
    if(String(amount).length <= 4)
        amount = 0 + String(amount);
    $scope.spend.amount = amount;
  }

  $scope.spendMoney = function() {
    var currentUser = ActiveUser();
    $http({
      method  : 'POST',
      url     : 'https://api.parse.com/1/functions/AddTransaction',
      data    : 'amount=' + $scope.spend.amount,
      headers : {
        'X-Parse-Application-Id': parseConfig.appid,
        'X-Parse-REST-API-Key': parseConfig.rest_key,
        'X-Parse-Session-Token': currentUser.sessionToken,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .success(function(response) {
      $scope.spend.amount = '';
      $scope.amountCents = '';

      IntercomTrackEvent('spent-money');

      $ionicHistory.nextViewOptions({
         disableBack: true
      });
      $state.go('app.daily', { transactions: [] }, { reload: true, inherit: false, notify: true });
    });
  }
})

.controller('GoalCtrl', function($scope, $http, $state, $localStorage, $ionicHistory, $ionicPopup, ActiveUser, parseConfig, IntercomTrackEvent) {
  $scope.goal = {};
  $scope.goal.amount = "00.00";

  if(!$localStorage.seenSettingsPopup) {
    // An alert dialog
      $ionicPopup.alert({
        title: 'Did you know that...',
         template: 'You can change your goal value and title by tapping on them.',
         buttons: [{ text: 'Got it!', type: 'button-calm' }]
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

    var currentUser = ActiveUser();
    $http({
      method  : 'GET',
      url     : 'https://api.parse.com/1/users/me',
      headers : {
        'X-Parse-Application-Id': parseConfig.appid,
        'X-Parse-REST-API-Key': parseConfig.rest_key,
        'X-Parse-Session-Token': currentUser.sessionToken,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .success(function(response) {
      dailyBudget = response.dailyBudget;
      remainingBudget = response.todaysBudget;
      newBudget = remainingBudget;

      $scope.remainingBudget = remainingBudget;
    })
    .then(function() {
        return $http({
          method  : 'POST',
          url     : 'https://api.parse.com/1/functions/GetUserBuckets',
          headers : {
            'X-Parse-Application-Id': parseConfig.appid,
            'X-Parse-REST-API-Key': parseConfig.rest_key,
            'X-Parse-Session-Token': currentUser.sessionToken,
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
      $http({
        method  : 'POST',
        url     : 'https://api.parse.com/1/functions/AddBucketContribution',
        data    : 'amount=' + $scope.goal.amount / 100,
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'X-Parse-Session-Token': currentUser.sessionToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      .success(function(response, status) {
        if(status == 200) {
          IntercomTrackEvent('saved-money');
          $ionicHistory.nextViewOptions({
            disableBack: true
          });
          $state.go('app.daily', { transactions: [] }, { reload: true, inherit: false, notify: true });
        }
      });
    }

    $scope.changeBucketName = function() {
      $ionicPopup.show({
        template: '<input type="text" ng-model="goal.bucketName">',
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
          $http({
            method  : 'POST',
            url     : 'https://api.parse.com/1/functions/UpdateUserSettings',
            data    : 'bucketName=' + bucketName,
            headers : {
              'X-Parse-Application-Id': parseConfig.appid,
              'X-Parse-REST-API-Key': parseConfig.rest_key,
              'X-Parse-Session-Token': currentUser.sessionToken,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          IntercomTrackEvent('changed-settings', {'bucket-name': bucketName});
        }
      });
    }

    $scope.changeBucketGoal = function() {
      $scope.goal.bucketGoal = parseFloat(bucketGoal / 100).toFixed(2);
      $ionicPopup.show({
        template: '<input type="text" ng-model="goal.bucketGoal">',
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
          $scope.updateSlider();
          $http({
            method  : 'POST',
            url     : 'https://api.parse.com/1/functions/UpdateUserSettings',
            data    : 'bucketGoal=' + newBucketGoal * 100,
            headers : {
              'X-Parse-Application-Id': parseConfig.appid,
              'X-Parse-REST-API-Key': parseConfig.rest_key,
              'X-Parse-Session-Token': currentUser.sessionToken,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          IntercomTrackEvent('changed-settings');
        }
      });
    }
})

.controller('WelcomeCtrl', function($scope, $rootScope, $http, $state, $stateParams, $localStorage, $ionicHistory, $ionicSideMenuDelegate, $ionicViewSwitcher, ActiveUser, parseConfig, IntercomTrackEvent) {

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

    $http({
      method  : 'POST',
      url     : 'https://api.parse.com/1/users',
      data    : JSON.stringify($scope.welcome),
      headers : {
        'X-Parse-Application-Id': parseConfig.appid,
        'X-Parse-REST-API-Key': parseConfig.rest_key,
        'Content-Type': 'application/json'
      }
    })
    .success(function(result) {
      ActiveUser(result);

      $http({
        method  : 'POST',
        url     : 'https://api.parse.com/1/functions/UpdateUserSettings',
        data    : 'bucketName=' + $scope.welcome.bucketTitle + "&bucketGoal=" + $scope.welcome.bucketGoal,
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'X-Parse-Session-Token': result.sessionToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      .success(function(result) {
        $localStorage.completedWelcomeProcess = true;
        $ionicHistory.nextViewOptions({
          disableBack: true
        });
        $state.go('app.daily', {  }, { reload: true, inherit: false, notify: true });
      });
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
