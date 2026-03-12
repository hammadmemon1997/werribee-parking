// ParkWest Service Worker — Push Notifications + Offline Cache
const CACHE = 'parkwest-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/manifest.json']))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Serve from cache with network fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Handle push notifications
self.addEventListener('push', e => {
  let data = { title: 'ParkWest', body: 'Check your morning commute', icon: '/icon-192.png', badge: '/icon-192.png', tag: 'parkwest-morning', data: { url: '/' } };
  
  try {
    const payload = e.data?.json();
    if (payload) data = { ...data, ...payload };
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      renotify: true,
      data: data.data,
      actions: [
        { action: 'open', title: '🚗 Check Now' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      vibrate: [200, 100, 200]
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});
