// Service Worker for Chicken Race Ranking PWA
// Use timestamp-based versioning to force cache updates on every deployment
const CACHE_VERSION = Date.now();
const CACHE_NAME = `chicken-race-v${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `chicken-race-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `chicken-race-dynamic-v${CACHE_VERSION}`;

// Assets to cache immediately
// NOTE: We exclude index.html to ensure CSP updates are always fresh
const STATIC_ASSETS = [
  '/manifest.json',
  '/vite.svg',
  // Add other static assets as needed
];

// API endpoints to cache with network-first strategy
// Note: In production, this should be dynamically configured
const API_ENDPOINTS = [
  // Funifier API endpoints will be configured at runtime
];

// Install event - cache static assets and skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing new version...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached, activating immediately');
        // Skip waiting to activate immediately and replace old service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static assets', error);
        // Still skip waiting even if caching fails
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches and force immediate activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Delete ALL old caches to ensure fresh content
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME &&
              cacheName !== DYNAMIC_CACHE_NAME &&
              cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated and claiming clients');
        // Force immediate control of all clients
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients to reload for fresh content
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'CACHE_UPDATED',
              message: 'New version available, reloading...'
            });
          });
        });
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests with network-first strategy
  if (API_ENDPOINTS.some(endpoint => request.url.includes(endpoint))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle static assets with cache-first strategy
  if (STATIC_ASSETS.some(asset => url.pathname === asset) ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Handle navigation requests - ALWAYS fetch fresh HTML (never cache)
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(fetch(request));
    return;
  }

  // Default: try network first, fallback to cache
  event.respondWith(networkFirstStrategy(request));
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  try {
    // Skip chrome-extension and other unsupported schemes
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fetch(request);
    }

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      try {
        const cache = await caches.open(STATIC_CACHE_NAME);
        // Check if we have enough quota before caching
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          const usagePercentage = (estimate.usage || 0) / (estimate.quota || 1);

          // Only cache if we're using less than 80% of quota
          if (usagePercentage < 0.8) {
            await cache.put(request, networkResponse.clone());
          }
        } else {
          // Fallback: try to cache and handle quota errors
          await cache.put(request, networkResponse.clone());
        }
      } catch (cacheError) {
        console.warn('Failed to cache response:', cacheError);
        // Continue without caching
      }
    }

    return networkResponse;
  } catch (error) {
    console.error('Cache-first strategy failed:', error);

    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      try {
        const cache = await caches.open(STATIC_CACHE_NAME);
        return cache.match('/index.html');
      } catch (fallbackError) {
        console.error('Failed to get offline fallback:', fallbackError);
      }
    }

    throw error;
  }
}

// Network-first strategy for dynamic content
async function networkFirstStrategy(request) {
  try {
    // Skip chrome-extension and other unsupported schemes
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fetch(request);
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      try {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        // Check quota before caching
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          const usagePercentage = (estimate.usage || 0) / (estimate.quota || 1);

          if (usagePercentage < 0.8) {
            await cache.put(request, networkResponse.clone());
          }
        } else {
          await cache.put(request, networkResponse.clone());
        }
      } catch (cacheError) {
        console.warn('Failed to cache response:', cacheError);
      }
    }

    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      try {
        const cache = await caches.open(STATIC_CACHE_NAME);
        return cache.match('/index.html');
      } catch (fallbackError) {
        console.error('Failed to get offline fallback:', fallbackError);
      }
    }

    throw error;
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);

  if (event.tag === 'background-sync-leaderboard') {
    event.waitUntil(syncLeaderboardData());
  }
});

// Sync leaderboard data when back online
async function syncLeaderboardData() {
  try {
    console.log('Service Worker: Syncing leaderboard data');

    // Get stored API configuration from IndexedDB or localStorage
    const apiConfig = await getStoredApiConfig();
    if (!apiConfig) {
      console.log('Service Worker: No API config found for sync');
      return;
    }

    // Fetch latest leaderboard data
    const response = await fetch(`${apiConfig.serverUrl}/api/leaderboards`, {
      headers: {
        'Authorization': apiConfig.authToken,
        'X-API-Key': apiConfig.apiKey,
      },
    });

    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(response.url, response.clone());
      console.log('Service Worker: Leaderboard data synced');
    }
  } catch (error) {
    console.error('Service Worker: Failed to sync leaderboard data', error);
  }
}

// Helper function to get stored API config
async function getStoredApiConfig() {
  try {
    // Try to get from localStorage (simplified approach)
    const config = localStorage.getItem('chicken-race-api-config');
    return config ? JSON.parse(config) : null;
  } catch (error) {
    console.error('Service Worker: Failed to get API config', error);
    return null;
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'New leaderboard update available!',
    icon: '/vite.svg',
    badge: '/vite.svg',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'View Leaderboard',
        icon: '/vite.svg',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/vite.svg',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification('🐔 Chicken Race Update', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');

  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_API_CONFIG') {
    // Store API config for offline sync
    try {
      localStorage.setItem('chicken-race-api-config', JSON.stringify(event.data.config));
    } catch (error) {
      console.error('Service Worker: Failed to store API config', error);
    }
  }
});

console.log('Service Worker: Loaded and ready');