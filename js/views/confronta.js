/* Vista Confronta: metriche di più immobili affiancate, con evidenza del valore migliore e grafici */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, M = G.MODEL, CH = G.CHARTS, VH = G.VH;
  var V = {}, root = null, off = null, ids = [], MAXC = 10;

  /* Righe del confronto: stringa = intestazione di sezione; t = formato; best = max|min (valore migliore evidenziato) */
  var ROWS = [
    'Profilo',
    { l: 'Stato', t: 'html', v: function (f, m, p) { return UI.statusBadge(p.status); } },
    { l: 'Tipologia', t: 'html', v: function (f, m, p) { return U.esc(M.typeLabel(p.type)); } },
    { l: 'Uso', t: 'html', v: function (f, m, p) { return U.esc(M.USAGE[p.usage] || '—'); } },
    { l: 'Superficie', t: 'sqm', v: function (f, m, p) { return U.ok(p.sqm) && p.sqm > 0 ? p.sqm : null; } },
    { l: 'Quota di proprietà', t: 'quota', v: function (f, m, p) { return U.ok(p.ownershipPct) ? p.ownershipPct : 100; } },
    { l: 'Valuta', t: 'html', v: function (f, m) { return U.esc(m.cur || 'EUR'); } },
    { l: 'Data d\'acquisto', t: 'html', v: function (f, m) { return m.buyDate ? U.fmtDate(m.buyDate) : '—'; } },
    'Valori in euro (pro quota)',
    { l: 'Valore di mercato', t: 'eur', best: 'max', v: function (f, m) { return m.valueEur; } },
    { l: 'Prezzo d\'acquisto', t: 'eur', v: function (f, m) { return m.priceEur; } },
    { l: 'Costo totale', t: 'eur', h: 'Prezzo, imposte, notaio, agenzia, lavori e arredi', v: function (f, m) { return m.costTotalEur; } },
    { l: 'Capitale proprio investito', t: 'eur', v: function (f, m) { return m.equityInvestedEur; } },
    { l: 'Debito residuo', t: 'eur', best: 'min', v: function (f) { return f.debt; } },
    { l: 'Patrimonio netto', t: 'eur', best: 'max', h: 'Valore di mercato meno debito residuo', v: function (f) { return f.equityEur; } },
    { l: 'Plusvalenza latente', t: 'eur', best: 'max', v: function (f) { return f.unrealizedEur; } },
    'Reddito annuo in euro',
    { l: 'Canone lordo', t: 'eur', best: 'max', v: function (f, m) { return m.grossEur; } },
    { l: 'Spese di gestione', t: 'eur', best: 'min', v: function (f, m) { return m.opexEur; } },
    { l: 'Reddito operativo netto (NOI)', t: 'eur', best: 'max', v: function (f) { return f.noi; } },
    { l: 'Imposte totali', t: 'eur', best: 'min', h: 'IMU o IVIE, cedolare o IRPEF con addizionali, imposte estere al netto del credito d\'imposta', v: function (f) { return f.taxTotal; } },
    { l: 'Rate del mutuo', t: 'eur', v: function (f, m) { return m.ds ? m.ds.pay : null; } },
    { l: 'Cash flow netto', t: 'eur', best: 'max', v: function (f) { return f.cfPost; } },
    { l: 'Cash flow mensile', t: 'eur', best: 'max', v: function (f) { return f.cfMonthly; } },
    'Rendimento',
    { l: 'Rendimento lordo', t: 'pct', best: 'max', h: 'Canone lordo annuo / prezzo d\'acquisto', v: function (f) { return f.grossYield; } },
    { l: 'Rendimento netto', t: 'pct', best: 'max', h: 'NOI meno imposte sul reddito / costo totale', v: function (f) { return f.netYield; } },
    { l: 'Cap rate', t: 'pct', best: 'max', h: 'NOI / valore di mercato attuale', v: function (f) { return f.capRate; } },
    { l: 'Cash on cash', t: 'pct', best: 'max', h: 'Cash flow netto / capitale proprio investito', v: function (f) { return f.coc; } },
    { l: 'Payback', t: 'yrs', best: 'min', h: 'Anni per recuperare il capitale proprio con il cash flow attuale', v: function (f) { return f.payback; } },
    { l: 'ROI', t: 'pct', best: 'max', sub: function (f) { return f.roiKind; }, v: function (f) { return f.roi; } },
    { l: 'ROI annualizzato', t: 'pct', best: 'max', v: function (f) { return f.roiAnn; } },
    { l: 'TIR (IRR)', t: 'pct', best: 'max', h: 'Tasso interno di rendimento sui flussi datati', v: function (f) { return f.irr; } },
    { l: 'Utile', t: 'eur', best: 'max', v: function (f) { return f.profit; } },
    'Rischio e prezzi',
    { l: 'LTV', t: 'pct', best: 'min', h: 'Debito residuo / valore di mercato', v: function (f) { return f.ltv; } },
    { l: 'DSCR', t: 'x', best: 'max', h: 'NOI / rate del mutuo: sotto 1,2 il margine è ridotto', v: function (f) { return f.dscr; } },
    { l: 'Occupazione di pareggio', t: 'pct', best: 'min', h: 'Quota del canone potenziale necessaria a coprire spese, imposte sulla proprietà e rate', v: function (f) { return f.breakEven; } },
    { l: 'Moltiplicatore del canone', t: 'x', best: 'min', h: 'Valore / canone lordo potenziale annuo (GRM)', v: function (f) { return f.grm; } },
    { l: 'Prezzo al m²', t: 'loc', best: 'min', v: function (f) { return f.priceSqm; } },
    { l: 'Valore al m²', t: 'loc', v: function (f) { return f.valueSqm; } },
    { l: 'Canone al m² (mese)', t: 'loc', best: 'max', v: function (f) { return f.rentSqm; } }
  ];

  function parseIds(route) {
    var A = G.APP, seen = {};
    return String((route.query && route.query.ids) || '').split(',').filter(function (id) {
      if (!id || seen[id] || !A.get(id)) return false;
      seen[id] = 1;
      return true;
    }).slice(0, MAXC);
  }
  function setIds(list) {
    ids = list.slice(0, MAXC);
    G.APP.setQuery(ids.length ? { ids: ids.join(',') } : {});
    draw();
  }
  function fmtVal(r, v, cur) {
    if (r.t === 'html') return v;
    if (!U.ok(v)) return '—';
    switch (r.t) {
      case 'eur': return v < -0.5 ? '<span class="neg">' + U.fmtEur(v) + '</span>' : U.fmtEur(v);
      case 'pct': return VH.pct(v, 1);
      case 'x': return U.fmtNum(v, 2) + '×';
      case 'yrs': return U.fmtNum(v, 1) + ' anni';
      case 'sqm': return U.fmtNum(v, 0) + ' m²';
      case 'quota': return U.fmtNum(v, v % 1 ? 2 : 0) + '%';
      case 'loc': return U.fmtMoney(v, cur || 'EUR', 0);
    }
    return U.esc(String(v));
  }
  /* Indice del valore migliore (‑1 se non confrontabile); i valori in valuta locale si confrontano in euro */
  function bestIdx(r, vals, list) {
    if (!r.best) return -1;
    var nums = vals.map(function (v, i) {
      if (!U.ok(v)) return null;
      return r.t === 'loc' ? G.FX.toEur(v, list[i].m.cur || 'EUR') : v;
    });
    var ok = nums.filter(function (v) { return U.ok(v); });
    if (ok.length < 2) return -1;
    var target = r.best === 'max' ? Math.max.apply(null, ok) : Math.min.apply(null, ok);
    if (Math.max.apply(null, ok) - Math.min.apply(null, ok) < 1e-9) return -1;
    return nums.indexOf(target);
  }
  function table(list) {
    var n = list.length;
    var head = '<tr><th scope="col" class="cmp-m">Metrica</th>' + list.map(function (x) {
      return '<th scope="col" class="cmp-h"><div class="cmp-p">' + VH.thumb(x.p, 'thumb-sm') + '<div>' + VH.link(x.p) +
        '<small class="muted">' + VH.loc(x.p) + '</small></div>' +
        '<button type="button" class="btn btn-sm btn-ghost btn-icon" data-act="rm" data-id="' + U.esc(x.p.id) + '" title="Togli dal confronto" aria-label="Togli dal confronto">' + U.icon('x') + '</button></div></th>';
    }).join('') + '</tr>';
    var body = ROWS.map(function (r) {
      if (typeof r === 'string') return '<tr class="row-sec"><th colspan="' + (n + 1) + '" scope="colgroup">' + r + '</th></tr>';
      var vals = list.map(function (x) {
        try { return r.v(x.f, x.m, x.p); } catch (e) { return null; }
      });
      var b = bestIdx(r, vals, list);
      return '<tr><th scope="row" class="cmp-m">' + r.l + UI.help(r.h) + '</th>' + vals.map(function (v, i) {
        var sub = r.sub ? r.sub(list[i].f) : '';
        return '<td class="num' + (i === b ? ' best' : '') + '"' + (i === b ? ' title="Valore migliore"' : '') + '>' + fmtVal(r, v, list[i].m.cur) +
          (sub && U.ok(v) ? '<small class="muted d-block">' + U.esc(sub) + '</small>' : '') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="tbl-wrap cmp-wrap"><table class="tbl cmp-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }
  function charts(list) {
    var A = G.APP;
    var mk = function (title, key, fmt) {
      var items = list.map(function (x) {
        return { label: M.displayName(x.p), value: x.f[key], href: A.editHref(x.p.id) };
      }).filter(function (x) { return U.ok(x.value); });
      return '<div><h4 class="sub-h">' + title + '</h4>' + CH.hbars(items, { fmt: fmt, empty: 'Dati insufficienti per questa metrica' }) + '</div>';
    };
    var pf = function (v) { return U.fmtPct(v, 1); }, ef = function (v) { return U.fmtEur(v); };
    return '<div class="chart-grid">' + mk('Cash flow netto annuo', 'cfPost', ef) + mk('Rendimento netto', 'netYield', pf) +
      mk('ROI', 'roi', pf) + mk('TIR (IRR)', 'irr', pf) + mk('Patrimonio netto', 'equityEur', ef) + mk('LTV', 'ltv', pf) + '</div>';
  }

  function draw() {
    if (!root) return;
    var A = G.APP;
    ids = ids.filter(function (id) { return A.get(id); });
    var list = ids.map(function (id) {
      var f = A.fin(id);
      return f ? { p: A.get(id), f: f, m: f.m } : null;
    }).filter(Boolean);
    var acts = UI.btn('Aggiungi immobile', { cls: 'btn-primary', icon: 'plus', act: 'add', disabled: ids.length >= MAXC || !A.props.length }) +
      (A.props.length > 1 ? UI.btn('I più importanti', { icon: 'star', act: 'auto', title: 'Confronta i ' + MAXC + ' immobili posseduti di maggior valore' }) : '') +
      (list.length ? UI.btn('Esporta CSV', { icon: 'download', act: 'csv' }) + UI.btn('Svuota', { icon: 'trash', act: 'clear' }) : '');
    var html = UI.pageHead('Confronta immobili', 'Fino a ' + MAXC + ' immobili affiancati. Importi in euro al cambio attuale, in proporzione alla quota di proprietà; evidenziato il valore migliore di ogni riga.', acts);
    if (!A.props.length) {
      html += UI.empty('Nessun immobile da confrontare', 'Aggiungi i tuoi immobili oppure carica i dati di esempio per provare il confronto.',
        UI.btn('Nuovo immobile', { cls: 'btn-primary', icon: 'plus', act: 'new' }) + UI.btn('Carica l\'esempio', { icon: 'upload', act: 'demo' }), 'compare');
    } else if (!list.length) {
      html += UI.empty('Scegli gli immobili da confrontare', 'Aggiungili uno alla volta, parti dai più importanti oppure selezionali nell\'elenco Immobili e premi "Confronta".',
        UI.btn('Aggiungi immobile', { cls: 'btn-primary', icon: 'plus', act: 'add' }) + UI.btn('Vai all\'elenco', { icon: 'list', href: '#/immobili' }), 'compare');
    } else {
      if (list.length === 1) html += UI.note('Aggiungi almeno un altro immobile per confrontare le metriche e vedere il valore migliore di ogni riga.', 'info');
      html += table(list);
      if (list.length > 1) html += UI.card('Grafici a confronto', charts(list), { icon: 'chart' });
      html += '<p class="muted small">Le metriche usano gli stessi dati e le stesse ipotesi delle schede (locazione, spese, mutui, imposte italiane ed estere). ' +
        'ROI e TIR sono "realizzati" per gli immobili venduti e "proiezione" o "ad oggi" negli altri casi. Stime indicative, da verificare con il tuo consulente.</p>';
    }
    root.innerHTML = html;
  }

  V.render = function (el, route) {
    var A = G.APP;
    ids = parseIds(route);
    root = VH.mount(el, '', 'v-confronta');
    off = UI.actions(root, {
      add: function () {
        VH.pickProperty('Aggiungi al confronto', { okLabel: 'Aggiungi', filter: function (p) { return ids.indexOf(p.id) < 0; } }).then(function (id) {
          if (id && root) setIds(ids.concat([id]));
        });
      },
      rm: function (b) {
        var id = b.getAttribute('data-id');
        setIds(ids.filter(function (x) { return x !== id; }));
      },
      clear: function () { setIds([]); },
      auto: function () {
        var port = A.port(), act = A.props.filter(function (p) { var f = port.byId[p.id]; return f && f.m.active; });
        if (act.length < 2) act = A.props.slice();
        act.sort(function (a, b) { return (U.n(port.byId[b.id] && port.byId[b.id].m.valueEur)) - (U.n(port.byId[a.id] && port.byId[a.id].m.valueEur)); });
        setIds(act.slice(0, MAXC).map(function (p) { return p.id; }));
      },
      csv: function () { if (ids.length) A.exportCSV(ids); },
      'new': function () { A.newDialog(); },
      demo: function () { A.loadDemo(); }
    });
    draw();
  };
  V.onFx = function () { draw(); };
  V.destroy = function () { if (off) off(); off = null; root = null; };

  G.VIEWS = G.VIEWS || {};
  G.VIEWS.confronta = V;
})(window.GPI = window.GPI || {});
