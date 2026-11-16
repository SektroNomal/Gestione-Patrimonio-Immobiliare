/* Confronto con i portali immobiliari (GPI.PORTALS): link di ricerca, lettura di annunci incollati, bookmarklet.
   I portali non consentono la lettura automatica da un'altra pagina web: per questo i dati arrivano da link, copia/incolla o bookmarklet. */
(function (G) {
  'use strict';
  var U = G.U, MD = G.MODEL, K = G.COUNTRIES, PT = {};

  /* Segmenti URL verificati per immobiliare.it; le altre categorie usano la ricerca Google sul sito */
  var IMM = { case: 'case', ville: 'ville', negozi: 'negozi', uffici: 'uffici', capannoni: 'capannoni' };
  var KW = { case: 'casa appartamento', ville: 'villa', palazzi: 'palazzo stabile intero', negozi: 'negozio locale commerciale', uffici: 'ufficio', capannoni: 'capannone', magazzini: 'magazzino deposito', hotel: 'hotel albergo', garage: 'box garage', terreni: 'terreno' };

  function google(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
  PT.google = google;
  PT.category = function (p) { return (MD.TYPES[p.type] || [])[3] || 'case'; };

  /* Gruppi di link per l'immobile: [{group, kind, items:[{label, url, hint}]}] */
  PT.links = function (p) {
    var a = p.address || {}, city = String(a.city || '').trim(), cc = p.country || 'IT', groups = [];
    var cat = PT.category(p), kw = KW[cat] || 'casa', addr = [a.street, a.zip, city, cc === 'IT' ? a.province : K.name(cc)].filter(Boolean).join(', ');
    if (city) {
      var cs = U.slug(city);
      if (cc === 'IT') {
        var prov = K.provinceName(a.province), ps = prov ? U.slug(prov) : cs;
        ['vendita', 'affitto'].forEach(function (k) {
          var items = [], seg = IMM[cat], resid = cat === 'case' || cat === 'ville';
          items.push(seg ? { label: 'Immobiliare.it', url: 'https://www.immobiliare.it/' + k + '-' + seg + '/' + cs + '/', hint: 'Elenco annunci del comune' }
            : { label: 'Immobiliare.it', url: google('site:immobiliare.it ' + k + ' ' + kw + ' ' + city), hint: 'Ricerca Google sul sito' });
          items.push(resid ? { label: 'Idealista', url: 'https://www.idealista.it/' + k + '-case/' + cs + '-' + ps + '/', hint: 'Elenco annunci del comune' }
            : { label: 'Idealista', url: google('site:idealista.it ' + k + ' ' + kw + ' ' + city), hint: 'Ricerca Google sul sito' });
          items.push(resid ? { label: 'Casa.it', url: 'https://www.casa.it/' + k + '/residenziale/' + cs + '/', hint: 'Elenco annunci del comune' }
            : { label: 'Casa.it', url: google('site:casa.it ' + k + ' ' + kw + ' ' + city), hint: 'Ricerca Google sul sito' });
          items.push({ label: 'Subito.it', url: google('site:subito.it ' + k + ' ' + kw + ' ' + city), hint: 'Ricerca Google sul sito' });
          items.push({ label: 'Wikicasa', url: google('site:wikicasa.it ' + k + ' ' + kw + ' ' + city), hint: 'Ricerca Google sul sito' });
          items.push({ label: 'Tutti i portali', url: google(k + ' ' + kw + ' ' + city + (p.sqm ? ' ' + p.sqm + ' mq' : '')), hint: 'Ricerca generica' });
          groups.push({ group: k === 'vendita' ? 'Annunci in vendita' : 'Annunci in affitto', kind: k, items: items });
        });
        groups.push({ group: 'Quotazioni e prezzi medi', items: [
          { label: 'OMI – Agenzia delle Entrate (GEOPOI)', url: 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/index.php', hint: 'Valori min/max €/m² della zona OMI: riportali nella scheda Catasto & valori' },
          { label: 'Prezzi medi €/m² – Immobiliare.it', url: google('site:immobiliare.it/mercato-immobiliare ' + city), hint: 'Andamento prezzi di vendita e affitto' },
          { label: 'Prezzi medi €/m² – Idealista', url: google('site:idealista.it report prezzo immobile ' + city), hint: 'Report prezzi del comune' }
        ] });
      } else {
        var portals = ((K.PRESETS[cc] || {}).portals || []).slice(), cn = K.name(cc), items2 = [];
        portals.forEach(function (d) {
          items2.push({ label: d, url: google('site:' + d + ' ' + city), hint: 'Ricerca annunci a ' + city + ' sul portale' });
          items2.push({ label: d + ' (home)', url: 'https://' + d + '/', hint: 'Apri il portale', home: true });
        });
        items2.push({ label: 'Ricerca generica', url: google(city + ' ' + cn + ' property for sale price per m2'), hint: 'Annunci e prezzi medi' });
        groups.push({ group: 'Portali locali – ' + cn, kind: 'vendita', items: items2 });
        groups.push({ group: 'Prezzi medi e affitti', items: [
          { label: 'Prezzi €/m² della città', url: google(city + ' ' + cn + ' average price per square meter real estate'), hint: 'Statistiche di mercato' },
          { label: 'Affitti medi', url: google(city + ' ' + cn + ' average rent per square meter'), hint: 'Canoni medi' }
        ] });
      }
    }
    if (addr || (a.lat && a.lng)) {
      var q = a.lat && a.lng ? a.lat + ',' + a.lng : addr;
      groups.push({ group: 'Mappa e zona', items: [
        { label: 'Google Maps', url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q), hint: 'Posizione e Street View' },
        { label: 'OpenStreetMap', url: a.lat && a.lng ? 'https://www.openstreetmap.org/?mlat=' + a.lat + '&mlon=' + a.lng + '#map=17/' + a.lat + '/' + a.lng : 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(addr), hint: 'Mappa libera' }
      ] });
    }
    return groups;
  };
  /* ---------- Lettura di annunci incollati (testo copiato dalla pagina o dall'elenco risultati) ---------- */
  var NUM = '(\\d{1,3}(?:[.,\'\\s\\u00a0\\u202f]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
  var SYM = '(€|eur\\b|euro\\b|£|gbp\\b|\\$|usd\\b|chf\\b|fr\\.|aed\\b|zł|pln\\b|kč|czk\\b|huf\\b|ron\\b|try\\b|tl\\b)';
  var SUF = '(\\s?(?:k|mila|mln|milioni|million|mio)\\b)?';
  var RX_PRICE = new RegExp(SYM + '\\s?' + NUM + SUF + '|' + NUM + SUF + '\\s?' + SYM, 'gi');
  var RX_SQM = /(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?\s?(m²|m2\b|mq\b|m\.q\.|metri quadr|sqm\b|sq\.?\s?m\b|㎡|sq\.?\s?ft\b|ft²|square feet)/i;
  var RX_ROOMS = /(\d{1,2})\s?(?:\+\s?(\d)\s?)?(locali|vani|stanze|camere|rooms?\b|bedrooms?|beds?\b|habitaciones|hab\.|dormitorios|pièces|chambres|quartos|zimmer|odas)/i;
  var RX_ROOMS2 = /\b(mono|bi|tri|quadri|penta)locale\b|\bT([0-6])\b|\b(locali|vani)\s*:?\s*(\d{1,2})\b/i;
  var CURMAP = { '€': 'EUR', eur: 'EUR', euro: 'EUR', '£': 'GBP', gbp: 'GBP', '$': 'USD', usd: 'USD', chf: 'CHF', 'fr.': 'CHF', aed: 'AED', 'zł': 'PLN', pln: 'PLN', 'kč': 'CZK', czk: 'CZK', huf: 'HUF', ron: 'RON', 'try': 'TRY', tl: 'TRY' };
  var NOTPRICE = /(spese|condomin|cauzione|deposito|caparra|riscald|\bimu\b|tasse|mutuo|rata|stima|risparmi|mensilit|commission|\bfee|deposit|mortgage|council|charge|gastos|comunidad|\bibi\b|taxe|ribass|sconto|prima era|prezzo precedente)[^\n]{0,25}$/i;
  var RENT = /^\s?(\/\s?(mese|mes|month|mois|monat|mo\b|m\b)|al mese|mensil|per month|a month|pcm|p\.c\.m|pm\b|par mois|al mes|mtl|monthly)/i;

  function pnum(raw, suf) {
    var t = String(raw).replace(/[\s\u00a0\u202f']/g, '');
    var m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)(?:[.,](\d{1,2}))?$/);
    var v = m ? parseFloat(m[1].replace(/[.,]/g, '') + (m[2] ? '.' + m[2] : '')) : U.parseNum(t);
    if (v == null || !isFinite(v)) return null;
    suf = String(suf || '').toLowerCase().replace(/\s/g, '');
    if (suf === 'k' || suf === 'mila') v *= 1e3; else if (suf) v *= 1e6;
    return v;
  }
  function prices(text) {
    var out = [], m, rx = new RegExp(RX_PRICE.source, 'gi');
    while ((m = rx.exec(text))) {
      var sym = (m[1] || m[6] || '').toLowerCase(), v = m[1] ? pnum(m[2], m[3]) : pnum(m[4], m[5]);
      var after = text.slice(rx.lastIndex, rx.lastIndex + 20), before = text.slice(Math.max(0, m.index - 40), m.index);
      if (v == null || v < 50) continue;
      if (/^\s?\/\s?(m²|mq|m2|sqm|sq|m\b)/i.test(after) || /^\s?(al|per)\s?(m²|mq|metro)/i.test(after)) continue;
      if (NOTPRICE.test(before)) continue;
      out.push({ value: v, currency: CURMAP[sym] || CURMAP[sym.replace(/\.$/, '')] || 'EUR', rent: RENT.test(after), index: m.index, end: rx.lastIndex });
    }
    return out;
  }
  function sqmOf(t) {
    var m = String(t || '').match(RX_SQM); if (!m) return null;
    var v = pnum(m[1]); if (v == null) return null;
    if (/ft|feet/i.test(m[2])) v = Math.round(v * 0.092903);
    return v >= 5 && v <= 200000 ? v : null;
  }
  function roomsOf(t) {
    var m = String(t || '').match(RX_ROOMS);
    if (m) { var r = parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) : 0); if (r > 0 && r < 60) return r; }
    m = String(t || '').match(RX_ROOMS2);
    if (!m) return null;
    if (m[1]) return { mono: 1, bi: 2, tri: 3, quadri: 4, penta: 5 }[m[1].toLowerCase()] || 6;
    if (m[2]) return parseInt(m[2], 10) + 1;
    return parseInt(m[4], 10) || null;
  }
  function urlOf(t) { var m = String(t || '').match(/https?:\/\/[^\s"'<>]+/i); return m ? m[0].replace(/[).,;]+$/, '') : ''; }
  function titleOf(t, last) {
    var lines = String(t || '').split(/\n/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(function (l) {
      return l.length > 8 && l.length < 160 && !/^https?:/i.test(l) && /[a-zà-ü]{4}/i.test(l) && !/[€£$]|\d\s?(mq|m²|m2|locali|vani)\b/i.test(l) &&
        !/^(salva|condividi|contatta|nascondi|mostra|vedi|foto|mappa|home|menu|accedi|pubblica|cerca|share|save|contact)/i.test(l);
    });
    return lines.length ? lines[last ? lines.length - 1 : 0] : '';
  }
  /* Città dal titolo dell'annuncio: «… in vendita a Milano, …» oppure indirizzo seguito dalla città («Trilocale via Roma 10, Torino») */
  var STREET = /(^|\s)(via|viale|piazza|piazzale|corso|largo|vicolo|strada|contrada|borgo|lungomare|localit[àa]|frazione|calle|avenida|plaza|rue|avenue|boulevard|street|road)\s|\d/i;
  function placeOk(c) {
    c = String(c || '').replace(/\s*\([A-Z]{2}\)\s*$/, '').replace(/\s+/g, ' ').trim();
    return /^[A-ZÀ-Ý][A-Za-zÀ-ÿ' .\-]{1,39}$/.test(c) && c.split(' ').length <= 4 && !STREET.test(c + ' ') &&
      !/vendit|affitt|local|camer|bagn|terrazz|giardin|ristruttur|nuovo|ottimo|stato/i.test(c) ? c : '';
  }
  function cityOf(t) {
    var s = String(t || '').split(/\s[-–—|·]\s/)[0], m = s.match(/\b(?:vendita|affitto|sale|rent|venta|alquiler|vendre|louer)\s+(?:a|ad|in|en|à)\s+([^,;()]{2,40})/i);
    var c = m ? placeOk(m[1].split(/\d/)[0]) : '';
    var k = s.lastIndexOf(',');
    if (!c && k > 0 && STREET.test(s.slice(0, k))) c = placeOk(s.slice(k + 1));
    return c;
  }
  PT.cityOf = cityOf;
  function domainOf(u) { var m = String(u || '').match(/^https?:\/\/(?:www\.)?([^\/?#]+)/i); return m ? m[1].toLowerCase() : ''; }
  PT.domain = domainOf;
  function kindOf(x) { return x.rent || x.value < 20000 ? 'affitto' : 'vendita'; }

  /* Tabelle incollate da Excel/CSV (separatore tab o ;), con o senza intestazione */
  function parseTable(t) {
    var lines = t.split('\n').filter(function (l) { return l.trim(); });
    if (lines.length < 2) return [];
    var sep = lines[0].indexOf('\t') >= 0 ? '\t' : ';';
    var rows = lines.map(function (l) { return l.split(sep).map(function (c) { return c.trim().replace(/^"|"$/g, ''); }); });
    if (rows.filter(function (r) { return r.length >= 3; }).length < rows.length * 0.8) return [];
    var head = /\d/.test(rows[0].join('')) ? null : rows.shift().map(function (h) { return U.norm(h); });
    var col = function (re) { if (head) for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; };
    var ci = { price: col(/prezzo|price|canone|importo|precio|prix|valore/), sqm: col(/mq|m2|m²|sqm|superficie|metri|size|area/), rooms: col(/local|vani|stanz|camer|room|bed/),
      title: col(/titol|title|descr|nome|name|annuncio/), url: col(/url|link/), city: col(/citta|city|comune|zona|localita/), kind: col(/tipo|kind|contratto/) };
    var num = function (s) { return pnum(String(s || '').replace(/[^\d.,'\s]/g, '').trim()); };
    return rows.map(function (r) {
      var c = { price: null, sqm: null, rooms: null, title: '', url: '', city: '', kind: '', currency: 'EUR' };
      if (head) {
        c.price = ci.price >= 0 ? num(r[ci.price]) : null; c.sqm = ci.sqm >= 0 ? num(r[ci.sqm]) : null; c.rooms = ci.rooms >= 0 ? num(r[ci.rooms]) : null;
        c.title = ci.title >= 0 ? r[ci.title] || '' : ''; c.url = ci.url >= 0 ? U.safeUrl(r[ci.url]) : ''; c.city = ci.city >= 0 ? r[ci.city] || '' : '';
        c.kind = ci.kind >= 0 && /affitt|rent|locaz|alquil/i.test(r[ci.kind] || '') ? 'affitto' : '';
      } else {
        var nums = [];
        r.forEach(function (cell) {
          if (/^https?:/i.test(cell)) { c.url = U.safeUrl(cell); return; }
          if (/m²|mq|m2|sqm/i.test(cell) && c.sqm == null) { c.sqm = sqmOf(cell); return; }
          var v = /^[€£$]?\s?[\d.,'\s]+\s?(€|eur)?$/i.test(cell) ? num(cell) : null;
          if (v != null) nums.push(v); else if (cell.length > c.title.length) c.title = cell;
        });
        nums.sort(function (a, b) { return b - a; });
        c.price = nums.length ? nums.shift() : null;
        if (c.sqm == null) { var s = nums.filter(function (v) { return v >= 10 && v <= 100000; })[0]; if (s != null) { c.sqm = s; nums.splice(nums.indexOf(s), 1); } }
        c.rooms = nums.filter(function (v) { return v >= 1 && v <= 30 && Math.round(v) === v; })[0] || null;
      }
      if (!c.kind) c.kind = c.price != null && c.price < 20000 ? 'affitto' : 'vendita';
      c.source = domainOf(c.url);
      return c;
    }).filter(function (c) { return c.price != null && c.price > 0; });
  }

  /* Estrae uno o più annunci: [{kind, price, currency, sqm, rooms, url, title, city, source}] */
  PT.parse = function (text, opts) {
    opts = opts || {};
    var t = String(text || '').replace(/\r/g, ''), out = [], seen = {};
    if (!t.trim()) return out;
    var tab = opts.single ? [] : parseTable(t);
    if (tab.length) return tab;
    var list = prices(t);
    var push = function (c) {
      var k = [c.price, c.sqm, c.rooms, c.url].join('|');
      if (!seen[k]) { seen[k] = 1; c.source = domainOf(c.url); out.push(c); }
    };
    if (opts.single || list.length <= 1) {
      var p0 = list[0] || null, url = urlOf(t), ti = titleOf(t);
      push({ kind: p0 ? kindOf(p0) : 'vendita', price: p0 ? p0.value : null, currency: p0 ? p0.currency : 'EUR', sqm: sqmOf(t), rooms: roomsOf(t), url: url, title: ti, city: cityOf(ti) });
      return out[0].price == null && out[0].sqm == null ? [] : out;
    }
    list = list.filter(function (x, i) { var pr = list[i - 1]; return !(pr && pr.value === x.value && x.index - pr.end < 80); });
    list.forEach(function (x, i) {
      var nx = list[i + 1], pv = list[i - 1];
      var after = t.slice(x.end, nx ? nx.index : t.length), before = t.slice(pv ? pv.end : 0, x.index).slice(-400), ti = titleOf(before, true) || titleOf(after);
      push({ kind: kindOf(x), price: x.value, currency: x.currency, sqm: sqmOf(after) || sqmOf(before), rooms: roomsOf(after) || roomsOf(before),
        url: urlOf(after) || urlOf(before), title: ti, city: cityOf(ti) });
    });
    return out;
  };

  /* Bookmarklet: dalla pagina dell'annuncio (immobiliare.it, idealista, casa.it, …) invia titolo, link e righe utili all'app */
  PT.bookmarklet = function (appUrl) {
    var src = '(function(){try{var A=' + JSON.stringify(String(appUrl || '').split('#')[0]) + ',D=document,h=D.querySelector("h1"),' +
      'L=(D.body.innerText||"").split(/\\n+/).filter(function(l){return l.length<220&&/€|£|\\$|m²|mq|m2|sqm|local|vani|camer|bagn|superfic|prezzo|price|bed|room|habitac|pièce|quarto|zimmer|piano|floor/i.test(l)}).slice(0,90).join("\\n"),' +
      'c=(function(){var r="";[].forEach.call(D.querySelectorAll("script[type=\'application/ld+json\']"),function(s){var m=!r&&/"addressLocality"\\s*:\\s*"([^"]{2,80})"/.exec(s.textContent);if(m)r=m[1]});return r})(),' +
      'd={u:location.href,t:((h&&h.innerText)||D.title||"").trim().slice(0,200),p:(D.title||"").slice(0,200),c:c,x:L.slice(0,6000)},s=JSON.stringify(d),' +
      'w=window.open(A+"#/ricevi?d="+encodeURIComponent(s),"_blank");if(!w)prompt("Copia questo testo e incollalo nella scheda Confronti > Importa annunci",s)}' +
      'catch(e){alert("Gestione Patrimonio: "+e.message)}})();';
    return 'javascript:' + encodeURIComponent(src);
  };

  /* Dati ricevuti dal bookmarklet ({u: link, t: titolo h1, p: titolo pagina, c: località JSON-LD, x: righe utili}) → annuncio letto */
  PT.fromPayload = function (d) {
    d = d || {};
    var r = PT.parse((d.t || '') + '\n' + (d.x || ''), { single: true })[0] || { kind: 'vendita', price: null, currency: 'EUR', sqm: null, rooms: null };
    r.url = U.safeUrl(d.u) || r.url || ''; r.title = String(d.t || r.title || '').slice(0, 200); r.source = domainOf(r.url);
    var jc = String(d.c || '').replace(/\s+/g, ' ').trim();
    try { jc = JSON.parse('"' + jc + '"'); } catch (e) { jc = jc.replace(/\\/g, ''); }
    r.city = cityOf(d.t) || cityOf(d.p) || (/^[^<>{}\d]{2,60}$/.test(jc) ? jc : '') || r.city || '';
    if (/affitt|\/rent|alquiler|location|to-rent|miete/i.test(r.url)) r.kind = 'affitto';
    else if (/vendit|for-sale|venta|vente|kaufen|comprar/i.test(r.url)) r.kind = r.kind === 'affitto' && r.price < 20000 ? 'affitto' : 'vendita';
    return r;
  };

  /* Annuncio letto → comparabile dell'immobile (prezzo convertito nella valuta dell'immobile se serve) */
  PT.toComparable = function (r, p) {
    var cur = (p && p.currency) || 'EUR', price = r.price, note = '';
    if (price != null && r.currency && r.currency !== cur && G.FX) {
      var cv = G.FX.convert(price, r.currency, cur);
      if (cv != null) { note = 'Convertito da ' + U.fmtMoney(price, r.currency) + ' al cambio del ' + U.fmtDate(U.todayISO()); price = Math.round(cv); }
    }
    return MD.newComparable({ kind: r.kind || 'vendita', source: r.source || domainOf(r.url) || 'manuale', url: r.url || '', title: r.title || '',
      city: r.city || (p && p.address && p.address.city) || '', price: price, sqm: r.sqm, rooms: r.rooms, date: U.todayISO(), notes: note, include: true });
  };

  G.PORTALS = PT;
})(window.GPI = window.GPI || {});
