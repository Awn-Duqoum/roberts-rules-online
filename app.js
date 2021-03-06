'use strict';

// Declare app level module which depends on views, and components
angular
  .module('myApp', [
    'ngRoute',
    'flux',
    'btford.socket-io',
    'auth0',
    'angular-storage',
    'angular-jwt'
  ])
  .constant('QUEUES', {
    'NEW_POINT': 'New Point',
    'DIRECT_POINT': 'Direct Point',
    'CLARIFICATION': 'Clarification',
    'FOR': 'For',
    'AGAINST': 'Against',
    'ABSTAIN': 'Abstain'
  })
  .factory('mySocket', function(socketFactory) {
    return socketFactory();
  })
  .config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/meeting', {
        templateUrl: 'meeting/meeting.html',
        controller: 'MeetingCtrl'
      })
      .when('/login', {
        templateUrl: 'login/login.html',
        controller: 'LoginCtrl'
      })
      .otherwise({
        redirectTo: '/meeting'
      });
  }])
  .config(['fluxProvider', function(fluxProvider) {
    fluxProvider.setImmutableDefaults({ immutable: false });
  }])
  .config(['authProvider', 'jwtInterceptorProvider', '$httpProvider',
      function(authProvider, jwtInterceptorProvider, $httpProvider) {

    authProvider.init({
      domain: 'speaker.auth0.com',
      clientID: 'T5e6DPbYjiuXVCcJeYfcdEgEx8xxNKOW',
      callbackUrl: location.href,
      loginUrl: '/login'
    });

    jwtInterceptorProvider.tokenGetter = ['store', function(store) {
      // Return the saved token
      return store.get('token');
    }];

    $httpProvider.interceptors.push('jwtInterceptor');

    authProvider.on('loginSuccess', function($location, profilePromise, idToken, store) {
      console.log("Login Success");
      profilePromise.then(function(profile) {
        store.set('profile', profile);
        store.set('token', idToken);
      });
      $location.path('/meeting');
    });

    authProvider.on('loginFailure', function() {
       // Error Callback
    });
  }])
  .run(function($rootScope, $location, $http, QUEUES, mySocket, auth, store, jwtHelper, meetingActions) {
    $rootScope.QUEUES = QUEUES;
    $rootScope.$on( "$routeChangeStart", function(evt) {
      if(!auth.isAuthenticated) {
        $location.path("/login");
      }
    });

    $rootScope.$on('$locationChangeStart', function() {
      var token = store.get('token');
      if (token) {
        if (!jwtHelper.isTokenExpired(token)) {
          if (!auth.isAuthenticated) {
            auth.authenticate(store.get('profile'), token);
          }
        } else {
          // Either show the login page or use the refresh token to get a new idToken
          $location.path('/login');
        }
      }
    });

    auth.hookEvents();

    mySocket.on('connection', function(socket) {
      console.log('Connected');
    });

    mySocket.on('pull', function(msg) {
      console.log('Pulling');
      $http.get('/api/v1/meeting')
        .then(function(res) {
          meetingActions.setState(res.data);
        });
    });
  });
