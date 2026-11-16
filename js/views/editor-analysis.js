/* Patrimonio Immobiliare – schede "Confronti" (portali e comparabili) e "Analisi" (indicatori, proiezioni, simulazioni) */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, C = G.CALC, CH = G.CHARTS, PT = G.PORTALS;
  var ED = G.ED = G.ED || {}, TABS = G.EDTABS = G.EDTABS || {}, CALC = G.EDCALC = G.EDCALC || {}, ACT = G.EDACT = G.EDACT || {};

  var MAX_CMP = 500;
  var KINDS = [['vendita', 'In vendita'], ['affitto', 'In affitto']];
  var YEARS = [5, 10, 15, 20, 25, 30];
  var SRC = ['Idealista', 'Immobiliare.it', 'Casa.it', 'Subito.it', 'Wikicasa', 'Agenzia', 'Perizia', 'Rightmove', 'Zoopla', 'Fotocasa', 'SeLoger', 'Leboncoin', 'ImmobilienScout24', 'Funda', 'Imovirtual', 'Zillow'];
  var SIM = {};
  var PEND = { pid: null, items: [], text: '' };

  /* ---------- Formattazione ---------- */
  function eur(x, d) { return U.ok(x) ? U.fmtEur(x, d || 0) : '—'; }
  function money(x, cur, d) {
    if (!U.ok(x)) return '—';
    try { return U.fmtMoney(x, cur || 'EUR', d || 0); } catch (e) { return U.fmtNum(x, d || 0) + ' ' + U.esc(cur || ''); }
  }
  function loc(s, x, d) { return money(x, s.cur, d); }
  function pct(x, d) { return U.fmtPct(x, d == null ? 1 : d); }
  function pos(x) { return U.ok(x) && x > 0 ? x : 0; }
  function rate(s) { var r = s.m && s.m.rNow; return r > 0 ? r : 1; }
  function leR(s, xL, r) { return U.ok(xL) ? ED.le(s, xL, xL / (r > 0 ? r : rate(s))) : '—'; }
  function le(s, xL) { return leR(s, xL, rate(s)); }
  function numOr(v) { return typeof v === 'number' ? (isFinite(v) ? v : null) : U.parseNum(v); }
  function eurC(x) { return eur(x, 0); }
  function axis(x) { return U.fmtCompact(x); }
  function signed(x) { return U.ok(x) ? '<span class="' + UI.cls(x) + '">' + eur(x) + '</span>' : '—'; }
  function csvNum(x) { return U.ok(x) ? U.round(x, 2) : ''; }
  function csvPct(x) { return U.ok(x) ? U.round(x * 100, 2) : ''; }
  function defaults(s) { return (s.m && s.m.D) || (s.S && s.S.defaults) || {}; }
  function hostOf(u) { var m = /^https?:\/\/([^\/?#:]+)/i.exec(u || ''); return m ? m[1].replace(/^www\./i, '') : ''; }
  function attr(el, name) { return el && el.getAttribute ? el.getAttribute(name) : null; }

  /* ---------- Stato della simulazione (solo in memoria, per immobile) ---------- */
  function sim(s) {
    var k = s.pid;
    if (!SIM[k]) SIM[k] = { years: Math.round(U.n(defaults(s).projectionYears)) || 10, price: null, costs: null, date: '', rate: null };
    return SIM[k];
  }
  function years(s) {
    var y = Math.round(U.n(sim(s).years)) || 10;
    return Math.max(1, Math.min(50, y));
  }
  function simField(s, key, label, o) {
    o = o || {};
    o.attrs = (o.attrs || '') + ' data-nobind="1" data-sim="' + key + '"';
    return UI.field({ sim: sim(s) }, 'sim.' + key, label, o);
  }
  var simLater = U.debounce(function () { if (ED.current()) ED.recalc(); }, 300);

  /* ---------- Comparabili ---------- */
  function isRent(c) { return !!c && c.kind === 'affitto'; }
  function sqmPrice(c) {
    var pr = U.n(c && c.price), q = U.n(c && c.sqm);
    return pr > 0 && q > 0 ? pr / q : null;
  }
  /* mode: 'low' = negativo è favorevole, 'high' = positivo è favorevole, '' = neutro */
  function gapHtml(x, mode) {
    if (!U.ok(x)) return '—';
    var t = (x > 0 ? '+' : x < 0 ? '−' : '') + U.fmtPct(Math.abs(x), 1);
    var good = mode === 'low' ? x < 0 : mode === 'high' ? x > 0 : null;
    var cls = good === null || x === 0 ? '' : good ? 'pos' : 'neg';
    return '<span class="gap' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
  }
  function cmpSort(a, b) {
    var ka = isRent(a) ? 1 : 0, kb = isRent(b) ? 1 : 0;
    if (ka !== kb) return ka - kb;
    var x = sqmPrice(a), y = sqmPrice(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  }
  function appUrl() { return String(location.href).split('#')[0]; }

  /* JSON incollato: payload del bookmarklet {u,t,p,c,x}, array di annunci o {comparables:[...]} (export del programma) */
  function fromJson(t) {
    var d;
    try { d = JSON.parse(t); } catch (e) { return null; }
    if (!d || typeof d !== 'object') return null;
    var one = function (r) {
      if (!r || typeof r !== 'object') return null;
      if ((r.u || r.x) && !r.price) { try { return PT.fromPayload(r) || null; } catch (e2) { return null; } }
      var dt = String(r.date || ''), cur = String(r.currency || '').toUpperCase();
      return {
        kind: r.kind === 'affitto' ? 'affitto' : 'vendita',
        price: numOr(r.price),
        currency: /^[A-Z]{3}$/.test(cur) ? cur : '',
        sqm: numOr(r.sqm),
        rooms: numOr(r.rooms),
        url: U.safeUrl(String(r.url || '')),
        title: r.title ? String(r.title).slice(0, 200) : '',
        city: r.city ? String(r.city).slice(0, 80) : '',
        source: r.source ? String(r.source).slice(0, 60) : '',
        date: /^\d{4}-\d{2}-\d{2}$/.test(dt) ? dt : '',
        notes: r.notes ? String(r.notes).slice(0, 500) : ''
      };
    };
    var arr = d instanceof Array ? d : d.comparables instanceof Array ? d.comparables : [d];
    var out = [];
    arr.forEach(function (r) { var c = one(r); if (c) out.push(c); });
    return out;
  }

  function pendCount() {
    var n = 0, i;
    PEND.items.forEach(function (r) { if (!r.skip) n++; });
    var els = document.querySelectorAll('[data-pend-count]');
    for (i = 0; i < els.length; i++) els[i].textContent = String(n);
    var b = document.querySelector('[data-act="cmp-add"]');
    if (b) b.disabled = !n;
    var all = document.querySelector('[data-pend-all]');
    if (all) { all.checked = n === PEND.items.length; all.indeterminate = n > 0 && n < PEND.items.length; }
  }

  function projection(s) {
    if (!s.m || s.m.sold) return null;
    try { return C.projection(s.m, s.ctx, years(s)); } catch (e) { return null; }
  }

  /* Campi non legati all'immobile: simulazione, selezione degli annunci da importare, testo incollato */
  function onSim(ev) {
    var el = ev.target, s = ED.current(), i;
    if (!s || !el || !el.hasAttribute) return;
    if (el.hasAttribute('data-pend-all')) {
      var on = !!el.checked;
      PEND.items.forEach(function (r) { r.skip = !on; });
      var cbs = document.querySelectorAll('[data-pend]');
      for (i = 0; i < cbs.length; i++) cbs[i].checked = on;
      pendCount();
      return;
    }
    if (el.hasAttribute('data-pend')) {
      var r1 = PEND.items[+el.getAttribute('data-pend')];
      if (r1) r1.skip = !el.checked;
      pendCount();
      return;
    }
    if (el.hasAttribute('data-pend-kind')) {
      var r2 = PEND.items[+el.getAttribute('data-pend-kind')];
      if (r2) r2.kind = el.value === 'affitto' ? 'affitto' : 'vendita';
      return;
    }
    if (el.hasAttribute('data-paste')) { PEND.text = el.value; PEND.pid = s.pid; return; }
    var host = el.hasAttribute('data-sim') ? el : el.closest ? el.closest('[data-sim]') : null;
    if (!host) return;
    if (ev.type === 'input' && el.tagName === 'SELECT') return;
    var key = host.getAttribute('data-sim'), v = UI.readValue(el);
    if (v === undefined) { el.classList.add('invalid'); return; }
    el.classList.remove('invalid');
    if (key === 'years') v = Math.max(1, Math.min(50, Math.round(U.n(v)) || 10));
    sim(s)[key] = v === '' ? null : v;
    if (ev.type === 'change') ED.recalc(); else simLater();
  }

  /* ---------- Scheda "Confronti": ricerca sui portali ---------- */
  function portalsCard(s) {
    var p = s.p, groups, html = '';
    try { groups = PT.links(p) || []; } catch (e) { groups = []; }
    if (!(p.address && p.address.city)) html += UI.note('Indica la <b>città</b> (e se possibile l\'indirizzo) nella scheda <a href="' + U.esc(G.APP.editHref(p.id, 'generale')) + '">Generale</a>: le ricerche sui portali saranno più precise.', 'warn');
    groups.forEach(function (g) {
      var links = ((g && g.items) || []).map(function (it) {
        var u = U.safeUrl(it.url || '');
        return u ? '<a class="btn btn-sm" href="' + U.esc(u) + '" target="_blank" rel="noopener noreferrer"' + (it.hint ? ' title="' + U.esc(it.hint) + '"' : '') + '>' +
          U.icon('external') + '<span>' + U.esc(it.label) + '</span></a>' : '';
      }).join('');
      if (links) html += '<h4 class="sub-h">' + U.esc(g.group || 'Portali') + '</h4>' + ED.btnRow(links);
    });
    if (!groups.length) html += '<p class="muted">Nessun portale disponibile.</p>';
    html += UI.note('I portali non permettono a una pagina esterna di leggere i loro annunci: apri la ricerca, copia il testo degli annunci simili e incollalo in <b>Importa annunci</b>, oppure usa il pulsante <b>«Invia a Patrimonio»</b> dai preferiti del browser.', 'info');
    return UI.card('Cerca sui portali', html, { icon: 'search' });
  }

  /* ---------- Importazione annunci: testo incollato, JSON, bookmarklet ---------- */
  function importCard(s) {
    var own = PEND.pid === s.pid, items = own ? PEND.items : [];
    var html = '<p class="muted">Copia dalla pagina del portale il testo di uno o più annunci (anche l\'intera pagina dei risultati con Ctrl+A e Ctrl+C) e incollalo qui: il programma riconosce prezzo, superficie, locali e link, e potrai controllare i dati prima di aggiungerli. Sono accettati anche i dati JSON esportati da questo programma.</p>' +
      '<textarea id="cmp-paste" class="cmp-paste" rows="5" data-paste="1" data-nobind="1" spellcheck="false" placeholder="Es.: Trilocale in via Roma, Milano · 85 m² · 3 locali · 320.000 € · https://www.idealista.it/immobile/…">' + U.esc(own ? PEND.text : '') + '</textarea>' +
      ED.btnRow(UI.btn('Analizza testo', { cls: 'btn-sm btn-primary', icon: 'search', act: 'cmp-parse' }) +
        (own && (items.length || PEND.text) ? UI.btn('Annulla', { cls: 'btn-sm', icon: 'x', act: 'cmp-cancel' }) : ''));
    if (items.length) html += '<h4 class="sub-h">Annunci riconosciuti (' + items.length + ')</h4>' + pendTable(s, items);
    html += UI.details('Pulsante «Invia a Patrimonio»: importa con un clic l\'annuncio che stai guardando', bmHtml());
    return UI.card('Importa annunci', html, { icon: 'upload' });
  }

  function pendTable(s, items) {
    var nSel = 0;
    items.forEach(function (r) { if (!r.skip) nSel++; });
    var cur = function (r) { return r.currency || s.cur; };
    var cols = [
      { label: '<input type="checkbox" data-pend-all="1" data-nobind="1" title="Seleziona o deseleziona tutti"' + (nSel === items.length ? ' checked' : '') + '>', cls: 'c-chk',
        render: function (r, i) { return '<input type="checkbox" data-pend="' + i + '" data-nobind="1"' + (r.skip ? '' : ' checked') + '>'; } },
      { label: 'Tipo', render: function (r, i) {
        return '<select data-pend-kind="' + i + '" data-nobind="1">' + KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (r.kind === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select>';
      } },
      { label: 'Prezzo', cls: 'num', render: function (r) { return U.n(r.price) > 0 ? money(r.price, cur(r), 0) : '—'; } },
      { label: 'm²', cls: 'num', render: function (r) { return U.n(r.sqm) > 0 ? U.fmtNum(r.sqm, 0) : '—'; } },
      { label: 'Locali', cls: 'num', render: function (r) { return U.n(r.rooms) > 0 ? U.fmtNum(r.rooms, 0) : '—'; } },
      { label: 'Prezzo/m²', cls: 'num', render: function (r) { var v = sqmPrice(r); return v === null ? '—' : money(v, cur(r), isRent(r) ? 2 : 0); } },
      { label: 'Annuncio', render: function (r) {
        var u = U.safeUrl(r.url || ''), t = U.esc(r.title || r.city || (u ? hostOf(u) : 'Annuncio'));
        return (u ? '<a href="' + U.esc(u) + '" target="_blank" rel="noopener noreferrer">' + t + '</a>' : t) + (r.source ? ' <small class="muted">' + U.esc(r.source) + '</small>' : '');
      } }
    ];
    return UI.table(cols, items, { cls: 'tbl-compact' }) +
      ED.btnRow(UI.btn('Aggiungi selezionati (<span data-pend-count>' + nSel + '</span>)', { cls: 'btn-sm btn-primary', icon: 'plus', act: 'cmp-add', disabled: !nSel }));
  }

  function bmHtml() {
    var href = '', file = /^file:/i.test(appUrl());
    try { href = PT.bookmarklet(appUrl()); } catch (e) { href = ''; }
    return '<ol class="steps">' +
      '<li>Mostra la barra dei preferiti del browser (Ctrl+Maiusc+B in Chrome ed Edge).</li>' +
      '<li>Trascina il pulsante <b>Invia a Patrimonio</b> qui sotto sulla barra dei preferiti. In alternativa usa <b>Copia codice</b> e crea un nuovo preferito incollando il codice come indirizzo (URL).</li>' +
      '<li>Apri un annuncio su Idealista, Immobiliare.it, Casa.it o un altro portale e fai clic sul preferito.</li>' +
      '<li>Si apre questa applicazione: scegli l\'immobile a cui aggiungere l\'annuncio e verifica prezzo e superficie.</li></ol>' +
      (file ? UI.note('Stai usando l\'applicazione come file locale: il pulsante funziona solo con l\'app pubblicata online (ad esempio su GitHub Pages, vedi la Guida).', 'warn') : '') +
      (href ? ED.btnRow('<a class="btn btn-sm bm-link" href="' + U.esc(href) + '" data-act="bm-info" title="Trascinami sulla barra dei preferiti">' + U.icon('bookmark') + '<span>Invia a Patrimonio</span></a>' +
        UI.btn('Copia codice', { cls: 'btn-sm', icon: 'copy', act: 'bm-copy' })) : UI.note('Pulsante non disponibile in questo browser.', 'warn'));
  }

  /* ---------- Elenco dei comparabili ---------- */
  function cmpRow(s) {
    return function (c, bp, i) {
      var rent = isRent(c), sp = sqmPrice(c), u = U.safeUrl(c.url || '');
      return UI.grid([
        UI.select(s.p, bp + '.kind', 'Tipo', KINDS),
        UI.text(s.p, bp + '.title', 'Titolo / descrizione', { placeholder: 'Es. trilocale con terrazzo' }),
        UI.text(s.p, bp + '.source', 'Fonte', { list: 'dl-cmp-src', placeholder: 'Idealista, Immobiliare.it…' }),
        ED.amt(s, bp + '.price', rent ? 'Canone mensile' : 'Prezzo richiesto', { dec: 0, noFx: true }),
        UI.num(s.p, bp + '.sqm', 'Superficie', { suffix: 'm²', dec: 0 }),
        UI.int(s.p, bp + '.rooms', 'Locali'),
        UI.date(s.p, bp + '.date', 'Data rilevazione'),
        UI.text(s.p, bp + '.city', 'Città / zona'),
        UI.field(s.p, bp + '.url', 'Link all\'annuncio', { type: 'url', placeholder: 'https://…' }),
        UI.area(s.p, bp + '.notes', 'Note', { rows: 1 }),
        UI.bool(s.p, bp + '.include', 'Includi nelle statistiche', { hint: sp === null ? 'Servono prezzo e superficie' : (rent ? 'Canone/m²: ' : 'Prezzo/m²: ') + money(sp, s.cur, rent ? 2 : 0) }),
        '<div class="fld fld-act">' + UI.btn('Apri annuncio', { cls: 'btn-sm', icon: 'external', act: 'cmp-open', data: ' data-i="' + i + '"', title: u ? hostOf(u) : 'Inserisci il link dell\'annuncio' }) + '</div>'
      ], 4, 'cmp-grid');
    };
  }

  function cmpCard(s) {
    var n = (s.p.comparables || []).length;
    var extra = UI.btn('Ordina', { cls: 'btn-sm', icon: 'sort', act: 'cmp-sort', title: 'Prima le vendite, poi per prezzo al m² crescente' }) +
      UI.btn('Rimuovi esclusi', { cls: 'btn-sm', icon: 'trash', act: 'cmp-clear-excluded', title: 'Elimina i comparabili non inclusi nelle statistiche' }) +
      UI.btn('CSV', { cls: 'btn-sm', icon: 'download', act: 'cmp-csv', title: 'Esporta i comparabili (CSV per Excel)' });
    return UI.card('Annunci comparabili (' + U.fmtNum(n, 0) + ')', ED.list(s, 'comparables', cmpRow(s), {
      addLabel: 'Aggiungi comparabile',
      empty: 'Nessun comparabile. Aggiungili a mano, incollando il testo degli annunci o con il pulsante «Invia a Patrimonio».',
      extra: extra
    }), { icon: 'compare' });
  }

  TABS.confronti = function (s) {
    var used = [];
    (s.A.props || []).forEach(function (q) {
      (q.comparables || []).forEach(function (c) {
        var src = c && c.source ? String(c.source) : '';
        if (src && used.length < 300 && used.indexOf(src) < 0) used.push(src);
      });
    });
    var main = portalsCard(s) + importCard(s) + UI.datalist('dl-cmp-src', ED.uniq(SRC.concat(used))) + cmpCard(s) +
      UI.card('Riepilogo comparabili', ED.calcBox('confronti-tab', s), { icon: 'table' });
    return ED.layout(main, ED.side(s, 'confronti', 'Confronto con il mercato', 'compare'));
  };

  /* ---------- Riquadri calcolati della scheda "Confronti" ---------- */
  function comps(s) { try { return C.comps(s.p, s.S); } catch (e) { return null; } }

  CALC['confronti-tab'] = function (s) {
    var all = s.p.comparables || [];
    if (!all.length) return '<p class="muted">Aggiungi dei comparabili per vedere il riepilogo e le statistiche.</p>';
    var cs = comps(s), list = all.slice().sort(cmpSort);
    var med = { vendita: cs && cs.sale && cs.sale.n ? cs.sale.med : null, affitto: cs && cs.rent && cs.rent.n ? cs.rent.med : null };
    var html = UI.table([
      { label: 'Tipo', render: function (c) { return isRent(c) ? 'Affitto' : 'Vendita'; } },
      { label: 'Annuncio', render: function (c) {
        var u = U.safeUrl(c.url || ''), t = U.esc(c.title || c.city || (u ? hostOf(u) : 'Annuncio'));
        return (u ? '<a href="' + U.esc(u) + '" target="_blank" rel="noopener noreferrer">' + t + '</a>' : t) + (c.source ? ' <small class="muted">' + U.esc(c.source) + '</small>' : '');
      } },
      { label: 'Prezzo', cls: 'num', render: function (c) { return U.n(c.price) > 0 ? money(c.price, s.cur, 0) + (isRent(c) ? '<small>/mese</small>' : '') : '—'; } },
      { label: 'm²', cls: 'num', render: function (c) { return U.n(c.sqm) > 0 ? U.fmtNum(c.sqm, 0) : '—'; } },
      { label: 'Prezzo/m²', cls: 'num', render: function (c) { var v = sqmPrice(c); return v === null ? '—' : money(v, s.cur, isRent(c) ? 2 : 0); } },
      { label: 'vs mediana', cls: 'num', title: 'Scostamento dal prezzo al m² mediano dei comparabili inclusi dello stesso tipo', render: function (c) {
        var v = sqmPrice(c), m0 = med[isRent(c) ? 'affitto' : 'vendita'];
        return v !== null && m0 > 0 ? gapHtml(v / m0 - 1, '') : '—';
      } },
      { label: 'Incluso', render: function (c) { return c.include === false ? '<span class="muted">No</span>' : 'Sì'; } }
    ], list, { cls: 'tbl-compact', rowAttrs: function (c) { return c.include === false ? ' class="row-off"' : ''; } });
    var stats = [['Vendita', cs && cs.sale, 0], ['Affitto (mensile)', cs && cs.rent, 2]].filter(function (r) { return r[1] && r[1].n; });
    if (stats.length) html += '<h4 class="sub-h">Prezzo al m² dei comparabili inclusi</h4>' + UI.table([
      { label: 'Tipo', render: function (r) { return r[0]; } },
      { label: 'Annunci', cls: 'num', render: function (r) { return U.fmtNum(r[1].n, 0); } },
      { label: 'Minimo', cls: 'num', render: function (r) { return money(r[1].min, s.cur, r[2]); } },
      { label: 'Mediana', cls: 'num', render: function (r) { return '<b>' + money(r[1].med, s.cur, r[2]) + '</b>'; } },
      { label: 'Media', cls: 'num', render: function (r) { return money(r[1].mean, s.cur, r[2]); } },
      { label: 'Massimo', cls: 'num', render: function (r) { return money(r[1].max, s.cur, r[2]); } }
    ], stats, { cls: 'tbl-compact' });
    return html;
  };

  CALC.confronti = function (s) {
    var p = s.p, cs = comps(s), D = defaults(s), html = '';
    if (!cs) return UI.note('Statistiche dei comparabili non disponibili.', 'warn');
    var nS = cs.sale ? cs.sale.n : 0, nR = cs.rent ? cs.rent.n : 0;
    if (!(U.n(p.sqm) > 0)) html += UI.note('Indica la <b>superficie</b> dell\'immobile (scheda Generale) per stimare valore e canone dai comparabili.', 'warn');
    if (!cs.count) html += UI.note('Nessun comparabile: cerca annunci simili (zona, tipologia, superficie, stato) sui portali e aggiungili qui.', 'info');
    else if (nS < 3 && nR < 3) html += UI.note('Pochi comparabili utilizzabili (servono prezzo e superficie): con almeno 3–5 annunci simili la stima è più affidabile.', 'warn');
    var rng = function (st, d) { return st && st.n > 1 ? money(st.min, s.cur, d) + ' – ' + money(st.max, s.cur, d) : null; };
    html += UI.kv([
      nS ? ['Prezzo/m² mediano (vendita)', '<b>' + money(cs.sale.med, s.cur, 0) + '</b> <small class="muted">' + nS + ' annunci</small>'] : null,
      rng(cs.sale, 0) ? ['Intervallo vendita', rng(cs.sale, 0)] : null,
      nR ? ['Canone/m² mediano (mese)', '<b>' + money(cs.rent.med, s.cur, 2) + '</b> <small class="muted">' + nR + ' annunci</small>'] : null,
      rng(cs.rent, 2) ? ['Intervallo affitto', rng(cs.rent, 2)] : null,
      U.ok(cs.estValue) ? ['Valore stimato', le(s, cs.estValue), 'Prezzo al m² mediano × superficie, meno lo sconto medio di trattativa del ' + U.fmtNum(U.n(D.compDiscountPct), 1) + '% (modificabile in Impostazioni).'] : null,
      U.ok(cs.estRent) ? ['Canone stimato', le(s, cs.estRent) + ' <small>/mese</small>'] : null,
      U.ok(cs.estYield) ? ['Rendimento lordo stimato', pct(cs.estYield), 'Canone stimato × 12 / valore stimato.'] : null,
      U.ok(cs.gapPct) ? ['Tuo acquisto/m² vs mercato', gapHtml(cs.gapPct, 'low'), 'Negativo = hai comprato sotto la mediana dei prezzi richiesti.'] : null,
      U.ok(cs.valueGapPct) ? ['Valore attuale vs mercato', gapHtml(cs.valueGapPct, ''), 'Confronto tra il valore di mercato inserito e la mediana dei comparabili.'] : null,
      U.ok(cs.askGapPct) ? ['Prezzo richiesto vs mercato', gapHtml(cs.askGapPct, ''), 'Il tuo prezzo di vendita richiesto rispetto alla mediana.'] : null,
      U.ok(cs.rentGapPct) ? ['Tuo canone/m² vs mercato', gapHtml(cs.rentGapPct, 'high'), 'Positivo = affitti sopra la mediana della zona.'] : null,
      U.ok(cs.omiMid) ? ['OMI valore medio/m²', money(cs.omiMid, s.cur, 0)] : null,
      U.ok(cs.omiValue) ? ['Valore secondo OMI', le(s, cs.omiValue)] : null,
      U.ok(cs.omiRentMid) ? ['OMI canone medio/m² (mese)', money(cs.omiRentMid, s.cur, 2)] : null,
      U.ok(cs.omiRent) ? ['Canone secondo OMI', le(s, cs.omiRent) + ' <small>/mese</small>'] : null
    ]);
    var b = (U.ok(cs.estValue) && cs.estValue > 0 ? UI.btn('Usa come valore di mercato', { cls: 'btn-sm', icon: 'check', act: 'cmp-use-est', title: 'Imposta il valore stimato come valore di mercato (scheda Catasto & valori)' }) : '') +
      (U.ok(cs.estRent) && cs.estRent > 0 ? UI.btn('Usa come canone stimato', { cls: 'btn-sm', icon: 'check', act: 'cmp-use-rent', title: 'Imposta il canone mensile stimato (scheda Catasto & valori)' }) : '');
    if (b) html += ED.btnRow(b);
    if (nS) {
      var md = cs.sale.med, f = s.f || {}, items = [{ label: 'Mediana comparabili', value: md, color: '#2563eb' }];
      if (U.ok(f.valueSqm) && f.valueSqm > 0) items.push({ label: 'Tuo valore attuale', value: f.valueSqm, color: '#16a34a' });
      if (U.ok(f.priceSqm) && f.priceSqm > 0) items.push({ label: 'Tuo prezzo d\'acquisto', value: f.priceSqm, color: '#7c3aed' });
      if (U.ok(cs.askGapPct)) items.push({ label: 'Tuo prezzo richiesto', value: md * (1 + cs.askGapPct), color: '#f59e0b' });
      if (U.ok(cs.omiMid) && cs.omiMid > 0) items.push({ label: 'OMI (valore medio)', value: cs.omiMid, color: '#0891b2' });
      (p.comparables || []).filter(function (c) { return !isRent(c) && c.include !== false && sqmPrice(c) !== null; }).sort(cmpSort).slice(0, 40).forEach(function (c) {
        items.push({ label: c.title || c.city || hostOf(U.safeUrl(c.url || '')) || 'Annuncio', sub: c.source || '', value: sqmPrice(c), color: '#94a3b8' });
      });
      html += '<h4 class="sub-h">Prezzo al m² a confronto</h4>' + CH.hbars(items, { fmt: function (x) { return money(x, s.cur, 0); } });
    }
    return html;
  };

  /* ---------- Azioni ---------- */
  ACT['cmp-parse'] = function () {
    var s = ED.current(); if (!s) return;
    var ta = document.getElementById('cmp-paste'), t = ta ? String(ta.value || '') : '', tt = t.replace(/^\s+|\s+$/g, '');
    if (!tt) { U.toast('Incolla prima il testo degli annunci copiato dal portale.', 'warn'); return; }
    var items = null, c0 = tt.charAt(0);
    if (c0 === '{' || c0 === '[') items = fromJson(tt);
    if (!items) { try { items = PT.parse(t, {}) || []; } catch (e) { items = []; } }
    items = items.filter(function (r) { return r && (U.n(r.price) > 0 || U.safeUrl(r.url || '')); }).slice(0, MAX_CMP);
    items.forEach(function (r) { r.skip = false; r.kind = r.kind === 'affitto' ? 'affitto' : 'vendita'; });
    PEND = { pid: s.pid, text: t, items: items };
    if (!items.length) U.toast('Nessun annuncio riconosciuto: verifica che il testo contenga i prezzi (e possibilmente le superfici) oppure inserisci i dati a mano.', 'warn', 6000);
    else U.toast(items.length === 1 ? 'Trovato 1 annuncio: controllalo e aggiungilo.' : 'Trovati ' + items.length + ' annunci: controllali e aggiungi quelli simili al tuo immobile.', 'success');
    ED.refresh();
  };

  ACT['cmp-add'] = function () {
    var s = ED.current(); if (!s || PEND.pid !== s.pid) return;
    var sel = PEND.items.filter(function (r) { return !r.skip; });
    if (!sel.length) { U.toast('Seleziona almeno un annuncio.', 'warn'); return; }
    PEND = { pid: null, items: [], text: '' };
    ED.withProp(s.pid, function (p) {
      var added = 0, dup = 0, over = 0;
      if (!(p.comparables instanceof Array)) p.comparables = [];
      sel.forEach(function (r) {
        var c = null;
        try { c = PT.toComparable(r, p); } catch (e) { c = null; }
        if (!c) return;
        c.kind = r.kind === 'affitto' ? 'affitto' : 'vendita';
        if (r.date) c.date = r.date;
        if (r.notes) c.notes = c.notes ? c.notes + ' · ' + r.notes : r.notes;
        if (r.source && (!c.source || c.source === 'manuale')) c.source = r.source;
        var u = U.safeUrl(c.url || '');
        var twin = p.comparables.some(function (x) {
          if (u && U.safeUrl(x.url || '') === u) return true;
          return (x.kind || 'vendita') === c.kind && U.n(c.price) > 0 && U.n(x.price) === U.n(c.price) && U.n(x.sqm) === U.n(c.sqm);
        });
        if (twin) { dup++; return; }
        if (p.comparables.length >= MAX_CMP) { over++; return; }
        p.comparables.push(c);
        added++;
      });
      var msg = added ? (added === 1 ? 'Aggiunto 1 comparabile' : 'Aggiunti ' + added + ' comparabili') : 'Nessun comparabile aggiunto';
      if (dup) msg += ' · ' + dup + (dup === 1 ? ' duplicato ignorato' : ' duplicati ignorati');
      if (over) msg += ' · ' + over + ' oltre il limite di ' + MAX_CMP;
      U.toast(msg + '.', added ? 'success' : 'warn');
    });
  };

  ACT['cmp-cancel'] = function () { PEND = { pid: null, items: [], text: '' }; ED.refresh(); };

  ACT['cmp-open'] = function (el) {
    var s = ED.current(); if (!s) return;
    var c = (s.p.comparables || [])[+attr(el, 'data-i')], u = c ? U.safeUrl(c.url || '') : '';
    if (!u) { U.toast('Link dell\'annuncio mancante o non valido (deve iniziare con https://).', 'warn'); return; }
    window.open(u, '_blank', 'noopener');
  };

  ACT['cmp-clear-excluded'] = function () {
    var s = ED.current(); if (!s) return;
    var pid = s.pid, n = (s.p.comparables || []).filter(function (c) { return c.include === false; }).length;
    if (!n) { U.toast('Non ci sono comparabili esclusi.', 'info'); return; }
    U.confirm('Eliminare ' + (n === 1 ? 'il comparabile escluso' : 'i ' + n + ' comparabili esclusi') + ' dalle statistiche?', 'Elimina', true).then(function (ok) {
      if (!ok) return;
      ED.withProp(pid, function (p) { p.comparables = (p.comparables || []).filter(function (c) { return c.include !== false; }); });
      U.toast(n === 1 ? 'Comparabile eliminato.' : n + ' comparabili eliminati.', 'success');
    });
  };

  ACT['cmp-sort'] = function () {
    var s = ED.current(); if (!s) return;
    ED.withProp(s.pid, function (p) { (p.comparables || []).sort(cmpSort); });
  };

  ACT['cmp-use-est'] = function () {
    var s = ED.current(); if (!s) return;
    var cs = comps(s);
    if (!cs || !(cs.estValue > 0)) { U.toast('Stima non disponibile: servono comparabili in vendita e la superficie dell\'immobile.', 'warn'); return; }
    var v = Math.round(cs.estValue / 100) * 100, n = cs.sale ? cs.sale.n : 0;
    ED.withProp(s.pid, function (p) {
      p.valuation = p.valuation || {};
      p.valuation.marketValue = v;
      p.valuation.date = U.todayISO();
      p.valuation.source = 'Comparabili (' + n + ' annunci)';
    });
    U.toast('Valore di mercato aggiornato a ' + money(v, s.cur, 0) + '.', 'success');
  };

  ACT['cmp-use-rent'] = function () {
    var s = ED.current(); if (!s) return;
    var cs = comps(s);
    if (!cs || !(cs.estRent > 0)) { U.toast('Stima non disponibile: servono comparabili in affitto e la superficie dell\'immobile.', 'warn'); return; }
    var v = Math.round(cs.estRent / 10) * 10;
    ED.withProp(s.pid, function (p) { p.valuation = p.valuation || {}; p.valuation.estimatedRent = v; });
    U.toast('Canone stimato aggiornato a ' + money(v, s.cur, 0) + ' al mese.', 'success');
  };

  ACT['cmp-csv'] = function () {
    var s = ED.current(); if (!s) return;
    var list = s.p.comparables || [];
    if (!list.length) { U.toast('Nessun comparabile da esportare.', 'info'); return; }
    var rows = [['Tipo', 'Titolo', 'Fonte', 'Città/zona', 'Prezzo (' + s.cur + ')', 'm²', 'Locali', 'Prezzo/m²', 'Data', 'Incluso', 'Link', 'Note']];
    list.forEach(function (c) {
      rows.push([isRent(c) ? 'Affitto' : 'Vendita', c.title || '', c.source || '', c.city || '', U.n(c.price) > 0 ? c.price : '', U.n(c.sqm) > 0 ? c.sqm : '',
        U.n(c.rooms) > 0 ? c.rooms : '', csvNum(sqmPrice(c)), c.date || '', c.include === false ? 'No' : 'Sì', c.url || '', c.notes || '']);
    });
    U.download('comparabili-' + (U.slug(s.p.name || 'immobile') || 'immobile') + '.csv', U.toCSV(rows), 'text/csv;charset=utf-8');
  };

  ACT['bm-info'] = function () {
    U.toast('Trascina il pulsante «Invia a Patrimonio» sulla barra dei preferiti, poi usalo dalla pagina di un annuncio.', 'info', 6000);
  };

  ACT['bm-copy'] = function () {
    var code = '';
    try { code = PT.bookmarklet(appUrl()); } catch (e) { code = ''; }
    if (!code) return;
    U.copyText(code).then(function () {
      U.toast('Codice copiato: crea un nuovo preferito e incollalo come indirizzo (URL).', 'success', 6000);
    }, function () { U.toast('Copia non riuscita: trascina il pulsante sulla barra dei preferiti.', 'error'); });
  };

  ACT['sim-reset'] = function () {
    var s = ED.current(); if (!s) return;
    delete SIM[s.pid];
    ED.refresh();
  };

  ACT['proj-csv'] = function () {
    var s = ED.current(); if (!s) return;
    var pr = projection(s);
    if (!pr || !pr.rows || !pr.rows.length) { U.toast('Proiezione non disponibile.', 'warn'); return; }
    var rows = [['Anno', 'Data', 'Valore (EUR)', 'Debito (EUR)', 'Patrimonio netto (EUR)', 'Flusso di cassa (EUR)', 'Flusso cumulato (EUR)',
      'Imposta plusvalenza (EUR)', 'Netto da vendita (EUR)', 'Utile (EUR)', 'Capitale investito (EUR)', 'ROI %', 'ROI annuo %', 'TIR %']];
    pr.rows.forEach(function (r) {
      rows.push([r.year, r.date || '', csvNum(r.valueEur), csvNum(r.debtEur), csvNum(r.equityEur), csvNum(r.cf), csvNum(r.cumCf),
        csvNum(r.cgtEur), csvNum(r.netSaleEur), csvNum(r.profit), csvNum(r.invested), csvPct(r.roi), csvPct(r.roiAnn), csvPct(r.irr)]);
    });
    U.download('proiezione-' + (U.slug(s.p.name || 'immobile') || 'immobile') + '.csv', U.toCSV(rows), 'text/csv;charset=utf-8');
  };

  /* ---------- Scheda "Analisi" ---------- */
  function minus(x) { return U.ok(x) && x !== 0 ? -x : 0; }

  TABS.analisi = function (s) {
    var y = years(s), opts = YEARS.slice(), sm = sim(s);
    if (opts.indexOf(y) < 0) { opts.push(y); opts.sort(function (a, b) { return a - b; }); }
    sm.years = y;
    var horizon = simField(s, 'years', 'Orizzonte della proiezione', { type: 'select', numeric: true, options: opts.map(function (k) { return [k, k + ' anni']; }) });
    var simForm = UI.grid([
      simField(s, 'price', 'Prezzo di vendita ipotetico', { type: 'num', dec: 0, suffix: s.cur, placeholder: 'Valore attuale', hint: 'Vuoto = valore di mercato attuale' }),
      simField(s, 'costs', 'Costi di vendita', { type: 'num', dec: 0, suffix: s.cur, placeholder: 'Automatici', hint: 'Vuoto = percentuale prevista per l\'immobile' }),
      simField(s, 'date', 'Data di vendita', { type: 'date', hint: 'Vuoto = oggi' }),
      s.foreign ? simField(s, 'rate', 'Cambio alla vendita', { type: 'num', dec: 4, suffix: s.cur + '/EUR', placeholder: U.fmtNum(rate(s), 4), hint: 'Vuoto = cambio attuale' }) : ''
    ], 4);
    return ED.shareNote(s) +
      UI.card('Indicatori', ED.calcBox('analisi-kpi', s), { icon: 'chart' }) +
      UI.card('Proiezione', '<div class="proj-ctl">' + horizon + '</div>' + ED.calcBox('analisi-proj', s), { icon: 'trend' }) +
      UI.card('Flussi per anno', ED.calcBox('analisi-hist', s), { icon: 'calendar' }) +
      UI.card('Simulazione di vendita', '<p class="muted">Cosa succederebbe vendendo a un certo prezzo e in una certa data: imposte, estinzione dei mutui, incasso netto e rendimento. I valori della simulazione non vengono salvati.</p>' +
        simForm + ED.btnRow(UI.btn('Ripristina', { cls: 'btn-sm', icon: 'undo', act: 'sim-reset', title: 'Torna ai valori predefiniti' })) + ED.calcBox('analisi-sim', s), { icon: 'calc' }) +
      UI.card('Sensitività alla rivalutazione', ED.calcBox('analisi-sens', s), { icon: 'sliders' }) +
      ED.btnRow(UI.btn('Crea copia per simulazione', { cls: 'btn-sm', icon: 'copy', act: 'target', title: 'Duplica l\'immobile come scenario da modificare liberamente' }) +
        UI.btn('Stampa', { cls: 'btn-sm', icon: 'print', act: 'print' }));
  };

  CALC['analisi-kpi'] = function (s) {
    var f = s.f || {}, m = s.m || {}, html;
    html = UI.kpis([
      UI.kpi('Flusso di cassa netto annuo', eur(f.cfPost), { vcls: UI.cls(f.cfPost), sub: U.ok(f.cfMonthly) ? eur(f.cfMonthly) + ' al mese' : '', title: 'Dopo spese, imposte e rate dei mutui' }),
      UI.kpi('ROI' + (f.roiKind ? ' (' + f.roiKind + ')' : ''), pct(f.roi), { vcls: UI.cls(f.roi), sub: U.ok(f.roiAnn) ? pct(f.roiAnn) + ' annuo' : '' }),
      UI.kpi('TIR (IRR)', pct(f.irr), { vcls: UI.cls(f.irr), sub: U.ok(f.irrU) ? 'senza leva ' + pct(f.irrU) : '' }),
      UI.kpi('Patrimonio netto', eur(f.equityEur), { sub: U.n(f.debt) > 0 ? 'debito ' + eur(f.debt) : 'nessun debito' }),
      UI.kpi('Plusvalenza latente', eur(f.unrealizedEur), { vcls: UI.cls(f.unrealizedEur), title: 'Valore attuale meno costo complessivo d\'acquisto' })
    ]);
    html += '<div class="cols2">' + UI.kv([
      ['Rendimento lordo', pct(f.grossYield), 'Canone annuo lordo / prezzo d\'acquisto.'],
      ['Rendimento lordo sul costo totale', pct(f.grossYieldInv), 'Canone annuo lordo / costo totale (prezzo + oneri + lavori).'],
      ['Rendimento netto', pct(f.netYield), 'Reddito dopo spese e imposte / costo totale.'],
      ['Rendimento sul valore attuale', pct(f.currentYield), 'Canone annuo lordo / valore di mercato attuale.'],
      ['Cap rate', pct(f.capRate), 'Reddito operativo netto (NOI) / valore di mercato.'],
      ['Cash on cash', pct(f.coc), 'Flusso di cassa netto dopo imposte e rate / capitale proprio investito.'],
      ['Cash on cash ante imposte', pct(f.cocPre)],
      ['DSCR', U.ok(f.dscr) ? U.fmtNum(f.dscr, 2) + '×' : '—', 'Copertura delle rate: NOI / rate annue. Le banche chiedono di solito almeno 1,2.'],
      ['LTV', pct(f.ltv), 'Debito residuo / valore di mercato.'],
      ['LTC', pct(f.ltc), 'Mutuo iniziale / costo totale.'],
      ['Occupazione di pareggio', pct(f.breakEven), 'Quota di occupazione necessaria a coprire spese, imposte sull\'immobile e rate.'],
      ['GRM', U.ok(f.grm) ? U.fmtNum(f.grm, 1) + '×' : '—', 'Moltiplicatore del canone lordo: valore / canone annuo potenziale.'],
      ['Rientro del capitale', U.ok(f.payback) ? U.fmtYears(f.payback) : '—', 'Capitale proprio investito / flusso di cassa netto annuo.']
    ]) + UI.kv([
      ['Prezzo d\'acquisto al m²', U.ok(f.priceSqm) ? loc(s, f.priceSqm) : '—'],
      ['Costo totale al m²', U.ok(f.costSqm) ? eur(f.costSqm) : '—', 'Prezzo + oneri + lavori, in EUR.'],
      ['Valore al m²', U.ok(f.valueSqm) ? loc(s, f.valueSqm) : '—'],
      ['Canone al m² (mese)', U.ok(f.rentSqm) ? loc(s, f.rentSqm, 2) : '—'],
      ['NOI (reddito operativo netto)', eur(f.noi), 'Entrate meno spese operative e imposte sull\'immobile, prima delle rate e dell\'imposta sul reddito.'],
      ['Imposta sul reddito da locazione', eur(f.incomeTax)],
      ['Imposte sull\'immobile', eur(f.propTax), 'IMU o imposte locali/estere sulla proprietà.'],
      ['Imposte totali', eur(f.taxTotal)],
      ['Costo annuo complessivo', eur(f.annualCostEur), 'Spese + imposte + rate dei mutui.'],
      ['Detrazioni fiscali dell\'anno', eur(U.n(f.ded) + U.n(f.mortDed)), 'Bonus edilizi e interessi del mutuo per l\'abitazione principale.'],
      ['ROI senza leva', pct(f.roiU), 'Come se l\'immobile fosse stato pagato senza mutuo.'],
      ['TIR senza leva', pct(f.irrU)]
    ]) + '</div>';
    if (f.includesImputed) html += UI.note('I risultati includono il <b>canone figurativo</b> (l\'affitto risparmiato usando l\'immobile): è un rendimento implicito, non un incasso.', 'info');
    if (m.pipe) html += UI.note('Immobile non ancora acquistato: gli indicatori sono una <b>proiezione</b>' + (U.ok(f.projYears) ? ' a ' + U.fmtNum(f.projYears, 0) + ' anni' : '') + ' basata sui dati inseriti.', 'info');
    return html;
  };

  function soldNote(s) {
    return UI.note('Immobile venduto: i risultati effettivi sono nella scheda <a href="' + G.APP.editHref(s.pid, 'vendita') + '">Vendita</a>.', 'info');
  }
  function hypotheses(s) {
    var D = defaults(s);
    return '<p class="muted small">Ipotesi: rivalutazione ' + U.fmtNum(U.n(D.appreciationPct), 1) + '% annuo, canoni +' + U.fmtNum(U.n(D.rentGrowthPct), 1) +
      '% annuo, costi +' + U.fmtNum(U.n(D.costGrowthPct), 1) + '% annuo, costi di vendita ' + U.fmtNum(U.n(D.saleCostPct), 1) +
      '%. Importi in EUR al cambio attuale, imposte sulla plusvalenza secondo le regole italiane ed estere (<a href="' + G.APP.href('impostazioni') + '">modifica le ipotesi</a>).</p>';
  }

  CALC['analisi-proj'] = function (s) {
    if (s.m && s.m.sold) return soldNote(s);
    var pr = projection(s), rows = (pr && pr.rows) || [];
    if (!rows.length) return UI.note('Proiezione non disponibile: inserisci almeno prezzo e data d\'acquisto.', 'warn');
    var labels = rows.map(function (r) { return String(r.year); }), last = rows[rows.length - 1], best = null;
    rows.forEach(function (r) { if (U.ok(r.irr) && (!best || r.irr > best.irr)) best = r; });
    var col = function (k) { return rows.map(function (r) { return U.ok(r[k]) ? r[k] : 0; }); };
    var html = hypotheses(s);
    html += '<div class="chart-grid"><div><h4 class="sub-h">Valore, debito e patrimonio netto</h4>' + CH.line({
      labels: labels,
      series: [
        { name: 'Valore', values: col('valueEur'), color: '#2563eb', area: true },
        { name: 'Debito', values: col('debtEur'), color: '#dc2626', dash: true },
        { name: 'Patrimonio netto', values: col('equityEur'), color: '#16a34a' }
      ]
    }, { height: 240, fmt: eurC, axisFmt: axis }) + '</div><div><h4 class="sub-h">Flusso di cassa annuo e utile se vendi</h4>' + CH.bar({
      labels: labels,
      series: [{ name: 'Flusso di cassa', values: col('cf'), color: '#0891b2' }]
    }, { height: 240, fmt: eurC, axisFmt: axis, line: { name: 'Utile se vendi', values: col('profit'), color: '#7c3aed' }, legend: true }) + '</div></div>';
    html += '<h4 class="sub-h">Se vendi tra ' + rows.length + ' anni (' + U.fmtDate(last.date) + ')</h4>' + '<div class="cols2">' + UI.kv([
      ['Valore stimato', eur(last.valueEur)],
      ['Debito residuo', eur(last.debtEur)],
      ['Imposta sulla plusvalenza', U.ok(last.cgtEur) ? eur(last.cgtEur) : '—', last.cgtReason || ''],
      ['Incasso netto dalla vendita', eur(last.netSaleEur), 'Prezzo meno costi di vendita, imposte ed estinzione dei mutui.'],
      ['Flussi di cassa cumulati', signed(last.cumCf)]
    ]) + UI.kv([
      ['Capitale investito', eur(last.invested)],
      ['Utile complessivo', signed(last.profit)],
      ['ROI', pct(last.roi), null, UI.cls(last.roi)],
      ['ROI annualizzato', pct(last.roiAnn), null, UI.cls(last.roiAnn)],
      ['TIR (IRR)', pct(last.irr), 'Tasso interno di rendimento di tutti i flussi, vendita compresa.', UI.cls(last.irr)],
      best ? ['Anno di vendita con il TIR migliore', best.year + ' (' + pct(best.irr) + ')', 'Oltre questo orizzonte il rendimento annuo tende a diminuire.'] : null
    ]) + '</div>';
    var table = UI.table([
      { label: 'Anno', render: function (r) { return String(r.year); } },
      { label: 'Valore', cls: 'num', render: function (r) { return eur(r.valueEur); } },
      { label: 'Debito', cls: 'num', render: function (r) { return eur(r.debtEur); } },
      { label: 'Patrimonio netto', cls: 'num', render: function (r) { return eur(r.equityEur); } },
      { label: 'Flusso di cassa', cls: 'num', render: function (r) { return signed(r.cf); } },
      { label: 'Cumulato', cls: 'num', render: function (r) { return signed(r.cumCf); } },
      { label: 'Imposta plusvalenza', cls: 'num', render: function (r) { return U.ok(r.cgtEur) ? eur(r.cgtEur) : '—'; } },
      { label: 'Netto da vendita', cls: 'num', render: function (r) { return eur(r.netSaleEur); } },
      { label: 'Utile', cls: 'num', render: function (r) { return signed(r.profit); } },
      { label: 'ROI annuo', cls: 'num', render: function (r) { return pct(r.roiAnn); } },
      { label: 'TIR', cls: 'num', render: function (r) { return pct(r.irr); } }
    ], rows, { cls: 'tbl-compact' });
    html += UI.details('Tabella anno per anno', table +
      ED.btnRow(UI.btn('Esporta CSV', { cls: 'btn-sm', icon: 'download', act: 'proj-csv' })), false);
    return html;
  };

  function histYears(f) {
    var rows = (f && f.hist && f.hist.rows) || [], by = {}, out = [];
    rows.forEach(function (r) {
      var y = r.year, a = by[y];
      if (!a) { a = by[y] = { year: y, income: 0, imputed: 0, costs: 0, debt: 0, interest: 0, ded: 0, net: 0 }; out.push(a); }
      a.income += U.n(r.income); a.imputed += U.n(r.imputed); a.costs += U.n(r.costs); a.debt += U.n(r.debt);
      a.interest += U.n(r.interest); a.ded += U.n(r.ded) + U.n(r.mortDed); a.net += U.n(r.net);
    });
    out.sort(function (a, b) { return a.year - b.year; });
    return out;
  }

  CALC['analisi-hist'] = function (s) {
    var f = s.f || {}, ys = histYears(f);
    if (!ys.length) {
      return UI.note(s.m && s.m.pipe ? 'Nessun flusso storico: l\'immobile non è ancora stato acquistato (vedi la proiezione).' :
        'Nessun flusso registrato: inserisci data d\'acquisto, canoni, spese e mutui.', 'info');
    }
    var labels = ys.map(function (a) { return String(a.year); });
    var hasImp = ys.some(function (a) { return a.imputed !== 0; }), hasDed = ys.some(function (a) { return a.ded !== 0; });
    var pick = function (k, neg) { return ys.map(function (a) { return neg ? minus(a[k]) : a[k]; }); };
    var series = [{ name: 'Entrate nette', values: pick('income'), color: '#16a34a' }];
    if (hasImp) series.push({ name: 'Canone figurativo', values: pick('imputed'), color: '#65a30d' });
    series.push({ name: 'Spese e imposte', values: pick('costs', true), color: '#f59e0b' });
    series.push({ name: 'Rate dei mutui', values: pick('debt', true), color: '#dc2626' });
    if (hasDed) series.push({ name: 'Detrazioni', values: pick('ded'), color: '#0891b2' });
    var tot = { income: 0, imputed: 0, costs: 0, debt: 0, interest: 0, ded: 0, net: 0 };
    ys.forEach(function (a) { for (var k in tot) if (tot.hasOwnProperty(k)) tot[k] += a[k]; });
    var html = '<p class="muted small">Flussi effettivi dalla data d\'acquisto a oggi, per la tua quota e in EUR. Le entrate sono al netto della cedolare/imposta sul canone e delle spese variabili; spese e imposte comprendono IMU e imposte estere sulla proprietà.</p>';
    html += CH.bar({ labels: labels, series: series }, {
      height: 260, stacked: true, fmt: eurC, axisFmt: axis, legend: true,
      line: { name: 'Netto', values: pick('net'), color: '#2563eb' }
    });
    var cols = [{ label: 'Anno', render: function (r) { return String(r.year); } }, { label: 'Entrate nette', cls: 'num', render: function (r) { return eur(r.income); } }];
    var foot = ['Totale', eur(tot.income)];
    if (hasImp) { cols.push({ label: 'Canone figurativo', cls: 'num', render: function (r) { return eur(r.imputed); } }); foot.push(eur(tot.imputed)); }
    cols.push({ label: 'Spese e imposte', cls: 'num', render: function (r) { return eur(r.costs); } }); foot.push(eur(tot.costs));
    cols.push({ label: 'Rate', cls: 'num', render: function (r) { return eur(r.debt); } }); foot.push(eur(tot.debt));
    cols.push({ label: 'di cui interessi', cls: 'num', render: function (r) { return eur(r.interest); } }); foot.push(eur(tot.interest));
    if (hasDed) { cols.push({ label: 'Detrazioni', cls: 'num', render: function (r) { return eur(r.ded); } }); foot.push(eur(tot.ded)); }
    cols.push({ label: 'Netto', cls: 'num', render: function (r) { return signed(r.net); } }); foot.push(signed(tot.net));
    html += UI.table(cols, ys, { cls: 'tbl-compact', foot: foot });
    var rr = ED.resultRows(f);
    if (rr && rr.length) html += '<h4 class="sub-h">Risultato complessivo' + (f.roiKind ? ' (' + U.esc(f.roiKind) + ')' : '') + '</h4>' + UI.kv(rr);
    return html;
  };

  CALC['analisi-sim'] = function (s) {
    if (s.m && s.m.sold) return soldNote(s);
    var st = sim(s), res = null;
    try { res = C.simulateSale(s.m, s.ctx, { price: st.price, costs: st.costs, date: st.date || null, rate: st.rate }); } catch (e) { res = null; }
    if (!res) return UI.note('Simulazione non disponibile: controlla prezzo e data d\'acquisto.', 'warn');
    var html = s.m.pipe ? UI.note('Immobile non ancora acquistato: la simulazione ipotizza l\'acquisto alla data prevista.', 'info') : '';
    var pairs = [
      ['Data di vendita', U.fmtDate(res.date)],
      ['Anni di possesso', U.fmtYears(res.holdYears)],
      ['Prezzo di vendita', leR(s, res.priceL, res.rate)],
      ['Costi di vendita', leR(s, res.costsL, res.rate), 'Agenzia, notaio a carico del venditore, certificazioni.'],
      s.foreign ? ['Cambio', U.fmtNum(res.rate, 4) + ' ' + U.esc(s.cur) + ' per 1 EUR'] : null,
      ['Mutui da estinguere', eur(res.debtEur)],
      ['Imposte sulla plusvalenza', eur(res.taxEur)],
      ['Incasso netto', '<b class="' + UI.cls(res.netEur) + '">' + eur(res.netEur) + '</b>', 'Dopo costi, imposte ed estinzione dei mutui, per la tua quota.']
    ];
    html += '<div class="cols2">' + UI.kv(pairs) + UI.kv((ED.cgRows(s, res.cg) || []).concat(ED.resultRows(res) || [])) + '</div>';
    if (U.ok(res.breakEvenPriceL)) {
      html += UI.note('Prezzo minimo per chiudere l\'investimento senza perdite (considerando tutti i flussi passati, i costi di vendita e le imposte): <b>' + leR(s, res.breakEvenPriceL, res.rate) + '</b>.', 'info');
    }
    return html;
  };

  CALC['analisi-sens'] = function (s) {
    if (s.m && s.m.sold) return soldNote(s);
    var base = U.n(defaults(s).appreciationPct), y = years(s), rows = [];
    [-2, -1, 0, 1, 2].forEach(function (d) {
      try {
        var S2 = U.clone(s.S);
        S2.defaults = S2.defaults || {};
        S2.defaults.appreciationPct = base + d;
        var m2 = C.base(s.p, S2, true), pr = C.projection(m2, s.ctx, y), last = pr && pr.rows && pr.rows[pr.rows.length - 1];
        if (last) rows.push({ d: d, app: base + d, r: last });
      } catch (e) { /* scenario non calcolabile */ }
    });
    if (!rows.length) return UI.note('Analisi non disponibile: inserisci almeno prezzo e data d\'acquisto.', 'warn');
    var html = '<p class="muted small">Risultato della vendita tra ' + y + ' anni al variare della rivalutazione annua dell\'immobile (tutte le altre ipotesi restano invariate).</p>';
    html += UI.table([
      { label: 'Rivalutazione annua', render: function (x) { return U.fmtNum(x.app, 1) + '%'; } },
      { label: 'Valore finale', cls: 'num', render: function (x) { return eur(x.r.valueEur); } },
      { label: 'Netto da vendita', cls: 'num', render: function (x) { return eur(x.r.netSaleEur); } },
      { label: 'Utile', cls: 'num', render: function (x) { return signed(x.r.profit); } },
      { label: 'ROI annuo', cls: 'num', render: function (x) { return pct(x.r.roiAnn); } },
      { label: 'TIR', cls: 'num', render: function (x) { return pct(x.r.irr); } }
    ], rows, { cls: 'tbl-compact', rowAttrs: function (x) { return x.d === 0 ? 'class="row-base"' : ''; } });
    html += '<h4 class="sub-h">TIR per scenario di rivalutazione</h4>' + CH.hbars(rows.map(function (x) {
      var irr = U.ok(x.r.irr) ? x.r.irr : 0;
      return { label: 'Rivalutazione ' + U.fmtNum(x.app, 1) + '%', value: irr, sub: 'utile ' + eur(x.r.profit), color: irr < 0 ? '#dc2626' : x.d === 0 ? '#2563eb' : '#94a3b8' };
    }), { fmt: function (v) { return pct(v); } });
    return html;
  };

  document.addEventListener('input', onSim);
  document.addEventListener('change', onSim);
})(window.GPI = window.GPI || {});
