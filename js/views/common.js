/* Funzioni condivise dalle viste: link, miniature, duplicazione, eliminazione, selezione immobile (GPI.VH) */
(function (G) {
  'use strict';
  var U = G.U, M = G.MODEL, VH = {};

  /* Sostituisce il contenuto di #app con un nuovo contenitore: gli eventi legati al contenitore spariscono con la vista */
  VH.mount = function (el, html, cls) {
    var d = document.createElement('div');
    d.className = 'view' + (cls ? ' ' + cls : '');
    d.innerHTML = html;
    el.innerHTML = '';
    el.appendChild(d);
    return d;
  };
  VH.name = function (p) { return U.esc(M.displayName(p)); };
  VH.link = function (p, tab) { return '<a href="' + G.APP.editHref(p.id, tab) + '">' + VH.name(p) + '</a>'; };
  VH.loc = function (p) { return '<span class="flag">' + U.flag(p.country) + '</span> ' + U.esc(M.location(p)); };
  VH.iconFor = function (p) {
    var c = p.category || M.typeCategory(p.type);
    if (p.type === 'palazzo' || p.type === 'palazzo_misto' || p.type === 'edificio_commerciale') return 'building';
    return c === 'commerciale' ? 'shop' : c === 'terreno' ? 'land' : c === 'pertinenza' ? 'garage' : 'home';
  };
  VH.thumb = function (p, cls) {
    var src = p.thumb && /^data:image\/(png|jpe?g|webp|gif);/i.test(p.thumb) ? p.thumb : '';
    return '<span class="thumb' + (cls ? ' ' + cls : '') + '">' + (src ? '<img src="' + src + '" alt="" loading="lazy">' : U.icon(VH.iconFor(p))) + '</span>';
  };
  VH.chk = function (id, label, on, hint) {
    return '<label class="fld fld-check"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span>' + label + '</span>' + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
  };
  VH.eur = function (x, d) { return U.fmtEur(x, d); };
  VH.pct = function (x, d) { return U.ok(x) ? U.fmtPct(x, d == null ? 1 : d) : '—'; };
  VH.roiCls = function (x) { return G.UI.cls(x); };

  /* Duplicazione con opzioni: restituisce la Promise degli immobili creati */
  VH.duplicate = function (ids) {
    var A = G.APP;
    ids = [].concat(ids || []).filter(function (id) { return A.get(id); });
    if (!ids.length) return Promise.resolve([]);
    if (!A.room()) { A.limitMsg(); return Promise.resolve([]); }
    var single = ids.length === 1;
    var body = '<p>' + (single ? 'Crea una o più copie di <b>' + VH.name(A.get(ids[0])) + '</b> con tutti i dati (acquisto, spese, mutui, tasse, locazione…).' :
      'Duplica i <b>' + ids.length + '</b> immobili selezionati.') + '</p>' +
      '<div class="grid g2">' + VH.chk('d-comp', 'Copia i confronti di mercato', true) + VH.chk('d-docs', 'Copia i documenti allegati', false) +
      VH.chk('d-ledger', 'Copia il registro entrate/uscite', false) + VH.chk('d-rem', 'Copia i promemoria', false) +
      VH.chk('d-sale', 'Mantieni i dati di vendita', false) + VH.chk('d-target', 'Crea come "Obiettivo / simulazione"', false, 'Utile per valutare un acquisto simile senza toccare i totali del patrimonio') +
      VH.chk('d-suffix', 'Aggiungi "(copia)" al nome', true) + '</div>' +
      '<label class="fld"><span>Numero di copie' + (single ? '' : ' per ciascun immobile') + '</span><div class="inp"><input type="number" id="d-n" min="1" max="' + A.room() + '" value="1"></div>' +
      '<small>Posti liberi: ' + U.fmtNum(A.room()) + ' su ' + U.fmtNum(A.MAX) + '</small></label>';
    return U.modal({
      title: 'Duplica immobile', body: body, enterButton: 1,
      buttons: [{ label: 'Annulla', value: null }, { label: 'Duplica', cls: 'btn-primary', action: function (r) {
        var q = function (id) { return r.querySelector('#' + id).checked; };
        return { opts: { comparables: q('d-comp'), documents: q('d-docs'), ledger: q('d-ledger'), reminders: q('d-rem'), sale: q('d-sale'), asTarget: q('d-target'), suffix: q('d-suffix') ? true : false },
          n: Math.max(1, Math.min(A.MAX, parseInt(r.querySelector('#d-n').value, 10) || 1)) };
      } }]
    }).then(function (res) {
      if (!res) return [];
      var out = [], chain = Promise.resolve();
      ids.forEach(function (id) {
        chain = chain.then(function () { return A.room() ? A.duplicate(id, res.opts, res.n).then(function (a) { out = out.concat(a); }) : null; });
      });
      return chain.then(function () {
        if (out.length) U.toast(out.length === 1 ? 'Copia creata' : U.fmtNum(out.length) + ' copie create', 'success');
        return out;
      });
    });
  };

  /* Eliminazione con conferma: Promise del numero di immobili eliminati */
  VH.remove = function (ids) {
    var A = G.APP;
    ids = [].concat(ids || []).filter(function (id) { return A.get(id); });
    if (!ids.length) return Promise.resolve(0);
    var msg = ids.length === 1 ? 'Eliminare definitivamente <b>' + VH.name(A.get(ids[0])) + '</b> con tutti i suoi dati?' :
      'Eliminare definitivamente <b>' + ids.length + '</b> immobili con tutti i loro dati?';
    return U.confirm(msg + ' L\'operazione non si può annullare: se serve, esporta prima un backup.', 'Elimina', true).then(function (ok) {
      if (!ok) return 0;
      return A.remove(ids).then(function (n) { U.toast(n === 1 ? 'Immobile eliminato' : n + ' immobili eliminati', 'success'); return n; });
    });
  };
  /* Selezione di un immobile da un elenco filtrabile: Promise dell'id scelto o null */
  VH.pickProperty = function (title, o) {
    var A = G.APP; o = o || {};
    var list = A.props.filter(o.filter || function () { return true; })
      .sort(function (a, b) { return M.displayName(a).localeCompare(M.displayName(b), 'it'); });
    if (!list.length) { U.toast('Non ci sono immobili in archivio', 'warn'); return Promise.resolve(null); }
    var rows = list.map(function (p) {
      var s = U.norm(M.displayName(p) + ' ' + M.location(p) + ' ' + (p.code || '') + ' ' + (p.group || ''));
      return '<label class="pick" data-s="' + U.esc(s) + '"><input type="radio" name="pp" value="' + U.esc(p.id) + '"' + (p.id === o.selected ? ' checked' : '') + '>' +
        '<span>' + VH.name(p) + ' <small class="muted">' + U.esc(M.location(p)) + ' · ' + U.esc(M.STATUS[p.status] || '') + '</small></span></label>';
    }).join('');
    var body = (o.text ? '<p>' + o.text + '</p>' : '') +
      '<input type="search" class="w100" data-flt placeholder="Cerca per nome, città, codice, gruppo…" aria-label="Filtra immobili">' +
      '<div class="pick-list scroll">' + rows + '</div>';
    return U.modal({
      title: title || 'Scegli un immobile', body: body, wide: true,
      onOpen: function (r) {
        r.querySelector('[data-flt]').addEventListener('input', function (e) {
          var q = U.norm(e.target.value);
          Array.prototype.forEach.call(r.querySelectorAll('.pick[data-s]'), function (l) { l.hidden = !!q && l.getAttribute('data-s').indexOf(q) < 0; });
        });
      },
      buttons: [{ label: 'Annulla', value: null }, { label: o.okLabel || 'Scegli', cls: 'btn-primary', action: function (r) {
        var c = r.querySelector('input[name="pp"]:checked');
        if (!c) { U.toast('Seleziona un immobile', 'warn'); return false; }
        return c.value;
      } }]
    });
  };

  /* Esportazione di eventi in formato iCalendar (.ics), con promemoria il giorno prima */
  VH.ics = function (events, name) {
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var esc = function (s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1'); };
    var fold = function (l) { var out = []; while (l.length > 73) { out.push(l.slice(0, 73)); l = ' ' + l.slice(73); } out.push(l); return out.join('\r\n'); };
    var d = new Date(), stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gestione Patrimonio Immobiliare//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Scadenze immobili'];
    events.forEach(function (e, i) {
      if (!U.validDate(e.date)) return;
      var s = e.date.replace(/-/g, ''), t = U.addDays(e.date, 1).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', 'UID:gpi-' + s + '-' + i + '-' + U.slug(e.title || '').slice(0, 24) + '@patrimonio-immobiliare', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + s, 'DTEND;VALUE=DATE:' + t, 'SUMMARY:' + esc(e.title));
      if (e.desc) lines.push('DESCRIPTION:' + esc(e.desc));
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.title), 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    U.download(name || 'scadenze-immobili.ics', lines.map(fold).join('\r\n') + '\r\n', 'text/calendar;charset=utf-8');
  };

  /* Riepilogo testuale di un valore in valuta locale + EUR al cambio attuale */
  VH.money = function (amount, cur) { return G.UI.money(amount, cur); };

  G.VH = VH;
})(window.GPI = window.GPI || {});
