/* Gestione Patrimonio Immobiliare — applicazione: stato, salvataggio, router, import/export (GPI.APP) */
(function (G) {
  'use strict';
  var U = G.U, DB = G.DB, M = G.MODEL, C = G.CALC, FX = G.FX, UI = G.UI;
  var A = { props: [], byId: {}, S: null, rev: 1, MAX: M.MAX_PROPERTIES || 1000, route: { name: '', params: [], query: {} }, ready: false, clip: null, lastBackup: null };
  var VIEWS = G.VIEWS = G.VIEWS || {};
  var ROUTES = { dashboard: 'Dashboard', immobili: 'Immobili', immobile: 'Scheda immobile', confronta: 'Confronta', mappa: 'Mappa', scadenze: 'Scadenze', cambi: 'Cambi valuta', impostazioni: 'Impostazioni', guida: 'Guida', ricevi: 'Importa annuncio' };
  var ITER = 250000;

  /* ---------- Stato ---------- */
  function reindex() { A.byId = {}; A.props.forEach(function (p) { A.byId[p.id] = p; }); }
  A.get = function (id) { return id ? A.byId[id] || null : null; };
  A.bump = function () { A.rev++; };
  A.room = function () { return Math.max(0, A.MAX - A.props.length); };

  var portCache = null, portKey = '';
  A.port = function () {
    var key = A.rev + '|' + A.S.rev + '|' + FX.version + '|' + U.todayISO();
    if (!portCache || key !== portKey) { portCache = C.portfolio(A.props, A.S); portKey = key; }
    return portCache;
  };
  A.fin = function (id) { return A.port().byId[id] || null; };

  /* ---------- Salvataggio (con debounce per immobile) ---------- */
  var pending = {}, timers = {};
  function flush(id) {
    clearTimeout(timers[id]); delete timers[id];
    var p = pending[id]; delete pending[id];
    if (!p || !A.byId[id]) return Promise.resolve();
    return DB.put(p).catch(function (e) { U.toast('Salvataggio non riuscito: ' + ((e && e.message) || e), 'error', 7000); });
  }
  A.touch = function (p) { p.updatedAt = Date.now(); C.invalidate(p.id); A.bump(); };
  A.save = function (p, now) {
    A.touch(p);
    pending[p.id] = p;
    clearTimeout(timers[p.id]);
    if (now) return flush(p.id);
    timers[p.id] = setTimeout(function () { flush(p.id); }, 500);
    return Promise.resolve();
  };
  A.flushAll = function () { return Promise.all(Object.keys(pending).map(flush)); };
  window.addEventListener('pagehide', function () { A.flushAll(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') A.flushAll(); });

  A.limitMsg = function (n) { U.toast('Limite di ' + A.MAX + ' immobili raggiunto' + (n ? ': ' + n + ' non aggiunti' : ''), 'warn', 7000); };
  A.addMany = function (list) {
    list = (list || []).filter(function (x) { return x && typeof x === 'object'; });
    var room = A.room(), take = list.slice(0, room), out = [];
    if (list.length > room) A.limitMsg(list.length - room);
    take.forEach(function (raw) {
      var p = M.normalize(raw);
      if (A.byId[p.id]) p.id = U.uid();
      p.updatedAt = Date.now();
      A.props.push(p); A.byId[p.id] = p; C.invalidate(p.id); out.push(p);
    });
    if (!out.length) return Promise.resolve(out);
    A.bump();
    return DB.putMany(out).then(function () { return out; });
  };
  A.add = function (raw) { return A.addMany([raw]).then(function (a) { return a[0] || null; }); };
  A.remove = function (ids) {
    ids = [].concat(ids || []).filter(function (id) { return A.byId[id]; });
    if (!ids.length) return Promise.resolve(0);
    var set = {};
    ids.forEach(function (id) { set[id] = 1; delete pending[id]; clearTimeout(timers[id]); delete A.byId[id]; C.invalidate(id); });
    A.props = A.props.filter(function (p) { return !set[p.id]; });
    A.bump();
    return DB.delMany(ids).then(function () { return ids.length; });
  };
  A.duplicate = function (id, opts, n) {
    var src = A.get(id);
    if (!src) return Promise.resolve([]);
    if (!A.room()) { A.limitMsg(); return Promise.resolve([]); }
    n = Math.max(1, Math.min(n || 1, A.room()));
    var list = [];
    for (var i = 1; i <= n; i++) list.push(M.duplicate(src, opts, n > 1 ? i : 0));
    return A.addMany(list);
  };
  /* Aggiornamento in blocco (cambio stato, gruppo, tag…) */
  A.updateMany = function (ids, fn) {
    var list = [].concat(ids || []).map(A.get).filter(Boolean);
    list.forEach(function (p) { fn(p); p.updatedAt = Date.now(); C.invalidate(p.id); });
    A.bump();
    return DB.putMany(list).then(function () { return list.length; });
  };

  /* ---------- Impostazioni e tema ---------- */
  var lastFxOv = null;
  function syncFx() {
    var j = JSON.stringify(A.S.fxOverrides || {});
    if (j !== lastFxOv) { lastFxOv = j; FX.setOverrides(U.clone(A.S.fxOverrides || {})); }
  }
  A.saveSettings = function () {
    A.S.rev = (A.S.rev || 0) + 1;
    C.invalidate(); A.bump();
    syncFx(); applyTheme();
    return DB.setKV('settings', A.S).catch(function (e) { U.toast('Impostazioni non salvate: ' + ((e && e.message) || e), 'error'); });
  };
  var THEME_NEXT = { auto: 'light', light: 'dark', dark: 'auto' }, THEME_LABEL = { auto: 'automatico', light: 'chiaro', dark: 'scuro' };
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    var t = (A.S && THEME_LABEL[A.S.theme]) ? A.S.theme : 'auto';
    var dark = t === 'dark' || (t === 'auto' && !!(mq && mq.matches));
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var b = document.getElementById('theme-toggle');
    if (b) { b.title = 'Tema ' + THEME_LABEL[t] + ' (clic per cambiare)'; b.setAttribute('data-mode', t); }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0b1220' : '#1e3a8a');
    /* copia per js/boot.js, che applica il tema prima dell'avvio */
    try { localStorage.setItem('gpi:' + (location.pathname || '/').replace(/[^/]*$/, '') + ':theme', t); } catch (e) { /* ignora */ }
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);
  A.applyTheme = applyTheme;
  A.toggleTheme = function () {
    A.S.theme = THEME_NEXT[A.S.theme] || 'light';
    applyTheme();
    DB.setKV('settings', A.S);
    U.toast('Tema ' + THEME_LABEL[A.S.theme], 'info', 1500);
  };

  /* ---------- Router ---------- */
  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, ''), q = '', i = h.indexOf('?');
    if (i >= 0) { q = h.slice(i + 1); h = h.slice(0, i); }
    var parts = h.split('/').filter(Boolean).map(function (s) { try { return decodeURIComponent(s); } catch (e) { return s; } });
    var name = parts.shift() || 'dashboard';
    return { name: ROUTES[name] ? name : 'dashboard', params: parts, query: U.parseQuery(q), hash: location.hash };
  }
  A.href = function (name, params, query) {
    var h = '#/' + name + (params && params.length ? '/' + params.map(function (x) { return encodeURIComponent(x); }).join('/') : '');
    var q = Object.keys(query || {}).filter(function (k) { return U.has(query[k]); })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); }).join('&');
    return h + (q ? '?' + q : '');
  };
  A.go = function (hash, replace) {
    if (location.hash === hash) { A.render(true); return; }
    if (replace && history.replaceState) { history.replaceState(null, '', hash); A.render(); return; }
    location.hash = hash;
  };
  /* Aggiorna la query string senza ridisegnare (filtri persistenti nel link) */
  A.setQuery = function (query) {
    var h = A.href(A.route.name, A.route.params, query);
    if (history.replaceState) history.replaceState(null, '', h);
    A.route.query = query; A.route.hash = h;
  };
  A.editHref = function (id, tab) { return A.href('immobile', tab ? [id, tab] : [id]); };

  function highlightNav(name) {
    var n = name === 'immobile' ? 'immobili' : name, links = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute('data-nav') === n;
      links[i].classList.toggle('active', on);
      if (on) links[i].setAttribute('aria-current', 'page'); else links[i].removeAttribute('aria-current');
    }
  }
  A.dueCount = function () {
    var n = 0, lim = U.addDays(U.todayISO(), 30);
    A.port().dates.forEach(function (d) { if (d.past ? d.level !== 'info' : d.date <= lim) n++; });
    return n;
  };
  function updateBadges() {
    var c = document.getElementById('nav-count'), s = document.getElementById('nav-due');
    if (c) c.textContent = A.props.length ? U.fmtNum(A.props.length) : '';
    if (s) { var n = 0; try { n = A.dueCount(); } catch (e) { n = 0; } s.textContent = n ? String(n) : ''; }
  }
  A.updateBadges = updateBadges;

  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    var b = document.getElementById('menu-toggle'); if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  var curView = null, lastKey = '';
  A.render = function (keepScroll) {
    var el = document.getElementById('app');
    if (!el || !A.ready) return;
    var r = parseHash(), v = VIEWS[r.name], key = r.name + '/' + (r.params[0] || ''), y = window.pageYOffset || 0;
    var keep = keepScroll === true || key === lastKey;
    if (curView && curView.destroy) { try { curView.destroy(); } catch (e) { console.error(e); } }
    A.route = r; curView = v; lastKey = key;
    setNav(false);
    highlightNav(r.name);
    document.title = ROUTES[r.name] + ' · Patrimonio Immobiliare';
    if (!v) {
      el.innerHTML = UI.empty('Sezione non disponibile', 'La pagina richiesta non esiste.', UI.btn('Vai alla dashboard', { href: '#/dashboard', cls: 'btn-primary' }), 'alert');
    } else {
      try { v.render(el, r); } catch (e) {
        console.error(e);
        el.innerHTML = UI.note('Errore durante la visualizzazione: ' + U.esc((e && e.message) || String(e)) + '. I dati salvati non sono stati modificati.', 'danger');
      }
    }
    window.scrollTo(0, keep ? y : 0);
    if (!keep && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) { /* ignora */ } }
    updateBadges();
  };

  function updateFxStatus() {
    var el = document.getElementById('fx-status');
    if (!el) return;
    var s = FX.status(), ok = s.ok && !s.stale;
    el.className = 'fx-status ' + (ok ? 'ok' : 'warn');
    el.innerHTML = U.icon('currency') + '<span>' + (s.ok ? 'Cambi BCE/live del ' + U.fmtDate(s.date) + (s.stale ? ' · da aggiornare' : '') : 'Cambi indicativi offline') + '</span>';
    el.title = 'Fonti: ' + (s.sources || []).join(', ') + (s.fetchedAt ? ' — scaricati il ' + U.fmtDateTime(s.fetchedAt) : '') + '. Clic per aggiornare.';
  }
  A.refreshFx = function () {
    U.toast('Aggiornamento dei cambi in corso…', 'info', 1500);
    return FX.refresh(true).then(function () { U.toast('Cambi aggiornati', 'success'); }, function (e) {
      U.toast('Impossibile aggiornare i cambi: ' + ((e && e.message) || 'rete non disponibile') + '. Restano validi gli ultimi tassi salvati.', 'warn', 6000);
    });
  };
  U.bus.on('fx:updated', function () {
    updateFxStatus();
    if (!A.ready) return;
    var v = VIEWS[A.route.name];
    if (v && v.onFx) { v.onFx(); return; }
    var ae = document.activeElement, app = document.getElementById('app');
    if (ae && app && app.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    if (!document.querySelector('.modal-backdrop')) A.render(true);
  });

  /* ---------- Nuovo immobile ---------- */
  A.newDialog = function (preset) {
    if (!A.room()) { A.limitMsg(); return Promise.resolve(null); }
    var p = M.newProperty(preset || {});
    var body = '<p class="muted">Inserisci i dati essenziali: potrai completare tutto il resto nella scheda.</p>' + UI.grid([
      UI.text(p, 'name', 'Nome / descrizione', { placeholder: 'es. Bilocale Milano Navigli', attrs: ' autofocus' }),
      UI.select(p, 'type', 'Tipologia', null, { optionsHtml: UI.typeOptionsHtml(p.type) }),
      UI.select(p, 'country', 'Paese', UI.countryOptions()),
      UI.text(p, 'address.city', 'Città / comune'),
      UI.select(p, 'status', 'Stato', M.STATUS),
      UI.select(p, 'usage', 'Utilizzo', M.USAGE)
    ], 2);
    return U.modal({
      title: 'Nuovo immobile', body: body, enterButton: 1,
      onOpen: function (root) { UI.bind(root, p, function () { /* aggiornato in p */ }); },
      buttons: [{ label: 'Annulla', value: null }, { label: 'Crea e apri la scheda', cls: 'btn-primary', value: true }]
    }).then(function (ok) {
      if (!ok) return null;
      p.category = M.typeCategory(p.type);
      p.currency = G.COUNTRIES.currency(p.country) || 'EUR';
      if (p.country === 'IT' && p.address.city) {
        var pc = G.COUNTRIES.findProvince(p.address.city);
        if (pc) { p.address.province = pc; p.address.region = G.COUNTRIES.provinceRegion(pc); }
      }
      return A.add(p).then(function (np) { if (np) { U.toast('Immobile creato', 'success'); A.go(A.editHref(np.id, 'generale')); } return np; });
    });
  };
  /* ---------- Esportazione ---------- */
  function listOf(ids) { return ids ? [].concat(ids).map(A.get).filter(Boolean) : A.props; }
  A.exportData = function (ids, withSettings) {
    var list = listOf(ids), out = { app: 'GPI', name: 'Gestione Patrimonio Immobiliare', schema: M.SCHEMA, exportedAt: new Date().toISOString(), count: list.length };
    if (withSettings) out.settings = A.S;
    out.properties = list;
    return out;
  };
  function markBackup() { A.lastBackup = Date.now(); DB.setKV('lastBackup', A.lastBackup); }
  A.exportJSON = function (ids, name) {
    A.flushAll();
    var data = A.exportData(ids, !ids), fn = (name || (ids ? 'immobili-selezionati' : 'patrimonio-immobiliare')) + '-' + U.todayISO() + '.json';
    U.download(fn, JSON.stringify(data, null, 1), 'application/json');
    if (!ids) markBackup();
    U.toast('Esportati ' + data.count + ' immobili nel file ' + fn, 'success', 4500);
  };

  var subtle = window.crypto && window.crypto.subtle;
  A.canEncrypt = function () { return !!(subtle && window.TextEncoder && window.TextDecoder); };
  function deriveKey(pass, salt, iter) {
    return subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']).then(function (k) {
      return subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  A.encrypt = function (obj, pass) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(pass, salt, ITER).then(function (key) {
      return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    }).then(function (buf) {
      return { app: 'GPI', enc: 'AES-GCM-256', kdf: 'PBKDF2-SHA256', iter: ITER, salt: U.bytesToB64(salt), iv: U.bytesToB64(iv), data: U.bytesToB64(buf) };
    });
  };
  A.decrypt = function (env, pass) {
    return deriveKey(pass, U.b64ToBytes(env.salt), +env.iter || ITER).then(function (key) {
      return subtle.decrypt({ name: 'AES-GCM', iv: U.b64ToBytes(env.iv) }, key, U.b64ToBytes(env.data));
    }).then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); }, function () { throw new Error('Password errata o file danneggiato'); });
  };
  var PW_ERR = '<p class="form-err" data-err role="alert"></p>';
  A.exportEncrypted = function () {
    if (!A.canEncrypt()) { U.toast('Cifratura non disponibile: apri l\'app da HTTPS (es. GitHub Pages).', 'error', 5000); return Promise.resolve(); }
    var body = UI.note('Il backup sarà cifrato con AES-256-GCM. <b>Senza la password non sarà possibile recuperarlo</b>: conservala in un luogo sicuro.', 'info') +
      '<label class="fld"><span>Password (minimo 8 caratteri)</span><input type="password" id="pw1" autocomplete="new-password" autofocus></label>' +
      '<label class="fld"><span>Ripeti la password</span><input type="password" id="pw2" autocomplete="new-password"></label>' + PW_ERR;
    return U.modal({ title: 'Backup cifrato', body: body, enterButton: 1, buttons: [{ label: 'Annulla', value: null }, {
      label: 'Esporta cifrato', cls: 'btn-primary', action: function (r) {
        var a = r.querySelector('#pw1').value, b = r.querySelector('#pw2').value, er = r.querySelector('[data-err]');
        if (a.length < 8) { er.textContent = 'La password deve avere almeno 8 caratteri.'; return false; }
        if (a !== b) { er.textContent = 'Le due password non coincidono.'; return false; }
        return a;
      } }] }).then(function (pass) {
      if (!pass) return;
      A.flushAll();
      return A.encrypt(A.exportData(null, true), pass).then(function (env) {
        var fn = 'patrimonio-immobiliare-cifrato-' + U.todayISO() + '.json';
        U.download(fn, JSON.stringify(env), 'application/json');
        markBackup();
        U.toast('Backup cifrato salvato: ' + fn, 'success', 5000);
      });
    }).catch(function (e) { U.toast('Errore di cifratura: ' + ((e && e.message) || e), 'error'); });
  };

  /* CSV con le metriche principali (apribile in Excel: separatore ";" e virgola decimale) */
  A.exportCSV = function (ids) {
    var port = A.port(), list = listOf(ids);
    var pc = function (x) { return U.ok(x) ? U.round(x * 100, 2) : null; }, e2 = function (x) { return U.ok(x) ? U.round(x, 2) : null; };
    var rows = [['ID', 'Codice', 'Nome', 'Tipologia', 'Categoria', 'Stato', 'Utilizzo', 'Paese', 'Città', 'Provincia', 'Indirizzo', 'Valuta', 'Quota %', 'Mq',
      'Data acquisto', 'Prezzo (valuta locale)', 'Costo totale EUR', 'Capitale proprio investito EUR', 'Valore attuale EUR', 'Debito residuo EUR', 'Patrimonio netto EUR',
      'Canone lordo annuo EUR', 'Spese operative annue EUR', 'Imposte annue EUR', 'Rate mutuo annue EUR', 'Cash flow netto annuo EUR', 'Rendimento lordo %',
      'Rendimento netto %', 'Cash on cash %', 'LTV %', 'DSCR', 'Plusvalenza EUR', 'Imposta plusvalenza EUR', 'Utile complessivo EUR', 'ROI %', 'ROI annuo %', 'TIR %',
      'Tipo ROI', 'Data vendita', 'Gruppo', 'Etichette']];
    list.forEach(function (p) {
      var f = port.byId[p.id]; if (!f) return;
      var m = f.m, a = p.address || {}, cg = f.cg || {};
      rows.push([p.id, p.code || '', M.displayName(p), M.typeLabel(p.type), (M.CATEGORIES[p.category] || p.category || ''), (M.STATUS[p.status] || p.status || ''),
        (M.USAGE[p.usage] || p.usage || ''), G.COUNTRIES.name(p.country), a.city || '', a.province || '', a.street || '', p.currency || 'EUR', U.n(p.ownershipPct),
        U.n(p.sqm) || null, m.buyDate || '', e2(m.acqL.price), e2(m.costTotalEur), e2(m.equityInvestedEur), e2(m.valueEur), e2(f.debt), e2(f.equityEur),
        e2(m.grossEur), e2(m.opexEur), e2(f.taxTotal), e2(m.ds.pay), e2(f.cfPost), pc(f.grossYield), pc(f.netYield), pc(f.coc), pc(f.ltv),
        U.ok(f.dscr) ? U.round(f.dscr, 2) : null, e2(cg.gainEur), e2(cg.tax), e2(f.profit), pc(f.roi), pc(f.roiAnn), pc(f.irr), f.roiKind,
        m.sold ? (m.saleDate || '') : '', p.group || '', (p.tags || []).join(', ')]);
    });
    U.download('immobili-metriche-' + U.todayISO() + '.csv', U.toCSV(rows), 'text/csv;charset=utf-8');
    U.toast('Esportate ' + (rows.length - 1) + ' righe in CSV', 'success');
  };
  /* ---------- Importazione ---------- */
  A.mergeProps = function (list) {
    var changed = [], added = [], room = A.room(), skipped = 0;
    list.forEach(function (raw) {
      var p = M.normalize(raw), old = A.byId[p.id];
      if (old) {
        var i = A.props.indexOf(old);
        delete pending[p.id]; clearTimeout(timers[p.id]);
        A.props[i] = p; A.byId[p.id] = p; C.invalidate(p.id); changed.push(p);
      } else if (room > 0) {
        room--; A.props.push(p); A.byId[p.id] = p; C.invalidate(p.id); changed.push(p); added.push(p);
      } else skipped++;
    });
    if (skipped) A.limitMsg(skipped);
    A.bump();
    return DB.putMany(changed).then(function () { return { updated: changed.length - added.length, added: added.length, skipped: skipped }; });
  };
  A.replaceAll = function (list) {
    var seen = {}, out = [];
    list.forEach(function (raw) {
      if (out.length >= A.MAX) return;
      var p = M.normalize(raw);
      if (seen[p.id]) p.id = U.uid();
      seen[p.id] = 1; out.push(p);
    });
    if (list.length > A.MAX) A.limitMsg(list.length - A.MAX);
    Object.keys(pending).forEach(function (id) { clearTimeout(timers[id]); delete pending[id]; });
    return DB.clear().then(function () { return DB.putMany(out); }).then(function () {
      A.props = out; reindex(); C.invalidate(); A.bump();
      return out.length;
    });
  };
  function extract(d) {
    if (Array.isArray(d)) return { props: d, settings: null };
    if (!d || typeof d !== 'object') return null;
    if (Array.isArray(d.properties)) return { props: d.properties, settings: d.settings || null };
    if (d.kind === 'property' && d.property) return { props: [d.property], settings: null };
    if (d.purchase || d.type || d.address) return { props: [d], settings: null };
    if (d.settings) return { props: [], settings: d.settings };
    return null;
  }
  function askPassword(env) {
    return U.modal({
      title: 'Backup cifrato', enterButton: 1,
      body: '<p>Il file è cifrato: inserisci la password usata per l\'esportazione.</p><label class="fld"><span>Password</span><input type="password" id="pw" autocomplete="current-password" autofocus></label>',
      buttons: [{ label: 'Annulla', value: null }, { label: 'Decifra', cls: 'btn-primary', action: function (r) { return r.querySelector('#pw').value || false; } }]
    }).then(function (pass) {
      if (!pass) return null;
      return A.decrypt(env, pass).catch(function (e) { U.toast(e.message, 'error', 4000); return askPassword(env); });
    });
  }
  A.importText = function (txt) {
    var data;
    try { data = JSON.parse(String(txt || '').replace(/^\ufeff/, '')); } catch (e) { U.toast('Il file non è un JSON valido.', 'error'); return Promise.resolve(null); }
    if (data && data.enc && data.data) {
      if (!A.canEncrypt()) { U.toast('Per aprire un backup cifrato apri l\'app da HTTPS.', 'error'); return Promise.resolve(null); }
      return askPassword(data).then(function (d) { return d ? applyImport(d) : null; });
    }
    return applyImport(data);
  };
  A.importFile = function () {
    return U.pickFile('.json,application/json').then(function (file) {
      if (!file) return null;
      if (file.size > 300 * 1024 * 1024) { U.toast('File troppo grande.', 'error'); return null; }
      return U.readFile(file).then(A.importText);
    }).catch(function (e) { U.toast('Importazione non riuscita: ' + ((e && e.message) || e), 'error', 6000); });
  };
  function applyImport(data) {
    var x = extract(data);
    if (!x) { U.toast('Formato non riconosciuto: usa un file esportato da questa applicazione.', 'error', 5000); return Promise.resolve(null); }
    var list = x.props.filter(function (r) { return r && typeof r === 'object'; });
    if (!list.length && !x.settings) { U.toast('Il file non contiene immobili.', 'warn'); return Promise.resolve(null); }
    var same = list.filter(function (r) { return r.id && A.byId[r.id]; }).length;
    var radio = function (v, t, chk) { return '<label class="fld-check"><input type="radio" name="imp-mode" value="' + v + '"' + (chk ? ' checked' : '') + '><span>' + t + '</span></label>'; };
    var body = '<p>Il file contiene <b>' + list.length + '</b> immobili' + (same ? ' (' + same + ' già presenti con lo stesso identificativo)' : '') +
      '; attualmente ne hai <b>' + A.props.length + '</b>.</p>' + (list.length ? '<div class="stack">' +
      radio('merge', '<b>Unisci</b>: aggiorna gli immobili già presenti e aggiunge i nuovi', true) +
      radio('copy', '<b>Aggiungi come copie</b>: importa tutto come nuovi immobili') +
      radio('replace', '<b>Sostituisci tutto</b>: elimina gli immobili attuali e carica quelli del file') + '</div>' : '') +
      (x.settings ? '<hr><label class="fld-check"><input type="checkbox" id="imp-set"' + (list.length ? '' : ' checked') + '><span>Importa anche le impostazioni (profilo fiscale, parametri, preferenze)</span></label>' : '');
    return U.modal({ title: 'Importa dati', body: body, buttons: [{ label: 'Annulla', value: null }, { label: 'Importa', cls: 'btn-primary', action: function (r) {
      var c = r.querySelector('input[name="imp-mode"]:checked'), s = r.querySelector('#imp-set');
      return { mode: c ? c.value : 'merge', settings: !!(s && s.checked) };
    } }] }).then(function (o) {
      if (!o) return null;
      var go = o.mode === 'replace' && A.props.length ? U.confirm('Verranno eliminati definitivamente <b>' + A.props.length + '</b> immobili attuali. Consigliato: esporta prima un backup. Continuare?', 'Sostituisci tutto', true) : Promise.resolve(true);
      return go.then(function (ok) {
        if (!ok) return null;
        var job = !list.length ? Promise.resolve('') :
          o.mode === 'replace' ? A.replaceAll(list).then(function (n) { return n + ' immobili caricati'; }) :
          o.mode === 'copy' ? A.addMany(list.map(function (r) { var c = U.clone(r); c.id = U.uid(); return c; })).then(function (a) { return a.length + ' immobili aggiunti'; }) :
          A.mergeProps(list).then(function (r) { return r.added + ' aggiunti, ' + r.updated + ' aggiornati'; });
        return job.then(function (msg) {
          if (o.settings && x.settings) { var rv = A.S.rev || 1; A.S = M.normalizeSettings(x.settings); A.S.rev = rv; A.saveSettings(); }
          U.toast('Importazione completata' + (msg ? ': ' + msg : '') + (o.settings ? ' (impostazioni incluse)' : ''), 'success', 5000);
          A.render(true);
          return true;
        });
      });
    });
  }
  A.applyImport = applyImport;
  /* ---------- Copia / incolla di un immobile (anche tra browser o dispositivi diversi) ---------- */
  A.copyProp = function (id) {
    var p = A.get(id); if (!p) return Promise.resolve();
    A.clip = U.clone(p);
    return U.copyText(JSON.stringify({ app: 'GPI', kind: 'property', property: p })).then(function () {
      U.toast('Immobile copiato negli appunti: usa "Incolla" qui o in un altro browser.', 'success', 4500);
    }, function () { U.toast('Immobile copiato in memoria: usa "Incolla" dall\'elenco immobili.', 'info', 4500); });
  };
  function pasteList(txt) {
    var d; try { d = JSON.parse(String(txt || '').trim()); } catch (e) { return null; }
    var x = extract(d);
    return x && x.props.length ? x.props : null;
  }
  A.pasteProp = function () {
    var read = navigator.clipboard && navigator.clipboard.readText && window.isSecureContext ?
      navigator.clipboard.readText().catch(function () { return ''; }) : Promise.resolve('');
    return read.then(function (txt) {
      var list = pasteList(txt);
      if (list) return list;
      if (A.clip) return [A.clip];
      return U.modal({
        title: 'Incolla immobile', wide: true,
        body: '<p>Incolla qui il testo ottenuto con "Copia immobile" (formato JSON).</p><textarea id="paste-ta" rows="10" class="mono w100" autofocus></textarea>',
        buttons: [{ label: 'Annulla', value: null }, { label: 'Incolla', cls: 'btn-primary', action: function (r) {
          var l = pasteList(r.querySelector('#paste-ta').value);
          if (!l) { U.toast('Testo non riconosciuto', 'error'); return false; }
          return l;
        } }]
      });
    }).then(function (list) {
      if (!list) return null;
      var all = { comparables: true, documents: true, ledger: true, reminders: true, sale: true };
      return A.addMany(list.map(function (raw) { return M.duplicate(M.normalize(raw), all); })).then(function (out) {
        if (out.length === 1) { U.toast('Immobile incollato come copia', 'success'); A.go(A.editHref(out[0].id)); }
        else if (out.length) { U.toast(out.length + ' immobili incollati', 'success'); A.render(true); }
        return out;
      });
    });
  };

  /* ---------- Copia di sezioni da un immobile ad altri ---------- */
  A.SECTIONS = [
    ['generale', 'Dati generali (tipologia, utilizzo, superfici, vani, classe energetica)', ['category', 'type', 'usage', 'sqm', 'landSqm', 'rooms', 'bathrooms', 'floor', 'yearBuilt', 'energyClass', 'unitsCount']],
    ['luogo', 'Paese, valuta e indirizzo', ['country', 'currency', 'address', 'sameComuneAsMainHome']],
    ['catasto', 'Dati catastali', ['cadastre']],
    ['acquisto', 'Acquisto (prezzo, quota, imposte, notaio, agenzia)', ['acquisitionMode', 'ownershipPct', 'purchase']],
    ['arredamento', 'Arredamento', ['furnishing']],
    ['ristrutturazioni', 'Ristrutturazioni e lavori', ['renovations']],
    ['extra', 'Spese extra', ['extraExpenses']],
    ['mutui', 'Mutui', ['loans']],
    ['ricorrenti', 'Spese ricorrenti (condominio, bollette, assicurazione)', ['recurring']],
    ['locazione', 'Locazione (contratto e canone)', ['rental']],
    ['tasseIT', 'Tasse Italia (IMU e altre)', ['taxesIT']],
    ['tasseEstero', 'Tasse estere', ['taxesForeign']],
    ['valutazione', 'Valutazione di mercato', ['valuation']],
    ['vendita', 'Vendita', ['sale']],
    ['confronti', 'Immobili di confronto', ['comparables']],
    ['registro', 'Registro entrate/uscite', ['ledger']],
    ['documenti', 'Documenti', ['documents']],
    ['promemoria', 'Promemoria', ['reminders']],
    ['etichette', 'Gruppo, etichette e note', ['group', 'tags', 'notes']]
  ];
  var reid = function (v) {
    if (Array.isArray(v)) v.forEach(function (it) { if (it && typeof it === 'object') { if (it.id) it.id = U.uid(); reid(it); } });
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (v[k] && typeof v[k] === 'object') reid(v[k]); });
  };
  A.copySections = function (srcId, targetIds, keys) {
    var src = A.get(srcId), fields = [];
    if (!src) return Promise.resolve(0);
    A.SECTIONS.forEach(function (s) { if (keys.indexOf(s[0]) >= 0) fields = fields.concat(s[2]); });
    return A.updateMany(targetIds.filter(function (id) { return id !== srcId; }), function (p) {
      fields.forEach(function (k) { var v = U.clone(src[k]); reid(v); p[k] = v; });
    });
  };
  A.copySectionsDialog = function (srcId, preselected) {
    var src = A.get(srcId);
    if (!src) return Promise.resolve(null);
    var others = A.props.filter(function (p) { return p.id !== srcId; });
    if (!others.length) { U.toast('Serve almeno un altro immobile di destinazione.', 'warn'); return Promise.resolve(null); }
    var pre = {}; (preselected || []).forEach(function (id) { pre[id] = 1; });
    var secs = A.SECTIONS.map(function (s) {
      return '<label class="fld-check"><input type="checkbox" name="sec" value="' + s[0] + '"><span>' + U.esc(s[1]) + '</span></label>';
    }).join('');
    var items = others.map(function (p) {
      var label = M.displayName(p) + ' · ' + M.location(p);
      return '<label class="fld-check pick" data-s="' + U.esc(U.norm(label + ' ' + (p.code || '') + ' ' + (p.group || '') + ' ' + (p.tags || []).join(' '))) + '"><input type="checkbox" name="tgt" value="' + p.id + '"' + (pre[p.id] ? ' checked' : '') + '><span>' + U.esc(label) + '</span></label>';
    }).join('');
    var body = '<p>Copia le sezioni scelte da <b>' + U.esc(M.displayName(src)) + '</b> agli immobili selezionati. I dati delle sezioni nelle destinazioni verranno <b>sovrascritti</b>.</p>' +
      '<div class="grid g2"><div><h4>Sezioni da copiare</h4><div class="stack pick-list">' + secs + '</div></div>' +
      '<div><h4>Immobili di destinazione <small class="muted" data-cnt></small></h4>' +
      '<div class="row"><input type="search" placeholder="Filtra…" data-flt class="grow" aria-label="Filtra immobili">' +
      '<button type="button" class="btn btn-sm" data-all="1">Tutti</button><button type="button" class="btn btn-sm" data-all="0">Nessuno</button></div>' +
      '<div class="stack pick-list scroll">' + items + '</div></div></div>';
    return U.modal({
      title: 'Copia sezioni su altri immobili', wide: true, body: body,
      onOpen: function (r) {
        var cnt = function () { r.querySelector('[data-cnt]').textContent = '(' + r.querySelectorAll('input[name="tgt"]:checked').length + ' selezionati)'; };
        r.querySelector('[data-flt]').addEventListener('input', function (e) {
          var q = U.norm(e.target.value);
          Array.prototype.forEach.call(r.querySelectorAll('.pick[data-s]'), function (l) { l.hidden = !!q && l.getAttribute('data-s').indexOf(q) < 0; });
        });
        Array.prototype.forEach.call(r.querySelectorAll('[data-all]'), function (b) {
          b.addEventListener('click', function () {
            var on = b.getAttribute('data-all') === '1';
            Array.prototype.forEach.call(r.querySelectorAll('.pick[data-s]'), function (l) { if (!l.hidden) l.querySelector('input').checked = on; });
            cnt();
          });
        });
        r.addEventListener('change', cnt); cnt();
      },
      buttons: [{ label: 'Annulla', value: null }, { label: 'Copia sezioni', cls: 'btn-primary', action: function (r) {
        var val = function (n) { return Array.prototype.map.call(r.querySelectorAll('input[name="' + n + '"]:checked'), function (i) { return i.value; }); };
        var o = { keys: val('sec'), ids: val('tgt') };
        if (!o.keys.length) { U.toast('Seleziona almeno una sezione', 'warn'); return false; }
        if (!o.ids.length) { U.toast('Seleziona almeno un immobile di destinazione', 'warn'); return false; }
        return o;
      } }]
    }).then(function (o) {
      if (!o) return null;
      return A.copySections(srcId, o.ids, o.keys).then(function (n) {
        U.toast(o.keys.length + ' sezioni copiate su ' + n + ' immobili', 'success', 4500);
        A.render(true);
        return n;
      });
    });
  };
  /* ---------- Dati di esempio ---------- */
  A.loadDemo = function () {
    if (!G.DEMO) return Promise.resolve([]);
    return A.addMany(G.DEMO.sample()).then(function (out) {
      if (out.length) U.toast(out.length + ' immobili di esempio caricati: puoi modificarli o eliminarli liberamente.', 'success', 5000);
      A.render(true);
      return out;
    });
  };
  A.backupDue = function () {
    if (!A.props.length) return false;
    var last = A.lastBackup || 0, newest = 0;
    A.props.forEach(function (p) { if (p.updatedAt > newest) newest = p.updatedAt; });
    return newest > last && Date.now() - last > 14 * 864e5;
  };

  /* ---------- Avvio ---------- */
  function bindShell() {
    var $ = function (id) { return document.getElementById(id); };
    var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); };
    on('menu-toggle', 'click', function () { setNav(!document.body.classList.contains('nav-open')); });
    on('nav-overlay', 'click', function () { setNav(false); });
    on('fx-status', 'click', function () { A.refreshFx(); });
    on('theme-toggle', 'click', function () { A.toggleTheme(); });
    on('btn-new', 'click', function () { A.newDialog(); });
    /* il link «Vai al contenuto» non deve cambiare l'hash, che è usato dal router */
    on('skip-link', 'click', function (e) {
      e.preventDefault();
      var m = $('app'); if (m) { try { m.focus(); } catch (er) { /* ignora */ } m.scrollIntoView(); }
    });
    var s = $('global-search');
    if (s) s.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var q = s.value.trim(); s.value = ''; s.blur();
        A.go(A.href('immobili', null, q ? { q: q } : null));
      } else if (e.key === 'Escape') { s.value = ''; s.blur(); }
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target || {}, tag = t.tagName || '';
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { setNav(false); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || t.isContentEditable || document.querySelector('.modal-backdrop')) return;
      if (e.key === '/' && s) { e.preventDefault(); s.focus(); }
    });
    window.addEventListener('hashchange', function () { A.render(); });
  }
  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (w) w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) U.toast('È disponibile una nuova versione: ricarica la pagina per usarla.', 'info', 8000);
        });
      });
    }).catch(function () { /* funziona anche senza service worker */ });
  }
  A.init = function () {
    bindShell();
    var el = document.getElementById('app');
    return DB.init().then(function () { return DB.getKV('settings'); }).then(function (s) {
      A.S = M.normalizeSettings(s); A.S.rev = 1;
      applyTheme(); syncFx();
      return FX.init();
    }).then(function () { return DB.getAll(); }).then(function (list) {
      A.props = (list || []).map(function (r) {
        try { return M.normalize(r); } catch (e) { console.error(e); return null; }
      }).filter(Boolean).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      reindex();
      return DB.getKV('lastBackup');
    }).then(function (lb) {
      A.lastBackup = lb || null;
      A.ready = true;
      updateFxStatus();
      A.render();
      var md = DB.mode();
      if (md !== 'idb') U.toast(md === 'ls' ? 'IndexedDB non disponibile: uso localStorage (spazio ridotto, evita foto e documenti pesanti).' : 'Archiviazione del browser non disponibile: i dati NON verranno conservati. Esporta un backup prima di chiudere.', 'warn', 9000);
      DB.persist();
      registerSW();
    }).catch(function (e) {
      console.error(e);
      if (el) el.innerHTML = UI.note('Impossibile avviare l\'applicazione: ' + U.esc((e && e.message) || String(e)) + '. Prova a ricaricare la pagina o a usare un browser aggiornato.', 'danger');
    });
  };

  G.APP = A;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', A.init);
  else setTimeout(A.init, 0);
})(window.GPI = window.GPI || {});
