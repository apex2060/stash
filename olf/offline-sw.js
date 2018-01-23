//When changes to any cached content is made, update this version number.
let version = '0.34';

var initFiles = [
	'/offline.html',
	'/offline.css',
	'/offline.js',
]

self.addEventListener('install', e => {
  let timeStamp = Date.now();
  e.waitUntil(
    caches.open(version).then(cache => {
      return cache.addAll(initFiles)
      .then(() => self.skipWaiting());
    })
  )
});

self.addEventListener('activate', function(event) {
  var cacheWhitelist = [version];

  event.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(keyList.map(function(key) {
        if (cacheWhitelist.indexOf(key) === -1) {
          return caches.delete(key);
        }
      }));
    })
  );
});

self.addEventListener('activate',  event => {
  event.waitUntil(self.clients.claim());
});


				// self.addEventListener('fetch', event => {
				//   event.respondWith(
				//     caches.match(event.request, {ignoreSearch:true}).then(response => {
				//       return response || fetch(event.request);
				//     })
				//   );
				// });

// self.addEventListener('fetch', function(event) {
//   event.respondWith(
//     caches.match(event.request).then(function(resp) {
//       return resp || fetch(event.request).then(function(response) {
//         return caches.open(version).then(function(cache) {
//           cache.put(event.request, response.clone());
//           return response;
//         });  
//       });
//     })
//   );
// });