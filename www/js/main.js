/*
	global app, angular, firebase, google, navigator, $script, localStorage
*/

var it = {};
var app = angular.module('app', ['ngMaterial','firebase','ngRoute','ngAnimate'])
app.config(function($mdThemingProvider, $locationProvider, $routeProvider){
	$locationProvider.hashPrefix('');
	$mdThemingProvider.theme('default')
	.primaryPalette('blue')
	.accentPalette('grey');
	$routeProvider
	.when('/:view', {
		controller: 'SiteCtrl',
		templateUrl: function($routeParams){
			return 'views/'+$routeParams.view+'.html';
		}
	})
	.when('/:view/:id', {
		controller: 'SiteCtrl',
		templateUrl: function($routeParams){
			return 'views/'+$routeParams.view+'.html';
		}
	})
	.otherwise({
		redirectTo: '/home'
	});
})

app.factory('config', function(){
	var config = {
		host: 'https://dashboard.stashmob.co',
		clientId: '',
		firebase: {
			apiKey: "AIzaSyArptSeFJqZ9DHfRPaYhM4Zqm-wotfFt_A",
			authDomain: "stashmob-16f57.firebaseapp.com",
			databaseURL: "https://stashmob-16f57.firebaseio.com",
			projectId: "stashmob-16f57",
			storageBucket: "stashmob-16f57.appspot.com",
			messagingSenderId: "738604374084"
		},
		stripe: 			'',
		cloudinary: {
			cloudName:		'stashmob-co',
			uploadPreset:	'mainSite'
		}
	}
	firebase.initializeApp(config.firebase);
	window.db = firebase.firestore();
	return config;
})
//combines multiple collections into 1 iterable object which parts can each be saved
app.factory('Firestore', function($q, Auth){
	//[{name,path,query}]
	var firestore = {};
	firestore.collections = {};
	
	function hash(str) {
		var hash = 0, i, chr;
		if (str.length === 0) return hash;
		for (i = 0; i < str.length; i++) {
			chr   = str.charCodeAt(i);
			hash  = ((hash << 5) - hash) + chr;
			hash |= 0;
		}
		return hash;
	}
	function Collection(collections){
		var fs = this;
		fs.sibblings = firestore.collections;
		fs.collections = collections;
		fs.data = {};
		fs.defer = $q.defer();
		fs.promise = fs.defer.promise;
		fs.convert = function(){
			fs.data = Object.keys(fs.data).map(function(key){
				fs.data[key].id = key;
				return fs.data[key];
			})
			fs.defer.resolve(fs.data);
		}
		fs.list = function(){
			if(!fs.start){
				fs.start = true;
				fs.collections.forEach(function(collection, i){
					db.collection(collection.path).where(...collection.query).get().then((qs) => {
						qs.forEach((doc) => {
							fs.data[doc.id] = fs.data[doc.id] || {};
							fs.data[doc.id][collection.name] = doc.data();
						})
						if(i == fs.collections.length-1)
							fs.convert();
					})
				})
			}
			return fs.promise;
		}
		fs.save = function(name, item){
			var deferred = $q.defer();
			var c = fs.collections.find(function(c){return c.name == name});
			var iRef = db.collection(c.path).doc(item.id);
			item = item || {};
			item[name] = item[name] || {};
			Auth.init().then(function(user){
				item[name].updatedBy = user.uid;
			})
			iRef.set(item[name]).then(function(r){
				deferred.resolve(r);
			}).catch(function(e){
				deferred.reject(e);
			})
			return deferred.promise;
		}
		fs.get = function(id){
			var deferred = $q.defer();
			fs.list().then(function(data){
				deferred.resolve(data.find(function(item){return item.id == id;}))
			})
			return deferred.promise;
		}
		fs.list();
	}

	return function(collections){
		var h = hash(angular.toJson(collections));
		firestore.collections[h] = firestore.collections[h] || new Collection(collections);
		return firestore.collections[h];
	}
})
app.factory('Auth', function($rootScope, $q, $firebaseAuth, $firebaseObject){
	console.log('auth called')
	var auth = {
		login: function(method){
			$firebaseAuth().$signInWithPopup(method);
		},
		init: function(){
			//online or offline...
			return auth.online();
		},
		offline: function(){
			
		},
		online: function(){
			if(!auth.defer)
				auth.defer = $q.defer();
			$firebaseAuth().$onAuthStateChanged(function(user){
				if(user && user.uid){
					var ref = firebase.database().ref().child('site/public/roles').child(user.uid);
					var obj = $firebaseObject(ref);
					obj.$loaded().then(function(){
						user.roles = obj || {};
						user.is = function(role){
							return !role || role=='all' || !!user.roles[role]
						}
						user.jwt = function(){
							return firebase.auth().currentUser.getToken(true)
						}
						$rootScope.user = user;
						$q.all([auth.profile(user), auth.account(user)]).then(function(arr){
							auth.defer.resolve($rootScope.user);
						})
					});
				}
			})
			return auth.defer.promise;
		},
		profile: function(user){
			var deferred = $q.defer();
			if($rootScope.profile && $rootScope.profile.displayName)
				deferred.resolve($rootScope.profile);
			else{
				var profileRef = firebase.database().ref().child("account/public").child(user.uid);
				$rootScope.profile = $firebaseObject(profileRef);
				$rootScope.profile.$loaded(function(p){
					if(p.displayName){
						deferred.resolve()
					}else{
						$rootScope.profile.displayName = user.displayName.toLowerCase();
						$rootScope.profile.photoURL = user.photoURL;
						$rootScope.profile.$save().then(function(){
							deferred.resolve($rootScope.profile);
						})
					}
				})
			}
			return deferred.promise;
		},
		account: function(user){
			var deferred = $q.defer();
			if($rootScope.account && $rootScope.account.displayName)
				deferred.resolve($rootScope.account);
			else{
				var accountRef = firebase.database().ref().child("account/private").child(user.uid);
				$rootScope.account = $firebaseObject(accountRef);
				$rootScope.account.$loaded(function(act){
					if(act.displayName){
						deferred.resolve()
					}else{
						$rootScope.account.displayName = user.displayName;
						$rootScope.account.email = user.email;
						$rootScope.account.$save().then(function(){
							deferred.resolve($rootScope.account);
						})
					}
				})
			}
			return deferred.promise;
		}
	}
	return auth;
})
//Cloudinary Transformations to Images
app.directive('clSrc', function($timeout) {
	return {
		restrict: 'A',
		scope: { clSrc: '@'},
		link: function(scope, ele, attrs) {
			scope.attrs = attrs;
			var tsrc, src;
			function transform(attrs){
				it.a=attrs;
				var tlKeys = Object.keys(attrs)
				tlKeys = tlKeys.filter(function(key){
					return key.indexOf('transform') == 0
				})
				var transform = ''
				tlKeys.forEach(function(key, i){
					var val = attrs[key];
					transform += key.replace('transform','').toLowerCase() + '_' + val
					if(i != tlKeys.length - 1)
						transform += ','
				})
				if(tlKeys.length && !attrs['transformC'])
					transform += ',c_fill'
				if(attrs['auto']){
					if(tlKeys.length)
						transform += ','
					transform += 'g_auto,q_auto,f_auto'
				}
				
				var clKeys = Object.keys(attrs)
				clKeys = clKeys.filter(function(key){
					return key.indexOf('constrain') == 0
				})
				var constrain = ''
				clKeys.forEach(function(key, i){
					var val = attrs[key];
					constrain += key.replace('constrain','').toLowerCase() + '_' + val
					if(i != clKeys.length - 1)
						constrain += ','
				})
				if(clKeys.length && !attrs['constrainC'])
					constrain += ',c_fill'
				if(constrain.length)
					transform += '/'+constrain
					
				return transform;
			}
			scope.$watch('clSrc', function(val) {
				if(val){
					tsrc = val.split('upload')
					src = tsrc[0]+'upload/'+transform(attrs)+tsrc[1]
					$(ele).attr("src", src);
				}
			})
			scope.$watch('attrs', function(newVal, oldVal) {
				// console.log('changed');
				if(tsrc){
					src = tsrc[0]+'upload/'+transform(newVal)+tsrc[1]
					$(ele).attr("src", src);
				}
			}, true);
		}
	};
});
app.controller('SiteCtrl', function SiteCtrl($rootScope, $scope, $firebaseObject, $routeParams, $http, $q, config, Auth, Firestore){
	$rootScope.params = $routeParams;
	$rootScope.auth = Auth;
	var tools = $rootScope.rootTools = {
		init: function(){
			Auth.init();
			tools.register().then(function(device){
				$rootScope.device = device;
			})
		},
		register: function(){
			var deferred = $q.defer();
			var device = localStorage.getItem('device') || '{}';
				device = angular.fromJson(device);
			if(device.deviceId){
				deferred.resolve(device);
			}else{
				$http.get(config.host+'/cloud/register/main').then(function(r){
					device = r.data;
					localStorage.setItem('device', angular.toJson(device))
					deferred.resolve(device);
				})
			}
			return deferred.promise;
		}
	}
	tools.init();
	it.SiteCtrl = $scope;
})
app.controller('SettingCtrl', function SettingCtrl($scope, $http, config){
	var js = $scope.js = {
		init: function(){
			
		},
		pushNotification: {
			init: function(){
				console.log('pn init')
				navigator.serviceWorker.register('firebase-messaging-sw_js').then((registration) => {
					console.log('sw registered')
					js.messaging = firebase.messaging();
					js.messaging.useServiceWorker(registration)
					js.messaging.getToken()
					.then(function(token) {
						console.log('init token')
						if(token){
							$scope.fcm = {status:'token'}
							js.pushNotification.register(token);
						}else{
							$scope.fcm = {status:'noToken'}
							js.pushNotification.link();
						}
						$scope.$apply();
					}, function(e){
						console.log('error')
						$scope.fcm = {status:'error', error:e}
						$scope.$apply();
					})
				})
				// if(localStorage.getItem('deviceId')){
				// 	var deviceRef = firebase.database().ref('account/private').child($scope.user.uid).child('remote/devices').child(localStorage.getItem('deviceId'));
				// 	var device = $firebaseObject(deviceRef);
				// 	device.$bindTo($scope, "device");
				// }
			}, 
			link: function(){
				js.messaging.requestPermission()
				.then(function() {
					$scope.fcm = {status:'granted'}
					js.pushNotification.token();
					$scope.$apply();
				})
				.catch(function(e){
					$scope.fcm = {status:'denied', error:e}
					$scope.$apply();
				});
			},
			register: function(token){
				if($scope.device.token != token){
					$scope.device.token = token;
					$http.post(config.host+'/cloud/device', $scope.device);
				}
			},
			token: function(){
				console.log('fn token')
				js.messaging.getToken()
				.then(function(currentToken) {
					if(currentToken){
						$scope.fcm = {status:'token'}
						js.pushNotification.register(currentToken);
					}else{
						//no token: clear from server... request new token...
						$scope.fcm = {status:'noToken'}
						$scope.$apply();
					}
				})
				.catch(function(e) {
					$scope.fcm = {status:'error', error:e}
					$scope.$apply();
				});
			}
		},
	}
	js.init();
	it.SettingCtrl = $scope;
})
app.controller('HomeCtrl', function HomeCtrl($scope, $firebaseArray, $http, config){
	var js = $scope.js = {
		init: function(){
			$scope.account = {
				coins: 120
			}
			
			$http.get(config.host+'/cloud/api-adventures').then(function(r){
				var adv = $scope.adventures = r.data;
				var c = Math.floor(Math.random() * adv.length);
				$scope.campaign = $scope.adventures[c];
			}, function(e){
				// alert(e)
			})
			
			var ref = firebase.database().ref().child("ud/data/market");
			$scope.market = $firebaseArray(ref);
			
			js.geo.init();
		},
		geo: {
			init: function(){
				document.addEventListener("deviceready", onDeviceReady, false);
				function onDeviceReady() {
					var onSuccess = function(position) {
					    // alert('Latitude: '          + position.coords.latitude          + '\n' +
					    //       'Longitude: '         + position.coords.longitude         + '\n' +
					    //       'Altitude: '          + position.coords.altitude          + '\n' +
					    //       'Accuracy: '          + position.coords.accuracy          + '\n' +
					    //       'Altitude Accuracy: ' + position.coords.altitudeAccuracy  + '\n' +
					    //       'Heading: '           + position.coords.heading           + '\n' +
					    //       'Speed: '             + position.coords.speed             + '\n' +
					    //       'Timestamp: '         + position.timestamp                + '\n');
					};
					
					// onError Callback receives a PositionError object
					//
					function onError(error) {
					    alert('code: '    + error.code    + '\n' +
					          'message: ' + error.message + '\n');
					}
					
					navigator.geolocation.getCurrentPosition(onSuccess, onError);
				}
			}
		}
	}
	js.init();
	it.HomeCtrl = $scope;
})

app.controller('LocCtrl', function LocCtrl($scope, $http, config){
	var js = $scope.js = {
		init: function(){
			js.locations.init();
		},
		locations: {
			init: function(){
				$scope.favorites = JSON.parse(localStorage.getItem('favorites')) || [];
				alert(JSON.stringify($scope.favorites));
				js.locations.update();
				$scope.$on('$routeChangeStart', function(next, current) { 
					js.locations.update();
				});
			},
			update: function(){
				navigator.geolocation.getCurrentPosition(function(pos){
					js.locations.load(pos.coords, $scope.params.id)
					// js.locations.display(pos.coords);
				})
			},
			load: function(geo, category){
				$scope.category = category;
				$http.post(config.host+'/cloud/api-locations', {geo: {latitude: geo.latitude, longitude: geo.longitude},category}).then(function(r){
					$scope.locations = r.data.filter(l=>(l.industry==category));
					var origins = [new google.maps.LatLng(geo.latitude, geo.longitude)];
					var destinations = $scope.locations.map(loc=>{
						loc.favorite = ($scope.favorites.indexOf(loc._id) != -1)
						return new google.maps.LatLng(loc.geo.latitude, loc.geo.longitude)
					})
					var dm = new google.maps.DistanceMatrixService();
					dm.getDistanceMatrix({
						origins, destinations,
						travelMode: 'DRIVING',
						unitSystem: google.maps.UnitSystem.IMPERIAL
					}, result=>{
						result.rows[0].elements.forEach((elem, i)=>{
							$scope.locations[i].distance = elem.distance.text
						})
						$scope.$apply();
					})
				})
			},
			display: function(geo){
				var latLng = {lat: geo.latitude, lng: geo.longitude};
				$scope.map = $scope.map || new google.maps.Map(document.getElementById('map'), {
					center: latLng,
					zoom: 19
				});
			}
		},
		loc: {
			init: function(){
				js.loc.update();
				$scope.$on('$routeChangeStart', function(next, current) { 
					js.loc.update();
				});
			},
			update: function(){
				console.log('update')
				$http.get(config.host+'/cloud/api-locations/'+$scope.params.id).then(function(r){
					$scope.loc = r.data;	
				})
			},
			favorite: function(item){
				item.favorite = !item.favorite;
				if(item.favorite)
					$scope.favorites.push(item._id);
				else
					$scope.favorites.splice($scope.favorites.findIndex(i=>i==item._id))
				localStorage.setItem('favorites', JSON.stringify($scope.favorites))
			}
		},
		offer: {
			init: function(){
				js.offer.update();
			},
			update: function(){
				$http.get(config.host+'/cloud/api-offers/'+$scope.params.id).then(function(r){
					$scope.offers = r.data;	
				})
			},
			view: function(offer){
				$scope.offer = offer;
			},
			back: function(){
				if($scope.offer)
					js.offer.view();
				else
					window.history.back();
					// window.location = '#/location/'+$scope.params.id;
			}
		}
	}
	it.LocCtrl = $scope;
	js.init();
})
app.controller('AdventureCtrl', function LocCtrl($scope, $http, $routeParams, config){
	var js = $scope.js = {
		init: function(){
			$scope.favorites = JSON.parse(localStorage.getItem('favorites')) || [];
			alert(JSON.stringify($scope.favorites));
			
			$http.post(config.host+'/cloud/api-adventures/'+$routeParams.id).then(function(r){
				$scope.adventure = r.data;
				$scope.locations = r.data && r.data.locations;
				$scope.locations.forEach(loc=>{
					loc.favorite = ($scope.favorites.indexOf(loc._id) != -1)
				})
			})
		},
		loc:{
			favorite: function(item){
				item.favorite = !item.favorite;
				if(item.favorite)
					$scope.favorites.push(item._id);
				else
					$scope.favorites.splice($scope.favorites.findIndex(i=>i==item._id))
				localStorage.setItem('favorites', JSON.stringify($scope.favorites))
			}
		}
	}
	it.AdventureCtrl = $scope;
	js.init();
})

app.controller('MapCtrl', function MapCtrl($scope, $http, $routeParams, config){
	var js = $scope.js = {
		init: function(){
			js.map.init();
			$scope.$on('$destroy', ()=>{
				if($scope.updateTimer)
					window.clearTimeout($scope.updateTimer)
			})
		},
		hide: function(){
			$('.overlay').remove();
		},
		redeem: function(){
			firebase.auth().currentUser.getIdToken(true).then(function(idToken) {
				$http.post(config.host+'/cloud/api-redeem/'+$routeParams.id, {idToken}).then(response=>{
					$scope.debug = response.data;
				})
			})
		},
		map: {
			init: function(){
				document.addEventListener("deviceready", js.map.getPosition, false);
				// js.map.update();
			},
			getPosition: function(){
				navigator.geolocation.getCurrentPosition(function(position) {
					// alert('Latitude: '          + position.coords.latitude          + '\n' +
					// 'Longitude: '         + position.coords.longitude         + '\n' +
					// 'Altitude: '          + position.coords.altitude          + '\n' +
					// 'Accuracy: '          + position.coords.accuracy          + '\n' +
					// 'Altitude Accuracy: ' + position.coords.altitudeAccuracy  + '\n' +
					// 'Heading: '           + position.coords.heading           + '\n' +
					// 'Speed: '             + position.coords.speed             + '\n' +
					// 'Timestamp: '         + position.timestamp                + '\n');
					js.map.load(position.coords, $scope.params.id)
				}, function(error) {
					alert('code: '    + error.code    + '\n' +
					'message: ' + error.message + '\n');
				});
			},
			// update: function(){
			// 	navigator.geolocation.getCurrentPosition(function(pos){
			// 		js.map.load(pos.coords, $scope.params.id)
			// 	})
			// },
			load: function(geo, category){
				// alert('load')
				$http.get('https://dashboard.stashmob.co/cloud/mongo/locations?objectId='+$scope.params.id).then(function(r){
					// alert(JSON.stringify(r.data));
					$scope.loc = r.data;
					js.map.display(geo, $scope.loc);
				})
			},
			display: function(geo, loc){
				var latLng = new google.maps.LatLng(geo.latitude, geo.longitude);
				$scope.map = $scope.map || new google.maps.Map(document.getElementById('map'), {
					center: latLng,
					zoom: 17
				});
				$scope.map.setHeading(geo.heading);
				js.map.update();
				// js.map.current();
				// js.map.coins(loc);
			},
			update: function(){
				navigator.geolocation.getCurrentPosition(function(position) {
					var geo = position.coords;
					var latLng = new google.maps.LatLng(geo.latitude, geo.longitude);
					$scope.map.setCenter(latLng)
					$scope.map.setHeading(geo.heading)
					alert('heading: '+geo.heading)
					js.map.compas((deg)=>{
						alert('compas: '+deg)
					})
					$scope.updateTimer = window.setTimeout(js.map.update, 5000)
				})
			},
			compas: function(callback){
				//Compas
				if (window.DeviceOrientationEvent) {
					window.addEventListener('deviceorientation', function(eventData) {
						var compassdir;
						if(event.webkitCompassHeading)
							compassdir = event.webkitCompassHeading;  
						else 
							compassdir = event.alpha;
						callback(compassdir)
					});
				}
			},
			coins: function(loc){
				var latLng = {lat: loc.geo.latitude, lng: loc.geo.longitude};
				var icon = 'https://res.cloudinary.com/stashmob-co/image/upload/v1515889620/sbud4ibxy2mf43lvlqns.png';
				new google.maps.Marker({
					position: latLng,
					map: $scope.map,
					title: 'Coin Stash',
					icon
				});
			},
			current: function(){
				var icon = 'https://res.cloudinary.com/stashmob-co/image/upload/v1515899992/hmpxgrddorsqmd1dpcke.png';
				navigator.geolocation.getCurrentPosition(function(pos){
					var latLng = {lat: pos.coords.latitude, lng: pos.coords.longitude};
					$scope.myMarker = new google.maps.Marker({
						map: $scope.map,
						position: latLng,
						icon
					});
					// $scope.myPoint = new google.maps.Circle({
					// 	strokeColor: '#002a6a',
					// 	strokeOpacity: 1,
					// 	strokeWeight: 2,
					// 	fillColor: '#002a6a',
					// 	fillOpacity: 1,
					// 	map: $scope.map,
					// 	center: latLng,
					// 	radius: 2
					// });
					// $scope.myCircle = new google.maps.Circle({
					// 	strokeColor: '#2196f3',
					// 	strokeOpacity: 0.8,
					// 	strokeWeight: 2,
					// 	fillColor: '#2196f3',
					// 	fillOpacity: 0.35,
					// 	map: $scope.map,
					// 	center: latLng,
					// 	radius: 20
					// });
				});
			}
		}
	}
	it.MapCtrl = $scope;
	js.init();
})