// ============================================
// MISSION CONTROL — Service Worker v1.0
// ============================================

const CACHE_NAME = 'mission-control-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './mission-control.html',
  './journal.html',
  './feelings.html',
  './habits.html',
  './mc-style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// ---- Install: cache all static assets ----
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      // Cache what we can, ignore failures (external fonts etc)
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ---- Activate: clean up old caches ----
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Message: schedule habit notifications (persists briefly after page close) ----
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SCHEDULE_HABITS') return;

  // Clear any previously scheduled timers
  if (self._habitTimers) self._habitTimers.forEach(t => clearTimeout(t));
  self._habitTimers = [];

  const habits = event.data.habits || [];
  habits.forEach(habit => {
    const delay = habit.msUntilNotification;
    if (!delay || delay <= 0 || delay > 25 * 60 * 60 * 1000) return;

    const t = setTimeout(() => {
      const streak = habit.streak || 0;
      const body = streak > 0
        ? `🔥 ${streak} day streak — keep it going!`
        : 'Start building your streak today.';

      self.registration.showNotification(`${habit.icon} ${habit.name}`, {
        body,
        tag: `habit-${habit.id}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: { habitId: habit.id },
        actions: [
          { action: 'done',  title: '✓ Done'  },
          { action: 'later', title: '🔔 Later' },
        ],
      });
    }, delay);

    self._habitTimers.push(t);
  });
});

// ---- Notification click: mark done via URL param or just open page ----
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const habitId = event.notification.data?.habitId;

  const url = (event.action === 'done' && habitId)
    ? `./habits.html?done=${habitId}`
    : './habits.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If habits page already open, focus + navigate it
      for (const client of clientList) {
        if (client.url.includes('habits.html') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ---- Fetch: serve from cache, fall back to network ----
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-http requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache, update in background (stale-while-revalidate)
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {});
        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./mission-control.html');
          }
        });
    })
  );
});
