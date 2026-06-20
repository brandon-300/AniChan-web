const CACHE_NAME = 'anichan-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/anime_info.html',
  '/anime.html',
  '/genre.html',
  '/type.html',
  '/status.html',
  '/season.html',
  '/episode_info.html',
  '/chat.html',
  '/profile.html',
  '/user_login.html',
  '/admin.html',
  '/admin_login.html',
  '/find_friends.html',
  '/forgot_password.html',
  '/reset_password.html',
  '/i18n.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});