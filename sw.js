// CoachOS Progressive Web App Service Worker
const CACHE_NAME = 'coachos-cache-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/app.css',
    './js/config.js',
    './js/toast.js',
    './js/supabase.js',
    './js/app.js',
    './js/router.js',
    './js/screens/client-mobile.js',
    './js/screens/workout-logger.js',
    './views/client-mobile.html',
    './views/workout-logger.html',
    './icons/icon.svg',
    './icons/icon-192.svg',
    './icons/icon-512.svg'
];

// Install: Cache Shell Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('Non-critical asset cache miss on install:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches and claim clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network-First with Cache Fallback (for gym offline support)
self.addEventListener('fetch', (event) => {
    // Only intercept GET requests
    if (event.request.method !== 'GET') return;
    
    // Ignore external APIs like Supabase / CDN / WebSockets from caching
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin && !url.hostname.includes('fonts.googleapis.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});

// Push Notifications
self.addEventListener('push', (event) => {
    let payload = {
        title: 'CoachOS Training Reminder',
        body: 'Time to log your daily metrics and check today’s training session!',
        url: './#client-mobile'
    };

    try {
        if (event.data) {
            payload = Object.assign(payload, event.data.json());
        }
    } catch (e) {
        if (event.data) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: 'icons/icon-192.svg',
        badge: 'icons/icon-192.svg',
        vibrate: [150, 50, 150],
        data: { url: payload.url || './#client-mobile' },
        actions: [
            { action: 'open', title: 'Open CoachOS' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || './#client-mobile';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
