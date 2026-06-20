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
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// ── Push Notifications ──
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const { title, body, icon, url } = data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || 'https://yphxpgssdqboufbgazwi.supabase.co/storage/v1/object/public/avatars/site-logo/icon-512.png',
      badge: icon || 'https://yphxpgssdqboufbgazwi.supabase.co/storage/v1/object/public/avatars/site-logo/icon-512.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});