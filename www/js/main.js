// if('serviceWorker' in navigator) {
// 	navigator.serviceWorker.register('app-sw_js', { scope: '/component/' })
// 	.then(function(registration) {
// 		console.log('Service Worker Registered');
// 	});
// 	navigator.serviceWorker.ready
// 	.then(function(registration) {
// 		console.log('Service Worker Ready');
// 		document.title = 'Mobile Ninja!';
// 	});
// }


var it = {};
var app = angular.module('app', ['ngMaterial','firebase','ngRoute'])
app.config(function($mdThemingProvider, $locationProvider, $routeProvider){
	$locationProvider.hashPrefix('');
	$mdThemingProvider.theme('default')
	.primaryPalette('pink')
	.accentPalette('blue');
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
		host: 'https://app.stashmob.com',
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
			//google, facebook...
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
			tools.loadData();
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
		},
		loadCtrl: function(view){
			var deferred = $q.defer();
			$http.get('modjs_'+view).then(function(r){
				eval('window.js'+mod+'='+r.data);
				window['js'+view].init();
				deferred.resolve();
			})
			return deferred.promise;
		},
		loadData: function(){
			Auth.init().then(function(user){
				var stuCol = [{
					name: 'private',
					path: 'student_private',
					query: ['createdBy', '==', user.uid]
				},{
					name: 'data',
					path: 'student_data',
					query: ['parent', '==', user.uid]
				}]
				$rootScope.fireStu = Firestore(stuCol);
				$rootScope.fireStu.list().then(function(data){
					$scope.children = data;
				})
			})
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
			$http.get(config.origin+'/cloud/mongo/adventures').then(function(r){
				var adv = $scope.adventures = r.data;
				var c = Math.floor(Math.random() * adv.length);
				console.log(c);
				$scope.campaign = $scope.adventures[c];
			})
			
			var ref = firebase.database().ref().child("ud/data/market");
			$scope.market = $firebaseArray(ref);
		},
	}
	js.init();
	it.HomeCtrl = $scope;
})
// app.controller('HomeCtrl', function HomeCtrl($rootScope, $scope, $http, config, Auth, Firestore){
// 	var js = $scope.js = {
// 		init: function(){
// 			$scope.message = 'Welcome to the past.'
// 		},
// 		map: function(){
// 			alert('map')
// 			var map;
// 			document.addEventListener("deviceready", function() {
// 				var div = document.getElementById("map_canvas");

// 				// Initialize the map view
// 				map = plugin.google.maps.Map.getMap(div);

// 				// Wait until the map is ready status.
// 				map.addEventListener(plugin.google.maps.event.MAP_READY, onMapReady);
// 			}, false);

// 			function onMapReady() {
// 				var button = document.getElementById("button");
// 				button.addEventListener("click", onButtonClick);
// 			}

// 			function onButtonClick() {

// 				// Move to the position with animation
// 				map.animateCamera({
// 					target: { lat: 37.422359, lng: -122.084344 },
// 					zoom: 17,
// 					tilt: 60,
// 					bearing: 140,
// 					duration: 5000
// 				}, function() {

// 					// Add a maker
// 					map.addMarker({
// 						position: { lat: 37.422359, lng: -122.084344 },
// 						title: "Welecome to \n" +
// 							"Cordova GoogleMaps plugin for iOS and Android",
// 						snippet: "This plugin is awesome!",
// 						animation: plugin.google.maps.Animation.BOUNCE
// 					}, function(marker) {

// 						// Show the info window
// 						marker.showInfoWindow();

// 						// Catch the click event
// 						marker.on(plugin.google.maps.event.INFO_CLICK, function() {

// 							// To do something...
// 							alert("Hello world!");

// 						});
// 					});
// 				});
// 			}
// 		}
// 	}
// 	js.init();
// 	it.HomeCtrl = $scope;
// })
app.controller('NoteCtrl', function NoteCtrl($scope, $http, $mdToast, config, Auth, Firestore){
	var js = $scope.js = {
		init: function(){
			var subjects = ['English','Math','Science','Something Else','Another Subject']
			$scope.subjects = subjects.map(function(s,i){return {title:s,i:i}})
			js.reset();
		},
		reset: function(){
			$scope.note = {children: []};
		},
		upload: function(){
			cloudinary.openUploadWidget({cloud_name: 'overturelearning', upload_preset: 'portfolio', sources: ['local','camera'], theme:'minimal'}, function(error, result) {
				var img = result[0];
					img.src = img.secure_url;
				$scope.$apply(function(){
					$scope.note.img = img;
				})
			});
		},
		// upload: function(event){
		// 	var files = event.target.files;
		// 	for (var i = 0; i < files.length; i++) {
		// 		var file = files[i];
		// 		var reader = new FileReader();
		// 		reader.onload = $scope.js.load; 
		// 		reader.readAsDataURL(file);
		// 	}
		// },
		// load: function(event){
		// 	$scope.$apply(function() {
		// 		$scope.note.img = event.target.result;
		// 	});
		// },
		save: function(){
			$scope.note.createdOn = new Date().toISOString();
			$scope.note.createdBy = $scope.user.uid;
			$scope.note && $scope.note.children && 
			$scope.note.children.forEach(function(childId, i){
				$scope.fireStu.get(childId).then(function(child){
					child.private.notes = child.private.notes || [];
					child.private.notes.push($scope.note);
					$scope.fireStu.save('private', child);
					if(i == $scope.note.children.length-1){
						js.reset();
						$mdToast.show(
							$mdToast.simple()
							.textContent('Note Saved')
							.hideDelay(3000)
						);
					}
				})
			})
		},
		search: function(qry){
			return $scope.children.filter(function(c){
				return angular.toJson(c).toLowerCase().indexOf(qry.toLowerCase()) != -1;
			});
		},
	}
	js.init();
	it.NoteCtrl = $scope;
})
app.controller('ReceiptCtrl', function ReceiptCtrl($scope, $http, config, Auth, Firestore, $mdDialog){
	var js = $scope.js = {
		init: function(){
			var budgets = ['STEM','CORE','FLEX']
			$scope.budgets = budgets.map(function(s,i){return {title:s,i:i}})
			$scope.receipt = {};
		},
		upload: function(){
			cloudinary.openUploadWidget({cloud_name: 'overturelearning', upload_preset: 'receipt', sources: ['local','camera'], theme:'minimal'}, function(error, result) {
				var img = result[0];
					img.src = img.secure_url;
				$scope.$apply(function(){
					$scope.receipt.img = img;
				})
			});
		},
		line: {
			save: function(){
				//do some quick validation logic
				$scope.receipt.lines = $scope.receipt.lines || [];
				$scope.receipt.lines.push($scope.line);
				js.line.dot($scope.line);
				delete $scope.line;
				$mdDialog.hide();
			},
			cancel: function(){
				$mdDialog.cancel();
			},
			set: function(event){
				$scope.nlEvent = event;
				$scope.line = {stats: {
					top:	event.originalEvent.offsetY,
					left:	event.originalEvent.offsetX,
					width:	$(event.target).width(),
					height: $(event.target).height()
				}};
				
				$mdDialog.show({
					scope: $scope,
					preserveScope: true,
					templateUrl: 'receipt.dialog',
					parent: angular.element(document.body),
					targetEvent: event
				})
			},
			dot: function(line){
				var dot = $('<div class="dot"></div>').css({
					top: line.stats.top,
					left: line.stats.left,
				})
				$($scope.nlEvent.target).parent().append(dot)
			},
		},
		save: function(){
			$http.post('/cloud/receipt', $scope.receipt).then(function(r){
				$mdToast.show(
					$mdToast.simple()
					.textContent('Receipt Submitted')
					.hideDelay(3000)
				);
			})
		},
		search: function(qry){
			return $scope.account.children.filter(function(c){
				return angular.toJson(c).toLowerCase().indexOf(qry.toLowerCase()) != -1;
			});
		}
	}
	js.init();
	it.ReceiptCtrl = $scope;
})
app.controller('ChildCtrl', function ChildCtrl($scope, $http, $location, $routeParams, config, Auth){
	var js = $scope.js = {
		init: function(){
			Auth.init().then(function(user){
				$scope.fireStu.get($routeParams.id).then(function(data){
					$scope.child = data;
				})
			})
			// Auth.init().then(function(){
			// 	db.collection('student_private').doc($routeParams.id).get().then((doc) => {
			// 		$scope.$apply(function(){
			// 			$scope.child = doc;
			// 		})
			// 	});
			// 	db.collection('student_data').doc($routeParams.id).get().then((doc) => {
			// 		$scope.$apply(function(){
			// 			$scope.child_data = doc;
			// 		})
			// 	});
			// })
		}
	}
	js.init();
	it.ChildCtrl = $scope;
})