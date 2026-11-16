/* Vista Dashboard: riepilogo del patrimonio, grafici, avvisi e scadenze */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, M = G.MODEL, CH = G.CHARTS, K = G.COUNTRIES, VH = G.VH, C = G.CALC;
  var V = {}, timer = null;

  function welcome(el) {
    var A = G.APP;
    var acts = UI.btn('Nuovo immobile', { cls: 'btn-primary', icon: 'plus', act: 'new' }) +
      UI.btn('Carica dati di esempio', { icon: 'star', act: 'demo' }) +
      UI.btn('Importa backup', { icon: 'upload', act: 'import' }) +
      UI.btn('Leggi la guida', { icon: 'book', href: '#/guida' });
    var steps = [
      ['plus', 'Aggiungi gli immobili', 'Case, appartamenti, ville, bivilla, palazzi interi, negozi, uffici, terreni e box, in Italia e all\'estero: fino a ' + U.fmtNum(A.MAX) + ' schede.'],
      ['currency', 'Inserisci costi e valori', 'Prezzo in valuta locale, imposte, notaio, arredi, lavori, mutui, condominio e bollette: tutto convertito in euro con i cambi aggiornati.'],
      ['chart', 'Analizza i risultati', 'Rendimenti, cash flow, IMU, IVIE, cedolare, IRPEF, imposte estere, plusvalenze, ROI e TIR per immobile e per portafoglio.'],
      ['compare', 'Confronta con il mercato', 'Cerca annunci simili su Idealista, Immobiliare.it, Casa.it e altri portali e salvali come comparabili.']
    ];
    var html = UI.empty('Benvenuto nel tuo gestionale immobiliare', 'Non ci sono ancora immobili. Inizia aggiungendone uno, esplora l\'app con i dati di esempio oppure importa un backup.', acts, 'building') +
      '<div class="grid g4 steps">' + steps.map(function (s, i) {
        return UI.card('', '<div class="step-n">' + (i + 1) + '</div>' + U.icon(s[0], 'ico-lg') + '<h4>' + s[1] + '</h4><p class="muted small">' + s[2] + '</p>', { cls: 'step' });
      }).join('') + '</div>' +
      UI.note('<b>Privacy:</b> i dati restano solo in questo browser (IndexedDB) e non vengono inviati a nessun server. Esporta periodicamente un backup da <a href="#/impostazioni">Impostazioni</a> per non perderli e per spostarli su altri dispositivi.', 'info');
    var root = VH.mount(el, html, 'dash');
    UI.actions(root, {
      'new': function () { A.newDialog(); },
      demo: function () { A.loadDemo(); },
      'import': function () { A.importFile(); }
    });
  }

  /* Elenco {label, value} ordinato, con raggruppamento delle voci minori in "Altro" */
  function topGroups(obj, labelFn, max) {
    var arr = Object.keys(obj).map(function (key) { return { label: labelFn(key), value: obj[key].value, n: obj[key].n }; })
      .filter(function (x) { return x.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    if (max && arr.length > max) {
      var rest = arr.slice(max - 1);
      arr = arr.slice(0, max - 1);
      arr.push({ label: 'Altro (' + rest.length + ')', value: U.sum(rest, function (x) { return x.value; }), color: '#94a3b8' });
    }
    return arr;
  }
  var DIMS = {
    country: ['Paese', function (c) { return U.flag(c) + ' ' + K.name(c); }],
    category: ['Categoria', function (c) { return M.CATEGORIES[c] || c; }],
    type: ['Tipologia', function (c) { return M.typeLabel(c); }],
    usage: ['Utilizzo', function (c) { return M.USAGE[c] || c; }],
    currency: ['Valuta', function (c) { return c + ' — ' + G.FX.name(c); }],
    status: ['Stato', function (c) { return M.STATUS[c] || c; }]
  };
  function breakdown(port, dim) {
    var g = port.groups[dim] || {}, d = DIMS[dim] || DIMS.country, t = dim === 'status' ? null : port.total;
    var rows = Object.keys(g).map(function (key) { return { key: key, a: g[key] }; }).sort(function (x, y) { return y.a.value - x.a.value || y.a.n - x.a.n; });
    var n = function (k) { return function (r) { return U.fmtEur(r.a[k]); }; };
    return UI.table([
      { label: d[0], render: function (r) { return U.esc(d[1](r.key)); } },
      { label: 'Immobili', cls: 'num', render: function (r) { return U.fmtNum(r.a.n); } },
      { label: 'Valore', cls: 'num', render: n('value') },
      { label: 'Debito', cls: 'num', render: n('debt') },
      { label: 'Patrimonio netto', cls: 'num', render: n('equity') },
      { label: 'Canoni lordi', cls: 'num', render: n('gross') },
      { label: 'Imposte', cls: 'num', render: n('taxes') },
      { label: 'Cash flow netto', cls: 'num', render: function (r) { return UI.signed(r.a.cfPost); } },
      { label: 'Peso', cls: 'num', render: function (r) { return t && t.value > 0 ? U.fmtPct(r.a.value / t.value, 1) : '—'; } }
    ], rows, {
      empty: 'Nessun dato',
      foot: t ? ['Totale', U.fmtNum(t.n), U.fmtEur(t.value), U.fmtEur(t.debt), U.fmtEur(t.equity), U.fmtEur(t.gross), U.fmtEur(t.taxes), UI.signed(t.cfPost), '100%'] : null
    });
  }
  function compHtml(port, dim) {
    var d = DIMS[dim] || DIMS.country, items = topGroups(port.groups[dim] || {}, d[1], 8);
    return CH.donut(items, { center: U.fmtCompact(port.total.value), sub: 'valore', empty: 'Nessun immobile posseduto' });
  }
  var RANKS = {
    value: ['Valore di mercato', 'eur'], cfPost: ['Cash flow netto annuo', 'eur'], netYield: ['Rendimento netto', 'pct'],
    roi: ['ROI', 'pct'], equityEur: ['Patrimonio netto', 'eur'], taxTotal: ['Imposte annue', 'eur']
  };
  function rankHtml(port, rank) {
    var A = G.APP, R = RANKS[rank] || RANKS.value, items = [];
    port.bases.forEach(function (m, i) {
      if (!m.active) return;
      var f = port.fins[i], v = rank === 'value' ? m.valueEur : f[rank];
      if (U.ok(v)) items.push({ label: M.displayName(m.p), sub: M.location(m.p), value: v, href: A.editHref(m.id, rank === 'value' || rank === 'equityEur' ? 'generale' : 'analisi') });
    });
    items.sort(function (a, b) { return b.value - a.value; });
    var fmt = R[1] === 'pct' ? function (v) { return U.fmtPct(v); } : function (v) { return U.fmtEur(v); };
    return CH.hbars(items.slice(0, 10), { fmt: fmt, empty: 'Nessun dato disponibile per questa metrica' }) +
      (items.length > 10 ? '<p class="small"><a href="' + A.href('immobili', [], { sort: rank === 'value' ? 'value' : rank, dir: 'desc' }) + '">Vedi tutti (' + items.length + ') ›</a></p>' : '');
  }
  function upcoming(port) {
    var A = G.APP, today = U.todayISO(), lim = U.addDays(today, 120);
    var list = port.dates.filter(function (d) { return d.past ? d.level !== 'info' : d.date <= lim; }).slice(0, 10);
    if (!list.length) return '<p class="empty ok">' + U.icon('check') + ' Nessuna scadenza nei prossimi 4 mesi.</p>';
    return '<ul class="due-list">' + list.map(function (d) {
      var days = Math.round(U.daysBetween(today, d.date));
      var when = d.past ? '<span class="badge st-danger">scaduto</span>' : days === 0 ? '<span class="badge st-warn">oggi</span>' : '<span class="muted small">tra ' + days + ' gg</span>';
      return '<li class="due due-' + d.level + '"><div class="due-d"><b>' + U.fmtDate(d.date) + '</b>' + when + '</div><div class="due-t">' +
        '<a href="' + A.editHref(d.pid, d.tab) + '">' + U.esc(d.label) + '</a><div class="muted small">' + U.esc(d.name) + (d.amount ? ' · ' + U.fmtEur(d.amount) : '') + '</div></div></li>';
    }).join('') + '</ul>';
  }
  function soldPipe(port) {
    var A = G.APP, s = port.sold, p = port.pipe, out = [];
    if (s.n) {
      var prof = 0, inv = 0;
      port.bases.forEach(function (m, i) { if (m.sold) { prof += port.fins[i].profit || 0; inv += port.fins[i].invested || 0; } });
      out.push(UI.card('Immobili venduti', UI.kv([
        ['Numero', U.fmtNum(s.n)], ['Utile complessivo realizzato', UI.signed(prof)], ['Capitale investito', U.fmtEur(inv)],
        ['ROI realizzato', inv > 0 ? UI.signed(prof / inv, 'pct') : '—']
      ]), { icon: 'check', actions: '<a class="small" href="' + A.href('immobili', [], { stato: 'venduto' }) + '">Elenco ›</a>' }));
    }
    if (p.n) {
      out.push(UI.card('In trattativa e obiettivi', UI.kv([
        ['Numero', U.fmtNum(p.n)], ['Valore', U.fmtEur(p.value)], ['Costo totale stimato', U.fmtEur(p.cost)],
        ['Canoni lordi potenziali', U.fmtEur(p.gross)], ['Cash flow netto stimato', UI.signed(p.cfPost)]
      ]), { icon: 'star', actions: '<a class="small" href="' + A.href('confronta') + '">Confronta ›</a>' }));
    }
    return out.join('');
  }
  V.render = function (el, route) {
    var A = G.APP, S = A.S;
    if (!A.props.length) { welcome(el); return; }
    var port = A.port(), t = port.total, k = port.kpi, cnt = port.count, R = port.rentStats, q = route.query || {};
    var dim = DIMS[q.dim] ? q.dim : 'country', rank = RANKS[q.rank] ? q.rank : 'value', fx = G.FX.status();
    var sub = [U.fmtNum(cnt.all) + ' immobili', U.fmtNum(cnt.active) + ' posseduti', U.fmtNum(cnt.rented) + ' a reddito'];
    if (cnt.foreign) sub.push(U.fmtNum(cnt.foreign) + ' all\'estero');
    if (cnt.sold) sub.push(U.fmtNum(cnt.sold) + ' venduti');
    if (cnt.pipe) sub.push(U.fmtNum(cnt.pipe) + ' in trattativa/obiettivo');
    var head = UI.pageHead('Dashboard', sub.join(' · '),
      UI.btn('Nuovo immobile', { cls: 'btn-primary', icon: 'plus', act: 'new' }) +
      UI.btn('', { icon: 'download', act: 'backup', title: 'Esporta backup completo (JSON)' }) +
      UI.btn('', { icon: 'table', act: 'csv', title: 'Esporta tabella con le metriche (CSV per Excel)' }) +
      UI.btn('', { icon: 'print', act: 'print', title: 'Stampa o salva in PDF' }));
    var notes = '';
    if (A.backupDue()) notes += UI.note('<b>Backup consigliato:</b> hai modificato i dati dopo l\'ultimo backup' + (A.lastBackup ? ' (' + U.fmtDateTime(A.lastBackup) + ')' : '') + '. I dati sono salvati solo in questo browser. ' + UI.btn('Esporta backup ora', { cls: 'btn-sm', icon: 'download', act: 'backup' }), 'warn');
    if (fx.offline) notes += UI.note('Cambi valuta non aggiornati: si usa un\'istantanea indicativa del ' + U.fmtDate(fx.date) + '. ' + UI.btn('Aggiorna i cambi', { cls: 'btn-sm', icon: 'refresh', act: 'fx' }), 'warn');
    var kp1 = UI.kpis([
      UI.kpi('Valore di mercato', U.fmtEur(t.value), { icon: 'building', sub: U.fmtNum(t.n) + ' immobili posseduti' + (k.valueSqm ? ' · ' + U.fmtEur(k.valueSqm) + '/m²' : ''), help: 'Somma dei valori di mercato stimati (o del prezzo d\'acquisto se manca la stima), in proporzione alla quota di proprietà, convertiti in euro al cambio attuale.' }),
      UI.kpi('Debito residuo', U.fmtEur(t.debt), { icon: 'currency', sub: 'LTV ' + U.fmtPct(k.ltv), help: 'Capitale residuo dei mutui ad oggi. LTV = debito / valore.' }),
      UI.kpi('Patrimonio netto', U.fmtEur(t.equity), { icon: 'chart', vcls: UI.cls(t.equity), sub: 'Plusvalenza latente ' + U.fmtEur(t.unrealized), help: 'Valore di mercato meno debito residuo. La plusvalenza latente è il valore meno il costo fiscalmente riconosciuto.' }),
      UI.kpi('Capitale proprio investito', U.fmtEur(t.invested), { icon: 'lock', sub: 'Costo totale ' + U.fmtEur(t.cost), help: 'Capitale proprio impiegato: prezzo + oneri d\'acquisto + lavori + arredi + spese del mutuo − importo dei mutui erogati.' })
    ]);
    var kp2 = UI.kpis([
      UI.kpi('Canoni lordi annui', U.fmtEur(t.gross), { icon: 'tag', sub: U.fmtNum(R.rentedN) + ' immobili a reddito', help: 'Canoni annui attesi (al netto di sfitto/occupazione) degli immobili posseduti.' }),
      UI.kpi('Cash flow netto annuo', UI.signed(t.cfPost), { icon: 'currency', sub: UI.signed(k.cfMonthly) + ' al mese', help: 'Canoni − spese di gestione − imposte − rate dei mutui (+ detrazioni). Al lordo dei costi una tantum.' }),
      UI.kpi('Rendimento lordo / netto', U.fmtPct(k.grossYield) + ' / ' + U.fmtPct(k.netYield), { icon: 'chart', sub: 'DSCR ' + (U.ok(k.dscr) ? U.fmtNum(k.dscr, 2) + '×' : '—'), help: 'Solo immobili a reddito. Lordo = canoni / prezzo. Netto = (NOI − imposte sul reddito) / costo totale. DSCR = NOI / rate dei mutui.' }),
      UI.kpi('ROI / TIR complessivi', '<span class="' + UI.cls(k.roi) + '">' + U.fmtPct(k.roi) + '</span> / ' + U.fmtPct(k.irr), { icon: 'star', sub: 'Utile ' + U.fmtEur(k.profit), help: 'Utile totale (flussi storici + vendita netta, realizzata o ipotetica ad oggi, dedotte le imposte) / capitale massimo investito. TIR = tasso interno di rendimento annuo dei flussi datati.' }),
      UI.kpi('Imposte annue stimate', U.fmtEur(t.taxes), { icon: 'file', sub: 'IMU/IVIE e altre ' + U.fmtEur(k.propTax) + ' · redditi ' + U.fmtEur(k.incomeTax), help: 'Stima annua: IMU, IVIE, imposte estere, IRPEF/cedolare sui canoni e sui redditi figurativi, al netto del credito per imposte estere.' })
    ]);
    var dimSel = '<select class="inp inp-sm" data-ch="dim" aria-label="Raggruppa per">' + UI.options(Object.keys(DIMS).filter(function (x) { return x !== 'status'; }).map(function (x) { return [x, DIMS[x][0]]; }), dim) + '</select>';
    var rankSel = '<select class="inp inp-sm" data-ch="rank" aria-label="Classifica per">' + UI.options(Object.keys(RANKS).map(function (x) { return [x, RANKS[x][0]]; }), rank) + '</select>';
    var yl = port.yearly.filter(function (y) { return y.year <= U.year(U.todayISO()); }).slice(-12);
    var flows = CH.bar({
      labels: yl.map(function (y) { return String(y.year); }),
      series: [
        { name: 'Entrate', values: yl.map(function (y) { return y.income; }), color: '#16a34a' },
        { name: 'Spese e imposte', values: yl.map(function (y) { return -y.costs; }), color: '#f59e0b' },
        { name: 'Rate mutui', values: yl.map(function (y) { return -y.debt; }), color: '#dc2626' }
      ]
    }, { stacked: true, line: { name: 'Flusso netto', values: yl.map(function (y) { return y.net; }), color: '#2563eb' }, empty: 'Inserisci le date di acquisto per vedere i flussi storici' });
    var years = U.clamp(Math.round(U.n(S.defaults.projectionYears)) || 10, 1, 40), pj = C.portfolioProjection(port, years);
    var proj = CH.line({
      labels: pj.rows.map(function (r) { return String(r.year); }),
      series: [
        { name: 'Valore', values: pj.rows.map(function (r) { return r.valueEur; }), color: '#2563eb', area: true },
        { name: 'Debito', values: pj.rows.map(function (r) { return r.debtEur; }), color: '#dc2626', dash: true },
        { name: 'Patrimonio netto', values: pj.rows.map(function (r) { return r.equityEur; }), color: '#16a34a' },
        { name: 'Cash flow cumulato', values: pj.rows.map(function (r) { return r.cumCf; }), color: '#7c3aed' }
      ]
    }, { empty: 'Nessun immobile posseduto' });
    var last = pj.rows[pj.rows.length - 1];
    var projFoot = last ? '<p class="muted small">Tra ' + years + ' anni: valore ' + U.fmtEur(last.valueEur) + ', debito ' + U.fmtEur(last.debtEur) + ', cash flow cumulato ' + U.fmtEur(last.cumCf) +
      '. Ipotesi: rivalutazione ' + U.fmtNum(U.n(S.defaults.appreciationPct), 1) + '%/anno, canoni +' + U.fmtNum(U.n(S.defaults.rentGrowthPct), 1) + '%/anno, costi +' + U.fmtNum(U.n(S.defaults.costGrowthPct), 1) + '%/anno (<a href="#/impostazioni">modifica</a>).</p>' : '';
    var fisc = UI.kv([
      ['IMU, IVIE e imposte patrimoniali estere', U.fmtEur(k.propTax)],
      ['Imposte sui redditi (IRPEF/cedolare, estere al netto del credito)', U.fmtEur(k.incomeTax)],
      ['Detrazioni annue (bonus edilizi, interessi del mutuo)', '<span class="pos">' + U.fmtEur(k.ded) + '</span>'],
      ['Totale imposte annue', '<b>' + U.fmtEur(t.taxes) + '</b>']
    ]) + '<p class="muted small">Residenza fiscale in Italia, reddito da altre fonti ' + U.fmtEur(U.n(S.profile.otherIncome)) + ' (<a href="#/impostazioni">profilo fiscale</a>). Stime indicative: verifica sempre con il tuo commercialista.</p>';
    var html = head + notes + kp1 + kp2 +
      '<div class="grid g2">' +
      UI.card('Composizione del patrimonio', '<div data-box="comp">' + compHtml(port, dim) + '</div>', { icon: 'chart', actions: dimSel }) +
      UI.card('Classifica immobili', '<div data-box="rank">' + rankHtml(port, rank) + '</div>', { icon: 'list', actions: rankSel }) +
      '</div>' +
      UI.card('Flussi di cassa annui (storico)', flows, { icon: 'chart', help: 'Entrate = canoni al netto delle imposte sui canoni e dei costi variabili (più l\'eventuale valore d\'uso indicato per gli immobili che usi tu). Spese = costi fissi di gestione e imposte patrimoniali. Rate = rate dei mutui. Esclusi acquisti, lavori e vendite. Gli anni passati sono ricostruiti dai valori attuali.' }) +
      UI.card('Proiezione a ' + years + ' anni', proj + projFoot, { icon: 'chart', help: 'Proiezione semplificata degli immobili posseduti, senza vendite né nuovi acquisti.' }) +
      '<div class="grid g2">' +
      UI.card('Avvisi', UI.alerts(port.alerts, { names: true, max: 8, empty: 'Nessun avviso: tutto in ordine.' }), { icon: 'alert' }) +
      UI.card('Prossime scadenze', upcoming(port), { icon: 'calendar', actions: '<a class="small" href="#/scadenze">Tutte ›</a>' }) +
      '</div>' +
      '<div class="grid g2">' + UI.card('Fisco (stima annua)', fisc, { icon: 'file' }) + soldPipe(port) + '</div>' +
      UI.card('Ripartizione per ' + DIMS[dim][0].toLowerCase(), '<div data-box="table">' + breakdown(port, dim) + '</div>', { icon: 'table', id: 'dash-table' });
    var root = VH.mount(el, html, 'dash');
    UI.actions(root, {
      'new': function () { A.newDialog(); },
      backup: function () { A.exportJSON(); },
      csv: function () { A.exportCSV(); },
      print: function () { window.print(); },
      fx: function () { A.refreshFx(); }
    });
    root.addEventListener('change', function (ev) {
      var s = ev.target, w = s && s.getAttribute ? s.getAttribute('data-ch') : null;
      if (!w) return;
      var P = A.port(), v = s.value, qq = U.clone(A.route.query || {});
      if (w === 'dim' && DIMS[v]) {
        root.querySelector('[data-box="comp"]').innerHTML = compHtml(P, v);
        root.querySelector('[data-box="table"]').innerHTML = breakdown(P, v);
        var h = root.querySelector('#dash-table .card-h h3 span');
        if (h) h.textContent = 'Ripartizione per ' + DIMS[v][0].toLowerCase();
        qq.dim = v;
      } else if (w === 'rank' && RANKS[v]) {
        root.querySelector('[data-box="rank"]').innerHTML = rankHtml(P, v);
        qq.rank = v;
      }
      A.setQuery(qq);
    });
  };
  V.destroy = function () { if (timer) { clearTimeout(timer); timer = null; } };
  G.VIEWS.dashboard = V;
})(window.GPI = window.GPI || {});
