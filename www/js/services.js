angular.module('budgie.services', ['ngStorage'])

.factory('ActiveUser', ['$window', '$localStorage', function(win, $localStorage) {
    var activeUser;
    return function(user) {
       if(user) {
        activeUser = user;
        $localStorage.sessionToken = user.sessionToken;
       }
       else if($localStorage.sessionToken) {
        activeUser = { 'sessionToken': $localStorage.sessionToken };
       }
       else if(user === null) {
        activeUser = null;
       }

       return activeUser;
    }
}])

.factory('Parse', ['$http', '$localStorage', function($http, $localStorage) {
    var baseUrl = "https://api.parse.com";
    var appId;
    var apiKey;
    var currentUser;

    return {
        config: function(data, success, error) {
          appId = data.appId;
          apiKey = data.apiKey;
          success();
        },
        signup: function(data, success, error) {
            $http.post(baseUrl + '/signin', data).success(success).error(error)
        },
        login: function(data, success, error) {
            $http.get(baseUrl + '/1/login?username=' + data.username + '&password=' + data.password).success(success).error(error)
        },
        logout: function(success) {
            changeUser({});
            delete $localStorage.token;
            success();
        }
    };
}])

.factory('IntercomAuthenticate', ['$window', function(win) {
    return function(userEmail) {
       Intercom('boot', {
          app_id: "ay3p9jeb",
          email: userEmail,
          last_request_at: Date.now
        });
    }
}])

.factory('IntercomTrackEvent', ['$window', function($window) {
    return function(eventName, metadata) {
        if(metadata === undefined) metadata = {};
        Intercom('trackEvent', eventName, metadata);
    }
}])

.factory('IntercomLogout', ['$window', function(win) {
    return function() {
       Intercom('shutdown');
    }
}]);
