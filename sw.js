/* Gestione Patrimonio Immobiliare — service worker: uso offline con strategia «prima la rete, poi la copia locale».
   Quando pubblichi una nuova versione dell'app aumenta VERSION: le copie vecchie vengono eliminate e chi ha l'app aperta
   riceve l'avviso di aggiornamento. I dati degli immobili non passano di qui: restano nel database del browser. */
'use strict';
var VERSION = '1.0.0';
var SCOPE_PATH = new URL('./', self.location.href).pathname;
var BASE = 'gpi|' + SCOPE_PATH + '|';
var CACHE = BASE + VERSION;
var TIMEOUT = 4500;
var ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'js/boot.js', 'js/utils.js', 'js/db.js', 'js/fx.js', 'js/countries.js', 'js/model.js', 'js/tax-it.js', 'js/calc.js',
  'js/charts.js', 'js/portals.js', 'js/ui.js', 'js/demo.js', 'js/app.js',
  'js/views/common.js', 'js/views/dashboard.js', 'js/views/immobili.js', 'js/views/editor.js', 'js/views/editor-tabs.js',
  'js/views/editor-analysis.js', 'js/views/confronta.js', 'js/views/mappa.js', 'js/views/scadenze.js', 'js/views/cambi.js',
  'js/views/impostazioni.js', 'js/views/guida.js', 'js/views/ricevi.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) {
      return c.add(new Request(u, { cache: 'reload' })).catch(function () { /* file non raggiungibile: verrà salvato al primo uso */ });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(BASE) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Una risposta ottenuta tramite redirect non può servire una navigazione: la ricostruisce senza il flag di redirect */
function clean(r) {
  if (!r || !r.redirected) return r;
  return r.blob().then(function (b) { return new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers }); });
}

function fromCache(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (r) {
      if (r || req.mode !== 'navigate') return r;
      return c.match('index.html').then(function (x) { return x || c.match('./'); });
    });
  }).then(clean);
}

function networkFirst(req) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    function finish(r) { if (!settled) { settled = true; resolve(r); } }
    function fail(err) { if (!settled) { settled = true; reject(err); } }
    var timer = setTimeout(function () {
      fromCache(req).then(function (r) { if (r) finish(r); }, function () { /* attende la rete */ });
    }, TIMEOUT);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () { /* spazio esaurito o richiesta non salvabile */ });
      }
      finish(res);
    }, function (err) {
      clearTimeout(timer);
      fromCache(req).then(function (r) { if (r) finish(r); else fail(err); }, function () { fail(err); });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request, url;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  try { url = new URL(req.url); } catch (er) { return; }
  /* Cambi valuta, geocodifica e mappa (altri domini) passano direttamente alla rete */
  if (url.origin !== self.location.origin || url.pathname.indexOf(SCOPE_PATH) !== 0) return;
  e.respondWith(networkFirst(req));
});
