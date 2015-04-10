angular.module('budgie.services', ['ngStorage', 'budgie.config'])

.factory('User', ['$http', '$localStorage', '$q', 'parseConfig', function($http, $localStorage, $q, parseConfig) {
  var currentUser;

  var User = {};

  // Converts an object to a query string
  var qs = function(obj, prefix){
    var str = [];
    for (var p in obj) {
      var k = prefix ? prefix + "[" + p + "]" : p,
          v = obj[k];
      str.push(angular.isObject(v) ? qs(v, k) : (k) + "=" + encodeURIComponent(v));
    }
    return str.join("&");
  }

  // Signs up on Parse and logs the user in
  // returns .success() upon successful signup,
  //         .error() otherwise
  // If the signup is successful, the sessionToken will be set in localStorage
  User.signup = function(signupData) {
    var deferred = $q.defer();
    var promise = deferred.promise;

    var request = $http({
      method  : 'POST',
      url     : parseConfig.base_url + '/1/users',
      data    : JSON.stringify(signupData),
      headers : {
        'X-Parse-Application-Id': parseConfig.appid,
        'X-Parse-REST-API-Key': parseConfig.rest_key,
        'Content-Type': 'application/json'
      }
    })
    .success(function(result) {
      currentUser = result;
      $localStorage.sessionToken = result.sessionToken;
      deferred.resolve(result);
    })
    .error(function(error) {
      deferred.reject(error);
    });

    promise.success = function(fn) {
      promise.then(fn);
      return promise;
    }

    promise.error = function(fn) {
      promise.then(null, fn);
      return promise;
    }

    return promise;
  }

  // Logs the user into Parse
  // returns .success() upon successful login,
  //         .error() otherwise
  // If the login is successful, the sessionToken will be set in localStorage
  User.login = function(username, password) {
    var deferred = $q.defer();
    var promise = deferred.promise;

    var request = $http({
      method  : 'GET',
      url     : parseConfig.base_url + '/1/login?username=' + username + '&password=' + password,
      headers : {
        'X-Parse-Application-Id': parseConfig.appid,
        'X-Parse-REST-API-Key': parseConfig.rest_key,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .success(function(result) {
      currentUser = result;
      $localStorage.sessionToken = result.sessionToken;
      deferred.resolve(result);
    })
    .error(function(error) {
      deferred.reject(error);
    });

    promise.success = function(fn) {
      promise.then(fn);
      return promise;
    }

    promise.error = function(fn) {
      promise.then(null, fn);
      return promise;
    }

    return promise;
  }

  User.logout = function() {
    $localStorage.sessionToken = null;
    localStorage.removeItem('ngStorage-sessionToken');
    currentUser = null;
  }

  User.fetchFromParse = function(sessionToken) {
    var deferred = $q.defer();
    var promise = deferred.promise;

    var request = $http({
      method  : 'GET',
      url     : parseConfig.base_url + '/1/users/me',
      headers : {
        'X-Parse-Application-Id': parseConfig.appid,
        'X-Parse-REST-API-Key': parseConfig.rest_key,
        'X-Parse-Session-Token': sessionToken,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .success(function(result) {
      currentUser = result;
      deferred.resolve(result);
    })
    .error(function(error) {
      deferred.reject(error);
    });

    promise.success = function(fn) {
      promise.then(fn);
      return promise;
    }

    promise.error = function(fn) {
      promise.then(null, fn);
      return promise;
    }

    return promise;
  }

  User.currentUser = function() {
    var deferred = $q.defer();
    var promise = deferred.promise;

    // User is logged in
    if(currentUser) {
      deferred.resolve(currentUser);
    }
    // User was logged in, need to fetch details again
    else if($localStorage.sessionToken) {
      User.fetchFromParse($localStorage.sessionToken)
      .success(function(result) {
        currentUser = result;
        deferred.resolve(result);
      })
      .error(function(error) {
        deferred.reject(error);
      });
    }
    // User never logged in
    else {
      deferred.reject('Not logged in');
    }

    return promise;
  }

  User.updateParse = function(newData) {
    if(currentUser) {
      var newDataJSON = qs(newData);
      $http({
        method  : 'POST',
        url     : parseConfig.base_url + '/1/functions/UpdateUserSettings',
        data    : newDataJSON,
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'X-Parse-Session-Token': currentUser.sessionToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    }
  }

  User.update = function(newData, skipParse) {
    if(skipParse === undefined) skipParse = false;

    if(currentUser) {
      for(var key in newData) {
        currentUser[key] = newData[key];
      }

      // Update parse data
      // unless skipped
      if(!skipParse) {
        User.updateParse(newData);
      }

      return currentUser;
    }
  }

  User.getUserObj = function() {
    return currentUser;
  }

  return User;
}])

.factory('Transactions', ['$http', '$localStorage', '$q', 'parseConfig', function($http, $localStorage, $q, parseConfig) {
  var Transactions = {};

  // A list of transactions for the user
  var transactionList = [];

  // A list of incoming transactions that will be added to transactionList
  // This list is regularly emptied
  var newTransactionList = [];

  // Fetch transactions, either from localStorage or Parse
  Transactions.getTransactions = function() {

  }

  // Adds transaction to newTransactionList
  Transactions.addTransaction = function(user, transaction) {
    var deferred = $q.defer();
    var promise = deferred.promise;

    if(!user.sessionToken) {
      deferred.reject('Invalid user');
    }

    var request = $http({
      method  : 'POST',
      url     : parseConfig.base_url + '/1/functions/AddTransaction',
      data    : 'amount=' + transaction,
      headers : {
        'X-Parse-Application-Id': parseConfig.appid,
        'X-Parse-REST-API-Key': parseConfig.rest_key,
        'X-Parse-Session-Token': user.sessionToken,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .success(function(result) {
      newTransactionList.push(result);
      deferred.resolve(result);
    })
    .error(function(error) {
      deferred.reject(error);
    });

    promise.success = function(fn) {
      promise.then(fn);
      return promise;
    }

    promise.error = function(fn) {
      promise.then(null, fn);
      return promise;
    }

    return promise;
  }

  // Appends new transactions to transactionList
  // and removes them from newTransactionList
  Transactions.addNewTransactions = function() {

  }

  return Transactions;
}])

.factory('Intercom', ['$window', function($window) {
  var hasAuthed = false;
  var IntercomService = {};

  IntercomService.authenticate = function(email) {
    hasAuthed = true;
    return Intercom('boot', {
      app_id: "ay3p9jeb",
      email: email,
      last_request_at: Date.now
    });
  }

  IntercomService.update = function(email) {
    if(hasAuthed) {
      return Intercom('update', { email: email });
    }
    else {
      return IntercomService.authenticate(email);
    }
  }

  IntercomService.trackEvent = function(eventName, metadata) {
    if(metadata === undefined) metadata = {};
    return Intercom('trackEvent', eventName, metadata);
  }

  IntercomService.shutdown = function() {
    return Intercom('shutdown');
  }

  return IntercomService;
}]);
