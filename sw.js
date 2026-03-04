const CACHE = 'ht-v16';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/firebase-config.js', './js/program-data.js',
  './js/storage.js', './js/app.js',
  './manifest.json', './img/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => { console.warn('Cache addAll failed:', err); self.skipWaiting(); })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic') || url.hostname.includes('google')) return;

  // Network-first for JS/CSS so updates deploy quickly
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request)).catch(() => caches.match('./index.html'))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cls => {
      if (cls.length > 0) cls[0].focus();
      else clients.openWindow('./');
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_REST') {
    const ms = e.data.ms || 0;
    if (ms > 0) {
      setTimeout(() => {
        self.registration.showNotification('Rest Complete', {
          body: 'Time for your next set!',
          icon: './img/icon.svg',
          vibrate: [200, 100, 200],
          tag: 'rest-timer',
          requireInteraction: false
        });
      }, ms);
    }
  }
});
