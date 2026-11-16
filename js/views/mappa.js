/* Vista Mappa: immobili per paese e città, mappa OpenStreetMap su richiesta, link a OSM/Google Maps e ricerca coordinate */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, M = G.MODEL, CH = G.CHARTS, K = G.COUNTRIES, VH = G.VH;
  var V = {}, root = null, off = null, offIn = null, busy = false;
  var st = { q: '', status: 'attivi', sel: null, live: false, geoOk: false };
  var FILTERS = [['attivi', 'Posseduti e in vendita'], ['pipe', 'In acquisto e obiettivi'], ['venduti', 'Venduti'], ['tutti', 'Tutti']];
  var GEO_MAX = 20;

  function coords(p) {
    var a = p.address || {};
    if (!U.ok(a.lat) || !U.ok(a.lng)) return null;
    var lat = +a.lat, lng = +a.lng;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
    return { lat: lat, lng: lng };
  }
  function addrText(p, noCountry) {
    var a = p.address || {};
    var parts = [a.street, a.zip, a.city, a.province, a.region].filter(function (x) { return x != null && String(x).trim(); });
    if (!parts.length) return '';
    if (!noCountry) parts.push(K.name(p.country || 'IT'));
    return parts.join(', ');
  }
  function osmUrl(p) {
    var c = coords(p);
    return c ? 'https://www.openstreetmap.org/?mlat=' + c.lat + '&mlon=' + c.lng + '#map=17/' + c.lat + '/' + c.lng :
      'https://www.openstreetmap.org/search?query=' + encodeURIComponent(addrText(p) || M.location(p));
  }
  function gmapsUrl(p) {
    var c = coords(p);
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c ? c.lat + ',' + c.lng : (addrText(p) || M.location(p)));
  }
  function embedUrl(c) {
    var dx = 0.008, dy = 0.005;
    var bbox = [c.lng - dx, c.lat - dy, c.lng + dx, c.lat + dy].map(function (x) { return x.toFixed(5); }).join(',');
    return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + c.lat.toFixed(6) + ',' + c.lng.toFixed(6);
  }
  function inFilter(p) {
    var s = p.status;
    if (st.status === 'attivi' && !M.ACTIVE[s]) return false;
    if (st.status === 'pipe' && s !== 'in_acquisto' && s !== 'obiettivo') return false;
    if (st.status === 'venduti' && s !== 'venduto') return false;
    if (st.q) {
      var t = U.norm(M.displayName(p) + ' ' + M.location(p) + ' ' + addrText(p) + ' ' + (p.code || '') + ' ' + (p.group || ''));
      if (t.indexOf(U.norm(st.q)) < 0) return false;
    }
    return true;
  }

  /* Geocodifica con Nominatim (OpenStreetMap): una richiesta alla volta, massimo 1 al secondo */
  function geocode(p) {
    var q = addrText(p);
    if (!q || !(p.address && p.address.city)) return Promise.resolve('noaddr');
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=it&q=' + encodeURIComponent(q);
    return U.fetchJSON(url, 12000).then(function (r) {
      if (!r || !r.length) return 'notfound';
      var lat = +r[0].lat, lng = +r[0].lon;
      if (!isFinite(lat) || !isFinite(lng)) return 'notfound';
      p.address = p.address || {};
      p.address.lat = Math.round(lat * 1e6) / 1e6;
      p.address.lng = Math.round(lng * 1e6) / 1e6;
      G.APP.save(p);
      return 'ok';
    });
  }
  function askGeo() {
    if (st.geoOk) return Promise.resolve(true);
    return U.confirm('Per trovare le coordinate, l\'indirizzo (senza nome né altri dati dell\'immobile) viene inviato al servizio gratuito <b>Nominatim di OpenStreetMap</b>. ' +
      'Il risultato è indicativo: controllalo sulla mappa e correggilo se serve nella scheda Generale.', 'Continua').then(function (ok) {
      if (ok) st.geoOk = true;
      return ok;
    });
  }
  function geoOne(id) {
    var p = G.APP.get(id);
    if (!p || busy) return;
    askGeo().then(function (ok) {
      if (!ok) return null;
      busy = true;
      U.toast('Ricerca delle coordinate…', 'info', 1500);
      return geocode(p).then(function (res) {
        busy = false;
        if (res === 'ok') { U.toast('Coordinate trovate per ' + M.displayName(p), 'success'); st.sel = p.id; }
        else if (res === 'noaddr') U.toast('Indirizzo incompleto: indica almeno città e via nella scheda Generale.', 'warn', 5000);
        else U.toast('Indirizzo non trovato: semplificalo oppure inserisci latitudine e longitudine a mano.', 'warn', 6000);
        draw();
      });
    }).catch(function (e) {
      busy = false;
      U.toast('Servizio di geocodifica non raggiungibile: ' + ((e && e.message) || 'errore di rete'), 'error', 6000);
    });
  }
  function geoMany(ids) {
    if (busy) return;
    var list = ids.map(function (id) { return G.APP.get(id); }).filter(function (p) { return p && !coords(p) && p.address && p.address.city; });
    if (!list.length) { U.toast('Nessun immobile con indirizzo da geolocalizzare (servono almeno città e via).', 'info', 5000); return; }
    var extra = list.length > GEO_MAX ? list.length - GEO_MAX : 0;
    list = list.slice(0, GEO_MAX);
    askGeo().then(function (ok) {
      if (!ok) return;
      busy = true;
      var done = 0, found = 0, i = 0;
      U.toast('Ricerca coordinate per ' + list.length + ' immobili (circa ' + Math.ceil(list.length * 1.2) + ' s)…', 'info', 4000);
      var next = function () {
        if (!root || i >= list.length) {
          busy = false;
          U.toast('Coordinate trovate: ' + found + ' su ' + done + (extra ? '. Ne restano ' + extra + ': ripeti per continuare.' : ''), found ? 'success' : 'warn', 6000);
          if (root) draw();
          return;
        }
        var p = list[i++];
        geocode(p).then(function (r) { done++; if (r === 'ok') found++; }, function () { done++; })
          .then(function () { setTimeout(next, 1200); });
      };
      next();
    });
  }

  function summary(list) {
    var port = G.APP.port(), countries = {}, cities = {}, withC = 0;
    list.forEach(function (p) {
      countries[p.country || 'IT'] = 1;
      var c = (p.address && p.address.city) || '';
      if (c) cities[(p.country || 'IT') + '|' + U.norm(c)] = 1;
      if (coords(p)) withC++;
    });
    var kpis = UI.kpis([
      UI.kpi('Immobili nel filtro', String(list.length), { icon: 'building' }),
      UI.kpi('Paesi', String(Object.keys(countries).length), { icon: 'map' }),
      UI.kpi('Città', String(Object.keys(cities).length), { icon: 'home' }),
      UI.kpi('Con coordinate', withC + ' / ' + list.length, { icon: 'pin', vcls: withC < list.length ? 'warn' : '', sub: list.length - withC ? (list.length - withC) + ' da geolocalizzare' : 'tutti sulla mappa' })
    ]);
    var g = port.groups.country || {}, items = Object.keys(g).map(function (cc) {
      return { label: U.flag(cc) + ' ' + K.name(cc), value: g[cc].value || 0, sub: g[cc].n + (g[cc].n === 1 ? ' immobile' : ' immobili') };
    }).sort(function (a, b) { return b.value - a.value; });
    var chart = UI.card('Valore di mercato per paese (immobili attivi)', CH.hbars(items, { fmt: function (v) { return U.fmtEur(v); }, empty: 'Nessun immobile attivo.' }), { icon: 'chart' });
    return kpis + chart;
  }

  function mapCard(list) {
    var p = st.sel ? G.APP.get(st.sel) : null;
    if (p && !inFilter(p)) p = null;
    if (!p) p = list.filter(coords)[0] || null;
    if (!p) return UI.card('Mappa', UI.note('Nessun immobile del filtro ha coordinate. Usa <b>Trova coordinate</b> nell\'elenco oppure inserisci latitudine e longitudine nella scheda Generale.'), { icon: 'map' });
    var c = coords(p), body;
    if (!c) {
      body = UI.note('<b>' + VH.name(p) + '</b> non ha coordinate. ' + UI.btn('Trova coordinate', { cls: 'btn-sm', icon: 'pin', act: 'geo', data: ' data-id="' + U.esc(p.id) + '"' }));
    } else if (!st.live) {
      body = '<div class="map-ph"><p>' + U.icon('map', 'ico-xl') + '</p><p>La mappa interattiva viene caricata da <b>openstreetmap.org</b> solo se lo chiedi: in questo modo nessuna posizione esce dal tuo browser senza consenso.</p>' +
        '<p>' + UI.btn('Carica la mappa (OpenStreetMap)', { cls: 'btn-primary', icon: 'map', act: 'live' }) + '</p></div>';
    } else {
      body = '<div class="map-frame"><iframe title="Mappa di ' + VH.name(p) + '" src="' + U.esc(embedUrl(c)) + '" loading="lazy" referrerpolicy="no-referrer"></iframe></div>';
    }
    var head = '<div class="map-sel">' + VH.thumb(p, 'thumb-sm') + '<div><b>' + VH.link(p) + '</b><br><span class="muted">' + U.esc(addrText(p) || M.location(p)) + '</span>' +
      (c ? '<br><span class="muted small">' + c.lat.toFixed(5) + ', ' + c.lng.toFixed(5) + '</span>' : '') + '</div></div>';
    var acts = '<div class="btn-row">' + UI.btn('OpenStreetMap', { cls: 'btn-sm', icon: 'external', href: osmUrl(p), blank: true }) +
      UI.btn('Google Maps', { cls: 'btn-sm', icon: 'external', href: gmapsUrl(p), blank: true }) +
      UI.btn('Modifica indirizzo', { cls: 'btn-sm', icon: 'edit', href: G.APP.editHref(p.id, 'generale') }) +
      (st.live ? UI.btn('Chiudi mappa', { cls: 'btn-sm btn-ghost', icon: 'x', act: 'unlive' }) : '') + '</div>';
    return UI.card('Mappa', head + body + acts, { icon: 'map', cls: 'map-card' });
  }
  function row(p) {
    var A = G.APP, f = A.fin(p.id), m = f && f.m, c = coords(p);
    var val = m ? (m.sold ? 'venduto' : VH.eur(m.valueEur)) : '—';
    return '<li class="geo-it' + (st.sel === p.id ? ' sel' : '') + '">' + VH.thumb(p, 'thumb-sm') +
      '<div class="geo-b"><div><b>' + VH.link(p) + '</b> ' + UI.statusBadge(p.status) + '</div>' +
      '<div class="muted small">' + U.esc(addrText(p, true) || 'Indirizzo non indicato') + ' · ' + U.esc(M.typeLabel(p.type)) + (p.sqm ? ' · ' + U.fmtNum(p.sqm) + ' m²' : '') + '</div>' +
      '<div class="small">' + (m && !m.sold ? 'Valore ' : '') + val + (c ? ' · <span class="pos">' + U.icon('pin') + ' ' + c.lat.toFixed(4) + ', ' + c.lng.toFixed(4) + '</span>' : ' · <span class="muted">senza coordinate</span>') + '</div></div>' +
      '<div class="geo-a">' +
      (c ? UI.btn('', { cls: 'btn-sm btn-icon', icon: 'map', act: 'show', data: ' data-id="' + U.esc(p.id) + '"', title: 'Mostra sulla mappa' }) :
        UI.btn('', { cls: 'btn-sm btn-icon', icon: 'pin', act: 'geo', data: ' data-id="' + U.esc(p.id) + '"', title: 'Trova coordinate dall\'indirizzo' })) +
      UI.btn('', { cls: 'btn-sm btn-icon', icon: 'external', href: osmUrl(p), blank: true, title: 'Apri in OpenStreetMap' }) +
      UI.btn('G', { cls: 'btn-sm btn-icon', href: gmapsUrl(p), blank: true, title: 'Apri in Google Maps' }) + '</div></li>';
  }
  function groupList(list) {
    if (!list.length) return UI.card('Elenco', UI.empty('Nessun immobile', 'Nessun immobile corrisponde al filtro selezionato.', '', 'map'), { icon: 'list' });
    var byC = {};
    list.forEach(function (p) {
      var cc = p.country || 'IT', city = ((p.address && p.address.city) || '').trim() || '(città non indicata)';
      byC[cc] = byC[cc] || { n: 0, cities: {} };
      byC[cc].n++;
      var k = U.norm(city);
      byC[cc].cities[k] = byC[cc].cities[k] || { name: city, items: [] };
      byC[cc].cities[k].items.push(p);
    });
    var ccs = Object.keys(byC).sort(function (a, b) { return byC[b].n - byC[a].n || K.name(a).localeCompare(K.name(b)); });
    var open = list.length <= 60;
    var html = ccs.map(function (cc) {
      var cs = byC[cc].cities, keys = Object.keys(cs).sort(function (a, b) { return cs[b].items.length - cs[a].items.length || cs[a].name.localeCompare(cs[b].name); });
      var inner = keys.map(function (k) {
        var items = cs[k].items.slice().sort(function (a, b) { return M.displayName(a).localeCompare(M.displayName(b)); });
        return '<div class="geo-city"><h4>' + U.esc(cs[k].name) + ' <span class="muted small">(' + items.length + ')</span></h4><ul class="geo-list">' + items.map(row).join('') + '</ul></div>';
      }).join('');
      var missing = 0;
      keys.forEach(function (k) { cs[k].items.forEach(function (p) { if (!coords(p)) missing++; }); });
      var sum = U.flag(cc) + ' <b>' + U.esc(K.name(cc)) + '</b> <span class="muted">· ' + byC[cc].n + (byC[cc].n === 1 ? ' immobile' : ' immobili') + ' · ' + keys.length + ' città' +
        (missing ? ' · ' + missing + ' senza coordinate' : '') + '</span>';
      return UI.details(sum, inner, open || ccs.length === 1, 'geo-country');
    }).join('');
    var nMiss = list.filter(function (p) { return !coords(p); }).length;
    var acts = nMiss ? [UI.btn('Trova coordinate mancanti (' + Math.min(nMiss, GEO_MAX) + (nMiss > GEO_MAX ? ' di ' + nMiss : '') + ')', { cls: 'btn-sm', icon: 'pin', act: 'geoall' })] : null;
    return UI.card('Immobili per paese e città', html, { icon: 'list', actions: acts ? acts.join('') : '' });
  }

  function draw() {
    if (!root) return;
    var all = G.APP.props, list = all.filter(inFilter);
    var main = root.querySelector('[data-main]');
    if (!all.length) {
      main.innerHTML = UI.empty('Nessun immobile', 'Aggiungi i tuoi immobili oppure carica i dati di esempio per vedere la mappa del portafoglio.',
        UI.btn('Nuovo immobile', { cls: 'btn-primary', icon: 'plus', act: 'new' }) + UI.btn('Carica esempio', { icon: 'star', act: 'demo' }), 'map');
      return;
    }
    main.innerHTML = summary(list) + '<div class="geo-grid">' + mapCard(list) + groupList(list) + '</div>';
  }

  V.render = function (el, route) {
    var A = G.APP;
    st.q = (route.query && route.query.q) || '';
    if (route.query && route.query.f && FILTERS.some(function (x) { return x[0] === route.query.f; })) st.status = route.query.f;
    if (route.query && route.query.id) { st.sel = route.query.id; }
    var fopts = FILTERS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === st.status ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('');
    var bar = '<div class="toolbar"><label class="tb-f"><span class="sr-only">Cerca</span><input type="search" data-q placeholder="Cerca per nome, città, indirizzo…" value="' + U.esc(st.q) + '"></label>' +
      '<label class="tb-f"><span class="sr-only">Stato</span><select data-f>' + fopts + '</select></label></div>';
    root = VH.mount(el, UI.pageHead('Mappa del portafoglio', 'Distribuzione geografica degli immobili, in Italia e all\'estero.') + bar + '<div data-main></div>', 'view-mappa');
    var q = root.querySelector('[data-q]'), f = root.querySelector('[data-f]');
    var onQ = U.debounce(function () { if (!root) return; st.q = q.value.trim(); A.setQuery({ q: st.q, f: st.status === 'attivi' ? '' : st.status }); draw(); }, 200);
    var onF = function () { st.status = f.value; A.setQuery({ q: st.q, f: st.status === 'attivi' ? '' : st.status }); draw(); };
    q.addEventListener('input', onQ);
    f.addEventListener('change', onF);
    offIn = function () { q.removeEventListener('input', onQ); f.removeEventListener('change', onF); };
    off = UI.actions(root, {
      show: function (b) { st.sel = b.getAttribute('data-id'); draw(); var c = root.querySelector('.map-card'); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      live: function () { st.live = true; draw(); },
      unlive: function () { st.live = false; draw(); },
      geo: function (b) { geoOne(b.getAttribute('data-id')); },
      geoall: function () { geoMany(G.APP.props.filter(inFilter).map(function (p) { return p.id; })); },
      'new': function () { A.newDialog(); },
      demo: function () { A.loadDemo(); }
    });
    draw();
  };
  V.onFx = function () { draw(); };
  V.destroy = function () {
    if (off) off();
    if (offIn) offIn();
    off = offIn = null;
    root = null;
  };

  G.VIEWS = G.VIEWS || {};
  G.VIEWS.mappa = V;
})(window.GPI = window.GPI || {});
