/* Componenti di interfaccia riutilizzabili: campi modulo con binding, KPI, tabelle, sezioni (GPI.UI) */
(function (G) {
  'use strict';
  var U = G.U, UI = {}, seq = 0;
  var NUMERIC = { num: 1, pct: 1, int: 1 };

  UI.esc = U.esc;
  UI.id = function (p) { return (p || 'u') + '-' + (++seq); };

  /* Opzioni per <select>: accetta mappa {k: label | [label, ...]}, array di stringhe o array di [k, label] */
  UI.options = function (opts, val, empty) {
    var out = [], sv = val == null ? '' : String(val);
    if (empty != null) out.push('<option value=""' + (sv === '' ? ' selected' : '') + '>' + U.esc(empty) + '</option>');
    var add = function (k, l) {
      k = String(k);
      out.push('<option value="' + U.esc(k) + '"' + (k === sv ? ' selected' : '') + '>' + U.esc(l) + '</option>');
    };
    if (Array.isArray(opts)) {
      opts.forEach(function (o) {
        if (Array.isArray(o)) add(o[0], o[1]);
        else if (o && typeof o === 'object') add(o.value, o.label);
        else add(o, o);
      });
    } else if (opts) {
      Object.keys(opts).forEach(function (k) { var l = opts[k]; add(k, Array.isArray(l) ? l[0] : l); });
    }
    return out.join('');
  };

  UI.help = function (text) {
    return text ? ' <span class="help" tabindex="0" role="note" data-tip="' + U.esc(text) + '" aria-label="' + U.esc(text) + '">?</span>' : '';
  };

  function inputVal(t, v, o) {
    if (NUMERIC[t] && o.dec === 'plain') return U.ok(v) ? String(v) : '';
    if (NUMERIC[t]) return U.fmtInput(v, o.dec != null ? o.dec : (t === 'int' ? 0 : t === 'pct' ? 4 : 2));
    if (t === 'tags') return Array.isArray(v) ? v.join(', ') : (v || '');
    return v == null ? '' : String(v);
  }

  /* Campo legato a obj[path]. o: {type: num|pct|int|text|date|bool|select|textarea|tags|url, options, empty, numeric,
     hint, help, suffix, placeholder, cls, dec, disabled, readonly, min, max, list, rows, id, value} */
  UI.field = function (obj, path, label, o) {
    o = o || {};
    var t = o.type || 'text', v = o.value !== undefined ? o.value : U.get(obj, path), id = o.id || UI.id('f');
    var common = ' id="' + id + '" data-path="' + U.esc(path) + '" data-type="' + t + '"' +
      (o.dec != null ? ' data-dec="' + o.dec + '"' : '') + (o.disabled ? ' disabled' : '') + (o.readonly ? ' readonly' : '') +
      (o.placeholder ? ' placeholder="' + U.esc(o.placeholder) + '"' : '') + (o.attrs || '');
    if (t === 'bool') {
      return '<label class="fld fld-check' + (o.cls ? ' ' + o.cls : '') + '"><input type="checkbox"' + common + (v ? ' checked' : '') + '>' +
        '<span>' + label + UI.help(o.help) + '</span>' + (o.hint ? '<small>' + o.hint + '</small>' : '') + '</label>';
    }
    var inner;
    if (t === 'select') {
      inner = '<select' + common + (o.numeric ? ' data-numeric="1"' : '') + (o.boolean ? ' data-boolean="1"' : '') + '>' +
        (o.optionsHtml != null ? o.optionsHtml : UI.options(o.options, v, o.empty)) + '</select>';
    } else if (t === 'textarea') {
      inner = '<textarea' + common + ' rows="' + (o.rows || 3) + '">' + U.esc(v == null ? '' : v) + '</textarea>';
    } else if (t === 'date') {
      inner = '<input type="date"' + common + ' value="' + U.esc(U.validDate(v) ? v : '') + '"' + (o.min ? ' min="' + o.min + '"' : '') + (o.max ? ' max="' + o.max + '"' : '') + '>';
    } else if (NUMERIC[t]) {
      inner = '<input type="text" inputmode="decimal" autocomplete="off"' + common + ' value="' + U.esc(inputVal(t, v, o)) + '">';
    } else {
      inner = '<input type="' + (t === 'url' ? 'url' : 'text') + '"' + common + ' value="' + U.esc(inputVal(t, v, o)) + '"' +
        (o.list ? ' list="' + o.list + '"' : '') + ' autocomplete="off">';
    }
    var sfx = o.suffix ? '<em class="sfx">' + U.esc(o.suffix) + '</em>' : (t === 'pct' ? '<em class="sfx">%</em>' : '');
    return '<label class="fld' + (o.cls ? ' ' + o.cls : '') + '" for="' + id + '"><span>' + label + UI.help(o.help) + '</span>' +
      '<div class="inp' + (sfx ? ' has-sfx' : '') + '">' + inner + sfx + '</div>' +
      (o.hint != null ? '<small' + (o.hintId ? ' id="' + o.hintId + '"' : '') + '>' + o.hint + '</small>' : '') + '</label>';
  };
  /* Scorciatoie */
  UI.num = function (obj, path, label, o) { o = o || {}; o.type = 'num'; return UI.field(obj, path, label, o); };
  UI.pct = function (obj, path, label, o) { o = o || {}; o.type = 'pct'; return UI.field(obj, path, label, o); };
  UI.int = function (obj, path, label, o) { o = o || {}; o.type = 'int'; return UI.field(obj, path, label, o); };
  UI.text = function (obj, path, label, o) { o = o || {}; o.type = o.type || 'text'; return UI.field(obj, path, label, o); };
  UI.date = function (obj, path, label, o) { o = o || {}; o.type = 'date'; return UI.field(obj, path, label, o); };
  UI.bool = function (obj, path, label, o) { o = o || {}; o.type = 'bool'; return UI.field(obj, path, label, o); };
  UI.select = function (obj, path, label, options, o) { o = o || {}; o.type = 'select'; o.options = options; return UI.field(obj, path, label, o); };
  UI.area = function (obj, path, label, o) { o = o || {}; o.type = 'textarea'; return UI.field(obj, path, label, o); };
  UI.grid = function (items, cols, cls) { return '<div class="grid g' + (cols || 3) + (cls ? ' ' + cls : '') + '">' + items.filter(Boolean).join('') + '</div>'; };
  /* Legge il valore tipizzato da un controllo; undefined = valore non valido */
  UI.readValue = function (el) {
    var t = el.getAttribute('data-type'), raw = el.value;
    if (t === 'bool') return !!el.checked;
    if (NUMERIC[t]) {
      if (String(raw).trim() === '') return null;
      /* Con 3 o più decimali (cambi, coordinate, percentuali) un singolo punto è sempre separatore decimale */
      var dd = el.getAttribute('data-dec');
      var n = U.parseNum(raw, { pct: t === 'pct' || (dd != null && dd !== 'plain' && +dd >= 3) });
      if (n == null || !isFinite(n)) return undefined;
      return t === 'int' ? Math.round(n) : n;
    }
    if (t === 'select') {
      if (el.getAttribute('data-numeric')) return raw === '' ? null : +raw;
      if (el.getAttribute('data-boolean')) return raw === '' ? null : raw === 'true';
      return raw === '' ? null : raw;
    }
    if (t === 'tags') return String(raw).split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (t === 'date') return raw === '' ? null : (U.validDate(raw) ? raw : undefined);
    if (t === 'url') return String(raw).trim();
    return raw;
  };

  /* Collega i controlli [data-path] contenuti in root all'oggetto target (o a una funzione che lo restituisce).
     onChange(path, value, el, old) a ogni modifica valida. Restituisce la funzione di scollegamento. */
  UI.bind = function (root, target, onChange) {
    var get = typeof target === 'function' ? target : function () { return target; };
    var handler = function (ev) {
      var el = ev.target;
      if (!el || !el.getAttribute) return;
      var path = el.getAttribute('data-path');
      if (!path || el.hasAttribute('data-nobind')) return;
      var v = UI.readValue(el);
      if (v === undefined) { el.classList.add('invalid'); el.setAttribute('aria-invalid', 'true'); return; }
      el.classList.remove('invalid'); el.removeAttribute('aria-invalid');
      var obj = get(); if (!obj) return;
      var old = U.get(obj, path);
      if (old === v || (Array.isArray(v) && JSON.stringify(old) === JSON.stringify(v))) return;
      if ((old == null || old === '') && (v == null || v === '') && el.getAttribute('data-type') !== 'text') return;
      U.set(obj, path, v);
      if (onChange) onChange(path, v, el, old);
    };
    var blur = function (ev) {
      var el = ev.target;
      if (!el || !el.getAttribute || el.hasAttribute('data-nobind')) return;
      var t = el.getAttribute('data-type');
      if (!NUMERIC[t] || el.classList.contains('invalid')) return;
      var obj = get(); if (!obj) return;
      var d = el.getAttribute('data-dec');
      el.value = inputVal(t, U.get(obj, el.getAttribute('data-path')), { dec: d == null ? null : (d === 'plain' ? d : +d) });
    };
    root.addEventListener('input', handler);
    root.addEventListener('change', handler);
    root.addEventListener('focusout', blur);
    return function () {
      root.removeEventListener('input', handler);
      root.removeEventListener('change', handler);
      root.removeEventListener('focusout', blur);
    };
  };

  /* Delegazione dei click su [data-act]: map {azione: function (el, ev)} */
  UI.actions = function (root, map) {
    var h = function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!el || !root.contains(el)) return;
      var fn = map[el.getAttribute('data-act')];
      if (!fn) return;
      ev.preventDefault();
      if (el.disabled) return;
      fn(el, ev);
    };
    root.addEventListener('click', h);
    return function () { root.removeEventListener('click', h); };
  };
  /* ---------- Visualizzazione ---------- */
  UI.cls = function (x) { return !U.ok(x) ? '' : x > 0.004 ? 'pos' : x < -0.004 ? 'neg' : ''; };
  UI.signed = function (x, f) { return '<span class="' + UI.cls(x) + '">' + U.fmt(x, f || 'eur') + '</span>'; };
  /* Importo in valuta locale con controvalore in EUR */
  UI.money = function (amount, cur, rate) {
    if (!U.ok(amount)) return '—';
    if (!cur || cur === 'EUR') return U.fmtEur(amount);
    return U.fmtMoney(amount, cur) + ' <small class="muted">≈ ' + U.fmtEur(G.FX.toEur(amount, cur, rate)) + '</small>';
  };
  UI.btn = function (label, o) {
    o = o || {};
    var cls = 'btn' + (o.cls ? ' ' + o.cls : '');
    var inner = (o.icon ? U.icon(o.icon) : '') + (label ? '<span>' + label + '</span>' : '');
    var attrs = (o.act ? ' data-act="' + o.act + '"' : '') + (o.data || '') + (o.disabled ? ' disabled' : '') +
      (o.title ? ' title="' + U.esc(o.title) + '"' + (label ? '' : ' aria-label="' + U.esc(o.title) + '"') : '');
    if (o.href) return '<a class="' + cls + '" href="' + U.esc(o.href) + '"' + attrs + (o.blank ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + inner + '</a>';
    return '<button type="button" class="' + cls + '"' + attrs + '>' + inner + '</button>';
  };
  UI.badge = function (text, cls) { return '<span class="badge' + (cls ? ' ' + cls : '') + '">' + text + '</span>'; };
  UI.statusBadge = function (st) { return UI.badge(U.esc(G.MODEL.STATUS[st] || st || ''), 'st-' + (st || '')); };
  UI.kpi = function (label, value, o) {
    o = o || {};
    return '<div class="kpi' + (o.cls ? ' ' + o.cls : '') + '"' + (o.title ? ' title="' + U.esc(o.title) + '"' : '') + '>' +
      '<div class="kpi-l">' + (o.icon ? U.icon(o.icon) : '') + '<span>' + label + '</span>' + UI.help(o.help) + '</div>' +
      '<div class="kpi-v' + (o.vcls ? ' ' + o.vcls : '') + '">' + value + '</div>' + (o.sub ? '<div class="kpi-s">' + o.sub + '</div>' : '') + '</div>';
  };
  UI.kpis = function (arr, cls) { return '<div class="kpis' + (cls ? ' ' + cls : '') + '">' + arr.filter(Boolean).join('') + '</div>'; };
  UI.card = function (title, body, o) {
    o = o || {};
    return '<section class="card' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' +
      (title ? '<header class="card-h"><h3>' + (o.icon ? U.icon(o.icon) : '') + '<span>' + title + '</span>' + UI.help(o.help) + '</h3>' +
        (o.actions ? '<div class="card-a">' + o.actions + '</div>' : '') + '</header>' : '') +
      '<div class="card-b">' + body + '</div>' + (o.foot ? '<footer class="card-f">' + o.foot + '</footer>' : '') + '</section>';
  };
  UI.details = function (summary, body, open, cls) {
    return '<details class="more' + (cls ? ' ' + cls : '') + '"' + (open ? ' open' : '') + '><summary>' + summary + '</summary><div class="more-b">' + body + '</div></details>';
  };
  UI.note = function (html, cls) { return '<div class="note' + (cls ? ' ' + cls : '') + '">' + U.icon(cls === 'warn' || cls === 'danger' ? 'alert' : 'info') + '<div>' + html + '</div></div>'; };
  UI.kv = function (pairs, cls) {
    return '<dl class="kv' + (cls ? ' ' + cls : '') + '">' + pairs.filter(Boolean).map(function (p) {
      return '<dt>' + p[0] + UI.help(p[2]) + '</dt><dd' + (p[3] ? ' class="' + p[3] + '"' : '') + '>' + (p[1] == null ? '—' : p[1]) + '</dd>';
    }).join('') + '</dl>';
  };
  UI.pageHead = function (title, sub, actions) {
    return '<header class="page-h"><div class="page-t"><h1>' + title + '</h1>' + (sub ? '<p class="muted">' + sub + '</p>' : '') + '</div>' +
      (actions ? '<div class="page-a">' + actions + '</div>' : '') + '</header>';
  };
  UI.empty = function (title, text, actions, icon) {
    return '<div class="empty-state">' + U.icon(icon || 'home', 'ico-xl') + '<h3>' + title + '</h3>' + (text ? '<p>' + text + '</p>' : '') +
      (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>';
  };
  UI.pbar = function (fr, cls, label) {
    var w = U.ok(fr) ? U.clamp(fr, 0, 1) * 100 : 0;
    return '<div class="pbar' + (cls ? ' ' + cls : '') + '"' + (label ? ' title="' + U.esc(label) + '"' : '') + '><i style="width:' + w.toFixed(1) + '%"></i></div>';
  };
  /* Tabella. cols: [{label, key, fmt, cls, title, render(row, i)}]; o: {cls, empty, foot[], rowAttrs(row, i), wrapCls} */
  UI.table = function (cols, rows, o) {
    o = o || {};
    if (!rows || !rows.length) return o.empty != null ? '<p class="empty">' + o.empty + '</p>' : '';
    var th = cols.map(function (c) {
      return '<th' + (c.cls ? ' class="' + c.cls + '"' : '') + (c.title ? ' title="' + U.esc(c.title) + '"' : '') + (c.thAttrs || '') + '>' + c.label + '</th>';
    }).join('');
    var body = rows.map(function (r, i) {
      return '<tr' + (o.rowAttrs ? ' ' + o.rowAttrs(r, i) : '') + '>' + cols.map(function (c) {
        var v = c.render ? c.render(r, i) : c.fmt ? U.fmt(U.get(r, c.key), c.fmt) : U.esc(U.get(r, c.key));
        return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + (c.label && !o.noLabels ? ' data-l="' + U.esc(String(c.label).replace(/<[^>]*>/g, '')) + '"' : '') + '>' + (v == null ? '' : v) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var foot = o.foot ? '<tfoot><tr>' + o.foot.map(function (f, i) {
      return '<td' + (cols[i] && cols[i].cls ? ' class="' + cols[i].cls + '"' : '') + '>' + (f == null ? '' : f) + '</td>';
    }).join('') + '</tr></tfoot>' : '';
    return '<div class="tbl-wrap' + (o.wrapCls ? ' ' + o.wrapCls : '') + '"><table class="tbl' + (o.cls ? ' ' + o.cls : '') + '">' +
      '<thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody>' + foot + '</table></div>';
  };

  /* Avvisi calcolati: [{level, msg, tab, pid, name}] */
  UI.alerts = function (list, o) {
    o = o || {};
    if (!list || !list.length) return o.empty ? '<p class="empty ok">' + U.icon('check') + ' ' + o.empty + '</p>' : '';
    var max = o.max || list.length;
    var html = list.slice(0, max).map(function (a) {
      var pid = a.pid || o.pid;
      var href = pid ? '#/immobile/' + pid + '/' + (a.tab || 'generale') : '';
      return '<li class="al al-' + (a.level || 'info') + '">' + U.icon(a.level === 'info' ? 'info' : 'alert') + '<div>' +
        (o.names && a.name ? '<b>' + U.esc(a.name) + '</b> · ' : '') + U.esc(a.msg) + '</div>' +
        (href ? '<a class="al-go" href="' + href + '">' + (o.goLabel || 'Vai') + ' ›</a>' : '') + '</li>';
    }).join('');
    return '<ul class="alerts">' + html + '</ul>' + (list.length > max ? '<p class="muted small">… e altri ' + (list.length - max) + ' avvisi</p>' : '');
  };

  /* Schede: items [[key, label, icon, dotLevel]] */
  UI.tabs = function (items, active, href) {
    return '<nav class="tabs" aria-label="Sezioni">' + items.map(function (t) {
      var on = t[0] === active;
      return '<a href="' + href(t[0]) + '" class="tab' + (on ? ' active' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' +
        (t[2] ? U.icon(t[2]) : '') + '<span>' + t[1] + '</span>' + (t[3] ? '<i class="dot dot-' + t[3] + '" title="Ci sono avvisi"></i>' : '') + '</a>';
    }).join('') + '</nav>';
  };

  UI.pager = function (page, pages, total, label) {
    var tot = '<span class="muted">' + U.fmtNum(total) + ' ' + (label || 'elementi') + '</span>';
    if (pages <= 1) return '<div class="pager">' + tot + '</div>';
    var b = function (p, t, dis, cur) {
      return '<button type="button" class="btn btn-sm' + (cur ? ' btn-primary' : '') + '" data-act="page" data-page="' + p + '"' + (dis ? ' disabled' : '') + (cur ? ' aria-current="page"' : '') + '>' + t + '</button>';
    };
    var out = [b(page - 1, '‹', page <= 1)], from = Math.max(1, page - 2), to = Math.min(pages, page + 2), i;
    if (from > 1) { out.push(b(1, '1')); if (from > 2) out.push('<span class="muted">…</span>'); }
    for (i = from; i <= to; i++) out.push(b(i, String(i), false, i === page));
    if (to < pages) { if (to < pages - 1) out.push('<span class="muted">…</span>'); out.push(b(pages, String(pages))); }
    out.push(b(page + 1, '›', page >= pages));
    return '<div class="pager">' + out.join('') + tot + '</div>';
  };

  /* Elenchi di opzioni ricorrenti (memorizzati) */
  var cache = {};
  UI.countryOptions = function () {
    return cache.cc || (cache.cc = G.COUNTRIES.list().map(function (c) { return [c.code, U.flag(c.code) + ' ' + c.name + (c.preset ? '' : c.code === 'IT' ? '' : ' (senza preset)')]; }));
  };
  UI.currencyOptions = function () {
    var v = G.FX.version;
    if (!cache.cur || cache.curV !== v) { cache.curV = v; cache.cur = G.FX.currencies().map(function (c) { return [c, c + ' — ' + G.FX.name(c)]; }); }
    return cache.cur;
  };
  UI.provinceOptions = function () {
    return cache.pr || (cache.pr = G.COUNTRIES.provinceList().map(function (p) { return [p.code, p.name + ' (' + p.code + ')']; }));
  };
  UI.typeOptionsHtml = function (val, cat) {
    var M = G.MODEL, out = '';
    Object.keys(M.CATEGORIES).forEach(function (c) {
      if (cat && c !== cat) return;
      var ks = Object.keys(M.TYPES).filter(function (k) { return M.TYPES[k][1] === c; });
      if (ks.length) out += '<optgroup label="' + U.esc(M.CATEGORIES[c]) + '">' + UI.options(ks.map(function (k) { return [k, M.TYPES[k][0]]; }), val) + '</optgroup>';
    });
    return out;
  };
  UI.datalist = function (id, values) {
    return '<datalist id="' + id + '">' + (values || []).map(function (v) { return '<option value="' + U.esc(v) + '"></option>'; }).join('') + '</datalist>';
  };
  /* Confronto per ordinamento (null in fondo) */
  UI.cmp = function (a, b, dir) {
    var na = a == null || a === '' || (typeof a === 'number' && !isFinite(a)), nb = b == null || b === '' || (typeof b === 'number' && !isFinite(b));
    if (na && nb) return 0; if (na) return 1; if (nb) return -1;
    var r = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'it', { numeric: true, sensitivity: 'base' });
    return dir === 'desc' ? -r : r;
  };

  G.UI = UI;
})(window.GPI = window.GPI || {});
