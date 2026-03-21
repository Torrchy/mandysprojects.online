// ============================================
// MISSION CONTROL — Service Worker v1.0
// ============================================

const CACHE_NAME = 'mission-control-v8';
const STATIC_ASSETS = [
  './',
  './index.html',
  './mission-control.html',
  './journal.html',
  './feelings.html',
  './habits.html',
  './mc-style.css',
  './app.js',
  './firebase-config.js',
  './firebase-sync.js',
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

// ---- Presence reminder scheduling ----

// Returns ms until the next valid firing time, honouring hour window + day restrictions.
// Falls back to intervalMs if no valid window found within 200 iterations.
function getNextFireDelay(settings) {
  const intervalMs = (settings.intervalMin || 120) * 60 * 1000;
  const startHour  = settings.startHour != null ? settings.startHour : 8;
  const endHour    = settings.endHour   != null ? settings.endHour   : 22;
  const days       = settings.days || [0,1,2,3,4,5,6];

  const now       = new Date();
  let candidate   = new Date(now.getTime() + intervalMs);

  for (let i = 0; i < 200; i++) {
    const h   = candidate.getHours();
    const day = candidate.getDay();

    if (days.includes(day) && h >= startHour && h < endHour) {
      return Math.max(candidate.getTime() - now.getTime(), 60000);
    }

    // Advance to next applicable window
    if (!days.includes(day) || h >= endHour) {
      // Skip to tomorrow at startHour
      const next = new Date(candidate);
      next.setDate(next.getDate() + 1);
      next.setHours(startHour, 0, 0, 0);
      candidate = next;
    } else {
      // Same day but before window — jump to startHour
      candidate = new Date(candidate);
      candidate.setHours(startHour, 0, 0, 0);
    }
  }

  // Fallback: no valid slot found, just use the raw interval
  return intervalMs;
}

function schedulePresenceReminder(settings) {
  if (self._presenceTimer) clearTimeout(self._presenceTimer);
  self._presenceSettings = settings; // store for snooze recovery

  const delay = getNextFireDelay(settings);

  self._presenceTimer = setTimeout(() => {
    self.registration.showNotification('Body check-in 🌫️', {
      body: 'How present do you feel right now? Take a moment to scan your body.',
      tag: 'presence-check',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [80, 40, 80],
      data: { type: 'presence' },
      actions: [
        { action: 'checkin', title: '✦ Check in' },
        { action: 'snooze',  title: '⏰ 30 min'  },
      ],
    });
    // Reschedule after firing
    schedulePresenceReminder(settings);
  }, delay);
}

// ---- Message: schedule habit notifications (persists briefly after page close) ----
self.addEventListener('message', event => {
  if (!event.data) return;

  // ── Presence reminders
  if (event.data.type === 'SCHEDULE_PRESENCE') {
    const settings = event.data.settings || { intervalMin: 120, startHour: 8, endHour: 22, days: [0,1,2,3,4,5,6] };
    schedulePresenceReminder(settings);
    return;
  }
  if (event.data.type === 'CANCEL_PRESENCE') {
    if (self._presenceTimer) clearTimeout(self._presenceTimer);
    self._presenceSettings = null;
    return;
  }

  if (event.data.type !== 'SCHEDULE_HABITS') return;

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

// ---- Notification click: handle presence + habits ----
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // ── Presence check-in notification
  if (event.notification.data?.type === 'presence') {
    if (event.action === 'snooze') {
      // Fire once in 30 min (ignoring time window — user is awake), then resume normal schedule
      if (self._presenceTimer) clearTimeout(self._presenceTimer);
      const savedSettings = self._presenceSettings;
      self._presenceTimer = setTimeout(() => {
        self.registration.showNotification('Body check-in 🌫️', {
          body: 'How present do you feel right now? Take a moment to scan your body.',
          tag: 'presence-check',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [80, 40, 80],
          data: { type: 'presence' },
          actions: [
            { action: 'checkin', title: '✦ Check in' },
            { action: 'snooze',  title: '⏰ 30 min'  },
          ],
        });
        if (savedSettings) schedulePresenceReminder(savedSettings);
      }, 30 * 60 * 1000);
      return;
    }
    // 'checkin' or default: open home page
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) { client.navigate('./index.html'); return client.focus(); }
        }
        if (clients.openWindow) return clients.openWindow('./index.html');
      })
    );
    return;
  }

  // ── Habit notification
  const habitId = event.notification.data?.habitId;
  const url = (event.action === 'done' && habitId)
    ? `./habits.html?done=${habitId}`
    : './habits.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('habits.html') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
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
