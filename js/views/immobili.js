/* Vista Immobili: elenco con ricerca, filtri, ordinamento, schede o tabella, selezione multipla e azioni in blocco */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, M = G.MODEL, K = G.COUNTRIES, VH = G.VH;
  var V = {}, sel = {}, idx = {}, root = null, LSV = 'gpi.listView', timer = null;
  var cur = null, rows = [], last = [], inList = {}, anchor = null, off = null;

  var fv = function (k) { return function (p, f) { return f ? f[k] : null; }; };
  var mv = function (k) { return function (p, f) { return f ? f.m[k] : null; }; };
  /* Ordinamenti: chiave -> [etichetta, valore(p, f), direzione predefinita] */
  var SORTS = {
    name: ['Nome', function (p) { return M.displayName(p); }, 'asc'],
    city: ['Città', function (p) { return (p.address && p.address.city) || ''; }, 'asc'],
    country: ['Paese', function (p) { return K.name(p.country); }, 'asc'],
    type: ['Tipologia', function (p) { return M.typeLabel(p.type); }, 'asc'],
    status: ['Stato', function (p) { return M.STATUS[p.status] || ''; }, 'asc'],
    group: ['Gruppo', function (p) { return p.group || ''; }, 'asc'],
    value: ['Valore di mercato', mv('valueEur'), 'desc'],
    price: ['Prezzo d\'acquisto', mv('priceEur'), 'desc'],
    gross: ['Canoni lordi annui', mv('grossEur'), 'desc'],
    cfPost: ['Cash flow netto annuo', fv('cfPost'), 'desc'],
    netYield: ['Rendimento netto', fv('netYield'), 'desc'],
    grossYield: ['Rendimento lordo', fv('grossYield'), 'desc'],
    roi: ['ROI', fv('roi'), 'desc'],
    irr: ['TIR', fv('irr'), 'desc'],
    equityEur: ['Patrimonio netto', fv('equityEur'), 'desc'],
    debt: ['Debito residuo', fv('debt'), 'desc'],
    taxTotal: ['Imposte annue', fv('taxTotal'), 'desc'],
    sqm: ['Superficie', function (p) { return U.n(p.sqm) || null; }, 'desc'],
    buyDate: ['Data d\'acquisto', function (p) { return p.purchase.date || ''; }, 'desc'],
    updatedAt: ['Ultima modifica', function (p) { return p.updatedAt; }, 'desc'],
    createdAt: ['Data di inserimento', function (p) { return p.createdAt; }, 'desc']
  };
  var STATI = [['attivi', 'Posseduti (anche in vendita)'], ['pipeline', 'In trattativa e obiettivi']];
  var AVVISI = [['tutti', 'Con avvisi'], ['danger', 'Con avvisi gravi']];
  var PAGES = [12, 25, 50, 100, 250];
  var KEYS = ['q', 'stato', 'cat', 'tipo', 'paese', 'uso', 'gruppo', 'tag', 'valuta', 'avvisi'];

  function pref(v) {
    try {
      if (v) localStorage.setItem(LSV, v);
      return localStorage.getItem(LSV) || 'tabella';
    } catch (e) { return v || 'tabella'; }
  }
  function readQ(q) {
    var A = G.APP, o = {}, sort = SORTS[q.sort] ? q.sort : 'name', pp = parseInt(q.n, 10);
    KEYS.forEach(function (k) { o[k] = q[k] ? String(q[k]) : ''; });
    o.sort = sort;
    o.dir = q.dir === 'asc' || q.dir === 'desc' ? q.dir : SORTS[sort][2];
    o.vista = q.vista === 'schede' || q.vista === 'tabella' ? q.vista : pref();
    o.n = PAGES.indexOf(pp) >= 0 ? pp : (U.clamp(Math.round(U.n(A.S.defaults.pageSize)) || 25, 5, 500));
    o.pagina = Math.max(1, parseInt(q.pagina, 10) || 1);
    return o;
  }
  function toQuery(o) {
    var q = {};
    KEYS.forEach(function (k) { if (o[k]) q[k] = o[k]; });
    if (o.sort !== 'name' || o.dir !== 'asc') { q.sort = o.sort; q.dir = o.dir; }
    if (o.vista !== pref()) q.vista = o.vista;
    if (PAGES.indexOf(o.n) >= 0 && o.n !== U.n(G.APP.S.defaults.pageSize)) q.n = o.n;
    if (o.pagina > 1) q.pagina = o.pagina;
    return q;
  }
  function filtered(o) { return KEYS.some(function (k) { return !!o[k]; }); }

  /* Testo ricercabile normalizzato (memorizzato finché l'immobile non cambia) */
  function text(p) {
    var c = idx[p.id];
    if (c && c.u === p.updatedAt) return c.s;
    var a = p.address || {};
    var s = U.norm([M.displayName(p), p.code, a.street, a.city, a.province, a.region, a.zip, p.country, K.name(p.country), p.group, (p.tags || []).join(' '),
      M.typeLabel(p.type), M.STATUS[p.status], M.USAGE[p.usage], p.currency, p.rental && p.rental.tenant, p.notes].join(' '));
    idx[p.id] = { u: p.updatedAt, s: s };
    return s;
  }
  function level(f) {
    var l = '';
    (f && f.alerts || []).forEach(function (a) { if (a.level === 'danger') l = 'danger'; else if (a.level === 'warn' && l !== 'danger') l = 'warn'; });
    return l;
  }
  var coll = null;
  try { coll = new Intl.Collator('it', { numeric: true, sensitivity: 'base' }); } catch (e) { coll = null; }
  function empty(x) { return x == null || x === '' || (typeof x === 'number' && !isFinite(x)); }
  function cmp(a, b, dir) {
    var na = empty(a), nb = empty(b);
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    var r = typeof a === 'number' && typeof b === 'number' ? a - b : coll ? coll.compare(String(a), String(b)) : String(a).localeCompare(String(b));
    return dir === 'desc' ? -r : r;
  }
  function match(p, o, port, words) {
    var st = o.stato;
    if (st === 'attivi' ? !M.ACTIVE[p.status] : st === 'pipeline' ? !M.PIPELINE[p.status] : st && p.status !== st) return false;
    if (o.cat && (p.category || M.typeCategory(p.type)) !== o.cat) return false;
    if (o.tipo && p.type !== o.tipo) return false;
    if (o.paese && (o.paese === 'estero' ? p.country === 'IT' : p.country !== o.paese)) return false;
    if (o.uso && p.usage !== o.uso) return false;
    if (o.gruppo && (p.group || '') !== (o.gruppo === '-' ? '' : o.gruppo)) return false;
    if (o.tag && (p.tags || []).indexOf(o.tag) < 0) return false;
    if (o.valuta && p.currency !== o.valuta) return false;
    if (o.avvisi) {
      var l = level(port.byId[p.id]);
      if (!l || (o.avvisi === 'danger' && l !== 'danger')) return false;
    }
    if (words.length) {
      var s = text(p), i;
      for (i = 0; i < words.length; i++) if (s.indexOf(words[i]) < 0) return false;
    }
    return true;
  }
  /* Elenco filtrato e ordinato: [{p, f, k, n}] */
  function query(o, port) {
    var A = G.APP, words = U.norm(o.q).split(/\s+/).filter(Boolean), get = SORTS[o.sort][1];
    var rows = A.props.filter(function (p) { return match(p, o, port, words); }).map(function (p) {
      var f = port.byId[p.id];
      return { p: p, f: f, k: get(p, f), n: M.displayName(p) };
    });
    rows.sort(function (a, b) { return cmp(a.k, b.k, o.dir) || cmp(a.n, b.n, 'asc'); });
    return rows;
  }
  function inc(map, k) { if (k) map[k] = (map[k] || 0) + 1; }
  /* Valori presenti in archivio per ciascun filtro (con conteggio) */
  function facets() {
    var A = G.APP, F = { stato: {}, cat: {}, tipo: {}, paese: {}, uso: {}, gruppo: {}, tag: {}, valuta: {} }, noGroup = 0, foreign = 0;
    A.props.forEach(function (p) {
      inc(F.stato, p.status); inc(F.cat, p.category || M.typeCategory(p.type)); inc(F.tipo, p.type); inc(F.paese, p.country);
      inc(F.uso, p.usage); inc(F.valuta, p.currency);
      if (p.group) inc(F.gruppo, p.group); else noGroup++;
      if (p.country !== 'IT') foreign++;
      (p.tags || []).forEach(function (t) { inc(F.tag, t); });
    });
    F.noGroup = noGroup; F.foreign = foreign;
    return F;
  }
  function pairs(map, label, sortByLabel) {
    var ks = Object.keys(map).map(function (k) { return [k, (label ? label(k) : k) + ' (' + map[k] + ')']; });
    if (sortByLabel !== false) ks.sort(function (a, b) { return cmp(a[1], b[1], 'asc'); });
    return ks;
  }
  /* Selettore di filtro: mostrato solo se ci sono almeno 2 valori (o se è già attivo) */
  function fsel(key, label, list, val, allLabel, min) {
    if (list.length < (min || 2) && !val) return '';
    if (val && !list.some(function (x) { return x[0] === val; })) list = list.concat([[val, val + ' (0)']]);
    return '<label class="fld fld-sm"><span>' + label + '</span><select data-f="' + key + '" aria-label="Filtro: ' + U.esc(label) + '">' +
      UI.options(list, val, allLabel || 'Tutti') + '</select></label>';
  }
  function filterBar(o) {
    var A = G.APP, F = facets();
    var st = Object.keys(M.STATUS).filter(function (k) { return F.stato[k]; }).map(function (k) { return [k, M.STATUS[k] + ' (' + F.stato[k] + ')']; });
    if (st.length > 1 || o.stato === 'attivi' || o.stato === 'pipeline') st = STATI.concat(st);
    var paesi = pairs(F.paese, function (k) { return U.flag(k) + ' ' + K.name(k); });
    if (F.foreign && F.foreign < A.props.length) paesi.unshift(['estero', 'Tutti tranne l\'Italia (' + F.foreign + ')']);
    var gruppi = pairs(F.gruppo);
    if (F.noGroup && gruppi.length) gruppi.push(['-', 'Senza gruppo (' + F.noGroup + ')']);
    var sels = [
      fsel('stato', 'Stato', st, o.stato),
      fsel('cat', 'Categoria', pairs(F.cat, function (k) { return M.CATEGORIES[k] || k; }), o.cat),
      fsel('tipo', 'Tipologia', pairs(F.tipo, M.typeLabel), o.tipo),
      fsel('paese', 'Paese', paesi, o.paese),
      fsel('uso', 'Utilizzo', pairs(F.uso, function (k) { return M.USAGE[k] || k; }), o.uso),
      fsel('gruppo', 'Gruppo', gruppi, o.gruppo, 'Tutti', 1),
      fsel('tag', 'Etichetta', pairs(F.tag), o.tag, 'Tutte', 1),
      fsel('valuta', 'Valuta', pairs(F.valuta), o.valuta, 'Tutte'),
      fsel('avvisi', 'Avvisi', AVVISI, o.avvisi, 'Indifferente')
    ].join('');
    var sorts = Object.keys(SORTS).map(function (k) { return [k, SORTS[k][0]]; });
    var vbtn = function (v, icon, title) {
      return '<button type="button" class="btn btn-sm btn-icon' + (o.vista === v ? ' on' : '') + '" data-act="vista" data-v="' + v + '" aria-pressed="' + (o.vista === v) + '" title="' + title + '" aria-label="' + title + '">' + U.icon(icon) + '</button>';
    };
    return '<div class="filters card" data-box="flt">' +
      '<div class="flt-top"><label class="flt-search">' + U.icon('search') + '<input type="search" data-f="q" value="' + U.esc(o.q) + '" placeholder="Cerca per nome, città, indirizzo, codice, etichetta, inquilino…" aria-label="Cerca negli immobili" autocomplete="off"></label>' +
      '<div class="flt-tools">' +
      '<label class="fld fld-sm fld-inline"><span>Ordina</span><select data-f="sort" aria-label="Ordina per">' + UI.options(sorts, o.sort) + '</select></label>' +
      '<button type="button" class="btn btn-sm" data-act="dir" title="Inverti l\'ordine">' + (o.dir === 'asc' ? '↑ Crescente' : '↓ Decrescente') + '</button>' +
      '<label class="fld fld-sm fld-inline"><span>Per pagina</span><select data-f="n" aria-label="Immobili per pagina">' +
      UI.options((PAGES.indexOf(o.n) < 0 ? PAGES.concat([o.n]).sort(function (a, b) { return a - b; }) : PAGES).map(function (n) { return [String(n), String(n)]; }), String(o.n)) + '</select></label>' +
      '<span class="seg" role="group" aria-label="Visualizzazione">' + vbtn('tabella', 'table', 'Vista tabella') + vbtn('schede', 'grid', 'Vista a schede') + '</span>' +
      '</div></div>' +
      '<div class="flt-sel">' + sels + '<button type="button" class="btn btn-sm btn-ghost" data-act="reset"' + (filtered(o) ? '' : ' hidden') + '>' + U.icon('x') + '<span>Azzera filtri</span></button></div>' +
      '</div>';
  }
  /* Totali del sottoinsieme filtrato (solo immobili posseduti per i valori patrimoniali) */
  function summary(rows) {
    var t = { n: rows.length, act: 0, value: 0, debt: 0, equity: 0, gross: 0, cfPost: 0, taxes: 0, sqm: 0 };
    rows.forEach(function (r) {
      var f = r.f, m = f && f.m;
      if (!m || !m.active) return;
      t.act++; t.value += m.valueEur; t.debt += f.debt; t.equity += f.equityEur; t.gross += m.grossEur; t.cfPost += f.cfPost; t.taxes += f.taxTotal;
    });
    var all = G.APP.props.length;
    return '<div class="sum-bar">' +
      '<span><b>' + U.fmtNum(t.n) + '</b> ' + (t.n === 1 ? 'immobile' : 'immobili') + (t.n < all ? ' su ' + U.fmtNum(all) : '') + (t.act !== t.n ? ' · ' + U.fmtNum(t.act) + ' posseduti' : '') + '</span>' +
      (t.act ? '<span>Valore <b>' + U.fmtCompact(t.value) + '</b></span><span>Debito <b>' + U.fmtCompact(t.debt) + '</b></span>' +
        '<span>Patrimonio netto <b>' + U.fmtCompact(t.equity) + '</b></span><span>Canoni lordi <b>' + U.fmtCompact(t.gross) + '</b>/anno</span>' +
        '<span>Cash flow netto <b class="' + UI.cls(t.cfPost) + '">' + U.fmtCompact(t.cfPost) + '</b>/anno</span><span>Imposte <b>' + U.fmtCompact(t.taxes) + '</b>/anno</span>' : '') +
      '</div>';
  }
  function selIds() {
    var A = G.APP;
    Object.keys(sel).forEach(function (id) { if (!A.get(id)) delete sel[id]; });
    return Object.keys(sel);
  }
  function bulkHtml() {
    var ids = selIds(), n = ids.length, tot = last.length;
    if (!n) return '<div class="bulk muted small">' + U.icon('info') + '<span>Seleziona uno o più immobili con le caselle per confrontarli, duplicarli, modificarli, copiarne le sezioni o esportarli in blocco. Maiusc+clic seleziona un intervallo.</span></div>';
    var hidden = ids.filter(function (id) { return !inList[id]; }).length;
    return '<div class="bulk on" role="region" aria-label="Azioni sugli immobili selezionati">' +
      '<span class="bulk-n"><b>' + U.fmtNum(n) + '</b> ' + (n === 1 ? 'selezionato' : 'selezionati') + (hidden ? ' <small class="muted">(' + hidden + ' nascosti dai filtri)</small>' : '') + '</span>' +
      (n < tot ? UI.btn('Seleziona tutti i ' + U.fmtNum(tot), { cls: 'btn-sm btn-ghost', act: 'selall' }) : '') +
      UI.btn('Deseleziona', { cls: 'btn-sm btn-ghost', act: 'selnone' }) +
      '<span class="bulk-a">' +
      UI.btn('Confronta', { cls: 'btn-sm', icon: 'compare', act: 'b-compare', disabled: n < 2, title: n < 2 ? 'Seleziona almeno 2 immobili' : 'Confronto affiancato delle metriche (fino a 10 immobili)' }) +
      UI.btn('Duplica', { cls: 'btn-sm', icon: 'copy', act: 'b-dup', title: 'Crea copie degli immobili selezionati' }) +
      UI.btn('Modifica', { cls: 'btn-sm', icon: 'edit', act: 'b-edit', title: 'Modifica in blocco stato, utilizzo, gruppo, etichette, valori e canoni' }) +
      UI.btn('Copia sezioni da…', { cls: 'btn-sm', icon: 'paste', act: 'b-sections', title: 'Copia sezioni (spese, tasse, mutui, locazione…) da un altro immobile su quelli selezionati' }) +
      UI.btn('JSON', { cls: 'btn-sm', icon: 'download', act: 'b-json', title: 'Esporta i selezionati in JSON (reimportabile)' }) +
      UI.btn('CSV', { cls: 'btn-sm', icon: 'table', act: 'b-csv', title: 'Esporta i selezionati con tutte le metriche (CSV per Excel)' }) +
      UI.btn('Elimina', { cls: 'btn-sm btn-danger', icon: 'trash', act: 'b-del' }) +
      '</span></div>';
  }
  function sortTh(k, label, o) {
    var on = o.sort === k;
    return '<button type="button" class="th-sort' + (on ? ' on ' + o.dir : '') + '" data-act="sort" data-k="' + k + '" title="Ordina per ' + U.esc(SORTS[k][0].toLowerCase()) + '">' + label + '</button>';
  }
  function ariaSort(k, o) { return o.sort === k ? ' aria-sort="' + (o.dir === 'asc' ? 'ascending' : 'descending') + '"' : ''; }
  function chk(id) { return '<input type="checkbox" data-sel="' + U.esc(id) + '"' + (sel[id] ? ' checked' : '') + ' aria-label="Seleziona immobile">'; }
  function dots(f) {
    var a = (f && f.alerts || []).filter(function (x) { return x.level !== 'info'; });
    if (!a.length) return '';
    return '<a class="al-dot dot-' + level(f) + '" href="' + G.APP.editHref(f.id, a[0].tab) + '" title="' + U.esc(a.map(function (x) { return '• ' + x.msg; }).join('\n')) + '">' +
      U.icon('alert') + '<span>' + a.length + '</span></a>';
  }
  function rowActs(p) {
    var d = ' data-id="' + U.esc(p.id) + '"';
    return '<span class="row-a">' +
      UI.btn('', { cls: 'btn-sm btn-icon btn-ghost', icon: 'edit', href: G.APP.editHref(p.id), title: 'Apri la scheda' }) +
      UI.btn('', { cls: 'btn-sm btn-icon btn-ghost', icon: 'copy', act: 'dup', data: d, title: 'Duplica' }) +
      UI.btn('', { cls: 'btn-sm btn-icon btn-ghost', icon: 'paste', act: 'clip', data: d, title: 'Copia negli appunti (da incollare qui o in un altro browser)' }) +
      UI.btn('', { cls: 'btn-sm btn-icon btn-ghost', icon: 'trash', act: 'del', data: d, title: 'Elimina' }) + '</span>';
  }
  function tagsHtml(p) {
    var t = (p.tags || []).slice(0, 4).map(function (x) { return '<span class="tag">' + U.esc(x) + '</span>'; }).join('');
    return t || p.group ? '<div class="tags">' + (p.group ? '<span class="tag tag-g">' + U.icon('list') + U.esc(p.group) + '</span>' : '') + t + '</div>' : '';
  }
  function valueCell(m) {
    var sub = [];
    if (m.cur && m.cur !== 'EUR' && m.valueL) sub.push(U.fmtMoney(m.valueL, m.cur));
    if (m.share < 1) sub.push('quota ' + U.fmtPct(m.share, 0));
    if (m.valueEstimated) sub.push('stima');
    return U.fmtEur(m.valueEur) + (sub.length ? '<div class="muted small">' + U.esc(sub.join(' · ')) + '</div>' : '');
  }
  function roiCell(f) {
    if (!f || !U.ok(f.roi)) return '—';
    return UI.signed(f.roi, 'pct') + (f.roiKind ? '<div class="muted small">' + U.esc(f.roiKind) + '</div>' : '');
  }
  function tableHtml(page) {
    var o = cur, A = G.APP;
    var allOn = page.length > 0 && page.every(function (r) { return sel[r.p.id]; });
    var S = function (k, label, cls, render) { return { label: sortTh(k, label, o), cls: cls, thAttrs: ariaSort(k, o), render: render }; };
    var cols = [
      { label: '<input type="checkbox" data-selpage' + (allOn ? ' checked' : '') + ' aria-label="Seleziona tutti gli immobili della pagina" title="Seleziona tutta la pagina">', cls: 'sel-col', render: function (r) { return chk(r.p.id); } },
      S('name', 'Immobile', 'c-name', function (r) {
        var p = r.p;
        return '<div class="pc-name">' + VH.thumb(p, 'thumb-sm') + '<div><a class="lnk-strong" href="' + A.editHref(p.id) + '">' + U.esc(r.n) + '</a>' +
          '<div class="muted small">' + (p.code ? U.esc(p.code) + ' · ' : '') + VH.loc(p) + '</div>' + tagsHtml(p) + '</div></div>';
      }),
      S('type', 'Tipologia', '', function (r) {
        var c = r.p.category || M.typeCategory(r.p.type);
        return U.esc(M.typeLabel(r.p.type)) + '<div class="muted small">' + U.esc(M.CATEGORIES[c] || c || '') + (U.n(r.p.unitsCount) > 1 ? ' · ' + U.fmtNum(r.p.unitsCount) + ' unità' : '') + '</div>';
      }),
      S('status', 'Stato', '', function (r) { return UI.statusBadge(r.p.status) + '<div class="muted small">' + U.esc(M.USAGE[r.p.usage] || '') + '</div>'; }),
      S('sqm', 'm²', 'num', function (r) { return U.n(r.p.sqm) ? U.fmtNum(r.p.sqm) : '—'; }),
      S('value', 'Valore', 'num', function (r) { return r.f ? valueCell(r.f.m) : '—'; }),
      S('gross', 'Canoni/anno', 'num', function (r) { return r.f && r.f.m.grossEur ? U.fmtEur(r.f.m.grossEur) : '—'; }),
      S('cfPost', 'Cash flow netto', 'num', function (r) { return r.f ? UI.signed(r.f.cfPost) : '—'; }),
      S('netYield', 'Rend. netto', 'num', function (r) { return r.f && U.ok(r.f.netYield) && r.f.m.grossEur ? U.fmtPct(r.f.netYield, 2) : '—'; }),
      S('roi', 'ROI', 'num', function (r) { return roiCell(r.f); }),
      { label: '<span class="sr-only">Avvisi</span>', cls: 'c-al', render: function (r) { return dots(r.f); } },
      { label: '<span class="sr-only">Azioni</span>', cls: 'c-act', render: function (r) { return rowActs(r.p); } }
    ];
    return UI.table(cols, page, { cls: 'tbl-props tbl-hover', wrapCls: 'tbl-sticky', rowAttrs: function (r) { return 'data-id="' + U.esc(r.p.id) + '"' + (sel[r.p.id] ? ' class="sel"' : ''); } });
  }
  function cardsHtml(page) {
    var A = G.APP;
    return '<div class="prop-cards">' + page.map(function (r) {
      var p = r.p, f = r.f, m = f && f.m, c = p.category || M.typeCategory(p.type);
      var kv = function (l, v) { return '<div><dt>' + l + '</dt><dd>' + v + '</dd></div>'; };
      return '<article class="prop-card' + (sel[p.id] ? ' sel' : '') + '" data-id="' + U.esc(p.id) + '">' +
        '<label class="pc-chk" title="Seleziona">' + chk(p.id) + '</label>' + dots(f) +
        '<a class="pc-img" href="' + A.editHref(p.id) + '" tabindex="-1" aria-hidden="true">' + VH.thumb(p, 'thumb-lg') + '</a>' +
        '<div class="pc-body"><h3><a href="' + A.editHref(p.id) + '">' + U.esc(r.n) + '</a></h3>' +
        '<div class="muted small">' + VH.loc(p) + '</div>' +
        '<div class="pc-badges">' + UI.statusBadge(p.status) + UI.badge(U.esc(M.typeLabel(p.type))) + (c ? UI.badge(U.esc(M.CATEGORIES[c] || c), 'b-soft') : '') + '</div>' +
        tagsHtml(p) +
        '<dl class="pc-kv">' +
        kv('Valore', m ? U.fmtCompact(m.valueEur) : '—') +
        kv('Canoni/anno', m && m.grossEur ? U.fmtCompact(m.grossEur) : '—') +
        kv('Cash flow netto', f ? '<span class="' + UI.cls(f.cfPost) + '">' + U.fmtCompact(f.cfPost) + '</span>' : '—') +
        kv('ROI', f && U.ok(f.roi) ? UI.signed(f.roi, 'pct') : '—') +
        '</dl></div>' +
        '<footer class="pc-foot">' + (p.sqm ? '<span class="muted small">' + U.fmtNum(p.sqm) + ' m²</span>' : '<span></span>') + rowActs(p) + '</footer>' +
        '</article>';
    }).join('') + '</div>';
  }
  /* Modifica in blocco: Promise del numero di immobili aggiornati */
  function bulkEdit(ids) {
    var A = G.APP, groups = {}, tags = {}, d = {}, KEEP = '— invariato —';
    A.props.forEach(function (p) { if (p.group) groups[p.group] = 1; (p.tags || []).forEach(function (t) { tags[t] = 1; }); });
    var body = '<p>Modifica <b>' + ids.length + '</b> ' + (ids.length === 1 ? 'immobile' : 'immobili') + '. I campi lasciati vuoti o "invariato" non vengono modificati.</p>' +
      UI.grid([
        UI.select(d, 'status', 'Stato', M.STATUS, { id: 'be-status', empty: KEEP }),
        UI.select(d, 'usage', 'Utilizzo', M.USAGE, { id: 'be-usage', empty: KEEP }),
        UI.text(d, 'group', 'Gruppo / portafoglio', { id: 'be-group', list: 'be-groups', placeholder: 'invariato', hint: 'Scrivi "-" per togliere il gruppo' }),
        UI.text(d, 'tadd', 'Aggiungi etichette', { id: 'be-tadd', list: 'be-tags', placeholder: 'es. da ristrutturare, Milano', hint: 'Separate da virgola' }),
        UI.text(d, 'tdel', 'Rimuovi etichette', { id: 'be-tdel', list: 'be-tags', placeholder: 'es. vecchia etichetta' }),
        UI.pct(d, 'val', 'Rivaluta il valore di mercato', { id: 'be-val', placeholder: 'es. 3 oppure -2,5', hint: 'Sul valore di mercato attuale (o sul prezzo d\'acquisto se manca). Aggiorna la data della stima.' }),
        UI.pct(d, 'rent', 'Adegua canoni e tariffe', { id: 'be-rent', placeholder: 'es. 1,8 (ISTAT)', hint: 'Canone mensile e tariffa per notte' }),
        UI.field(d, 'acc', 'Annotazione', { type: 'select', id: 'be-note', options: [['', 'Non annotare'], ['note', 'Annota la modifica nelle note dell\'immobile']] })
      ], 2) +
      UI.datalist('be-groups', Object.keys(groups).sort()) + UI.datalist('be-tags', Object.keys(tags).sort());
    return U.modal({
      title: 'Modifica in blocco', body: body, wide: true, enterButton: 1,
      buttons: [{ label: 'Annulla', value: null }, { label: 'Applica', cls: 'btn-primary', action: function (r) {
        var g = function (id) { return r.querySelector('#' + id); };
        var val = UI.readValue(g('be-val')), rent = UI.readValue(g('be-rent'));
        if (val === undefined || rent === undefined) { U.toast('Percentuale non valida', 'warn'); return false; }
        if ((val != null && val <= -100) || (rent != null && rent <= -100)) { U.toast('La variazione deve essere maggiore di -100%', 'warn'); return false; }
        var split = function (s) { return String(s || '').split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean); };
        var o = { status: g('be-status').value, usage: g('be-usage').value, group: g('be-group').value.trim(), tadd: split(g('be-tadd').value),
          tdel: split(g('be-tdel').value), val: val, rent: rent, note: g('be-note').value === 'note' };
        if (!o.status && !o.usage && !o.group && !o.tadd.length && !o.tdel.length && val == null && rent == null) { U.toast('Nessuna modifica indicata', 'warn'); return false; }
        return o;
      } }]
    }).then(function (o) {
      if (!o) return 0;
      var today = U.todayISO(), changes = [];
      if (o.status) changes.push('stato: ' + M.STATUS[o.status]);
      if (o.usage) changes.push('utilizzo: ' + M.USAGE[o.usage]);
      if (o.group) changes.push(o.group === '-' ? 'gruppo rimosso' : 'gruppo: ' + o.group);
      if (o.val != null) changes.push('valore ' + (o.val > 0 ? '+' : '') + U.fmtNum(o.val, 2) + '%');
      if (o.rent != null) changes.push('canoni ' + (o.rent > 0 ? '+' : '') + U.fmtNum(o.rent, 2) + '%');
      return A.updateMany(ids, function (p) {
        if (o.status) p.status = o.status;
        if (o.usage) p.usage = o.usage;
        if (o.group) p.group = o.group === '-' ? '' : o.group;
        if (o.tadd.length || o.tdel.length) {
          var t = (p.tags || []).filter(function (x) { return o.tdel.indexOf(x) < 0; });
          o.tadd.forEach(function (x) { if (t.indexOf(x) < 0) t.push(x); });
          p.tags = t;
        }
        if (o.val != null) {
          var base = U.n(p.valuation.marketValue) || U.n(p.purchase.price);
          if (base) {
            var nv = Math.round(base * (1 + o.val / 100));
            p.valuation.history.push({ date: today, value: nv, source: 'Rivalutazione in blocco ' + (o.val > 0 ? '+' : '') + U.fmtNum(o.val, 2) + '%' });
            p.valuation.marketValue = nv; p.valuation.date = today; p.valuation.source = 'Rivalutazione in blocco';
          }
        }
        if (o.rent != null) {
          var k = 1 + o.rent / 100;
          if (U.n(p.rental.monthlyRent)) p.rental.monthlyRent = Math.round(U.n(p.rental.monthlyRent) * k * 100) / 100;
          if (U.n(p.rental.nightlyRate)) p.rental.nightlyRate = Math.round(U.n(p.rental.nightlyRate) * k * 100) / 100;
        }
        if (o.note && changes.length) p.notes = (p.notes ? p.notes + '\n' : '') + U.fmtDate(today) + ' — modifica in blocco: ' + changes.join(', ');
      }).then(function (n) { U.toast(U.fmtNum(n) + ' immobili aggiornati', 'success'); return n; });
    });
  }
  function compute() {
    var A = G.APP;
    rows = query(cur, A.port());
    last = rows.map(function (r) { return r.p.id; });
    inList = {};
    last.forEach(function (id) { inList[id] = 1; });
    A.lastList = last.slice();
  }
  function resHtml() {
    var A = G.APP;
    if (!rows.length) return UI.empty('Nessun immobile corrisponde ai filtri', 'Modifica la ricerca o azzera i filtri per vedere tutti gli ' + U.fmtNum(A.props.length) + ' immobili in archivio.', UI.btn('Azzera filtri', { cls: 'btn-primary', icon: 'x', act: 'reset' }), 'search');
    var pages = Math.max(1, Math.ceil(rows.length / cur.n));
    if (cur.pagina > pages) cur.pagina = pages;
    var s = (cur.pagina - 1) * cur.n, page = rows.slice(s, s + cur.n);
    return summary(rows) + (cur.vista === 'schede' ? cardsHtml(page) : tableHtml(page)) + UI.pager(cur.pagina, pages, rows.length, rows.length === 1 ? 'immobile' : 'immobili');
  }
  function box(k) { return root ? root.querySelector('[data-box="' + k + '"]') : null; }
  function each(selector, fn) { Array.prototype.forEach.call(root.querySelectorAll(selector), fn); }
  /* Allinea caselle, righe evidenziate e barra delle azioni alla selezione corrente */
  function markDom() {
    if (!root) return;
    var tot = 0, on = 0;
    each('[data-box="res"] input[data-sel]', function (c) {
      var v = !!sel[c.getAttribute('data-sel')], row = c.closest('tr, .prop-card');
      c.checked = v; tot++; if (v) on++;
      if (row) row.classList.toggle('sel', v);
    });
    var all = root.querySelector('input[data-selpage]');
    if (all) { all.checked = tot > 0 && on === tot; all.indeterminate = on > 0 && on < tot; }
    var b = box('bulk');
    if (b) b.innerHTML = bulkHtml();
  }
  function syncTools() {
    var r = root.querySelector('.filters [data-act="reset"]'), d = root.querySelector('[data-act="dir"]'), s = root.querySelector('select[data-f="sort"]');
    if (r) r.hidden = !filtered(cur);
    if (d) d.textContent = cur.dir === 'asc' ? '↑ Crescente' : '↓ Decrescente';
    if (s) s.value = cur.sort;
    each('[data-act="vista"]', function (b) {
      var on = b.getAttribute('data-v') === cur.vista;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  /* Ricalcola solo i risultati: la barra dei filtri (e il focus nella ricerca) resta intatta */
  function refresh(keepPage) {
    if (!root || !cur) return;
    if (!keepPage) cur.pagina = 1;
    compute();
    G.APP.setQuery(toQuery(cur));
    G.APP.listQuery = toQuery(cur);
    var r = box('res');
    if (r) r.innerHTML = resHtml();
    markDom(); syncTools();
  }
  function onClick(ev) {
    var t = ev.target;
    if (!t || !t.matches) return;
    if (t.matches('input[data-sel]')) {
      var id = t.getAttribute('data-sel'), on = t.checked, a, b, i;
      if (ev.shiftKey && anchor && inList[anchor] && inList[id] && anchor !== id) {
        a = last.indexOf(anchor); b = last.indexOf(id);
        if (a > b) { i = a; a = b; b = i; }
        for (i = a; i <= b; i++) { if (on) sel[last[i]] = 1; else delete sel[last[i]]; }
      } else if (on) sel[id] = 1; else delete sel[id];
      anchor = id;
      markDom();
    } else if (t.matches('input[data-selpage]')) {
      var v = t.checked;
      each('[data-box="res"] input[data-sel]', function (c) { var k = c.getAttribute('data-sel'); if (v) sel[k] = 1; else delete sel[k]; });
      markDom();
    }
  }
  function onChange(ev) {
    var t = ev.target, k = t && t.getAttribute ? t.getAttribute('data-f') : null;
    if (!k) return;
    if (k === 'q') { if (timer) { clearTimeout(timer); timer = null; } if (cur.q === t.value) return; cur.q = t.value; }
    else if (k === 'sort') { cur.sort = SORTS[t.value] ? t.value : 'name'; cur.dir = SORTS[cur.sort][2]; }
    else if (k === 'n') cur.n = parseInt(t.value, 10) || 25;
    else cur[k] = t.value;
    refresh(false);
  }
  function onInput(ev) {
    var t = ev.target;
    if (!t || !t.getAttribute || t.getAttribute('data-f') !== 'q') return;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; if (cur && cur.q !== t.value) { cur.q = t.value; refresh(false); } }, 250);
  }
  function actionMap() {
    var A = G.APP;
    var redraw = function (x) { if (x && (x.length || x > 0)) A.render(true); };
    var keepView = function () { var q = toQuery(cur), o = {}; ['sort', 'dir', 'vista', 'n'].forEach(function (k) { if (q[k]) o[k] = q[k]; }); return o; };
    return {
      'new': function () { A.newDialog(); },
      paste: function () { A.pasteProp(); },
      'import': function () { A.importFile(); },
      'export': function () { A.exportJSON(); },
      csv: function () { if (last.length) A.exportCSV(last); },
      print: function () { window.print(); },
      demo: function () { A.loadDemo(); },
      reset: function () { cur.q = ''; A.go(A.href('immobili', [], keepView()), true); },
      dir: function () { cur.dir = cur.dir === 'asc' ? 'desc' : 'asc'; refresh(false); },
      sort: function (el) {
        var k = el.getAttribute('data-k');
        if (!SORTS[k]) return;
        if (cur.sort === k) cur.dir = cur.dir === 'asc' ? 'desc' : 'asc'; else { cur.sort = k; cur.dir = SORTS[k][2]; }
        refresh(false);
      },
      vista: function (el) { cur.vista = el.getAttribute('data-v') === 'schede' ? 'schede' : 'tabella'; pref(cur.vista); refresh(true); },
      page: function (el) {
        cur.pagina = Math.max(1, parseInt(el.getAttribute('data-page'), 10) || 1);
        refresh(true);
        var r = box('res');
        if (r && r.getBoundingClientRect().top < 0) r.scrollIntoView({ block: 'start' });
      },
      selall: function () { last.forEach(function (id) { sel[id] = 1; }); markDom(); },
      selnone: function () { sel = {}; anchor = null; markDom(); },
      dup: function (el) { VH.duplicate([el.getAttribute('data-id')]).then(redraw); },
      clip: function (el) { A.copyProp(el.getAttribute('data-id')); },
      del: function (el) { VH.remove([el.getAttribute('data-id')]).then(function (n) { selIds(); redraw(n); }); },
      'b-compare': function () {
        var ids = selIds();
        if (ids.length > 10) U.toast('Il confronto mostra i primi 10 immobili selezionati', 'info', 4000);
        A.go(A.href('confronta', [], { ids: ids.slice(0, 10).join(',') }));
      },
      'b-dup': function () { VH.duplicate(selIds()).then(redraw); },
      'b-edit': function () { bulkEdit(selIds()).then(redraw); },
      'b-sections': function () {
        var ids = selIds();
        VH.pickProperty('Copia sezioni da…', { text: 'Scegli l\'immobile <b>di origine</b>: al passo successivo sceglierai le sezioni (spese, tasse, mutui, locazione…) da copiare sugli immobili selezionati.', okLabel: 'Avanti' })
          .then(function (src) { if (src) A.copySectionsDialog(src, ids); });
      },
      'b-json': function () { A.exportJSON(selIds(), 'immobili-selezionati'); },
      'b-csv': function () { A.exportCSV(selIds()); },
      'b-del': function () { VH.remove(selIds()).then(function (n) { selIds(); redraw(n); }); }
    };
  }
  function headActions(A) {
    return UI.btn('Nuovo immobile', { cls: 'btn-primary', icon: 'plus', act: 'new', disabled: !A.room() }) +
      UI.btn('Incolla', { icon: 'paste', act: 'paste', title: 'Incolla un immobile copiato con il pulsante "Copia" (anche da un altro browser o dispositivo)' }) +
      UI.btn('Importa', { icon: 'upload', act: 'import', title: 'Importa un backup JSON (anche cifrato) esportato da questa applicazione' }) +
      UI.btn('Backup', { icon: 'download', act: 'export', title: 'Esporta tutti gli immobili e le impostazioni in JSON' }) +
      UI.btn('CSV', { icon: 'table', act: 'csv', title: 'Esporta gli immobili filtrati con tutte le metriche (Excel)' }) +
      UI.btn('', { icon: 'print', act: 'print', cls: 'btn-icon', title: 'Stampa l\'elenco' });
  }
  V.render = function (el, route) {
    var A = G.APP, n = A.props.length;
    cur = readQ(route.query || {});
    var sub = U.fmtNum(n) + ' di ' + U.fmtNum(A.MAX) + ' immobili in archivio' + (n >= A.MAX * 0.9 ? ' · <b class="neg">limite quasi raggiunto</b>' : '');
    var html;
    if (!n) {
      html = UI.pageHead('Immobili', sub, '') + UI.empty('Nessun immobile in archivio',
        'Inserisci il primo immobile (residenziale o commerciale, in Italia o all\'estero), carica i dati di esempio per provare tutte le funzioni oppure importa un backup.',
        UI.btn('Nuovo immobile', { cls: 'btn-primary', icon: 'plus', act: 'new' }) + UI.btn('Carica esempi', { icon: 'star', act: 'demo' }) +
        UI.btn('Importa', { icon: 'upload', act: 'import' }) + UI.btn('Incolla', { icon: 'paste', act: 'paste' }), 'building');
      root = VH.mount(el, html, 'list');
      off = UI.actions(root, actionMap());
      return;
    }
    compute();
    A.listQuery = toQuery(cur);
    html = UI.pageHead('Immobili', sub, headActions(A)) + filterBar(cur) +
      '<div data-box="bulk">' + bulkHtml() + '</div><div data-box="res">' + resHtml() + '</div>';
    root = VH.mount(el, html, 'list');
    off = UI.actions(root, actionMap());
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    markDom();
  };
  V.onFx = function () { refresh(true); };
  V.destroy = function () {
    clearTimeout(timer); timer = null;
    if (off) { off(); off = null; }
    root = null;
  };

  G.VIEWS = G.VIEWS || {};
  G.VIEWS.immobili = V;
})(window.GPI = window.GPI || {});
