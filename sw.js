/* ==========================================================================
   FIX & DRIVE — service worker

   The whole app is a handful of static files, so the strategy is simple:
   pre-cache everything on install and serve the shell cache-first. The
   garage's wifi is unreliable and the app must open instantly with no
   network at all, so the network is only ever a fallback, never a blocker.

   Bump CACHE_VERSION whenever a file changes — that is what triggers the
   old cache to be thrown away and the new files to be pulled in.
   ========================================================================== */

var CACHE_VERSION = 'fixdrive-v5';

var PRECACHE = [
  './',
  './index.html',
  './style.css',
  './icons.js',
  './data.js',
  './app.js',
  './people.js',
  './shop.js',
  './jobs.js',
  './money.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

/* ── INSTALL — pull the whole shell into the cache ───────────────────── */
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function(cache){
        // addAll is all-or-nothing; add individually so one bad path cannot
        // fail the entire install and leave the app uncached.
        return Promise.all(PRECACHE.map(function(url){
          return cache.add(new Request(url, { cache:'reload' })).catch(function(){
            /* skip anything missing rather than aborting the install */
          });
        }));
      })
      .then(function(){ return self.skipWaiting(); })
  );
});

/* ── ACTIVATE — drop caches from older versions ──────────────────────── */
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.map(function(k){
          return k === CACHE_VERSION ? null : caches.delete(k);
        }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

/* ── FETCH — cache first, network as backup ──────────────────────────── */
self.addEventListener('fetch', function(event){
  var req = event.request;

  // Never touch non-GET traffic, and ignore other origins entirely
  // (wa.me links must always go straight to the network).
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;

      return fetch(req).then(function(res){
        // Cache same-origin successes so anything missed at install time
        // is available offline from then on.
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copy); });
        }
        return res;
      }).catch(function(){
        // Offline and not cached: for a page navigation fall back to the
        // app shell so the user still lands in the app rather than on a
        // browser error page.
        if(req.mode === 'navigate'){
          return caches.match('./index.html');
        }
        return new Response('', { status:504, statusText:'Offline' });
      });
    })
  );
});
