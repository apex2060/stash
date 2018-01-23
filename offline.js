if('serviceWorker' in navigator) {
	navigator.serviceWorker.register('offline-sw.js', { scope: '/' })
	.then(function(registration) {
		console.log('Service Worker Registered');
	});
	navigator.serviceWorker.ready
	.then(function(registration) {
		console.log('Service Worker Ready');
		document.title = 'Stash Mob!';
	});
}


var it = {};
var app = angular.module('app', ['ngMaterial','firebase','ngRoute'])
app.config(function($mdThemingProvider, $routeProvider){
	$mdThemingProvider.theme('default')
	.primaryPalette('cyan')
	.accentPalette('pink');
	$routeProvider
	.when('/:view', {
		templateUrl: function($routeParams){
			return 'views/'+$routeParams.view+'.html';
		}
	})
	.when('/:view/:id', {
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
		origin: 'https://dashboard.stashmob.co',
		clientId: '',
		firebase: {
			apiKey: "AIzaSyArptSeFJqZ9DHfRPaYhM4Zqm-wotfFt_A",
			authDomain: "stashmob-16f57.firebaseapp.com",
			databaseURL: "https://stashmob-16f57.firebaseio.com",
			projectId: "stashmob-16f57",
			storageBucket: "",
			messagingSenderId: "738604374084"
		},
		stripe: 			'',
		cloudinary: {
			cloudName:		'stashmob-co',
			uploadPreset:	'mainSite'
		}
	}
	firebase.initializeApp(config.firebase);
	return config;
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

//Controllers
app.controller('SiteCtrl', function SiteCtrl($rootScope, $scope, $firebaseAuth, $firebaseObject, $routeParams, $http, $mdToast, $mdDialog, $mdSidenav, $timeout, config){
	$rootScope.params = $routeParams;
	$rootScope.auth = $firebaseAuth();
	var tools = $scope.tools = {
		init: function(){
			$rootScope.account = {
				coins: 200
			}
			tools.redeem();
		},
		view: function(){
			var view = $routeParams.view;
			// view = 'redeem';
			return 'offline-'+view;
		},
		redeem: function(){
			$scope.$on('$routeChangeStart', function(next, current) { 
				// Check if within proximity of business offering.
				//if so, open redeption page and issue coins.
				// $timeout(function(){
				// 	if($routeParams.view == 'directions')
				// 		window.location = '#!/redeem/'+$routeParams.id;
				// }, 20000)
			});
		}
	}
	$scope.tools.init();
})
app.controller('HomeCtrl', function HomeCtrl($scope, $firebaseArray, $http, config){
	console.log('HomeCtrl')
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
app.controller('LocCtrl', function LocCtrl($scope, $http, config){
	console.log('LocCtrl')
	console.log($scope)
	var js = $scope.js = {
		init: function(){
		},
		locations: {
			init: function(){
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
				var qry = {
					find: {
						geo: {
							$near: {
								$geometry: { 
									type: "Point",
		                            coordinates: [geo.longitude, geo.latitude] 
								},
								$minDistance: 1,
								$maxDistance: 15000,
							}
						}
					}
				}
				if(category)
					qry.find.industry = category;
				$http.post('https://dashboard.stashmob.co/cloud/mongo/locations', qry).then(function(r){
					$scope.locations = r.data;	
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
				$http.get('https://dashboard.stashmob.co/cloud/mongo/locations?objectId='+$scope.params.id).then(function(r){
					$scope.loc = r.data;	
				})
			}
		}
	}
	it.LocCtrl = $scope;
	js.init();
})
app.controller('AdventureCtrl', function LocCtrl($scope, $http, $routeParams, config){
	var js = $scope.js = {
		init: function(){
			$http.post(config.origin+'/cloud/mongo/adventures?objectId='+$routeParams.id).then(function(r){
				$scope.adventure = r.data;
				$scope.locations = r.data && r.data.locations;
			})
		}
	}
	it.AdventureCtrl = $scope;
	js.init();
})

app.controller('MapCtrl', function MapCtrl($scope, $http, config){
	var js = $scope.js = {
		init: function(){
			js.map.init();
		},
		hide: function(){
			$('.overlay').remove();
		},
		redeem: function(){
			window.location = '#!/redeem/'+$routeParams.id;
		},
		map: {
			init: function(){
				js.map.update();
			},
			update: function(){
				navigator.geolocation.getCurrentPosition(function(pos){
					js.map.load(pos.coords, $scope.params.id)
				})
			},
			load: function(geo, category){
				$http.get('https://dashboard.stashmob.co/cloud/mongo/locations?objectId='+$scope.params.id).then(function(r){
					$scope.loc = r.data;
					js.map.display(geo, $scope.loc);
				})
			},
			display: function(geo, loc){
				var latLng = {lat: geo.latitude, lng: geo.longitude};
				$scope.map = $scope.map || new google.maps.Map(document.getElementById('map'), {
					center: latLng,
					zoom: 17
				});
				js.map.setTilt(45);
				js.map.current();
				js.map.coins(loc);
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
	
console.log('Mobile Ninja')