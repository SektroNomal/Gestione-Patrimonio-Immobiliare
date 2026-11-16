/* Scheda immobile (editor): intestazione, indicatori, schede, salvataggio automatico e azioni comuni.
   Le singole schede sono in editor-tabs.js ed editor-analysis.js (registri GPI.EDTABS, GPI.EDCALC, GPI.EDACT). */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, M = G.MODEL, K = G.COUNTRIES, C = G.CALC, VH = G.VH, FX = G.FX;
  var ED = G.ED = G.ED || {};
  G.EDTABS = G.EDTABS || {};
  G.EDCALC = G.EDCALC || {};
  G.EDACT = G.EDACT || {};
  var V = {}, A = G.APP, root = null, off = null, unbind = null, offCity = null, timer = null, pid = null, tab = 'generale', st = null, boxHtml = {};

  ED.TABS = [
    ['generale', 'Generale', 'home'], ['catasto', 'Catasto & valori', 'building'], ['acquisto', 'Acquisto', 'currency'],
    ['spese', 'Spese', 'list'], ['mutui', 'Mutui', 'lock'], ['locazione', 'Locazione', 'calendar'],
    ['registro', 'Registro', 'table'], ['tasse', 'Tasse', 'file'], ['vendita', 'Vendita', 'shop'],
    ['confronti', 'Confronti', 'compare'], ['documenti', 'Documenti', 'inbox'], ['analisi', 'Analisi', 'chart']
  ];
  ED.hasTab = function (k) { return ED.TABS.some(function (t) { return t[0] === k; }); };

  /* Stato di calcolo: base (m) e risultati finali (f) nel contesto dell'intero portafoglio */
  ED.state = function (p) {
    A = G.APP;
    var ctx = C.portfolioCtx(A.props, A.S, p), m = ctx.base, f = C.finalize(m, ctx);
    var cur = String(p.currency || 'EUR').toUpperCase();
    return { p: p, m: m, f: f, ctx: ctx, A: A, S: A.S, P: m.P, cur: cur, foreign: cur !== 'EUR', isIT: p.country === 'IT', tab: tab, pid: p.id };
  };
  ED.current = function () { return st; };
  ED.get = function () { return pid ? G.APP.get(pid) : null; };

  function fxHint(p, path, cur, ratePath) {
    var v = U.get(p, path);
    if (!cur || cur === 'EUR' || !U.ok(v) || !v) return '';
    var r = ratePath ? +U.get(p, ratePath) : 0;
    return '≈ ' + U.fmtEur(FX.toEur(v, cur, r > 0 ? r : null));
  }
  /* Importo in valuta locale: suffisso con la valuta e controvalore in euro aggiornato mentre si scrive.
     o: opzioni di UI.field + {cur, ratePath (cambio storico della voce), noFx} */
  ED.amt = function (s, path, label, o) {
    var x = {}, src = o || {}, k;
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) x[k] = src[k];
    var cur = String(x.cur || s.cur).toUpperCase();
    if (!x.suffix) x.suffix = cur;
    if (cur !== 'EUR' && !x.noFx) {
      var h = '<span class="fxh" data-fxh="' + U.esc(path) + '" data-fxc="' + U.esc(cur) + '"' + (x.ratePath ? ' data-fxr="' + U.esc(x.ratePath) + '"' : '') + '>' +
        fxHint(s.p, path, cur, x.ratePath) + '</span>';
      x.hint = x.hint ? x.hint + ' ' + h : h;
    }
    return UI.num(s.p, path, label, x);
  };
  /* Importo sempre in euro (es. parametri fiscali italiani) */
  ED.eur = function (s, path, label, o) { o = o || {}; o.suffix = '€'; return UI.num(s.p, path, label, o); };

  function calcHtml(name, s) {
    var fn = G.EDCALC[name];
    if (!fn) return '';
    try { return fn(s) || ''; } catch (e) {
      if (window.console) console.error(e);
      return UI.note('Errore nel calcolo: ' + U.esc((e && e.message) || String(e)), 'danger');
    }
  }
  /* Riquadro di risultati ricalcolato a ogni modifica senza ridisegnare i campi */
  ED.calcBox = function (name, s) { return '<div class="calc" data-calc="' + name + '">' + calcHtml(name, s) + '</div>'; };

  /* Elenco modificabile di voci: rowFn(item, basePath, i) restituisce l'html dei campi della riga */
  ED.list = function (s, path, rowFn, o) {
    o = o || {};
    var arr = U.get(s.p, path) || [];
    var rows = arr.map(function (it, i) {
      var d = ' data-list="' + path + '" data-i="' + i + '"';
      return '<div class="li-row' + (o.rowCls ? ' ' + o.rowCls : '') + '" data-row="' + i + '">' +
        '<div class="li-f">' + rowFn(it, path + '.' + i, i) + '</div><div class="li-a">' +
        (o.noDup ? '' : UI.btn('', { cls: 'btn-icon btn-sm', icon: 'copy', act: 'ldup', data: d, title: 'Duplica voce' })) +
        UI.btn('', { cls: 'btn-icon btn-sm', icon: 'trash', act: 'ldel', data: d, title: 'Elimina voce' }) + '</div></div>';
    }).join('');
    return '<div class="list-rows" data-listbox="' + path + '">' + (rows || '<p class="empty muted small">' + (o.empty || 'Nessuna voce inserita.') + '</p>') + '</div>' +
      '<div class="list-add">' + UI.btn(o.addLabel || 'Aggiungi', { cls: 'btn-sm', icon: 'plus', act: 'ladd', data: ' data-list="' + path + '"' }) + (o.extra || '') + '</div>';
  };
  /* Nuove voci per ciascun elenco (pulsante "Aggiungi") */
  ED.MAKE = {
    'cadastre.units': function () { return M.newCadUnit(); },
    'purchase.otherCosts': function () { return M.newCostItem(); },
    furnishing: function () { return M.newExpense(); },
    renovations: function () { return M.newExpense(); },
    extraExpenses: function () { return M.newExpense(); },
    loans: function (p) { var l = M.newLoan(); l.startDate = p.purchase.date || ''; if (p.loans.length) l.label = 'Mutuo ' + (p.loans.length + 1); return l; },
    'recurring.other': function () { return M.newCostItem({ freq: 'mensile' }); },
    'taxesIT.other': function () { return M.newCostItem(); },
    comparables: function (p) { return M.newComparable({ city: p.address.city || '' }); },
    ledger: function () { return M.newLedger(); },
    documents: function () { return M.newDocument(); },
    reminders: function () { return M.newReminder(); },
    'valuation.history': function () { return { id: U.uid(), date: U.todayISO(), value: null, source: '' }; }
  };

  /* ---------- Parti della pagina ---------- */
  function navBtn(href, icon, title) {
    return UI.btn('', href ? { cls: 'btn-sm btn-icon', icon: icon, href: href, title: title } : { cls: 'btn-sm btn-icon', icon: icon, disabled: true, title: title });
  }
  function headHtml(s) {
    var p = s.p, list = A.lastList || [], i = list.indexOf(p.id), n = list.length;
    var nav = '<div class="ed-nav">' + UI.btn('Elenco', { cls: 'btn-sm', icon: 'list', href: A.href('immobili', [], A.listQuery || {}) }) +
      (i >= 0 && n > 1 ? navBtn(i > 0 ? A.editHref(list[i - 1], tab) : '', 'arrow-left', 'Immobile precedente') +
        '<span class="muted small">' + (i + 1) + ' di ' + n + '</span>' +
        navBtn(i < n - 1 ? A.editHref(list[i + 1], tab) : '', 'arrow-right', 'Immobile successivo') : '') + '</div>';
    var thumb = '<div class="ed-thumb">' + VH.thumb(p, 'thumb-lg') + '<div class="ed-thumb-a">' +
      UI.btn('', { cls: 'btn-icon btn-sm', icon: 'upload', act: 'thumb', title: p.thumb ? 'Cambia foto' : 'Aggiungi una foto' }) +
      (p.thumb ? UI.btn('', { cls: 'btn-icon btn-sm', icon: 'x', act: 'thumb-del', title: 'Rimuovi foto' }) : '') + '</div></div>';
    var sub = [UI.statusBadge(p.status), '<span>' + U.esc(M.typeLabel(p.type)) + '</span>', '<span>' + U.esc(M.USAGE[p.usage] || '') + '</span>', VH.loc(p)];
    var acts = UI.btn('Duplica', { cls: 'btn-sm', icon: 'copy', act: 'dup', title: 'Crea una o più copie di questo immobile' }) +
      UI.btn('Copia', { cls: 'btn-sm', icon: 'paste', act: 'clip', title: 'Copia l\'immobile negli appunti: potrai incollarlo dall\'elenco immobili' }) +
      UI.btn('Copia sezioni', { cls: 'btn-sm', icon: 'list', act: 'sections', title: 'Applica spese, tasse, mutui o altre sezioni ad altri immobili' }) +
      UI.btn('Simula', { cls: 'btn-sm', icon: 'star', act: 'target', title: 'Crea una copia in stato "Obiettivo / simulazione" per provare scenari senza toccare l\'originale' }) +
      UI.btn('', { cls: 'btn-sm btn-icon', icon: 'print', act: 'print', title: 'Stampa la scheda' }) +
      UI.btn('', { cls: 'btn-sm btn-icon', icon: 'download', act: 'json', title: 'Esporta questo immobile (JSON)' }) +
      UI.btn('', { cls: 'btn-sm btn-icon btn-danger', icon: 'trash', act: 'del', title: 'Elimina l\'immobile' });
    return nav + '<div class="ed-id">' + thumb + '<div class="ed-title"><h1>' + VH.name(p) + '</h1><p class="ed-sub">' + sub.join(' · ') + '</p></div>' +
      '<div class="page-a ed-acts">' + acts + '</div></div>';
  }

  function kpiHtml(s) {
    var m = s.m, f = s.f, cur = s.cur;
    var vSub = (m.valueEstimated ? UI.badge('stima', 'b-est') + ' ' : '') +
      (s.foreign && m.valueL ? U.fmtMoney(m.valueL * m.share, cur, 0) : (f.valueSqm ? U.fmtMoney(f.valueSqm, cur, 0) + '/m²' : ''));
    var yieldKpi = m.rented ?
      UI.kpi('Rendimento lordo · netto', VH.pct(f.grossYield) + ' · ' + VH.pct(f.netYield), { icon: 'chart', sub: 'cap rate ' + VH.pct(f.capRate) + ' · cash on cash ' + VH.pct(f.coc),
        help: 'Lordo = canone annuo / prezzo. Netto = (canone − spese − imposte) / costo totale d\'acquisto.' }) :
      UI.kpi('Costo annuo di possesso', U.fmtEur(f.annualCostEur), { icon: 'chart', sub: m.imputedEur ? 'affitto figurativo ' + U.fmtEur(m.imputedEur) + '/anno' : 'immobile non locato' });
    return UI.kpis([
      UI.kpi(m.sold ? 'Prezzo di vendita' : 'Valore attuale', U.fmtEur(m.valueEur), { icon: 'home', title: m.valueSrc, sub: vSub }),
      UI.kpi('Patrimonio netto', U.fmtEur(f.equityEur), { icon: 'star', sub: f.debt > 0 ? 'debito residuo ' + U.fmtEur(f.debt) : 'nessun debito' }),
      UI.kpi('Cash flow mensile', UI.signed(f.cfMonthly), { icon: 'currency', sub: 'annuo ' + U.fmtEur(f.cfPost) + ', dopo rate e imposte' }),
      yieldKpi,
      UI.kpi('ROI ' + (f.roiKind || ''), UI.signed(f.roi, 'pct'), { icon: 'chart', sub: f.roiAnn != null ? 'annualizzato ' + VH.pct(f.roiAnn) : (f.projYears ? 'su ' + f.projYears + ' anni' : ''),
        help: 'Utile complessivo (flussi netti + vendita al netto di costi, imposte e debito residuo) diviso il capitale proprio investito.' }),
      UI.kpi('TIR', VH.pct(f.irr), { icon: 'chart', sub: 'senza leva ' + VH.pct(f.irrU), help: 'Tasso interno di rendimento dei flussi di cassa, con e senza mutuo.' }),
      UI.kpi('LTV · DSCR', (f.ltv != null ? VH.pct(f.ltv, 0) : '—') + ' · ' + (f.dscr != null ? U.fmtNum(f.dscr, 2) : '—'), { icon: 'lock',
        sub: f.ltc != null ? 'LTC ' + VH.pct(f.ltc, 0) : '', help: 'LTV = debito / valore. DSCR = reddito netto / rate del mutuo (sotto 1,2 è rischioso).' })
    ], 'ed-kpi');
  }

  function tabsHtml(s) {
    var lv = {};
    (s.f.alerts || []).forEach(function (a) {
      if (a.level === 'danger') lv[a.tab] = 'danger';
      else if (a.level === 'warn' && lv[a.tab] !== 'danger') lv[a.tab] = 'warn';
    });
    return UI.tabs(ED.TABS.map(function (t) { return [t[0], t[1], t[2], lv[t[0]] || '']; }), tab, function (k) { return A.editHref(pid, k); });
  }
  function alertsHtml(s) {
    var al = s.f.alerts || [];
    if (tab === 'generale') return UI.alerts(al, { pid: pid, goLabel: 'Apri', max: 8 });
    return UI.alerts(al.filter(function (a) { return a.tab === tab; }));
  }
  function bodyHtml(s) {
    var fn = G.EDTABS[tab];
    if (!fn) return UI.note('Sezione non disponibile.', 'warn');
    try { return fn(s); } catch (e) {
      if (window.console) console.error(e);
      return UI.note('Errore nella visualizzazione della sezione: ' + U.esc((e && e.message) || String(e)), 'danger');
    }
  }
  function pageHtml(s) {
    boxHtml = { head: headHtml(s), kpi: kpiHtml(s), tabs: tabsHtml(s), alerts: alertsHtml(s) };
    return '<header class="ed-head" data-box="head">' + boxHtml.head + '</header>' +
      '<div data-box="kpi">' + boxHtml.kpi + '</div>' +
      '<div class="ed-tabs" data-box="tabs">' + boxHtml.tabs + '</div>' +
      '<div data-box="alerts">' + boxHtml.alerts + '</div>' +
      '<div class="ed-body" data-box="body" data-tab="' + tab + '">' + bodyHtml(s) + '</div>';
  }
  /* ---------- Aggiornamento ---------- */
  function detailsState(el) { return Array.prototype.map.call(el.querySelectorAll('details'), function (d) { return d.open; }); }
  function restoreDetails(el, list) {
    var dd = el.querySelectorAll('details');
    if (dd.length === list.length) Array.prototype.forEach.call(dd, function (d, i) { d.open = list[i]; });
  }
  function focusEl(el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }

  /* Ridisegna tutta la scheda mantenendo scorrimento, campo attivo, cursore e riquadri aperti */
  ED.refresh = function (focusPath) {
    if (!root) return;
    clearTimeout(timer);
    var p = G.APP.get(pid);
    if (!p) { G.APP.render(); return; }
    var y = window.pageYOffset, ae = document.activeElement, inside = !!(ae && root.contains(ae));
    var fp = focusPath || (inside ? ae.getAttribute('data-path') || '' : ''), fid = inside && !ae.getAttribute('data-path') ? ae.id : '', sel = null;
    if (inside && ae.getAttribute('data-path') === fp) { try { if (typeof ae.selectionStart === 'number') sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { sel = null; } }
    var det = detailsState(root);
    st = ED.state(p);
    root.innerHTML = pageHtml(st);
    restoreDetails(root, det);
    var el = fp ? root.querySelector('[data-path="' + fp.replace(/"/g, '') + '"]') : (fid ? document.getElementById(fid) : null);
    if (el && root.contains(el)) {
      focusEl(el);
      if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e2) { /* campo senza selezione */ } }
    }
    window.scrollTo(0, y);
  };

  function setBox(name, html) {
    if (boxHtml[name] === html) return;
    boxHtml[name] = html;
    var el = root.querySelector('[data-box="' + name + '"]');
    if (el) el.innerHTML = html;
  }
  /* Ricalcolo leggero: aggiorna intestazione, indicatori, avvisi e riquadri di calcolo, non i campi */
  ED.recalc = function () {
    clearTimeout(timer);
    if (!root) return;
    var p = G.APP.get(pid);
    if (!p) return;
    st = ED.state(p);
    setBox('head', headHtml(st)); setBox('kpi', kpiHtml(st)); setBox('tabs', tabsHtml(st)); setBox('alerts', alertsHtml(st));
    Array.prototype.forEach.call(root.querySelectorAll('[data-calc]'), function (box) {
      var det = detailsState(box);
      box.innerHTML = calcHtml(box.getAttribute('data-calc'), st);
      restoreDetails(box, det);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-fxh]'), function (sp) {
      sp.innerHTML = fxHint(st.p, sp.getAttribute('data-fxh'), sp.getAttribute('data-fxc'), sp.getAttribute('data-fxr'));
    });
  };
  ED.later = function () { clearTimeout(timer); timer = setTimeout(ED.recalc, 300); };
  /* Salva l'immobile e aggiorna la vista (hard = ridisegno completo) */
  ED.commit = function (hard, focusPath) {
    var p = ED.get();
    if (!p) return;
    G.APP.save(p);
    if (hard) ED.refresh(focusPath); else ED.later();
  };

  /* ---------- Modifiche ai campi ---------- */
  function resetFx(p) {
    var n = 0;
    ['purchase', 'sale'].forEach(function (k) { if (p[k].fxRate) n++; p[k].fxRate = null; p[k].fxSource = ''; });
    ['furnishing', 'renovations', 'extraExpenses'].forEach(function (k) { p[k].forEach(function (e) { if (e.fxRate) n++; e.fxRate = null; }); });
    if (n) U.toast('Valuta cambiata: azzerati ' + n + ' cambi storici registrati. Aggiornali con "Cambio storico" in Acquisto e Vendita.', 'warn', 7000);
  }
  /* Tipo di contratto coerente con la destinazione d'uso */
  function defContract(p) {
    var c = p.rental.contractType;
    if (p.usage === 'locazione_breve') return 'breve';
    if (p.usage === 'locazione_commerciale') return c === 'alberghiero_9_9' ? c : 'commerciale_6_6';
    if (p.usage === 'locazione_lunga') {
      if (p.country !== 'IT') return 'estero';
      if (c === 'breve' || c === 'commerciale_6_6' || c === 'alberghiero_9_9' || c === 'estero') return 'libero_4_4';
    }
    return c;
  }
  function onChange(path, v, el) {
    var p = ED.get();
    if (!p) return;
    if (path === 'type') p.category = M.typeCategory(v);
    else if (path === 'country') {
      var c = K.currency(v);
      if (c && c !== p.currency) { p.currency = c; resetFx(p); }
      if (v !== 'IT') p.sameComuneAsMainHome = false;
      p.rental.contractType = defContract(p);
    } else if (path === 'currency') resetFx(p);
    else if (path === 'address.province' && p.country === 'IT') { var rg = K.provinceRegion(v); if (rg) p.address.region = rg; }
    else if (path === 'usage') p.rental.contractType = defContract(p);
    var t = el.getAttribute('data-type');
    ED.commit(t === 'select' || t === 'bool' || el.hasAttribute('data-hard'), path);
  }
  /* Comune italiano senza provincia: la deduce dal nome (es. "Milano" → MI) */
  function onCity(ev) {
    var el = ev.target;
    if (!el || !el.getAttribute || el.getAttribute('data-path') !== 'address.city') return;
    var p = ED.get();
    if (!p || p.country !== 'IT' || p.address.province) return;
    var pr = K.findProvince(p.address.city);
    if (!pr) return;
    p.address.province = pr;
    p.address.region = K.provinceRegion(pr) || p.address.region;
    ED.commit(true);
  }
  /* ---------- Azioni ---------- */
  function isBlank(it, path, p) {
    var mk = ED.MAKE[path], fresh = mk ? mk(p) : {};
    return Object.keys(it).every(function (k) {
      var a = it[k];
      if (k === 'id' || a === null || a === undefined || a === '' || (Array.isArray(a) && !a.length)) return true;
      return JSON.stringify(a) === JSON.stringify(fresh[k]);
    });
  }
  function listOf(el) {
    var p = ED.get(), path = el.getAttribute('data-list'), arr = p ? U.get(p, path) : null;
    return { p: p, path: path, arr: Array.isArray(arr) ? arr : null, i: parseInt(el.getAttribute('data-i'), 10) };
  }
  /* Modifica asincrona: salva e ridisegna solo se la scheda dello stesso immobile è ancora aperta */
  function withProp(id, fn) {
    var p = G.APP.get(id);
    if (!p) return;
    fn(p);
    G.APP.save(p);
    if (root && pid === id) ED.refresh();
  }
  ED.withProp = withProp;
  var ACT = ED.ACT = {
    ladd: function (el) {
      var L = listOf(el), mk = ED.MAKE[L.path];
      if (!L.p || !mk) return;
      if (!L.arr) { L.arr = []; U.set(L.p, L.path, L.arr); }
      if (L.arr.length >= 500) { U.toast('Limite di 500 voci per elenco raggiunto.', 'warn'); return; }
      L.arr.push(mk(L.p));
      ED.commit(true);
      var box = root && root.querySelector('[data-listbox="' + L.path + '"]'), rows = box ? box.querySelectorAll('.li-row') : [];
      var inp = rows.length ? rows[rows.length - 1].querySelector('input:not([type="checkbox"]), select, textarea') : null;
      if (inp) focusEl(inp);
    },
    ldup: function (el) {
      var L = listOf(el);
      if (!L.arr || !L.arr[L.i]) return;
      if (L.arr.length >= 500) { U.toast('Limite di 500 voci per elenco raggiunto.', 'warn'); return; }
      var c = U.clone(L.arr[L.i]);
      if (c.id) c.id = U.uid();
      L.arr.splice(L.i + 1, 0, c);
      ED.commit(true);
    },
    ldel: function (el) {
      var L = listOf(el), it = L.arr ? L.arr[L.i] : null;
      if (!it) return;
      var go = function () {
        var k = L.arr.indexOf(it);
        if (k < 0) return;
        L.arr.splice(k, 1);
        ED.commit(true);
      };
      if (typeof it !== 'object' || isBlank(it, L.path, L.p)) go();
      else U.confirm('Eliminare questa voce?', 'Elimina', true).then(function (ok) { if (ok) go(); });
    },
    fxhist: function (el) {
      var id = pid, p = ED.get(), which = el.getAttribute('data-which') === 'sale' ? 'sale' : 'purchase';
      if (!p) return;
      var cur = String(p.currency || 'EUR').toUpperCase(), d = p[which].date || U.todayISO();
      if (cur === 'EUR') { U.toast('L\'immobile è in euro: il cambio non serve.', 'info'); return; }
      el.disabled = true;
      FX.historical(cur, d).then(function (r) {
        el.disabled = false;
        if (!r || !(r.rate > 0)) { U.toast('Cambio non disponibile: inseriscilo a mano.', 'error', 5000); return; }
        withProp(id, function (q) { q[which].fxRate = U.round(r.rate, 6); q[which].fxSource = r.source || ''; });
        U.toast(r.approx ? 'Cambio storico del ' + U.fmtDate(d) + ' non disponibile: usato il cambio attuale (1 € = ' + U.fmtNum(r.rate, 4) + ' ' + cur + '). Verificalo.' :
          '1 € = ' + U.fmtNum(r.rate, 4) + ' ' + cur + ' (' + (r.source || U.fmtDate(r.date || d)) + ')', r.approx ? 'warn' : 'success', 6000);
      });
    },
    thumb: function () {
      var id = pid;
      U.pickFile('image/*').then(function (f) {
        if (!f) return null;
        return U.resizeImage(f, 480, 0.78).then(function (url) { withProp(id, function (q) { q.thumb = url; }); });
      }).catch(function () { U.toast('Immagine non leggibile: prova con un file JPG o PNG.', 'error'); });
    },
    'thumb-del': function () { withProp(pid, function (q) { q.thumb = ''; }); },
    dup: function () {
      VH.duplicate([pid]).then(function (list) { if (list && list.length === 1) G.APP.go(G.APP.editHref(list[0].id, tab)); });
    },
    clip: function () { G.APP.copyProp(pid); },
    sections: function () { G.APP.copySectionsDialog(pid); },
    target: function () {
      var src = ED.get();
      if (!src) return;
      G.APP.duplicate(pid, { asTarget: true, suffix: false, comparables: true, ledger: true, sale: true }, 1).then(function (list) {
        var c = list && list[0];
        if (!c) return;
        c.name = (src.name || 'Immobile') + ' – simulazione';
        G.APP.save(c, true);
        U.toast('Creata una copia in stato "Obiettivo / simulazione": modificala liberamente, l\'originale resta invariato.', 'success', 6000);
        G.APP.go(G.APP.editHref(c.id, 'analisi'));
      });
    },
    print: function () { window.print(); },
    json: function () { var p = ED.get(); if (p) G.APP.exportJSON([pid], U.slug(p.name || 'immobile')); },
    del: function () {
      VH.remove([pid]).then(function (n) { if (n > 0) G.APP.go(G.APP.href('immobili', [], G.APP.listQuery || {}), true); });
    }
  };

  /* ---------- Ciclo di vita della vista ---------- */
  V.render = function (el, route) {
    A = G.APP;
    var prm = route.params || [];
    pid = prm[0] || null;
    tab = ED.hasTab(prm[1]) ? prm[1] : 'generale';
    var p = pid ? A.get(pid) : null;
    if (!p) {
      root = null; st = null;
      VH.mount(el, UI.empty('Immobile non trovato', 'L\'immobile richiesto non esiste o è stato eliminato.',
        UI.btn('Vai all\'elenco', { href: A.href('immobili'), cls: 'btn-primary', icon: 'list' }), 'alert'), 'editor');
      return;
    }
    st = ED.state(p);
    root = VH.mount(el, pageHtml(st), 'editor');
    var map = {}, k;
    for (k in G.EDACT) if (Object.prototype.hasOwnProperty.call(G.EDACT, k)) map[k] = G.EDACT[k];
    for (k in ACT) if (Object.prototype.hasOwnProperty.call(ACT, k)) map[k] = ACT[k];
    off = UI.actions(root, map);
    unbind = UI.bind(root, function () { return G.APP.get(pid); }, onChange);
    offCity = root;
    root.addEventListener('change', onCity);
    document.title = (p.name || 'Immobile') + ' · Patrimonio Immobiliare';
  };
  V.onFx = function () { if (root) ED.recalc(); };
  V.destroy = function () {
    clearTimeout(timer);
    if (unbind) unbind();
    if (off) off();
    if (offCity) offCity.removeEventListener('change', onCity);
    unbind = off = offCity = null;
    if (G.APP && G.APP.flushAll) G.APP.flushAll();
    root = null; st = null;
  };

  G.VIEWS = G.VIEWS || {};
  G.VIEWS.immobile = V;
})(window.GPI = window.GPI || {});
