/* Gestione Patrimonio Immobiliare — utilità generali (namespace GPI.U) */
(function (G) {
  'use strict';
  var U = {};

  U.uid = function () {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* contesto non sicuro */ }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  };

  U.clone = function (o) { return o == null ? o : JSON.parse(JSON.stringify(o)); };

  U.get = function (obj, path) {
    if (!path) return obj;
    var parts = String(path).split('.'), o = obj;
    for (var i = 0; i < parts.length; i++) { if (o == null) return undefined; o = o[parts[i]]; }
    return o;
  };

  U.set = function (obj, path, val) {
    var parts = String(path).split('.'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      o = o[k];
    }
    o[parts[parts.length - 1]] = val;
  };

  /* Numeri: accetta formati italiani ("250.000,50"), inglesi ("250,000.50"), suffissi k/M.
     opts.pct = true: un singolo punto è sempre separatore decimale (percentuali, tassi, cambi). */
  U.parseNum = function (v, opts) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim();
    if (!s) return null;
    s = s.replace(/[\s\u00a0\u202f'’]/g, '').replace(/[€$£¥₺₹₽%]/g, '').replace(/^[A-Za-z]{3}|[A-Za-z]{3}$/g, '');
    var mult = 1, m = s.match(/([kKmM])$/);
    if (m) { mult = /k/i.test(m[1]) ? 1e3 : 1e6; s = s.slice(0, -1); }
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (s.charAt(0) === '-') { neg = !neg; s = s.slice(1); } else if (s.charAt(0) === '+') s = s.slice(1);
    var hasComma = s.indexOf(',') >= 0, hasDot = s.indexOf('.') >= 0;
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hasComma) {
      s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (hasDot) {
      var parts = s.split('.');
      if (parts.length > 2) s = s.replace(/\./g, '');
      else if (!(opts && opts.pct) && parts[1].length === 3 && parts[0] !== '0' && parts[0] !== '') s = s.replace('.', '');
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    var n = parseFloat(s) * mult;
    return isFinite(n) ? (neg ? -n : n) : null;
  };

  U.n = function (v) { var x = typeof v === 'number' ? v : U.parseNum(v); return x == null || !isFinite(x) ? 0 : x; };
  U.has = function (v) { return v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && !isFinite(v)); };
  U.clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
  U.round = function (x, d) { var f = Math.pow(10, d || 0); return Math.round(x * f) / f; };

  var nfCache = {};
  /* useGrouping esplicito: con le impostazioni predefinite it-IT non separa le migliaia dei numeri a 4 cifre (2929 invece di 2.929) */
  function nf(key, opts) {
    if (!nfCache[key] && opts.useGrouping === undefined && !opts.notation) opts.useGrouping = true;
    return nfCache[key] || (nfCache[key] = new Intl.NumberFormat('it-IT', opts));
  }
  function ok(x) { return x !== null && x !== undefined && typeof x === 'number' && isFinite(x); }
  U.ok = ok;

  U.fmtNum = function (x, d) { d = d || 0; return ok(x) ? nf('n' + d, { minimumFractionDigits: d, maximumFractionDigits: d }).format(x) : '—'; };
  U.fmtEur = function (x, d) { d = d || 0; return ok(x) ? nf('e' + d, { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }).format(x) : '—'; };
  U.fmtMoney = function (x, cur, d) {
    d = d || 0; cur = cur || 'EUR';
    if (!ok(x)) return '—';
    if (cur === 'EUR') return U.fmtEur(x, d);
    try { return nf('m' + cur + d, { style: 'currency', currency: cur, currencyDisplay: 'code', minimumFractionDigits: d, maximumFractionDigits: d }).format(x).replace(/\u00a0/g, ' '); }
    catch (e) { return U.fmtNum(x, d) + ' ' + cur; }
  };
  U.fmtCompact = function (x) {
    if (!ok(x)) return '—';
    if (Math.abs(x) < 10000) return U.fmtEur(x);
    return nf('ce', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 2 }).format(x);
  };
  /* Percentuali: x è una frazione (0.05 = 5%) */
  U.fmtPct = function (x, d) { d = d == null ? 1 : d; return ok(x) ? nf('p' + d, { minimumFractionDigits: d, maximumFractionDigits: d }).format(x * 100) + '%' : '—'; };
  U.fmtInput = function (x, d) {
    if (!ok(x)) return '';
    return nf('i' + (d == null ? 'a' : d), { maximumFractionDigits: d == null ? 6 : d, useGrouping: true }).format(x);
  };
  U.fmtYears = function (x) { return ok(x) ? U.fmtNum(x, 1) + ' anni' : '—'; };
  U.fmt = function (x, f) {
    switch (f) {
      case 'eur': return U.fmtEur(x);
      case 'eur2': return U.fmtEur(x, 2);
      case 'pct': return U.fmtPct(x);
      case 'pct2': return U.fmtPct(x, 2);
      case 'num': return U.fmtNum(x);
      case 'num1': return U.fmtNum(x, 1);
      case 'num2': return U.fmtNum(x, 2);
      case 'num4': return U.fmtNum(x, 4);
      case 'x': return ok(x) ? U.fmtNum(x, 2) + '×' : '—';
      case 'years': return U.fmtYears(x);
      case 'date': return U.fmtDate(x);
      case 'compact': return U.fmtCompact(x);
      default: return x == null ? '—' : String(x);
    }
  };

  /* Date: stringhe ISO yyyy-mm-dd, calcoli in UTC */
  function pad(x) { return (x < 10 ? '0' : '') + x; }
  U.pad = pad;
  U.todayISO = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  U.parseDate = function (s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d) ? null : d;
  };
  U.validDate = function (s) { return !!U.parseDate(s); };
  U.iso = function (d) { return d.toISOString().slice(0, 10); };
  U.addMonths = function (iso, k) {
    var d = U.parseDate(iso); if (!d) return null;
    var day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + k);
    var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return U.iso(d);
  };
  U.addYears = function (iso, k) { return U.addMonths(iso, Math.round(12 * k)); };
  U.addDays = function (iso, k) { var d = U.parseDate(iso); if (!d) return null; d.setUTCDate(d.getUTCDate() + k); return U.iso(d); };
  U.daysBetween = function (a, b) { var x = U.parseDate(a), y = U.parseDate(b); return x && y ? (y - x) / 86400000 : 0; };
  U.yearsBetween = function (a, b) { return U.daysBetween(a, b) / 365.2425; };
  U.monthsBetween = function (a, b) { return U.daysBetween(a, b) / 30.436875; };
  U.year = function (iso) { var d = U.parseDate(iso); return d ? d.getUTCFullYear() : null; };
  U.minDate = function (a, b) { return !a ? b : !b ? a : (a < b ? a : b); };
  U.maxDate = function (a, b) { return !a ? b : !b ? a : (a > b ? a : b); };
  U.fmtDate = function (iso) { var d = U.parseDate(iso); return d ? pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() : '—'; };
  U.fmtDateTime = function (ts) { if (!ts) return '—'; var d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  U.MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  /* Testo e HTML */
  U.esc = function (s) {
    return s == null ? '' : String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  U.safeUrl = function (u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; };
  U.slug = function (s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/['’`]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };
  U.norm = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
  U.flag = function (cc) {
    if (!cc || cc.length !== 2 || !/^[A-Za-z]{2}$/.test(cc)) return '';
    cc = cc.toUpperCase();
    return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65, 0x1F1E6 + cc.charCodeAt(1) - 65);
  };
  U.icon = function (name, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>'; };

  /* Statistiche */
  U.sum = function (arr, fn) { var s = 0; (arr || []).forEach(function (x, i) { var v = fn ? fn(x, i) : x; if (ok(v)) s += v; }); return s; };
  U.mean = function (a) { a = (a || []).filter(ok); return a.length ? U.sum(a) / a.length : null; };
  U.median = function (a) {
    a = (a || []).filter(ok).slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var h = Math.floor(a.length / 2);
    return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
  };
  U.div = function (a, b) { return ok(a) && ok(b) && b !== 0 ? a / b : null; };

  /* Funzioni temporali */
  U.debounce = function (fn, ms) {
    var t = null, lastArgs = null, lastThis = null;
    var f = function () { lastArgs = arguments; lastThis = this; clearTimeout(t); t = setTimeout(function () { t = null; fn.apply(lastThis, lastArgs); }, ms); };
    f.flush = function () { if (t) { clearTimeout(t); t = null; fn.apply(lastThis, lastArgs || []); } };
    f.cancel = function () { clearTimeout(t); t = null; };
    f.pending = function () { return !!t; };
    return f;
  };
  U.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* Bus eventi */
  var handlers = {};
  U.bus = {
    on: function (e, fn) { (handlers[e] = handlers[e] || []).push(fn); },
    off: function (e, fn) { handlers[e] = (handlers[e] || []).filter(function (h) { return h !== fn; }); },
    emit: function (e, d) { (handlers[e] || []).slice().forEach(function (h) { try { h(d); } catch (err) { console.error(err); } }); }
  };

  /* File e codifiche */
  U.download = function (name, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };
  U.readFile = function (file, asDataUrl) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      if (asDataUrl) r.readAsDataURL(file); else r.readAsText(file, 'utf-8');
    });
  };
  U.pickFile = function (accept) {
    return new Promise(function (res) {
      var inp = document.createElement('input');
      inp.type = 'file'; if (accept) inp.accept = accept;
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = function () { res(inp.files && inp.files[0] ? inp.files[0] : null); inp.remove(); };
      inp.click();
    });
  };
  U.resizeImage = function (file, max, quality) {
    max = max || 480; quality = quality || 0.78;
    return U.readFile(file, true).then(function (src) {
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () {
          var sc = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = function () { rej(new Error('Immagine non valida')); };
        img.src = src;
      });
    });
  };
  U.bytesToB64 = function (buf) {
    var bytes = new Uint8Array(buf), bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  };
  U.b64ToBytes = function (b64) {
    b64 = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };
  U.b64enc = function (str) { return U.bytesToB64(new TextEncoder().encode(str)); };
  U.b64dec = function (b64) { return new TextDecoder().decode(U.b64ToBytes(b64)); };
  U.b64url = function (str) { return U.b64enc(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

  U.toCSV = function (rows, sep) {
    sep = sep || ';';
    return '\ufeff' + rows.map(function (r) {
      return r.map(function (v) {
        if (v == null || (typeof v === 'number' && !isFinite(v))) return '';
        var s = typeof v === 'number' ? String(U.round(v, 6)).replace('.', ',') : String(v);
        if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
        if (/["\n\r]/.test(s) || s.indexOf(sep) >= 0) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(sep);
    }).join('\r\n');
  };
  U.copyText = function (txt) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) return navigator.clipboard.writeText(txt);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); res(); } catch (e) { rej(e); }
      ta.remove();
    });
  };
  U.fetchJSON = function (url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 9000) : null;
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' }).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { if (t) clearTimeout(t); throw e; });
  };
  U.parseQuery = function (q) {
    var o = {};
    String(q || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
      try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { o[k] = v; }
    });
    return o;
  };

  /* UI: toast, modali, conferme */
  U.toast = function (msg, type, ms) {
    var root = document.getElementById('toast-root'); if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 400); }, ms || 3500);
  };

  /* opts: {title, body (html), buttons:[{label, cls, value, action(root) -> false = resta aperto}], wide, onOpen(root), enterButton} */
  U.modal = function (opts) {
    return new Promise(function (resolve) {
      var root = document.getElementById('modal-root') || document.body;
      var wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      var btns = opts.buttons || [{ label: 'Chiudi', value: null }];
      wrap.innerHTML = '<div class="modal' + (opts.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + U.esc(opts.title || '') + '">' +
        '<div class="modal-head"><h3>' + U.esc(opts.title || '') + '</h3><button type="button" class="btn-icon" data-close aria-label="Chiudi">' + U.icon('x') + '</button></div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        '<div class="modal-foot">' + btns.map(function (b, i) { return '<button type="button" class="btn ' + (b.cls || '') + '" data-btn="' + i + '">' + U.esc(b.label) + '</button>'; }).join('') + '</div></div>';
      var prevFocus = document.activeElement;
      function close(v) {
        document.removeEventListener('keydown', onKey, true);
        wrap.remove();
        if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { /* ignora */ } }
        resolve(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); close(null); return; }
        if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && opts.enterButton != null) {
          e.preventDefault(); var b = wrap.querySelector('[data-btn="' + opts.enterButton + '"]'); if (b) b.click();
        }
      }
      wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(null); });
      wrap.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) { close(null); return; }
        var b = e.target.closest('[data-btn]');
        if (!b) return;
        var def = btns[+b.getAttribute('data-btn')];
        var v = def.action ? def.action(wrap) : def.value;
        if (v === false && def.action) return;
        close(v === undefined ? def.value : v);
      });
      document.addEventListener('keydown', onKey, true);
      root.appendChild(wrap);
      if (opts.onOpen) opts.onOpen(wrap);
      var f = wrap.querySelector('[autofocus]') || wrap.querySelector('.modal-body input, .modal-body select, .modal-body textarea') || wrap.querySelector('.btn-primary');
      if (f) setTimeout(function () { try { f.focus(); } catch (e) { /* ignora */ } }, 30);
    });
  };
  U.confirm = function (msg, okLabel, danger) {
    return U.modal({
      title: 'Conferma', body: '<p>' + msg + '</p>',
      buttons: [{ label: 'Annulla', value: false }, { label: okLabel || 'Conferma', value: true, cls: danger ? 'btn-danger' : 'btn-primary' }]
    }).then(function (v) { return v === true; });
  };
  U.prompt = function (title, label, value, type) {
    return U.modal({
      title: title, enterButton: 1,
      body: '<label class="fld"><span>' + U.esc(label) + '</span><input type="' + (type || 'text') + '" id="prompt-val" value="' + U.esc(value || '') + '" autofocus></label>',
      buttons: [{ label: 'Annulla', value: null }, { label: 'OK', cls: 'btn-primary', action: function (r) { return r.querySelector('#prompt-val').value; } }]
    });
  };

  G.U = U;
})(window.GPI = window.GPI || {});
