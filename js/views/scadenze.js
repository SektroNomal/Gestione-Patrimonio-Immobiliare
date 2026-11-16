/* Vista Scadenze: contratti, imposte, mutui, documenti e promemoria di tutto il portafoglio */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, VH = G.VH;
  var V = {}, root = null, off = null, offIn = null;
  var st = { r: 'tutte', lv: '', q: '' };
  var RANGES = [['tutte', 'Tutte (scadute e prossimi 13 mesi)'], ['scadute', 'Solo scadute'], ['30', 'Prossimi 30 giorni'], ['90', 'Prossimi 90 giorni'], ['365', 'Prossimi 12 mesi']];
  var LEVELS = [['', 'Tutte le priorità'], ['danger', 'Urgenti'], ['warn', 'Da verificare'], ['info', 'Informative']];
  var MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  var WDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  var LVL = { danger: 'Urgente', warn: 'Da verificare', info: 'Informativa' };

  function filtered() {
    var today = U.todayISO(), lim = /^\d+$/.test(st.r) ? U.addDays(today, +st.r) : null, q = U.norm(st.q);
    return (G.APP.port().dates || []).filter(function (d) {
      if (st.r === 'scadute' && !d.past) return false;
      if (lim && (d.past || d.date > lim)) return false;
      if (st.lv && d.level !== st.lv) return false;
      if (q && U.norm(d.label + ' ' + (d.name || '')).indexOf(q) < 0) return false;
      return true;
    });
  }
  function when(d, today) {
    var n = Math.round(U.daysBetween(today, d.date));
    if (n === 0) return '<b class="warn">oggi</b>';
    if (n < 0) return '<span class="neg">scaduta da ' + (-n) + (n === -1 ? ' giorno' : ' giorni') + '</span>';
    if (n === 1) return '<b class="warn">domani</b>';
    return '<span class="' + (n <= 30 ? 'warn' : 'muted') + '">tra ' + n + ' giorni</span>';
  }
  function kpis(all) {
    var today = U.todayISO(), d30 = U.addDays(today, 30), d90 = U.addDays(today, 90), d365 = U.addDays(today, 365);
    var past = 0, n30 = 0, n90 = 0, amt = 0, amtN = 0;
    all.forEach(function (d) {
      if (d.past) { past++; return; }
      if (d.date <= d30) n30++;
      if (d.date <= d90) n90++;
      if (d.date <= d365 && U.ok(d.amount)) { amt += d.amount; amtN++; }
    });
    return UI.kpis([
      UI.kpi('Scadute', String(past), { icon: 'alert', vcls: past ? 'neg' : 'pos', sub: past ? 'da gestire o aggiornare' : 'nessuna' }),
      UI.kpi('Entro 30 giorni', String(n30), { icon: 'calendar', vcls: n30 ? 'warn' : '' }),
      UI.kpi('Entro 90 giorni', String(n90), { icon: 'calendar' }),
      UI.kpi('Importi previsti a 12 mesi', U.fmtEur(amt), { icon: 'calc', sub: amtN + ' versamenti stimati (IMU, registro…)', help: 'Somma degli importi stimati delle scadenze con un importo (per esempio IMU e imposta di registro) nei prossimi 12 mesi, in euro.' })
    ]);
  }
  function list(items) {
    if (!items.length) return UI.empty('Nessuna scadenza', 'Nessuna scadenza corrisponde ai filtri. Le scadenze vengono calcolate da contratti, mutui, documenti, promemoria, IMU e vincoli fiscali di ogni immobile.', '', 'calendar');
    var today = U.todayISO(), groups = [], byK = {};
    items.forEach(function (d) {
      var k = d.past ? 'past' : d.date.slice(0, 7);
      if (!byK[k]) { byK[k] = { k: k, items: [], amt: 0 }; groups.push(byK[k]); }
      byK[k].items.push(d);
      if (U.ok(d.amount)) byK[k].amt += d.amount;
    });
    groups.sort(function (a, b) { return a.k === 'past' ? -1 : b.k === 'past' ? 1 : a.k < b.k ? -1 : 1; });
    return groups.map(function (g) {
      var title = g.k === 'past' ? U.icon('alert') + ' Scadute' : MONTHS[+g.k.slice(5, 7) - 1] + ' ' + g.k.slice(0, 4);
      var rows = g.items.map(function (d) {
        var p = G.APP.get(d.pid), dt = new Date(d.date + 'T12:00:00');
        return '<li class="due-it lv-' + U.esc(d.level || 'info') + (d.past ? ' past' : '') + '">' +
          '<div class="due-d"><b>' + dt.getDate() + '</b><span>' + WDAYS[dt.getDay()] + '</span>' + (g.k === 'past' ? '<small>' + U.fmtDate(d.date) + '</small>' : '') + '</div>' +
          '<div class="due-b"><div>' + U.esc(d.label) + '</div><div class="muted small">' + (p ? VH.link(p, d.tab) + ' · ' + VH.loc(p) : U.esc(d.name || '')) + '</div></div>' +
          '<div class="due-r">' + (U.ok(d.amount) ? '<b>' + U.fmtEur(d.amount) + '</b><br>' : '') + when(d, today) + '<br>' + UI.badge(LVL[d.level] || 'Info', 'lv-' + (d.level || 'info')) + '</div></li>';
      }).join('');
      return '<section class="due-month' + (g.k === 'past' ? ' past' : '') + '"><h3>' + title + ' <span class="muted small">· ' + g.items.length + (g.items.length === 1 ? ' scadenza' : ' scadenze') +
        (g.amt ? ' · ' + U.fmtEur(g.amt) : '') + '</span></h3><ul class="due-list">' + rows + '</ul></section>';
    }).join('');
  }
  function draw() {
    if (!root) return;
    var main = root.querySelector('[data-main]'), A = G.APP;
    if (!A.props.length) {
      main.innerHTML = UI.empty('Nessun immobile', 'Aggiungi un immobile o carica i dati di esempio: qui troverai contratti in scadenza, rate IMU, registro, fine mutui e promemoria.',
        UI.btn('Nuovo immobile', { cls: 'btn-primary', icon: 'plus', act: 'new' }) + UI.btn('Carica esempio', { icon: 'star', act: 'demo' }), 'calendar');
      return;
    }
    var port = A.port(), items = filtered(), alerts = (port.alerts || []).filter(function (a) { return a.level !== 'info'; });
    main.innerHTML = kpis(port.dates || []) +
      (alerts.length ? UI.card('Avvisi da verificare', UI.alerts(alerts, { names: true, max: 12, goLabel: 'Apri' }), { icon: 'alert' }) : '') +
      UI.card('Calendario (' + items.length + ')', list(items), { icon: 'calendar', actions: items.some(function (d) { return !d.past; }) ? UI.btn('Esporta calendario (.ics)', { cls: 'btn-sm', icon: 'download', act: 'ics' }) : '' }) +
      UI.note('Le date sono calcolate automaticamente dai dati inseriti (contratti, mutui, documenti, promemoria, acquisto) e dai parametri fiscali. Gli importi IMU e registro sono stime: verifica sempre aliquote e scadenze con il tuo Comune o con un professionista. Per aggiungere un promemoria personale apri un immobile, scheda <b>Documenti</b>.');
  }
  function exportIcs() {
    var ev = filtered().filter(function (d) { return !d.past; }).map(function (d) {
      return { date: d.date, title: d.label + (d.name ? ' – ' + d.name : ''), desc: (d.name ? 'Immobile: ' + d.name + '\n' : '') + (U.ok(d.amount) ? 'Importo stimato: ' + U.fmtEur(d.amount) + '\n' : '') + 'Generato da Gestione Patrimonio Immobiliare' };
    });
    if (!ev.length) { U.toast('Nessuna scadenza futura da esportare.', 'info'); return; }
    VH.ics(ev, 'scadenze-immobili-' + U.todayISO() + '.ics');
    U.toast(ev.length + ' scadenze esportate: apri il file con il tuo calendario (Outlook, Google, Apple).', 'success', 5000);
  }

  V.render = function (el, route) {
    var A = G.APP, qy = route.query || {};
    st.q = qy.q || '';
    st.r = RANGES.some(function (x) { return x[0] === qy.r; }) ? qy.r : 'tutte';
    st.lv = LEVELS.some(function (x) { return x[0] === qy.l; }) ? qy.l : '';
    var opts = function (arr, v) { return arr.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === v ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); };
    var bar = '<div class="toolbar"><label class="tb-f"><span class="sr-only">Cerca</span><input type="search" data-q placeholder="Cerca scadenza o immobile…" value="' + U.esc(st.q) + '"></label>' +
      '<label class="tb-f"><span class="sr-only">Periodo</span><select data-r>' + opts(RANGES, st.r) + '</select></label>' +
      '<label class="tb-f"><span class="sr-only">Priorità</span><select data-l>' + opts(LEVELS, st.lv) + '</select></label></div>';
    root = VH.mount(el, UI.pageHead('Scadenze', 'Contratti, imposte, mutui, documenti e promemoria di tutti gli immobili attivi e in acquisto.') + bar + '<div data-main></div>', 'view-scadenze');
    var q = root.querySelector('[data-q]'), r = root.querySelector('[data-r]'), l = root.querySelector('[data-l]');
    var sync = function () { A.setQuery({ q: st.q, r: st.r === 'tutte' ? '' : st.r, l: st.lv }); draw(); };
    var onQ = U.debounce(function () { if (!root) return; st.q = q.value.trim(); sync(); }, 200);
    var onR = function () { st.r = r.value; sync(); };
    var onL = function () { st.lv = l.value; sync(); };
    q.addEventListener('input', onQ); r.addEventListener('change', onR); l.addEventListener('change', onL);
    offIn = function () { q.removeEventListener('input', onQ); r.removeEventListener('change', onR); l.removeEventListener('change', onL); };
    off = UI.actions(root, {
      ics: exportIcs,
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
  G.VIEWS.scadenze = V;
})(window.GPI = window.GPI || {});
