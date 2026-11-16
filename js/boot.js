/* Gestione Patrimonio Immobiliare — tema iniziale, applicato prima del caricamento dell'app per evitare il lampo di colori,
   e collegamento al manifest per l'installazione come app */
(function () {
  'use strict';
  var t = 'auto', dark = false;
  try { t = localStorage.getItem('gpi:' + (location.pathname || '/').replace(/[^/]*$/, '') + ':theme') || 'auto'; } catch (e) { t = 'auto'; }
  try { dark = t === 'dark' || (t !== 'light' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)); } catch (e) { dark = false; }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#0b1220' : '#1e3a8a');
  /* Aperta da file (doppio clic) il browser blocca il manifest e segnala un errore: lo collega solo via http(s) */
  if (/^https?:$/.test(location.protocol)) {
    var l = document.createElement('link');
    l.rel = 'manifest';
    l.href = 'manifest.webmanifest';
    document.head.appendChild(l);
  }
})();
