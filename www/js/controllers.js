angular.module('budgie.controllers', ['budgie.config'])

.controller('AppCtrl', function($scope, $ionicModal, $ionicPopup, $http, $location, $localStorage, ActiveUser, parseConfig) {
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
      $scope.modal = modal;
      $scope.modal.show();
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

.controller('DailyCtrl', function($scope, $http, ActiveUser, parseConfig) {

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

  // Get fresh transactions after logging in
  $scope.$on('modal.hidden', function(modal) {
    $scope.getTransactions();
  });

  $scope.getTransactions();
})

.controller('SpendCtrl', function($scope, $http, $state, $ionicHistory, ActiveUser, parseConfig) {

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

      $ionicHistory.nextViewOptions({
         disableBack: true
      });
      $state.go('app.daily', { transactions: [] }, { reload: true, inherit: false,
    notify: true });
    });
  }
});
