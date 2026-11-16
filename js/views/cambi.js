/* Vista Cambi valuta: stato dei tassi live, valute del portafoglio, convertitore, cambi storici, cambi manuali ed elenco completo */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, FX = G.FX, VH = G.VH;
  var V = {}, root = null, off = null, offIn = [];
  var st = { q: '', a: 100000, from: 'USD', to: 'EUR', hc: 'USD', hd: '' };

  function fmtRate(r) {
    if (!U.ok(r) || !(r > 0)) return '—';
    return U.fmtNum(r, r >= 1000 ? 2 : r >= 100 ? 3 : r >= 1 ? 4 : 6);
  }
  function curOpts(sel) { return UI.options(UI.currencyOptions(), sel); }
  function q(sel) { return root ? root.querySelector(sel) : null; }
  function listen(el, ev, fn) { if (!el) return; el.addEventListener(ev, fn); offIn.push(function () { el.removeEventListener(ev, fn); }); }

  function statusHtml() {
    var s = FX.status(), n = Object.keys(G.APP.S.fxOverrides || {}).length;
    var state = !s.ok ? '<span class="warn">Non scaricati: valori indicativi offline</span>' : s.stale ? '<span class="warn">Da aggiornare</span>' : '<span class="pos">Aggiornati</span>';
    return UI.kv([
      ['Stato', state],
      ['Data di riferimento dei tassi', U.fmtDate(s.date)],
      ['Ultimo download', s.fetchedAt ? U.fmtDateTime(s.fetchedAt) : '—'],
      ['Fonti', U.esc((s.sources || []).join(', ')) || '—'],
      ['Valute disponibili', String(s.count)],
      ['Cambi manuali attivi', n ? '<b>' + n + '</b>' : 'nessuno']
    ]) + UI.note('I tassi indicano quante unità di valuta corrispondono a <b>1 euro</b> (per esempio 1 EUR = 1,10 USD, quindi 110.000 USD ≈ 100.000 €). ' +
      'Fonte principale: <b>Banca Centrale Europea</b> (tramite frankfurter.dev), integrata da open.er-api.com e, in mancanza, da currency-api. ' +
      'I cambi si aggiornano da soli ogni 12 ore quando l\'app è aperta e restano salvati nel browser per l\'uso offline. Per prezzi d\'acquisto e vendite passate puoi usare il cambio storico della data dell\'atto.' +
      (s.ok ? '' : ' <b>Non è stato possibile scaricarli:</b> controlla la connessione e premi «Aggiorna ora».'), s.ok ? '' : 'warn');
  }
  function portHtml() {
    var g = (G.APP.port().groups || {}).currency || {};
    var rows = Object.keys(g).map(function (c) {
      var ri = FX.rateInfo(c);
      return { c: c, n: g[c].n, rate: ri.rate, src: ri.source, value: g[c].value || 0, debt: g[c].debt || 0 };
    }).sort(function (a, b) { return b.value - a.value; });
    if (!rows.length) return '<p class="empty">Nessun immobile attivo: le valute del portafoglio compariranno qui.</p>';
    var tot = U.sum(rows, function (r) { return r.value; }), foreign = U.sum(rows, function (r) { return r.c === 'EUR' ? 0 : r.value; });
    return UI.table([
      { label: 'Valuta', render: function (r) { return '<b>' + r.c + '</b> <span class="muted small">' + U.esc(FX.name(r.c)) + '</span>'; } },
      { label: 'Immobili', cls: 'num', render: function (r) { return String(r.n); } },
      { label: '1 € =', cls: 'num', render: function (r) { return r.c === 'EUR' ? '—' : fmtRate(r.rate) + ' ' + r.c; } },
      { label: '1 unità in €', cls: 'num', render: function (r) { return r.c === 'EUR' || !r.rate ? '—' : U.fmtNum(1 / r.rate, 4) + ' €'; } },
      { label: 'Fonte', render: function (r) { return '<span class="small">' + U.esc(r.src) + '</span>'; } },
      { label: 'Valore (€)', cls: 'num', render: function (r) { return U.fmtEur(r.value); } },
      { label: 'Debito (€)', cls: 'num', render: function (r) { return r.debt ? U.fmtEur(r.debt) : '—'; } },
      { label: 'Peso', cls: 'num', render: function (r) { return tot ? U.fmtPct(r.value / tot, 1) : '—'; } }
    ], rows, { cls: 'tbl-compact' }) +
      (foreign ? '<p class="small">Esposizione in valuta diversa dall\'euro: <b>' + U.fmtEur(foreign) + '</b> (' + U.fmtPct(tot ? foreign / tot : 0, 1) + ' del valore). ' +
        'Una variazione del 10% dei cambi sposterebbe il patrimonio di circa <b>' + U.fmtEur(foreign * 0.1) + '</b>.</p>' : '');
  }
  function convResult() {
    if (!U.ok(st.a)) return '<span class="muted">Inserisci un importo.</span>';
    var r = FX.convert(st.a, st.from, st.to);
    if (r == null) return '<span class="warn">Cambio non disponibile per ' + U.esc(FX.rate(st.from) ? st.to : st.from) + '.</span>';
    var unit = FX.convert(1, st.from, st.to);
    return '<b class="big">' + U.fmtMoney(r, st.to, 2) + '</b><br><span class="muted small">1 ' + st.from + ' = ' + fmtRate(unit) + ' ' + st.to + ' · 1 ' + st.to + ' = ' + fmtRate(unit ? 1 / unit : null) + ' ' + st.from + '</span>';
  }
  function convHtml() {
    return '<div class="grid g3 conv">' +
      '<label class="fld"><span>Importo</span><input type="text" inputmode="decimal" data-cv-a value="' + U.esc(U.fmtInput(st.a, 2)) + '"></label>' +
      '<label class="fld"><span>Da</span><select data-cv-f>' + curOpts(st.from) + '</select></label>' +
      '<label class="fld"><span>A</span><select data-cv-t>' + curOpts(st.to) + '</select></label></div>' +
      '<div class="conv-r"><div data-cv-r>' + convResult() + '</div>' + UI.btn('Inverti', { cls: 'btn-sm btn-ghost', icon: 'refresh', act: 'swap' }) + '</div>' +
      '<hr><h4>Cambio storico a una data</h4><p class="muted small">Utile per convertire in euro il prezzo d\'acquisto o di vendita al cambio del giorno dell\'atto (dati BCE dal 1999).</p>' +
      '<div class="grid g3"><label class="fld"><span>Valuta</span><select data-h-c>' + curOpts(st.hc) + '</select></label>' +
      '<label class="fld"><span>Data</span><input type="date" data-h-d value="' + U.esc(st.hd) + '" max="' + U.todayISO() + '"></label>' +
      '<div class="fld"><span>&nbsp;</span>' + UI.btn('Cerca cambio', { icon: 'calendar', act: 'hist' }) + '</div></div><div data-h-r></div>';
  }
  function ovHtml() {
    var ov = G.APP.S.fxOverrides || {}, keys = Object.keys(ov).sort();
    var rows = keys.map(function (c) {
      var auto = FX.liveRates()[c];
      return '<tr><td><b>' + c + '</b> <span class="muted small">' + U.esc(FX.name(c)) + '</span></td>' +
        '<td class="num"><input type="text" inputmode="decimal" class="in-sm" data-ov="' + c + '" value="' + U.esc(U.fmtInput(ov[c], 6)) + '" aria-label="Unità di ' + c + ' per 1 euro"></td>' +
        '<td class="num muted">' + (auto ? fmtRate(auto) : '—') + '</td>' +
        '<td>' + UI.btn('', { cls: 'btn-sm btn-icon btn-ghost', icon: 'trash', act: 'ovdel', data: ' data-c="' + c + '"', title: 'Rimuovi il cambio manuale' }) + '</td></tr>';
    }).join('');
    return '<p class="muted small">Imposta un cambio fisso (unità di valuta per 1 euro) per usare, ad esempio, il cambio della tua banca o di una valuta non quotata. Il cambio manuale ha la precedenza su quello automatico in tutti i calcoli.</p>' +
      (keys.length ? '<div class="tbl-wrap"><table class="tbl tbl-compact"><thead><tr><th>Valuta</th><th class="num">1 € = (manuale)</th><th class="num">Automatico</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
      '<div class="grid g3"><label class="fld"><span>Valuta</span><select data-ov-c>' + curOpts('USD') + '</select></label>' +
      '<label class="fld"><span>Unità per 1 €</span><input type="text" inputmode="decimal" data-ov-r placeholder="es. 1,0850"></label>' +
      '<div class="fld"><span>&nbsp;</span>' + UI.btn('Aggiungi cambio manuale', { icon: 'plus', act: 'ovadd' }) + '</div></div>';
  }
  function allHtml() {
    var qq = U.norm(st.q);
    var rows = FX.currencies().filter(function (c) { return !qq || U.norm(c + ' ' + FX.name(c)).indexOf(qq) >= 0; }).map(function (c) {
      var ri = FX.rateInfo(c);
      return { c: c, rate: ri.rate, src: ri.source };
    });
    return UI.table([
      { label: 'Codice', render: function (r) { return '<b>' + r.c + '</b>'; } },
      { label: 'Valuta', render: function (r) { return U.esc(FX.name(r.c)); } },
      { label: '1 € =', cls: 'num', render: function (r) { return fmtRate(r.rate); } },
      { label: '1 unità in €', cls: 'num', render: function (r) { return r.rate ? U.fmtNum(1 / r.rate, 6) : '—'; } },
      { label: 'Fonte', render: function (r) { return '<span class="small' + (r.rate ? '' : ' muted') + '">' + U.esc(r.src) + '</span>'; } }
    ], rows, { cls: 'tbl-compact', empty: 'Nessuna valuta trovata.' });
  }
  function refreshLive() {
    if (!root) return;
    var s = q('[data-status]'), p = q('[data-port]'), r = q('[data-cv-r]'), a = q('[data-all]');
    if (s) s.innerHTML = statusHtml();
    if (p) p.innerHTML = portHtml();
    if (r) r.innerHTML = convResult();
    if (a) a.innerHTML = allHtml();
  }
  var saveOv = U.debounce(function () { G.APP.saveSettings(); }, 400);
  function drawOv() { var o = q('[data-ov-box]'); if (o) o.innerHTML = ovHtml(); }

  V.render = function (el, route) {
    var A = G.APP;
    A.S.fxOverrides = A.S.fxOverrides || {};
    st.q = (route.query && route.query.q) || '';
    root = VH.mount(el, UI.pageHead('Cambi valuta', 'Tassi in tempo reale per convertire in euro gli immobili all\'estero.',
      UI.btn('Aggiorna ora', { cls: 'btn-primary', icon: 'refresh', act: 'refresh' })) +
      '<div class="grid g2">' + UI.card('Stato dei cambi', '<div data-status>' + statusHtml() + '</div>', { icon: 'currency' }) +
      UI.card('Convertitore', convHtml(), { icon: 'calc' }) + '</div>' +
      UI.card('Valute del portafoglio (immobili attivi)', '<div data-port>' + portHtml() + '</div>', { icon: 'chart' }) +
      UI.card('Cambi manuali', '<div data-ov-box>' + ovHtml() + '</div>', { icon: 'sliders' }) +
      UI.card('Tutte le valute', '<div class="toolbar"><label class="tb-f"><span class="sr-only">Filtra valute</span><input type="search" data-fq placeholder="Filtra per codice o nome…" value="' + U.esc(st.q) + '"></label></div><div data-all>' + allHtml() + '</div>', { icon: 'list' }), 'view-cambi');
    var upd = function () { var r = q('[data-cv-r]'); if (r) r.innerHTML = convResult(); };
    listen(q('[data-cv-a]'), 'input', function (e) { st.a = U.parseNum(e.target.value); upd(); });
    listen(q('[data-cv-f]'), 'change', function (e) { st.from = e.target.value; upd(); });
    listen(q('[data-cv-t]'), 'change', function (e) { st.to = e.target.value; upd(); });
    listen(q('[data-h-c]'), 'change', function (e) { st.hc = e.target.value; });
    listen(q('[data-h-d]'), 'change', function (e) { st.hd = e.target.value; });
    listen(q('[data-fq]'), 'input', U.debounce(function (e) { if (!root) return; st.q = e.target.value.trim(); A.setQuery({ q: st.q }); var a = q('[data-all]'); if (a) a.innerHTML = allHtml(); }, 200));
    listen(q('[data-ov-box]'), 'change', function (e) {
      var c = e.target.getAttribute('data-ov');
      if (!c) return;
      var v = U.parseNum(e.target.value, { pct: true });
      if (!(v > 0)) { U.toast('Inserisci un cambio maggiore di zero (unità di ' + c + ' per 1 euro).', 'warn'); e.target.value = U.fmtInput(A.S.fxOverrides[c], 6); return; }
      A.S.fxOverrides[c] = v;
      saveOv();
    });
    off = UI.actions(root, {
      refresh: function () { A.refreshFx(); },
      swap: function () {
        var t = st.from; st.from = st.to; st.to = t;
        var f = q('[data-cv-f]'), to = q('[data-cv-t]');
        if (f) f.value = st.from;
        if (to) to.value = st.to;
        upd();
      },
      hist: function () {
        var out = q('[data-h-r]');
        if (!U.validDate(st.hd)) { U.toast('Scegli una data.', 'warn'); return; }
        if (out) out.innerHTML = '<p class="muted">Ricerca in corso…</p>';
        FX.historical(st.hc, st.hd).then(function (r) {
          if (!root || !out) return;
          out.innerHTML = r && r.rate ? UI.note('Il ' + U.fmtDate(st.hd) + ': <b>1 € = ' + fmtRate(r.rate) + ' ' + st.hc + '</b> (1 ' + st.hc + ' = ' + U.fmtNum(1 / r.rate, 6) + ' €).<br><span class="small">Fonte: ' + U.esc(r.source) + '</span>', r.approx ? 'warn' : '') :
            UI.note('Cambio storico non disponibile per ' + st.hc + '.', 'warn');
        }, function () { if (out) out.innerHTML = UI.note('Servizio non raggiungibile: riprova più tardi.', 'warn'); });
      },
      ovadd: function () {
        var c = (q('[data-ov-c]') || {}).value, v = U.parseNum((q('[data-ov-r]') || {}).value, { pct: true });
        if (!c || c === 'EUR') { U.toast('Scegli una valuta diversa dall\'euro.', 'warn'); return; }
        if (!(v > 0)) { U.toast('Inserisci il cambio: quante unità di ' + c + ' per 1 euro.', 'warn'); return; }
        A.S.fxOverrides[c] = v;
        A.saveSettings();
        drawOv();
        U.toast('Cambio manuale per ' + c + ' impostato.', 'success');
      },
      ovdel: function (b) {
        var c = b.getAttribute('data-c');
        delete A.S.fxOverrides[c];
        A.saveSettings();
        drawOv();
        U.toast('Ripristinato il cambio automatico per ' + c + '.', 'info');
      }
    });
  };
  V.onFx = function () { refreshLive(); };
  V.destroy = function () {
    saveOv.flush();
    if (off) off();
    offIn.forEach(function (f) { f(); });
    offIn = [];
    off = null;
    root = null;
  };

  G.VIEWS = G.VIEWS || {};
  G.VIEWS.cambi = V;
})(window.GPI = window.GPI || {});
