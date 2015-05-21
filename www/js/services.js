angular.module('budgie.services', ['ngStorage', 'budgie.config'])

.factory('User', ['$http', '$localStorage', '$q', 'parseConfig', function($http, $localStorage, $q, parseConfig) {
  var currentUser;
  var userBuckets;

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
    userBuckets = null;
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

    var usersDate = new Date();

    // User is logged in
    if(currentUser) {
      currentUser.todaysDate = usersDate;
      deferred.resolve(currentUser);
    }
    // User was logged in, need to fetch details again
    else if($localStorage.sessionToken) {
      User.fetchFromParse($localStorage.sessionToken)
      .success(function(result) {
        currentUser = result;
        currentUser.todaysDate = usersDate;
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

  User.getUserBucketsObj = function() {
    return userBuckets;
  }

  User.fetchBucketsFromParse = function(sessionToken) {
    var deferred = $q.defer();
    var promise = deferred.promise;

    var request = $http({
        method  : 'POST',
        url     : 'https://api.parse.com/1/functions/GetUserBuckets',
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'X-Parse-Session-Token': sessionToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      .success(function(result) {
        userBuckets = result.result;
        deferred.resolve(userBuckets);
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

  User.getUserBuckets = function() {
    var deferred = $q.defer();
    var promise = deferred.promise;

    // User is logged in
    if(userBuckets) {
      deferred.resolve(userBuckets);
    }
    // User was logged in, need to fetch details again
    else if($localStorage.sessionToken) {
      User.fetchBucketsFromParse($localStorage.sessionToken)
      .success(function(result) {
        userBuckets = result;
        deferred.resolve(userBuckets);
      })
      .error(function(error) {
        deferred.reject(error);
      });
    }
    // User never logged in
    else {
      deferred.reject('Not logged in');
    }

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

  User.updateBuckets = function(newData, skipParse) {
    if(skipParse === undefined) skipParse = false;

    if(userBuckets) {
      for(var key in newData) {
        if(key == 'bucketGoal')
          userBuckets['goal'] = newData[key];
        else if(key == 'bucketName')
          userBuckets['title'] = newData[key];
        else
          userBuckets[key] = newData[key];
      }

      // Update parse data
      // unless skipped
      if(!skipParse) {
        User.updateParse(newData);
      }

      return userBuckets;
    }
  }

  return User;
}])

.factory('Transactions', ['$http', '$localStorage', '$q', 'parseConfig', 'User', 'Currency', function($http, $localStorage, $q, parseConfig, User, Currency) {
  var Transactions = {};

  // A list of transactions for the user
  var transactionList = [];

  // A list of incoming transactions that will be added to transactionList
  // This list is regularly emptied
  var newTransactionList = [];

  // Fetch transactions, either from localStorage or Parse
  Transactions.getTransactions = function(user) {
    var deferred = $q.defer();
    var promise = deferred.promise;

    if(transactionList.length > 0) {
      deferred.resolve(transactionList);
    }
    else {
      Transactions.fetchTransactionsFromParse(user.sessionToken)
      .success(function(transactions) {
        transactionList = transactions;
        deferred.resolve(transactionList);
      })
      .error(function(error) {
        deferred.reject(error);
      });
    }

    return promise;
  }

  Transactions.fetchTransactionsFromParse = function(sessionToken) {
    var deferred = $q.defer();
    var promise = deferred.promise;

    var request = $http({
        method  : 'POST',
        url     : parseConfig.base_url + '/1/functions/GetAllUserTransactions',
        headers : {
          'X-Parse-Application-Id': parseConfig.appid,
          'X-Parse-REST-API-Key': parseConfig.rest_key,
          'X-Parse-Session-Token': sessionToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      .success(function(result) {
        transactionList = result.result;
        deferred.resolve(transactionList);
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
      var newTransaction = result.result.transaction;
      transactionList.unshift(newTransaction);
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

  Transactions.removeTransaction = function(user, transId) {
    var deferred = $q.defer();
    var promise = deferred.promise;

    if(!user.sessionToken) {
      deferred.reject('Invalid user');
    }

    var request = $http({
      method  : 'POST',
      url     : parseConfig.base_url + '/1/functions/DeleteTransaction',
      data    : 'id=' + transId,
      headers : {
        'X-Parse-Application-Id': parseConfig.appid,
        'X-Parse-REST-API-Key': parseConfig.rest_key,
        'X-Parse-Session-Token': user.sessionToken,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .success(function(result) {
      for(var i in transactionList) {
        var trans = transactionList[i];
        if(trans.objectId == transId) {
          transactionList.splice(i, 1);
        }
      }
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
    hasAuthed = false;
    return Intercom('shutdown');
  }

  return IntercomService;
}])

.factory('Currency', ['$window', function($window) {
  var CurrencyService = {};
  var currentCurrency;

  var currencies = [
    {
      'currency': 'usd',
      'character': '$',
      'placeholder': '00.00',
      'decimalPlaces': 2,
      'centsToWhole': 100,
      'icon': 'fa-usd',
      'format': 'left',
      'sliderUnit': 1
    },
    {
      'currency': 'gbp',
      'character': '£',
      'placeholder': '00.00',
      'decimalPlaces': 2,
      'centsToWhole': 100,
      'icon': 'fa-gbp',
      'format': 'left',
      'sliderUnit': 1
    },
    {
      'currency': 'euro',
      'character': '€',
      'placeholder': '00.00',
      'decimalPlaces': 2,
      'centsToWhole': 100,
      'icon': 'fa-euro',
      'format': 'left',
      'sliderUnit': 1
    },
    {
      'currency': 'yen',
      'character': '¥',
      'placeholder': '00.00',
      'decimalPlaces': 2,
      'centsToWhole': 100,
      'icon': 'fa-yen',
      'format': 'left',
      'sliderUnit': 1
    },
    {
      'currency': 'lira',
      'character': '₺',
      'placeholder': '00.00',
      'decimalPlaces': 2,
      'centsToWhole': 100,
      'icon': 'fa-try',
      'format': 'left',
      'sliderUnit': 1
    }
  ];

  CurrencyService.getCurrencies = function() {
    return currencies;
  }

  CurrencyService.setCurrency = function(currency) {
    currentCurrency = this.getCurrency(currency);
  }

  CurrencyService.getCurrency = function(key) {
    if(!key) return currentCurrency;
    for(var i in currencies) {
      var currency = currencies[i];
      if(currency.currency == key) {
        return currency;
      }
    }

    return currencies[0];
  };

  CurrencyService.toStorageFormat = function(amount, currency) {
    if(typeof currency === 'undefined') currency = currentCurrency || currencies[0];
    var multiplier = currency.centsToWhole;
    return amount * multiplier;
  }

  CurrencyService.toWhole = function(amountInCents, currency) {
    if(typeof currency === 'undefined') currency = currentCurrency || currencies[0];
    var divisor = currency.centsToWhole;
    return parseFloat(amountInCents / divisor).toFixed(currency.decimalPlaces);
  }

  CurrencyService.toDisplay = function(amountInCents) {
    amountInCents = Math.round(amountInCents);
    if(currentCurrency) {
      var negativeSymbol = '';
      if(amountInCents < 0) {
        negativeSymbol = '-';
        amountInCents = Math.abs(amountInCents);
      }
      return negativeSymbol + currentCurrency.character + CurrencyService.toWhole(amountInCents, currentCurrency);
    }
  }

  return CurrencyService;
}]);
