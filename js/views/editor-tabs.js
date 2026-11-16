/* Schede dati dell'editor immobile: generale, catasto, acquisto, spese, mutui, locazione, registro, tasse, vendita, documenti.
   Ogni scheda è una funzione s -> html (GPI.EDTABS); i riquadri ricalcolati a ogni modifica sono in GPI.EDCALC; le azioni in GPI.EDACT. */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, M = G.MODEL, K = G.COUNTRIES, C = G.CALC, T = G.TAX, FX = G.FX, CH = G.CHARTS;
  var ED = G.ED = G.ED || {};
  var TABS = G.EDTABS = G.EDTABS || {}, CALC = G.EDCALC = G.EDCALC || {}, ACT = G.EDACT = G.EDACT || {};
  var YN = [['true', 'Sì'], ['false', 'No']];
  var WHOLE = { palazzo: 1, palazzo_misto: 1, residence: 1, edificio_commerciale: 1, hotel: 1 };
  var OMI_URL = 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/index.php';

  /* ---------- Aiuti ---------- */
  function lab(map, k) { var v = map ? map[k] : null; return v == null ? (k || '—') : (Array.isArray(v) ? v[0] : v); }
  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) {
      var t = v == null ? '' : String(v).trim(), k = t.toLowerCase();
      if (t && !seen[k]) { seen[k] = 1; out.push(t); }
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'it'); });
  }
  function propValues(fn) {
    var out = [];
    (G.APP.props || []).forEach(function (p) { var v = fn(p); if (Array.isArray(v)) out.push.apply(out, v); else out.push(v); });
    return uniq(out);
  }
  function layout(main, aside) { return '<div class="ed-layout"><div class="ed-main">' + main + '</div><aside class="ed-side">' + aside + '</aside></div>'; }
  function side(s, name, title, icon) { return UI.card(title, ED.calcBox(name, s), { cls: 'card-calc', icon: icon || 'chart' }); }
  function btnRow(html) { return '<div class="btn-row">' + html + '</div>'; }
  function eur(x, d) { return U.fmtEur(x, d); }
  function loc(s, x, d) { return U.fmtMoney(x, s.cur, d); }
  /* Importo locale con controvalore in euro (solo euro se l'immobile è in EUR) */
  function le(s, xL, xE) {
    if (!U.ok(xL) && !U.ok(xE)) return '—';
    if (!s.foreign) return eur(U.ok(xE) ? xE : xL);
    return (U.ok(xL) ? loc(s, xL) + ' ' : '') + '<small class="muted">≈ ' + eur(xE) + '</small>';
  }
  function pct(x, d) { return U.ok(x) ? U.fmtPct(x, d == null ? 1 : d) : '—'; }
  function shareNote(s) {
    return s.m.share < 1 ? UI.note('Risultati calcolati sulla tua quota di proprietà (<b>' + U.fmtPct(s.m.share, 0) + '</b>). Inserisci sempre gli importi al 100%: la quota viene applicata automaticamente.', 'info') : '';
  }
  function addrQuery(p) {
    var a = p.address || {};
    return [a.street, a.zip, a.city, a.province, a.street || a.city ? K.name(p.country) : ''].filter(function (x) { return x; }).join(', ');
  }
  function sortDates(arr) { return arr.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); }
  function sum(arr, fn) { return U.sum(arr || [], fn); }
  ED.lab = lab; ED.uniq = uniq; ED.propValues = propValues; ED.layout = layout; ED.side = side;
  ED.btnRow = btnRow; ED.le = le; ED.shareNote = shareNote; ED.addrQuery = addrQuery;

  /* ---------- Generale ---------- */
  TABS.generale = function (s) {
    var p = s.p, a = p.address, A = G.APP;
    var groups = propValues(function (x) { return x.group; }), tags = propValues(function (x) { return x.tags; });
    var ident = UI.grid([
      UI.text(p, 'name', 'Nome / descrizione', { cls: 'span2', placeholder: 'es. Bilocale via Roma – Milano' }),
      UI.text(p, 'code', 'Codice interno', { placeholder: 'es. IMM-001' }),
      UI.text(p, 'group', 'Gruppo / intestazione', { list: 'dl-groups', help: 'Per raggruppare gli immobili (es. "Personale", "Coniuge", "Società", "Eredità"). Usato nei filtri e nei riepiloghi.' }),
      UI.field(p, 'tags', 'Etichette', { type: 'tags', cls: 'span2', placeholder: 'es. mare, da ristrutturare', hint: tags.length ? 'Già usate: ' + U.esc(tags.slice(0, 15).join(', ')) : 'Separate da virgola' })
    ], 3) + UI.datalist('dl-groups', groups);

    var tipo = UI.grid([
      UI.field(p, 'type', 'Tipologia', { type: 'select', optionsHtml: UI.typeOptionsHtml(p.type), cls: 'span2' }),
      UI.select(p, 'category', 'Categoria', M.CATEGORIES),
      UI.select(p, 'status', 'Stato', M.STATUS, { help: '"In acquisto" e "Obiettivo" servono a valutare acquisti futuri: hanno tutte le metriche ma non entrano nei totali del patrimonio. "Venduto" usa i dati della scheda Vendita.' }),
      UI.select(p, 'usage', 'Utilizzo', M.USAGE, { help: 'Determina la tassazione (IMU, IRPEF o cedolare, IVIE) e quali costi e ricavi vengono considerati.' }),
      UI.select(p, 'acquisitionMode', 'Provenienza', M.ACQ_MODES),
      UI.pct(p, 'ownershipPct', 'Quota di proprietà', { dec: 2, help: 'Percentuale posseduta (1-100). Inserisci gli importi al 100%: i risultati vengono calcolati sulla tua quota.' })
    ], 3) + (WHOLE[p.type] ? UI.note('Per un <b>intero edificio</b> indica il numero di unità in "Caratteristiche" e inserisci ogni unità catastale nella scheda ' +
      '<a href="' + A.editHref(p.id, 'catasto') + '">Catasto</a>: IMU e rendite sono calcolate unità per unità. Nella scheda Locazione inserisci il canone mensile complessivo.', 'info') : '');

    var hasLL = U.ok(a.lat) && U.ok(a.lng), q = addrQuery(p);
    var osm = hasLL ? 'https://www.openstreetmap.org/?mlat=' + a.lat + '&mlon=' + a.lng + '#map=17/' + a.lat + '/' + a.lng :
      'https://www.openstreetmap.org/search?query=' + encodeURIComponent(q);
    var gmap = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(hasLL ? a.lat + ',' + a.lng : q);
    var ub = UI.grid([
      UI.select(p, 'country', 'Paese', UI.countryOptions()),
      UI.select(p, 'currency', 'Valuta degli importi', UI.currencyOptions(), { help: 'Valuta in cui inserisci prezzo, spese e canoni. Il controvalore in euro usa il cambio live oppure, dove indicato, il cambio storico della singola voce.' }),
      UI.text(p, 'address.zip', 'CAP / codice postale'),
      UI.text(p, 'address.street', 'Indirizzo', { cls: 'span2', placeholder: 'Via e numero civico' }),
      UI.text(p, 'address.city', 'Comune / città'),
      s.isIT ? UI.select(p, 'address.province', 'Provincia', UI.provinceOptions(), { empty: '—' }) : UI.text(p, 'address.province', 'Provincia / stato / contea'),
      UI.text(p, 'address.region', 'Regione'),
      UI.num(p, 'address.lat', 'Latitudine', { dec: 6, placeholder: 'es. 45,464211' }),
      UI.num(p, 'address.lng', 'Longitudine', { dec: 6, placeholder: 'es. 9,191383' })
    ], 3) + btnRow(
      UI.btn('Trova coordinate', { cls: 'btn-sm', icon: 'pin', act: 'geocode', disabled: !q, title: 'Cerca le coordinate dell\'indirizzo su OpenStreetMap (Nominatim)' }) +
      UI.btn('OpenStreetMap', { cls: 'btn-sm', icon: 'external', href: osm, blank: true }) +
      UI.btn('Google Maps', { cls: 'btn-sm', icon: 'external', href: gmap, blank: true }) +
      (s.isIT ? UI.btn('Quotazioni OMI', { cls: 'btn-sm', icon: 'external', href: OMI_URL, blank: true, title: 'Banca dati delle quotazioni immobiliari dell\'Agenzia delle Entrate' }) : '')
    );

    var car = UI.grid([
      UI.num(p, 'sqm', 'Superficie commerciale', { suffix: 'm²', dec: 0, help: 'Superficie commerciale lorda: usata per prezzo al m², comparabili e quotazioni OMI.' }),
      UI.num(p, 'landSqm', 'Giardino / terreno', { suffix: 'm²', dec: 0 }),
      UI.int(p, 'rooms', 'Locali'),
      UI.int(p, 'bathrooms', 'Bagni'),
      UI.text(p, 'floor', 'Piano', { placeholder: 'es. 3, T, R, 1-2' }),
      UI.int(p, 'yearBuilt', 'Anno di costruzione', { dec: 'plain' }),
      UI.select(p, 'energyClass', 'Classe energetica', M.ENERGY.map(function (e) { return [e, e || '—']; })),
      UI.int(p, 'unitsCount', 'Unità immobiliari', { help: 'Per palazzi, residence o immobili frazionati: numero di unità contenute.' }),
      s.isIT ? UI.bool(p, 'sameComuneAsMainHome', 'Nello stesso Comune dell\'abitazione principale', { cls: 'span2',
        help: 'Abitazioni non locate nello stesso Comune dell\'abitazione principale: oltre all\'IMU il 50% della rendita catastale rivalutata è soggetto a IRPEF (art. 9 D.Lgs. 23/2011).' }) : ''
    ], 4);

    var main = UI.card('Identificazione', ident, { icon: 'tag' }) +
      UI.card('Tipologia e utilizzo', tipo, { icon: 'home' }) +
      UI.card('Ubicazione', ub, { icon: 'pin' }) +
      UI.card('Caratteristiche', car, { icon: 'building' }) +
      UI.card('Note', UI.area(p, 'notes', 'Note libere', { rows: 5 }), { icon: 'edit' });
    return layout(main, side(s, 'riepilogo', 'Riepilogo', 'chart'));
  };

  CALC.riepilogo = function (s) {
    var m = s.m, f = s.f, A = G.APP;
    var kv = UI.kv([
      [m.sold ? 'Prezzo di vendita' : 'Valore attuale', le(s, m.valueL, m.valueEur) + (m.valueEstimated ? ' <small class="muted">(stima)</small>' : ''), m.valueSrc],
      ['Costo complessivo', eur(m.costTotalEur), 'Prezzo + oneri di acquisto + arredi, lavori e spese straordinarie (sulla tua quota).'],
      ['Capitale proprio investito', eur(m.equityInvestedEur)],
      m.debtEur > 0 ? ['Debito residuo', eur(m.debtEur)] : null,
      m.active ? ['Plus/minus latente', UI.signed(f.unrealizedEur), 'Valore attuale meno costo fiscalmente riconosciuto, prima di tasse e spese di vendita.'] : null,
      ['Cash flow netto annuo', UI.signed(f.cfPost)],
      ['Quota di proprietà', U.fmtPct(m.share, m.share < 1 ? 2 : 0)],
      ['Anni di possesso', U.ok(m.holdYears) && m.holdYears > 0 ? U.fmtYears(m.holdYears) : '—']
    ]);
    var next = sortDates((m.dates || []).filter(function (d) { return !d.past; })).slice(0, 6);
    var dl = next.length ? '<h4 class="sub-h">Prossime scadenze</h4><ul class="dates">' + next.map(function (d) {
      return '<li class="dt-' + (d.level || 'info') + '"><span class="dt-d">' + U.fmtDate(d.date) + '</span> ' +
        '<a href="' + A.editHref(s.pid, d.tab || 'generale') + '">' + U.esc(d.label) + '</a>' + (d.amount ? ' <small class="muted">' + eur(d.amount) + '</small>' : '') + '</li>';
    }).join('') + '</ul>' : '';
    return kv + dl;
  };

  ACT.geocode = function (el) {
    var s = ED.current(); if (!s) return;
    var p = s.p, q = addrQuery(p), id = p.id;
    if (!q) { U.toast('Inserisci prima indirizzo e città.', 'warn'); return; }
    var url = function (x) { return 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(x); };
    el.disabled = true;
    U.fetchJSON(url(q), 12000).then(function (r) {
      if (r && r.length) return { r: r, exact: true };
      var a = p.address, q2 = [a.city, a.province, K.name(p.country)].filter(function (x) { return x; }).join(', ');
      return q2 && q2 !== q ? U.fetchJSON(url(q2), 12000).then(function (r2) { return { r: r2, exact: false }; }) : { r: [], exact: false };
    }).then(function (o) {
      if (!o.r || !o.r.length) { U.toast('Indirizzo non trovato: controlla i dati o inserisci le coordinate a mano.', 'warn', 5000); return; }
      var lat = Math.round(+o.r[0].lat * 1e6) / 1e6, lng = Math.round(+o.r[0].lon * 1e6) / 1e6;
      if (!isFinite(lat) || !isFinite(lng)) { U.toast('Risposta non valida dal servizio di geocodifica.', 'error'); return; }
      ED.withProp(id, function (x) { x.address.lat = lat; x.address.lng = lng; });
      U.toast(o.exact ? 'Coordinate trovate' : 'Indirizzo esatto non trovato: usate le coordinate del comune', o.exact ? 'success' : 'warn', 4000);
    }).catch(function () { U.toast('Ricerca coordinate non riuscita: verifica la connessione.', 'error'); })
      .then(function () { el.disabled = false; });
  };

  /* ---------- Catasto e valore ---------- */
  var VAL_SOURCES = ['Perizia', 'Agenzia immobiliare', 'Stima personale', 'Comparabili', 'Quotazioni OMI', 'Portali immobiliari', 'Valore di successione'];
  TABS.catasto = function (s) {
    var p = s.p, out = [];
    if (s.isIT) {
      out.push(UI.card('Unità catastali', ED.list(s, 'cadastre.units', function (u, b) {
        return UI.grid([
          UI.text(p, b + '.foglio', 'Foglio'),
          UI.text(p, b + '.particella', 'Particella / mappale'),
          UI.text(p, b + '.sub', 'Subalterno'),
          UI.select(p, b + '.categoria', 'Categoria', M.CADASTRAL_CATS, { empty: '—' }),
          UI.text(p, b + '.classe', 'Classe'),
          UI.text(p, b + '.consistenza', 'Consistenza', { placeholder: 'vani o m²' }),
          ED.eur(s, b + '.rendita', 'Rendita catastale', { dec: 2, help: 'Rendita non rivalutata, come da visura. Per i terreni (categoria T) indica il reddito dominicale.' }),
          UI.bool(p, b + '.pertinenza', 'Pertinenza (C/2, C/6, C/7)')
        ], 4);
      }, { addLabel: 'Aggiungi unità catastale', empty: 'Nessuna unità: aggiungila per calcolare IMU, imposte d\'acquisto (prezzo-valore) e IRPEF.' }),
      { icon: 'building', help: 'Dati dalla visura catastale. Per un intero palazzo inserisci ogni unità (abitazioni, negozi, box): IMU e imposte sono calcolate unità per unità.' }));
    } else {
      out.push(UI.card('Valore fiscale locale', UI.grid([
        ED.amt(s, 'cadastre.foreignValue', 'Valore catastale / fiscale nel paese', { dec: 0, ratePath: 'purchase.fxRate',
          help: 'Valore catastale o fiscale attribuito dal paese estero (se esiste). È la base IVIE preferita per i paesi UE/SEE.' })
      ], 2), { icon: 'building' }));
    }
    out.push(UI.card('Valore di mercato', UI.grid([
      ED.amt(s, 'valuation.marketValue', 'Valore di mercato attuale', { dec: 0, help: 'Stima o perizia del valore al 100%. Se vuoto si usa, nell\'ordine: comparabili, quotazioni OMI, prezzo + lavori rivalutati.' }),
      UI.date(p, 'valuation.date', 'Data della valutazione'),
      UI.text(p, 'valuation.source', 'Fonte', { list: 'dl-valsrc', placeholder: 'es. perizia, agenzia' }),
      ED.amt(s, 'valuation.estimatedRent', 'Canone di mercato (mensile)', { dec: 0, help: 'Canone ottenibile affittando l\'immobile: usato nei confronti e come rendimento potenziale se non è locato.' })
    ], 4) + UI.datalist('dl-valsrc', VAL_SOURCES), { icon: 'currency' }));
    var sq = s.cur === 'EUR' ? '€/m²' : s.cur + '/m²';
    out.push(UI.card(s.isIT ? 'Quotazioni OMI (Agenzia delle Entrate)' : 'Quotazioni di zona', UI.grid([
      ED.amt(s, 'valuation.omiMin', 'Compravendita min', { dec: 0, suffix: sq, noFx: true }),
      ED.amt(s, 'valuation.omiMax', 'Compravendita max', { dec: 0, suffix: sq, noFx: true }),
      ED.amt(s, 'valuation.omiRentMin', 'Locazione min (mese)', { dec: 2, suffix: sq, noFx: true }),
      ED.amt(s, 'valuation.omiRentMax', 'Locazione max (mese)', { dec: 2, suffix: sq, noFx: true })
    ], 4) + (s.isIT ? btnRow(UI.btn('Apri GEOPOI – quotazioni OMI', { cls: 'btn-sm', icon: 'external', href: OMI_URL, blank: true }) +
      '<span class="muted small">Cerca l\'indirizzo, scegli la zona e copia i valori min/max per la tipologia (stato conservativo "normale").</span>') : ''),
    { icon: 'map', help: 'Valori al m² di superficie lorda. Il valore medio × la superficie dà una stima indipendente del valore e del canone.' }));
    out.push(UI.card('Storico delle valutazioni', ED.list(s, 'valuation.history', function (h, b) {
      return UI.grid([
        UI.date(p, b + '.date', 'Data'),
        ED.amt(s, b + '.value', 'Valore', { dec: 0, noFx: true }),
        UI.text(p, b + '.source', 'Fonte', { list: 'dl-valsrc' })
      ], 3);
    }, { addLabel: 'Aggiungi valutazione', empty: 'Nessuna valutazione registrata.',
      extra: UI.btn('Salva il valore attuale nello storico', { cls: 'btn-sm', icon: 'save', act: 'val-snap' }) }), { icon: 'calendar' }));
    return layout(out.join(''), side(s, 'catasto', 'Valori calcolati', 'chart'));
  };

  CALC.catasto = function (s) {
    var m = s.m, p = s.p, cmp = m.cmp || {}, rows = [], out = '';
    if (s.isIT) {
      var rt = T.renditaTotal(p);
      rows.push(['Rendita catastale totale', rt > 0 ? eur(rt, 2) : '—', 'Somma delle rendite delle unità (al 100%), esclusi i terreni.']);
      if (rt > 0) rows.push(['Rendita rivalutata (+5%)', eur(rt * 1.05, 2)]);
      if (m.imu && m.imu.base > 0) rows.push(['Base imponibile IMU', eur(m.imu.base), 'Rendita rivalutata × coefficiente di categoria (160 abitazioni, 140 B e C/3-C/5, 80 A/10 e D/5, 65 gruppo D, 55 C/1).']);
      rows.push(['IMU annua' + (m.share < 1 ? ' (tua quota)' : ''), m.imuEur > 0 ? eur(m.imuEur) : (m.imu && m.imu.note ? U.esc(m.imu.note) : '—')]);
    }
    rows.push([m.sold ? 'Prezzo di vendita' : 'Valore considerato', le(s, m.valueL, m.valueEur), m.valueSrc]);
    if (U.ok(s.f.valueSqm)) rows.push(['Valore al m²', loc(s, s.f.valueSqm)]);
    if (cmp.omiValue) rows.push(['Valore da OMI (medio)', loc(s, cmp.omiValue)]);
    if (cmp.omiRent) rows.push(['Canone da OMI (medio, mese)', loc(s, cmp.omiRent)]);
    if (cmp.estValue) rows.push(['Valore da comparabili', loc(s, cmp.estValue) + ' <small class="muted">(' + cmp.sale.n + ')</small>']);
    if (cmp.estRent) rows.push(['Canone da comparabili (mese)', loc(s, cmp.estRent) + ' <small class="muted">(' + cmp.rent.n + ')</small>']);
    out += UI.kv(rows);
    if (s.isIT && m.imu && m.imu.note && m.imuEur > 0) out += '<p class="muted small">' + U.esc(m.imu.note) + '</p>';
    var h = (p.valuation.history || []).filter(function (x) { return x && U.validDate(x.date) && U.ok(x.value) && x.value > 0; });
    if (h.length > 1) {
      h = sortDates(h);
      out += '<h4 class="sub-h">Andamento del valore</h4>' + UI.table([
        { label: 'Data', render: function (r) { return U.fmtDate(r.date); } },
        { label: 'Valore', cls: 'num', render: function (r) { return loc(s, r.value); } },
        { label: 'Var.', cls: 'num', render: function (r, i) { return i ? UI.signed(r.value / h[i - 1].value - 1, 'pct') : ''; } }
      ], h, { cls: 'tbl-sm' });
      var y = U.yearsBetween(h[0].date, h[h.length - 1].date);
      if (y > 0.5) out += '<p class="muted small">Rivalutazione media annua: <b>' + pct(Math.pow(h[h.length - 1].value / h[0].value, 1 / y) - 1) + '</b></p>';
    }
    return out;
  };

  ACT['val-snap'] = function () {
    var s = ED.current(); if (!s) return;
    var p = s.p, v = U.ok(p.valuation.marketValue) && p.valuation.marketValue > 0 ? p.valuation.marketValue : s.m.valueL;
    if (!(v > 0)) { U.toast('Nessun valore da salvare: inserisci il valore di mercato.', 'warn'); return; }
    if ((p.valuation.history || []).length >= 500) { U.toast('Limite di 500 voci per elenco raggiunto.', 'warn'); return; }
    ED.withProp(p.id, function (x) {
      var va = x.valuation;
      if (!Array.isArray(va.history)) va.history = [];
      va.history.push({ id: U.uid(), date: U.validDate(va.date) ? va.date : U.todayISO(), value: Math.round(v),
        source: va.source || (U.ok(va.marketValue) && va.marketValue > 0 ? 'Valutazione' : 'Stima automatica') });
    });
    U.toast('Valore salvato nello storico', 'success');
  };

  /* ---------- Acquisto ---------- */
  var PRICE_LABEL = { successione: 'Valore dichiarato in successione', donazione: 'Valore dichiarato nella donazione', costruzione: 'Costo terreno e costruzione', asta: 'Prezzo di aggiudicazione' };
  TABS.acquisto = function (s) {
    var p = s.p, pu = p.purchase, mode = p.acquisitionMode, rp = { dec: 0, ratePath: 'purchase.fxRate' };
    var base = [
      UI.date(p, 'purchase.date', mode === 'successione' ? 'Data di apertura della successione' : mode === 'costruzione' ? 'Data di fine lavori / accatastamento' : 'Data di acquisto (rogito)'),
      ED.amt(s, 'purchase.price', PRICE_LABEL[mode] || 'Prezzo di acquisto', { dec: 0, ratePath: 'purchase.fxRate', help: 'Importo al 100% nella valuta dell\'immobile, anche se possiedi solo una quota.' })
    ];
    if (mode === 'donazione' || mode === 'successione') base.push(UI.date(p, 'purchase.originalDate', mode === 'donazione' ? 'Data di acquisto del donante' : 'Data di acquisto del defunto',
      { help: mode === 'donazione' ? 'Per la plusvalenza contano la data e il costo d\'acquisto del donante.' : 'Solo informativa: per gli immobili ereditati la plusvalenza non è tassata.' }));
    if (s.foreign) {
      base.push(UI.num(p, 'purchase.fxRate', 'Cambio all\'acquisto (' + U.esc(s.cur) + ' per 1 €)', { dec: 6, placeholder: 'vuoto = cambio live',
        help: 'Cambio BCE del giorno del rogito: rende esatti costo storico in euro, plusvalenze e ROI. Usa "Cambio storico" per recuperarlo.' }));
      base.push(UI.text(p, 'purchase.fxSource', 'Fonte del cambio', { placeholder: 'es. BCE 12/03/2021' }));
    }
    var html = UI.grid(base, 3) + (s.foreign ? btnRow(UI.btn('Cambio storico alla data di acquisto', { cls: 'btn-sm', icon: 'refresh', act: 'fxhist', data: ' data-which="purchase"' })) : '');
    if (s.isIT && mode !== 'successione' && mode !== 'costruzione') {
      html += UI.grid([
        UI.select(p, 'purchase.sellerType', 'Venditore', M.SELLER_TYPES),
        UI.bool(p, 'purchase.primaCasa', 'Agevolazione "prima casa"', { help: 'Registro 2% (anziché 9%) da privato o IVA 4% da impresa; imposte ipotecaria e catastale fisse.' }),
        UI.bool(p, 'purchase.lusso', 'Abitazione di lusso (A/1, A/8, A/9)', { help: 'Esclude la "prima casa" e l\'esenzione IMU per l\'abitazione principale.' }),
        UI.bool(p, 'purchase.newBuild', 'Nuova costruzione / ristrutturata dall\'impresa')
      ], 4);
    }
    html += UI.grid([
      UI.select(p, 'purchase.taxMode', 'Imposte di acquisto', { auto: 'Calcolo automatico', manuale: 'Importo manuale' }),
      pu.taxMode === 'manuale' ? ED.amt(s, 'purchase.taxManual', 'Imposte pagate (totale)', rp) : ''
    ], 3);
    var costs = UI.grid([
      ED.amt(s, 'purchase.notary', 'Notaio (onorario + IVA)', rp),
      ED.amt(s, 'purchase.agency', 'Agenzia immobiliare', rp),
      ED.amt(s, 'purchase.technical', 'Tecnici, perizie, due diligence', rp),
      ED.amt(s, 'purchase.mortgageCosts', 'Spese bancarie del mutuo', { dec: 0, ratePath: 'purchase.fxRate', help: 'Istruttoria, perizia e notaio del mutuo. L\'imposta sostitutiva si gestisce nella scheda Mutui.' })
    ], 4) + '<h4 class="sub-h">Altri costi di acquisto</h4>' + ED.list(s, 'purchase.otherCosts', function (c, b) {
      return UI.grid([
        UI.text(p, b + '.label', 'Descrizione', { cls: 'span2', placeholder: 'es. avvocato, traduzioni, NIE, volture' }),
        ED.amt(s, b + '.amount', 'Importo', rp)
      ], 3);
    }, { addLabel: 'Aggiungi costo', empty: 'Nessun altro costo.' });
    var main = UI.card('Atto di acquisto', html, { icon: 'currency' }) +
      UI.card('Costi accessori', costs, { icon: 'list', help: 'Costi una tantum sostenuti per l\'acquisto. Arredi e lavori vanno nella scheda Spese.' });
    return layout(main, side(s, 'acquisto', 'Costo di acquisto', 'chart'));
  };

  CALC.acquisto = function (s) {
    var m = s.m, f = s.f, a = m.acqL || {}, ptx = m.ptx || { items: [] }, out = '';
    var notes = Array.isArray(ptx.notes) ? ptx.notes : (ptx.notes ? [ptx.notes] : []);
    if (ptx.items && ptx.items.length) {
      out += '<h4 class="sub-h">Imposte di acquisto</h4>' + UI.kv(ptx.items.map(function (it) { return [U.esc(it.label), loc(s, it.amount), it.hint]; }));
    }
    out += '<h4 class="sub-h">Riepilogo (100%)</h4>' + UI.kv([
      ['Prezzo', loc(s, a.price)],
      ['Imposte', loc(s, a.taxes)],
      a.notary ? ['Notaio', loc(s, a.notary)] : null,
      a.agency ? ['Agenzia', loc(s, a.agency)] : null,
      a.technical ? ['Tecnici', loc(s, a.technical)] : null,
      a.mortgage ? ['Spese mutuo', loc(s, a.mortgage)] : null,
      a.other ? ['Altri costi', loc(s, a.other)] : null,
      ['Totale oneri accessori', '<b>' + loc(s, a.costs) + '</b>' + (a.price ? ' <small class="muted">(' + pct(a.costs / a.price) + ' del prezzo)</small>' : '')],
      ['Costo complessivo', '<b>' + loc(s, (a.price || 0) + (a.costs || 0)) + '</b>']
    ]);
    out += '<h4 class="sub-h">In euro' + (m.share < 1 ? ', sulla tua quota' : '') + '</h4>' + UI.kv([
      ['Prezzo', eur(m.priceEur)],
      ['Oneri accessori', eur(m.acqCostsEur)],
      m.mortCostsEur ? ['di cui spese mutuo', eur(m.mortCostsEur), 'Costi di finanziamento: non entrano nel costo fiscale per la plusvalenza.'] : null,
      U.ok(f.priceSqm) ? ['Prezzo al m²', loc(s, f.priceSqm)] : null,
      U.ok(f.costSqm) ? ['Costo totale al m²', eur(f.costSqm)] : null,
      s.foreign ? ['Cambio usato', U.fmtNum(m.rBuy, 4) + ' ' + U.esc(s.cur) + '/€' + (U.ok(s.p.purchase.fxRate) ? '' : ' <small class="muted">(live)</small>')] : null
    ]);
    if (notes.length) out += notes.map(function (n) { return '<p class="muted small">' + U.esc(n) + '</p>'; }).join('');
    return out;
  };

  /* ---------- Spese: arredi, lavori, extra e costi ricorrenti ---------- */
  var EXP = {
    furnishing: { t: 'Arredamento ed elettrodomestici', icon: 'home', add: 'Aggiungi arredo', ph: 'es. Cucina con elettrodomestici',
      help: 'Mobili, elettrodomestici e corredo. Non aumentano il costo fiscale dell\'immobile (non riducono la plusvalenza). In Italia possono dare diritto al bonus mobili se collegati a lavori di ristrutturazione.' },
    renovations: { t: 'Ristrutturazioni e lavori straordinari', icon: 'edit', add: 'Aggiungi lavori', ph: 'es. Rifacimento bagno e impianti',
      help: 'Manutenzione straordinaria, impianti, ampliamenti, efficientamento energetico: per default aumentano il costo fiscale (riducono la plusvalenza imponibile) e in Italia possono dare diritto a detrazioni IRPEF.' },
    extraExpenses: { t: 'Spese extra una tantum', icon: 'plus', add: 'Aggiungi spesa', ph: 'es. Sanatoria, perizia, trasloco',
      help: 'Spese non ricorrenti diverse da arredi e lavori (sanatorie, perizie, allacci, traslochi, spese legali...). Per default non aumentano il costo fiscale: scegli "Sì" se sono documentate e inerenti all\'immobile.' }
  };
  function expRow(s, kind) {
    return function (it, b) {
      var yr = U.year(it.date) || U.year(s.p.purchase.date) || new Date().getFullYear();
      var bonus = s.isIT && it.bonus && it.bonus !== 'nessuno' ? it.bonus : '';
      var dp = bonus ? T.defaultDeductionPct(bonus, s.p, s.P, yr) : null, dy = bonus ? T.defaultDeductionYears(bonus, s.P, yr) : null;
      var effPct = U.has(it.deductionPct) ? U.n(it.deductionPct) : U.n(dp);
      return UI.grid([
        UI.date(s.p, b + '.date', 'Data', { help: 'Vuota = data d\'acquisto. Determina l\'anno delle detrazioni e il cambio applicato.' }),
        UI.text(s.p, b + '.description', 'Descrizione', { cls: 'span2', placeholder: EXP[kind].ph }),
        ED.amt(s, b + '.amount', 'Importo (100%)', { ratePath: b + '.fxRate' }),
        s.foreign ? UI.num(s.p, b + '.fxRate', 'Cambio ' + U.esc(s.cur) + ' per 1 €', { dec: 6, placeholder: 'automatico', help: 'Cambio del giorno del pagamento. Vuoto = cambio d\'acquisto (entro 6 mesi dall\'acquisto) o cambio attuale.' }) : null,
        kind !== 'furnishing' ? UI.select(s.p, b + '.capitalized', 'Aumenta il costo fiscale', YN, { boolean: true, empty: kind === 'renovations' ? 'Automatico (sì)' : 'Automatico (no)', help: 'Se "Sì" la spesa si somma al prezzo d\'acquisto nel calcolo della plusvalenza (serve documentazione: fatture, bonifici).' }) : null,
        s.isIT ? UI.select(s.p, b + '.bonus', 'Detrazione fiscale', M.BONUS) : null,
        bonus ? UI.pct(s.p, b + '.deductionPct', '% detraibile', { placeholder: U.ok(dp) ? U.fmtNum(dp, 0) : '', help: 'Vuoto = percentuale di legge per l\'anno della spesa e l\'uso dell\'immobile (parametri in Impostazioni).' }) : null,
        bonus ? UI.int(s.p, b + '.deductionYears', 'Rate annuali', { placeholder: U.ok(dy) ? String(dy) : '', help: 'Numero di quote annuali di pari importo in cui si ripartisce la detrazione.' }) : null,
        bonus ? UI.bool(s.p, b + '.cessione', 'Sconto in fattura / cessione del credito', { help: 'Se hai optato per sconto in fattura o cessione: nessuna detrazione in dichiarazione, l\'esborso è il costo netto.' }) : null,
        bonus && it.cessione ? ED.amt(s, b + '.netCost', 'Costo netto pagato', { ratePath: b + '.fxRate', placeholder: U.ok(it.amount) ? U.fmtNum(it.amount * Math.max(0, 1 - effPct / 100), 0) : '', help: 'Quanto hai pagato effettivamente dopo lo sconto. Vuoto = importo × (1 − % detraibile).' }) : null,
        bonus === 'superbonus' ? UI.date(s.p, b + '.endDate', 'Fine lavori', { help: 'Per la plusvalenza: le vendite entro 10 anni dalla fine dei lavori Superbonus sono tassabili (L. 213/2023).' }) : null
      ], 4);
    };
  }
  function amtPer(s, path, label, per, o) { o = o || {}; o.suffix = s.cur + (per ? '/' + per : ''); return ED.amt(s, path, label, o); }

  TABS.spese = function (s) {
    var p = s.p, P = s.P, rented = M.isRented(p), short = M.isShort(p);
    var living = !rented && (p.usage === 'abitazione_principale' || p.usage === 'uso_proprio');
    var oneOff = ['furnishing', 'renovations', 'extraExpenses'].map(function (k) {
      var e = EXP[k], intro = '';
      if (k === 'renovations' && s.isIT) {
        intro = UI.note('Detrazioni calcolate sulla tua quota con il massimale per unità immobiliare e anno: ristrutturazione ' +
          U.fmtNum(U.n(P.renoMainPct), 0) + '% (abitazione principale) / ' + U.fmtNum(U.n(P.renoOtherPct), 0) + '% (altri immobili) per le spese 2025-2026, tetto ' +
          U.fmtEur(U.n(P.renoCap) || 96000) + '. Bonus mobili ' + U.fmtNum(U.n(P.mobiliPct) || 50, 0) + '% fino a ' + U.fmtEur(U.n(P.mobiliCap) || 5000) + '. Verifica sempre i requisiti con il tuo consulente.', 'info');
      }
      return UI.card(e.t, intro + ED.list(s, k, expRow(s, k), { addLabel: e.add, empty: 'Nessuna voce inserita.' }), { icon: e.icon, help: e.help });
    }).join('');

    var main = UI.grid([
      amtPer(s, 'recurring.condoMonthly', 'Condominio ordinario', 'mese', { help: 'Rata mensile delle spese condominiali ordinarie (importo intero, non la tua quota).' }),
      rented && !short ? UI.pct(p, 'recurring.condoTenantSharePct', 'Condominio a carico inquilino', { help: 'Parte delle spese ordinarie rimborsata dall\'inquilino (pulizie scale, ascensore, portierato: spesso 70-100%).' }) : null,
      amtPer(s, 'recurring.condoExtraordinaryAnnual', 'Condominio straordinario', 'anno', { help: 'Media annua delle spese straordinarie deliberate (facciata, tetto, ascensore...).' }),
      amtPer(s, 'recurring.insuranceAnnual', 'Assicurazione', 'anno', { help: 'Polizza incendio/scoppio, globale fabbricati, responsabilità civile, rischio locativo.' }),
      amtPer(s, 'recurring.maintenanceAnnual', 'Manutenzione ordinaria', 'anno', { help: 'Stima annua di piccole riparazioni (regola pratica: 0,5-1% del valore dell\'immobile).' }),
      amtPer(s, 'recurring.cleaningAnnual', short ? 'Pulizie e biancheria' : 'Pulizie', 'anno', { help: short ? 'Pulizie tra un soggiorno e l\'altro, lavanderia, kit di cortesia.' : '' })
    ], 4);
    var utils = UI.grid([
      amtPer(s, 'recurring.waterMonthly', 'Acqua', 'mese'),
      amtPer(s, 'recurring.electricityMonthly', 'Luce', 'mese'),
      amtPer(s, 'recurring.gasMonthly', 'Gas', 'mese'),
      amtPer(s, 'recurring.heatingMonthly', 'Riscaldamento', 'mese', { help: 'Solo se separato dal gas (es. centralizzato, teleriscaldamento, pellet).' }),
      amtPer(s, 'recurring.internetMonthly', 'Internet / TV', 'mese'),
      amtPer(s, 'recurring.tariAnnual', s.isIT ? 'TARI (rifiuti)' : 'Tassa rifiuti', 'anno'),
      rented && !short ? UI.select(p, 'recurring.utilitiesPaidBy', 'Utenze pagate da', { proprietario: 'Proprietario', inquilino: 'Inquilino' }, { help: 'Se le utenze sono intestate all\'inquilino (o rimborsate) non sono costi per te.' }) : null
    ], 4);
    var utilNote = living ? UI.note('Uso proprio / abitazione principale: le utenze sono <b>costi di vita</b> e per default non entrano in rendimenti e ROI (opzione in Impostazioni).', 'info') :
      (rented && !short && p.recurring.utilitiesPaidBy === 'inquilino' ? UI.note('Utenze a carico dell\'inquilino: non vengono conteggiate.', 'info') : '');
    var mgmt = rented ? '<h4 class="sub-h">Gestione della locazione</h4>' + UI.grid([
      UI.pct(p, 'recurring.managementPct', 'Gestione / agenzia', { help: '% degli incassi pagata a property manager o agenzia per la gestione.' }),
      short ? UI.pct(p, 'recurring.platformFeePct', 'Commissioni piattaforme', { help: 'Airbnb, Booking, Vrbo...: % trattenuta sugli incassi (tipicamente 3-18%).' }) : null
    ], 4) : '';
    var other = ED.list(s, 'recurring.other', function (it, b) {
      return UI.grid([
        UI.text(p, b + '.label', 'Voce', { cls: 'span2', placeholder: 'es. Giardiniere, vigilanza, canone TV' }),
        ED.amt(s, b + '.amount', 'Importo'),
        UI.select(p, b + '.freq', 'Frequenza', M.FREQ)
      ], 4);
    }, { addLabel: 'Aggiungi costo ricorrente', empty: 'Nessun altro costo ricorrente.' });
    var rec = UI.card('Costi ricorrenti', '<h4 class="sub-h">Condominio, assicurazione e manutenzione</h4>' + main +
      '<h4 class="sub-h">Bollette e utenze</h4>' + utils + utilNote + mgmt + '<h4 class="sub-h">Altri costi ricorrenti</h4>' + other,
      { icon: 'calendar', help: 'Importi al 100% nella valuta dell\'immobile. Le imposte (IMU, tasse estere) si inseriscono nella scheda Tasse.' });
    return layout(shareNote(s) + rec + oneOff, side(s, 'spese', 'Riepilogo spese', 'chart'));
  };

  CALC.spese = function (s) {
    var m = s.m, ox = m.opex || [], out = '', livingIn = !!(m.D && m.D.livingInRoi);
    out += '<h4 class="sub-h">Costi ricorrenti annui</h4>';
    if (ox.length) {
      var cols = [{ label: 'Voce', render: function (o) { return U.esc(o.label) + (o.kind === 'living' ? ' <small class="muted" title="Costo di vita">✱</small>' : o.kind === 'var' ? ' <small class="muted" title="Variabile con gli incassi">~</small>' : ''); } }];
      if (s.foreign) cols.push({ label: U.esc(s.cur) + ' (100%)', cls: 'num', render: function (o) { return U.fmtNum(o.local, 0); } });
      cols.push({ label: 'EUR' + (m.share < 1 ? ' (quota)' : ''), cls: 'num', render: function (o) { return eur(o.eur); } });
      var foot = ['Totale'];
      if (s.foreign) foot.push(U.fmtNum(sum(ox, function (o) { return o.local; }), 0));
      var totE = sum(ox, function (o) { return o.eur; });
      foot.push('<b>' + eur(totE) + '</b>');
      out += UI.table(cols, ox, { cls: 'tbl-sm', foot: foot });
      out += UI.kv([
        ['Media mensile', eur(totE / 12)],
        m.opexLivingEur ? ['di cui costi di vita ✱', eur(m.opexLivingEur), livingIn ? 'Inclusi nei rendimenti (Impostazioni).' : 'Utenze di abitazione principale / uso proprio: escluse da rendimenti e ROI (modificabile in Impostazioni).'] : null,
        m.opexVarEur ? ['di cui variabili ~', eur(m.opexVarEur), 'Proporzionali agli incassi: gestione, piattaforme, pulizie degli affitti brevi.'] : null,
        ['Usati nei rendimenti', '<b>' + eur(m.opexEur) + '</b> /anno']
      ]);
    } else out += '<p class="muted small">Nessun costo ricorrente inserito.</p>';
    var tot1 = (m.furnEur || 0) + (m.renoEur || 0) + (m.extraEur || 0);
    out += '<h4 class="sub-h">Spese una tantum' + (m.share < 1 ? ' (tua quota)' : '') + '</h4>' + UI.kv([
      ['Arredamento', eur(m.furnEur)],
      ['Lavori', eur(m.renoEur)],
      ['Spese extra', eur(m.extraEur)],
      ['Totale esborsi', '<b>' + eur(tot1) + '</b>', 'Al netto di sconti in fattura / cessioni del credito.'],
      ['Aumento costo fiscale', eur(m.capexBasisEur), 'Lavori e spese capitalizzate: riducono la plusvalenza imponibile.'],
      m.sbCessEur ? ['Superbonus con sconto/cessione', eur(m.sbCessEur), 'Regole speciali per il costo fiscale in caso di vendita entro 10 anni (L. 213/2023): vedi scheda Vendita.'] : null,
      U.ok(s.f.costSqm) ? ['Costo totale al m²', eur(s.f.costSqm)] : null
    ]);
    var ys = Object.keys(m.dedSched || {}).sort();
    if (ys.length) {
      var cy = new Date().getFullYear(), saleY = m.sold ? U.year(m.saleDate) : null;
      out += '<h4 class="sub-h">Piano detrazioni IRPEF</h4>' + UI.table([
        { label: 'Anno', render: function (y) { return y + (+y === cy ? ' <small class="muted">◂ oggi</small>' : ''); } },
        { label: 'Detrazione', cls: 'num', render: function (y) { return saleY && +y >= saleY ? '<s class="muted">' + eur(m.dedSched[y]) + '</s>' : eur(m.dedSched[y]); } }
      ], ys, { cls: 'tbl-sm', foot: ['Totale', '<b>' + eur(m.dedTotalEur) + '</b>'] });
      if (saleY) out += '<p class="muted small">Con la vendita le rate residue passano all\'acquirente (salvo diverso accordo nel rogito): quelle barrate non sono conteggiate.</p>';
      out += '<p class="muted small">La detrazione spetta solo fino a capienza dell\'IRPEF lorda di ciascun anno.</p>';
    }
    return out;
  };

  /* ---------- Mutui ---------- */
  var SUBTAX = { auto: 'Calcolo automatico', manuale: 'Importo manuale', nessuna: 'Non dovuta / non applicata' };
  TABS.mutui = function (s) {
    var p = s.p, P = s.P;
    var intro = UI.note('Inserisci i dati del contratto al 100% anche se il mutuo è cointestato: piano di ammortamento, debito residuo e rate dei prossimi 12 mesi sono calcolati automaticamente sulla tua quota. ' +
      'Per i mutui a tasso variabile aggiorna periodicamente il tasso; dopo estinzioni parziali, surroghe o rinegoziazioni indica il debito residuo attuale.', 'info');
    var rows = ED.list(s, 'loans', function (it, b) {
      var cur = it.currency || s.cur;
      return UI.grid([
        UI.text(p, b + '.label', 'Descrizione', { cls: 'span2', placeholder: 'es. Mutuo Banca X – tasso fisso' }),
        UI.select(p, b + '.currency', 'Valuta del mutuo', UI.currencyOptions(), { empty: 'Come l\'immobile (' + s.cur + ')', help: 'Cambiala solo se il mutuo è in una valuta diversa da quella dell\'immobile (es. mutuo in euro da banca italiana per un immobile all\'estero).' }),
        ED.amt(s, b + '.amount', 'Importo erogato', { cur: cur, dec: 0 }),
        UI.pct(p, b + '.ratePct', 'Tasso annuo nominale (TAN)', { dec: 3, help: 'Per i mutui variabili: indice (es. Euribor) + spread attuali.' }),
        UI.int(p, b + '.years', 'Durata (anni)', { min: 1, max: 50 }),
        UI.date(p, b + '.startDate', 'Data di erogazione', { help: 'Vuota = data di acquisto. La prima rata è considerata un mese dopo.' }),
        UI.select(p, b + '.method', 'Ammortamento', M.LOAN_METHODS),
        ED.amt(s, b + '.paymentOverride', 'Rata effettiva (facoltativa)', { cur: cur, dec: 2, help: 'Se la rata della banca è diversa da quella calcolata (spese di incasso, arrotondamenti) inseriscila qui. Vale per l\'ammortamento francese.' }),
        ED.amt(s, b + '.balanceOverride', 'Debito residuo oggi (facoltativo)', { cur: cur, dec: 0, help: 'Dal piano di ammortamento o dall\'estratto conto: utile dopo estinzioni parziali o rinegoziazioni. Le rate future vengono riproporzionate.' }),
        UI.select(p, b + '.substituteTaxMode', 'Imposta sostitutiva sul mutuo', SUBTAX, { help: s.isIT ? 'Trattenuta dalla banca all\'erogazione: ' + U.fmtNum(U.n(P.loanSubstitutePrimaCasa), 2) + '% (prima casa e immobili non abitativi) o ' + U.fmtNum(U.n(P.loanSubstituteOther), 2) + '% (altre abitazioni). È un costo di finanziamento.' : 'Imposta italiana: in automatico non si applica agli immobili esteri. Scegli "Importo manuale" se la banca italiana l\'ha trattenuta.' }),
        it.substituteTaxMode === 'manuale' ? ED.amt(s, b + '.substituteTax', 'Imposta sostitutiva pagata', { cur: cur, dec: 0 }) : null
      ], 4);
    }, { addLabel: 'Aggiungi mutuo', empty: 'Nessun mutuo: l\'acquisto risulta finanziato interamente con capitale proprio.' });
    var info = s.isIT ? UI.note('<b>Detrazione interessi</b>: per l\'abitazione principale spetta una detrazione IRPEF del ' + U.fmtNum(U.n(P.mortgageInterestDeductionPct), 0) + '% sugli interessi passivi fino a ' +
      U.fmtEur(U.n(P.mortgageInterestCap)) + ' annui (da ripartire tra i cointestatari del mutuo). Per gli immobili locati gli interessi non sono deducibili dal reddito fondiario né dalla cedolare.', 'info') :
      UI.note('Immobile estero: in Italia non spettano detrazioni sugli interessi. Alcuni Paesi ne consentono la deduzione dai canoni: indica in tal caso la base imponibile "netto" nella scheda Tasse.', 'info');
    var main = shareNote(s) + UI.card('Mutui e finanziamenti', intro + rows + info, { icon: 'lock', help: 'Ogni finanziamento legato all\'immobile: mutuo ipotecario, prestito per i lavori, finanziamento del venditore.' });
    return layout(main, side(s, 'mutui', 'Piano e indicatori', 'chart'));
  };

  CALC.mutui = function (s) {
    var m = s.m, f = s.f, L = m.loans || [], out = '';
    if (!L.length) return '<p class="muted small">Nessun mutuo completo: inserisci almeno importo, tasso e durata.</p>' + (m.equityInvestedEur ? UI.kv([['Capitale proprio investito', eur(m.equityInvestedEur)]]) : '');
    var byY = {}, ys = [], thisY = new Date().getFullYear();
    L.forEach(function (x, i) {
      var st = x.stats, lc = x.currency, k = m.share / x.rSvc, nm = U.esc(x.loan.label || ('Mutuo ' + (i + 1)));
      var mny = function (v, d) { return U.fmtMoney(v, lc, d == null ? 0 : d); };
      var withEur = function (v) { return lc === 'EUR' && m.share === 1 ? mny(v) : mny(v) + ' <small class="muted">≈ ' + eur(v * k) + (m.share < 1 ? ' quota' : '') + '</small>'; };
      out += '<h4 class="sub-h">' + nm + '</h4>' + UI.kv([
        ['Rata', mny(st.payment, 2) + (Math.abs(st.paymentNow - st.payment) > 0.5 && st.paymentNow ? ' → ora ' + mny(st.paymentNow, 2) : '') + ' <small class="muted">/mese</small>'],
        ['Rate pagate', st.paidInstallments + ' di ' + st.N + (st.remainingMonths ? ' <small class="muted">(' + U.fmtYears(st.remainingMonths / 12) + ' residui)</small>' : '')],
        ['Debito residuo', '<b>' + withEur(st.balanceNow) + '</b>' + (m.sold ? ' <small class="muted">(estinto alla vendita)</small>' : '')],
        ['Ultima rata', U.fmtDate(st.end)],
        ['Interessi totali', mny(st.totalInterest) + ' <small class="muted">(' + pct(st.amount ? st.totalInterest / st.amount : null, 0) + ' del capitale)</small>'],
        st.prepaid > 0.5 ? ['Rimborsi anticipati', mny(st.prepaid), 'Differenza tra debito residuo teorico e quello indicato.'] : null,
        x.subTaxEur ? ['Imposta sostitutiva', eur(x.subTaxEur)] : null,
        ['Prossimi 12 mesi', eur(x.ds12.pay) + ' <small class="muted">di cui interessi ' + eur(x.ds12.int) + '</small>']
      ]);
      var yr = st.yearly();
      yr.forEach(function (r) {
        if (!byY[r.year]) { byY[r.year] = { b: 0 }; ys.push(r.year); }
        byY[r.year].b += r.balance * k;
      });
      out += UI.details('Piano di ammortamento annuale', UI.table([
        { label: 'Anno', render: function (r) { return r.year === thisY ? '<b>' + r.year + '</b>' : String(r.year); } },
        { label: 'Rate', cls: 'num', render: function (r) { return U.fmtNum(r.pay, 0); } },
        { label: 'Interessi', cls: 'num', render: function (r) { return U.fmtNum(r.int, 0); } },
        { label: 'Capitale', cls: 'num', render: function (r) { return U.fmtNum(r.prin, 0); } },
        { label: 'Residuo', cls: 'num', render: function (r) { return U.fmtNum(r.balance, 0); } }
      ], yr, { cls: 'tbl-sm', foot: ['Totale', U.fmtNum(st.totalPaid, 0), U.fmtNum(st.totalInterest, 0), U.fmtNum(st.amount, 0), ''] }) +
        '<p class="muted small">Importi in ' + U.esc(lc) + ' al 100%.</p>', false, 'det-sm');
    });
    ys.sort(function (a, b) { return a - b; });
    if (ys.length > 1) {
      out += '<h4 class="sub-h">Debito residuo a fine anno' + (m.share < 1 ? ' (quota)' : '') + '</h4>' +
        CH.line({ labels: ys.map(String), series: [{ name: 'Debito residuo', values: ys.map(function (y) { return byY[y].b; }), area: true }] }, { height: 150 });
    }
    out += '<h4 class="sub-h">Totale finanziamenti' + (m.share < 1 ? ' (tua quota, EUR)' : ' (EUR)') + '</h4>' + UI.kv([
      ['Erogato', eur(m.loanInEur)],
      ['Debito residuo', '<b>' + eur(m.debtEur) + '</b>'],
      ['Rate prossimi 12 mesi', eur(m.ds.pay) + ' <small class="muted">(' + eur(m.ds.pay / 12) + '/mese)</small>'],
      ['di cui interessi', eur(m.ds.int)],
      ['di cui capitale', eur(m.ds.prin)],
      m.subTaxEur ? ['Imposte sostitutive', eur(m.subTaxEur)] : null,
      f.mortDed ? ['Detrazione interessi', eur(f.mortDed) + ' /anno'] : null,
      ['LTV (debito / valore)', pct(f.ltv, 0), 'Sopra l\'80% il rischio di rifinanziamento e la sensibilità ai prezzi sono elevati.'],
      ['LTC (finanziato / costo)', pct(f.ltc, 0), 'Quota del costo totale coperta da debito: misura la leva finanziaria.'],
      U.ok(f.dscr) ? ['DSCR', U.fmtNum(f.dscr, 2) + '×', 'Reddito operativo netto / rate annue. Le banche chiedono di solito almeno 1,2×.'] : null
    ]);
    return out;
  };

  /* ---------- Locazione ---------- */
  var REGIMES = { cedolare: 'Cedolare secca', ordinaria: 'IRPEF ordinaria' };
  TABS.locazione = function (s) {
    var p = s.p, P = s.P, D = s.S.defaults || {}, rented = M.isRented(p), short = M.isShort(p);
    var use = UI.grid([UI.select(p, 'usage', 'Destinazione d\'uso', M.USAGE, { help: 'Determina tassazione, IMU e rendimenti. Si può modificare anche dalla scheda Generale.' })], 3);
    if (!rented) {
      /* L'affitto figurativo conta solo per gli immobili usati dal proprietario (vedi CALC: imputedEur) */
      var ownUse = p.usage === 'abitazione_principale' || p.usage === 'seconda_casa' || p.usage === 'uso_proprio';
      var body = use + UI.note('L\'immobile non risulta locato. Per inserire un contratto scegli "Affitto lungo termine", "Affitto breve / turistico" o "Locazione commerciale".', 'info') +
        (ownUse ? UI.grid([amtPer(s, 'rental.imputedRentMonthly', 'Affitto figurativo', 'mese', { dec: 0, help: 'Facoltativo: l\'affitto che pagheresti per un immobile equivalente (quanto risparmi abitandoci). Entra nel ROI come beneficio di godimento, non negli incassi né nelle imposte.' })], 3) : '');
      return layout(shareNote(s) + UI.card('Utilizzo dell\'immobile', body, { icon: 'home' }), side(s, 'locazione', 'Redditività', 'chart'));
    }
    var contract = [
      UI.select(p, 'rental.contractType', 'Tipo di contratto', M.CONTRACTS),
      short ? amtPer(s, 'rental.nightlyRate', 'Tariffa media', 'notte', { dec: 0, help: 'Prezzo medio per notte incassato (al netto di eventuali sconti), escluse le pulizie addebitate a parte.' }) :
        amtPer(s, 'rental.monthlyRent', 'Canone', 'mese', { dec: 0, help: 'Canone pattuito al 100%, esclusi i rimborsi delle spese condominiali.' }),
      short ? UI.pct(p, 'rental.occupancyPct', 'Tasso di occupazione', { placeholder: '60', help: 'Percentuale delle notti dell\'anno effettivamente prenotate.' }) :
        UI.pct(p, 'rental.vacancyPct', 'Sfitto e morosità', { placeholder: U.fmtNum(U.n(D.vacancyPct), 0), help: 'Percentuale dell\'anno senza incasso (cambio inquilino, insoluti). Vuoto = valore predefinito delle Impostazioni.' }),
      UI.date(p, 'rental.startDate', short ? 'Inizio attività' : 'Decorrenza contratto'),
      short ? null : UI.date(p, 'rental.endDate', 'Scadenza contratto', { help: 'Compare nelle Scadenze. Disdetta del locatore: almeno 6 mesi prima (abitativo) o 12 mesi (commerciale).' }),
      UI.date(p, 'rental.incomeSince', 'Incassi conteggiati dal', { help: 'Per lo storico del ROI: data da cui l\'immobile produce reddito. Vuota = data di acquisto.' }),
      short ? null : ED.amt(s, 'rental.deposit', 'Deposito cauzionale', { dec: 0, help: 'Non è un reddito: va restituito a fine contratto (massimo 3 mensilità per le abitazioni).' }),
      UI.text(p, 'rental.tenant', short ? 'Gestione / piattaforme' : 'Inquilino', { placeholder: short ? 'es. Airbnb + Booking, gestione diretta' : 'Nome o ragione sociale' }),
      short && s.isIT ? UI.text(p, 'rental.cin', 'CIN', { placeholder: 'es. IT015146C2ABCDEF12', help: 'Codice Identificativo Nazionale: obbligatorio per locazioni brevi e turistiche, da esporre all\'esterno e negli annunci.' }) : null
    ];
    var tax;
    if (s.isIT) {
      tax = UI.grid([
        UI.select(p, 'rental.taxRegime', 'Regime fiscale', REGIMES, { help: 'Cedolare secca: imposta fissa sul canone lordo, senza addizionali, registro e bollo. IRPEF ordinaria: il canone ridotto del ' + U.fmtNum(U.n(P.irpefFlatRentDeduction), 0) + '% si somma agli altri redditi.' }),
        short ? null : UI.bool(p, 'rental.concordato', 'Canone concordato', { help: 'Contratto a canone concordato in un Comune ad alta tensione abitativa: cedolare ' + U.fmtNum(U.n(P.cedolareConcordato), 0) + '%, base IRPEF ridotta del ' + U.fmtNum(U.n(P.concordatoBaseReduction), 0) + '%, IMU ridotta del 25%.' }),
        short ? UI.bool(p, 'rental.breveAliquotaAgevolata', 'Aliquota agevolata su questo immobile', { help: 'Per le locazioni brevi la cedolare è al ' + U.fmtNum(U.n(P.cedolareBreveDalSecondo), 0) + '%, ridotta al ' + U.fmtNum(U.n(P.cedolare), 0) + '% per un solo immobile a scelta. Oltre ' + U.fmtNum(U.n(P.maxShortTermUnits), 0) + ' immobili in affitto breve l\'attività si presume imprenditoriale.' }) : null
      ], 3) + UI.note('Le imposte sono stimate sulla tua quota con l\'aliquota IRPEF marginale ricavata dal profilo fiscale (Impostazioni). Con la cedolare non sono dovute imposta di registro e bollo sul contratto; in regime ordinario il registro annuo (2%, metà a carico del locatore) è conteggiato tra le imposte sull\'immobile.', 'info');
    } else {
      tax = UI.note('Immobile estero: il canone è tassato nel Paese dell\'immobile e, da residente fiscale italiano, va dichiarato anche in Italia (quadro RL) con credito per le imposte pagate all\'estero (art. 165 TUIR). Se il Paese estero non lo tassa, in Italia si dichiara il canone ridotto del ' +
        U.fmtNum(U.ok(P.foreignRentForfait) ? U.n(P.foreignRentForfait) : 15, 0) + '%. La cedolare secca non è applicabile. Aliquota e base imponibile estere si impostano nella scheda Tasse.', 'info');
    }
    var main = shareNote(s) + UI.card('Contratto e canone', use + UI.grid(contract, 4), { icon: 'calendar' }) + UI.card('Tassazione del canone', tax, { icon: 'file' });
    return layout(main, side(s, 'locazione', 'Redditività', 'chart'));
  };

  CALC.locazione = function (s) {
    var m = s.m, f = s.f, c = m.cmp || {}, out = '';
    var mkt = [
      c.rent && c.rent.n ? ['Mediana annunci di affitto (' + c.rent.n + ')', loc(s, c.rent.med, 2) + ' /m² mese'] : null,
      c.estRent ? ['Canone di mercato stimato', loc(s, c.estRent) + ' /mese'] : null,
      c.omiRentMid ? ['Canone OMI medio', loc(s, c.omiRentMid, 2) + ' /m² mese'] : null,
      U.ok(c.rentGapPct) ? ['Il tuo canone vs mercato', '<span class="' + (c.rentGapPct < 0 ? 'neg' : 'pos') + '">' + (c.rentGapPct > 0 ? '+' : '') + pct(c.rentGapPct, 0) + '</span>'] : null
    ];
    var mktHtml = mkt.some(function (x) { return x; }) ? '<h4 class="sub-h">Confronto con il mercato</h4>' + UI.kv(mkt) : '';
    if (!m.rented) {
      return UI.kv([
        ['Affitto figurativo', m.imputedEur ? eur(m.imputedEur) + ' /anno' : '—', 'Beneficio di godimento incluso nel ROI (non è un incasso e non è tassato).'],
        m.imputedEur && U.ok(f.capRate) ? ['Rendimento figurativo sul valore', pct(f.capRate)] : null
      ]) + mktHtml + '<p class="muted small">Immobile non locato: nessun reddito da locazione.</p>';
    }
    var pot = m.grossPotL, occ = pot > 0 ? m.grossL / pot : null;
    out += '<h4 class="sub-h">Incassi annui</h4>' + UI.kv([
      [m.short ? 'Potenziale (365 notti)' : 'Canone annuo pieno', le(s, pot, m.grossPotEur)],
      [m.short ? 'Occupazione' : 'Sfitto / morosità', m.short ? pct(occ, 0) : pct(occ == null ? null : 1 - occ, 1)],
      ['Incasso atteso', '<b>' + le(s, m.grossL, m.grossEur) + '</b>'],
      ['Media mensile', eur(m.grossEur / 12)]
    ]);
    var tx = [];
    if (f.cedRate != null) tx.push(['Cedolare secca ' + U.fmtNum(f.cedRate, 0) + '%', eur(f.cedTax), 'Sul canone lordo di ' + eur(m.cedBaseEur) + ', senza deduzioni.']);
    if (f.irBase > 0) {
      tx.push(['Reddito imponibile IRPEF', eur(f.irBase), s.isIT ? 'Maggiore tra canone ridotto forfettariamente e rendita catastale rivalutata.' : 'Reddito estero dichiarato in Italia.']);
      tx.push(['IRPEF (aliquota incrementale)', eur(f.irpef)]);
      tx.push(['Addizionali regionale e comunale', eur(f.add)]);
    }
    if (f.foreignTax) tx.push(['Imposte estere sul canone', eur(f.foreignTax)]);
    if (f.ftc) tx.push(['Credito per imposte estere', '−' + eur(f.ftc), 'Art. 165 TUIR: nei limiti dell\'IRPEF italiana sul reddito estero.']);
    tx.push(['Imposte sul reddito', '<b>' + eur(f.incomeTax) + '</b>']);
    if (m.regEur) tx.push(['Registro del contratto', eur(m.regEur), 'Incluso nelle imposte sull\'immobile (scheda Tasse).']);
    out += '<h4 class="sub-h">Imposte' + (m.share < 1 ? ' (tua quota)' : '') + '</h4>' + UI.kv(tx);
    out += '<h4 class="sub-h">Redditività</h4>' + UI.kv([
      ['Reddito operativo netto (NOI)', eur(f.noiCash), 'Incassi − costi ricorrenti − imposte sull\'immobile, prima di mutuo e imposte sul reddito.'],
      ['Flusso di cassa netto', '<b class="' + UI.cls(f.cfPost) + '">' + eur(f.cfPost) + '</b> <small class="muted">(' + eur(f.cfMonthly) + '/mese)</small>', 'Dopo rate del mutuo, imposte sul reddito e detrazioni.'],
      ['Rendimento lordo', pct(f.grossYield), 'Canone annuo / prezzo di acquisto.'],
      ['Lordo sul costo totale', pct(f.grossYieldInv), 'Canone annuo / costo totale (prezzo, oneri, lavori, arredi).'],
      ['Rendimento netto', pct(f.netYield), '(NOI − imposte sul reddito) / costo totale.'],
      ['Cap rate', pct(f.capRate), 'NOI / valore di mercato attuale.'],
      U.ok(f.coc) ? ['Cash on cash', pct(f.coc), 'Flusso di cassa netto / capitale proprio investito.'] : null,
      U.ok(f.breakEven) ? ['Punto di pareggio', pct(f.breakEven, 0), 'Occupazione minima per coprire costi, imposte sull\'immobile e rate.'] : null,
      U.ok(f.grm) ? ['Moltiplicatore del canone', U.fmtNum(f.grm, 1) + '×', 'Valore / canone annuo lordo.'] : null,
      U.ok(f.payback) ? ['Rientro del capitale proprio', U.fmtYears(f.payback)] : null,
      U.ok(f.rentSqm) ? ['Canone al m²', loc(s, f.rentSqm, 2) + ' /mese'] : null
    ]);
    return out + mktHtml;
  };

  /* ---------- Registro movimenti ---------- */
  var KINDS = { entrata: 'Entrata', uscita: 'Uscita' };
  TABS.registro = function (s) {
    var p = s.p;
    var intro = UI.note('Registra gli incassi e le spese effettivi della gestione (affitti, bollette, condominio, riparazioni, imposte pagate...) per confrontarli con le stime. ' +
      'Rendimenti e ROI usano le stime delle schede Spese, Locazione e Tasse; acquisto, arredi e lavori vanno nelle rispettive schede.', 'info');
    var rows = ED.list(s, 'ledger', function (it, b) {
      return UI.grid([
        UI.date(p, b + '.date', 'Data'),
        UI.select(p, b + '.kind', 'Tipo', KINDS),
        UI.text(p, b + '.category', 'Categoria', { list: 'dl-ledger-cats' }),
        ED.amt(s, b + '.amount', 'Importo', { dec: 2 }),
        UI.text(p, b + '.description', 'Descrizione', { cls: 'span2', placeholder: 'es. Affitto marzo, bolletta luce' })
      ], 6);
    }, {
      addLabel: 'Aggiungi movimento', empty: 'Nessun movimento registrato.',
      extra: UI.btn('Genera 12 mesi di affitto', { cls: 'btn-sm', icon: 'calendar', act: 'ledger-rent', title: 'Aggiunge 12 incassi mensili pari al canone' }) +
        UI.btn('Ordina per data', { cls: 'btn-sm', icon: 'sort', act: 'ledger-sort' })
    });
    var main = shareNote(s) + UI.card('Movimenti reali', intro + rows + UI.datalist('dl-ledger-cats', M.LEDGER_CATS), { icon: 'list' });
    return layout(main, side(s, 'registro', 'Riepilogo movimenti', 'chart'));
  };

  ACT['ledger-rent'] = function () {
    var p = ED.get();
    if (!p) return;
    var amt = U.n(p.rental && p.rental.monthlyRent);
    if (!(amt > 0)) { U.toast('Indica prima il canone mensile nella scheda Locazione.', 'warn'); return; }
    if ((p.ledger || []).length + 12 > 500) { U.toast('Limite di 500 movimenti raggiunto.', 'warn'); return; }
    var d = new Date(), first = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-01', id = p.id;
    U.prompt('Genera incassi di affitto', 'Data del primo incasso', first, 'date').then(function (v) {
      if (!v || !U.validDate(v)) return;
      ED.withProp(id, function (x) {
        if (!Array.isArray(x.ledger)) x.ledger = [];
        for (var i = 0; i < 12; i++) {
          var dt = U.addMonths(v, i), e = M.newLedger();
          e.date = dt; e.kind = 'entrata'; e.category = 'Affitto'; e.amount = amt;
          e.description = 'Affitto ' + new Date(dt + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
          x.ledger.push(e);
        }
      });
      U.toast('Aggiunti 12 incassi di affitto.', 'success');
    });
  };
  ACT['ledger-sort'] = function () {
    var p = ED.get();
    if (!p || !(p.ledger || []).length) return;
    ED.withProp(p.id, function (x) { x.ledger = sortDates(x.ledger.map(function (e) { if (!e.date) e.date = ''; return e; })); });
  };

  CALC.registro = function (s) {
    var m = s.m, r = m.real || {}, f = s.f, out = '';
    if (!r.n) return '<p class="muted small">Nessun movimento con data e importo validi.</p>';
    out += '<h4 class="sub-h">Ultimi 12 mesi' + (m.share < 1 ? ' (tua quota)' : '') + '</h4>' + UI.kv([
      ['Entrate', eur(r.in12)],
      ['Uscite', eur(r.out12)],
      ['Saldo', '<b class="' + UI.cls(r.in12 - r.out12) + '">' + eur(r.in12 - r.out12) + '</b>'],
      m.rented || m.opexEur ? ['Stima (flusso prima del mutuo)', eur(f.noiCash), 'NOI stimato dai dati delle schede: confrontalo con il saldo reale (che può includere rate e imposte).'] : null
    ]);
    var ys = Object.keys(r.byYear).sort();
    out += '<h4 class="sub-h">Per anno</h4>' + UI.table([
      { label: 'Anno', render: function (y) { return y; } },
      { label: 'Entrate', cls: 'num', render: function (y) { return eur(r.byYear[y].entrate); } },
      { label: 'Uscite', cls: 'num', render: function (y) { return eur(r.byYear[y].uscite); } },
      { label: 'Saldo', cls: 'num', render: function (y) { var v = r.byYear[y].entrate - r.byYear[y].uscite; return '<span class="' + UI.cls(v) + '">' + eur(v) + '</span>'; } }
    ], ys, { cls: 'tbl-sm', foot: ['Totale', eur(r.inTot), eur(r.outTot), '<b>' + eur(r.inTot - r.outTot) + '</b>'] });
    if (ys.length > 1) {
      out += CH.bar({ labels: ys, series: [
        { name: 'Entrate', values: ys.map(function (y) { return r.byYear[y].entrate; }), color: 'var(--ok)' },
        { name: 'Uscite', values: ys.map(function (y) { return -r.byYear[y].uscite; }), color: 'var(--bad)' }
      ] }, { height: 150, legend: true });
    }
    var cats = {};
    ((s.p.ledger) || []).forEach(function (e) {
      if (!e || !U.validDate(e.date) || !(U.n(e.amount) > 0)) return;
      var k = (e.kind === 'entrata' ? '+ ' : '− ') + (e.category || 'Altro');
      cats[k] = (cats[k] || 0) + U.n(e.amount) / m.rOp * m.share;
    });
    var ck = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });
    if (ck.length) out += '<h4 class="sub-h">Per categoria (totale)</h4>' + UI.kv(ck.map(function (k) { return [U.esc(k), eur(cats[k])]; }));
    return out;
  };

  /* ---------- Tasse ---------- */
  var IMU_MODES = { auto: 'Calcolo automatico', manuale: 'Importo manuale', esente: 'Esente' };
  var IVIE_BASES = { auto: 'Automatica (catastale se UE/SEE, altrimenti costo)', catastale: 'Valore catastale estero', costo: 'Costo d\'acquisto da atto', mercato: 'Valore di mercato' };
  var RENT_BASE_L = { lordo: 'canone lordo', netto: 'canone netto (dopo spese e interessi)', pct: 'percentuale del lordo' };
  function pnum(x, d) { return U.has(x) && isFinite(+x) ? U.fmtNum(+x, d == null ? 2 : d) + '%' : '—'; }

  TABS.tasse = function (s) {
    var p = s.p, P = s.P, m = s.m, t = p.taxesIT || {}, main = shareNote(s);
    var otherIT = function (title) {
      return '<h4 class="sub-h">' + title + '</h4>' + ED.list(s, 'taxesIT.other', function (it, b) {
        return UI.grid([
          UI.text(p, b + '.label', 'Descrizione', { cls: 'span2', placeholder: s.isIT ? 'es. Consorzio di bonifica, passo carrabile, TOSAP' : 'es. Commercialista per quadro RW, traduzioni' }),
          ED.eur(s, b + '.amount', 'Importo', { dec: 0 }),
          UI.select(p, b + '.freq', 'Frequenza', M.FREQ)
        ], 4);
      }, { addLabel: 'Aggiungi voce', empty: 'Nessuna altra voce.' });
    };
    if (s.isIT) {
      var mode = t.imuMode || 'auto', isMain = p.usage === 'abitazione_principale';
      var imu = [UI.select(p, 'taxesIT.imuMode', 'IMU', IMU_MODES, { help: 'Automatico: rendita catastale × 1,05 × moltiplicatore (160 per le abitazioni) × aliquota comunale. L\'abitazione principale non di lusso è esente.' })];
      if (mode === 'manuale') imu.push(ED.eur(s, 'taxesIT.imuManual', 'IMU annua (100%)', { dec: 0, help: 'Totale annuo (acconto + saldo) riferito all\'intero immobile.' }));
      if (mode === 'auto') {
        imu.push(UI.pct(p, 'taxesIT.imuRatePct', 'Aliquota comunale', { dec: 2, placeholder: U.fmtNum(U.n(isMain ? P.imuMainLuxRate : P.imuRate), 2),
          help: 'Aliquota deliberata dal Comune (cerca "aliquote IMU" e il nome del Comune sul sito del Dipartimento delle Finanze). Vuoto = aliquota predefinita delle Impostazioni.' }));
        imu.push(ED.eur(s, 'taxesIT.imuBaseManual', 'Base imponibile manuale', { dec: 0, placeholder: 'dalla rendita catastale', help: 'Lascia vuoto per calcolarla dalle rendite della scheda Catasto. Per i terreni edificabili: valore venale.' }));
      }
      var red = UI.grid([
        UI.bool(p, 'taxesIT.comodato', 'Comodato a parenti in linea retta', { help: 'Riduzione della base IMU del ' + U.fmtNum(U.n(P.imuComodatoReduction), 0) + '% (contratto registrato, comodatario residente; requisiti dell\'art. 1, c. 747, L. 160/2019).' }),
        UI.bool(p, 'taxesIT.storicoInagibile', 'Immobile storico o inagibile', { help: 'Riduzione della base IMU del ' + U.fmtNum(U.n(P.imuInagibileReduction), 0) + '%.' })
      ], 2);
      var itHtml = UI.grid(imu, 3) + red +
        (p.usage === 'locazione_lunga' && (p.rental.concordato || p.rental.contractType === 'concordato_3_2' || p.rental.contractType === 'studenti') ? UI.note('Canone concordato: IMU ridotta del ' + U.fmtNum(U.n(P.imuConcordatoReduction), 0) + '%.', 'info') : '') +
        otherIT('Altri tributi locali') +
        '<p class="muted small">TARI e consorzi pagati come utenze vanno nella scheda Spese. Le imposte sui canoni si impostano nella scheda Locazione (cedolare secca o IRPEF).</p>';
      main += UI.card('Imposte italiane sull\'immobile', itHtml, { icon: 'file' });
    } else {
      var pre = m.pre || {}, rented = m.rented, cname = U.esc(K.name(p.country)), vb = m.valueL || m.acqL.price;
      var est = function (k) { return U.n(pre[k]) > 0 && vb ? 'stima ' + U.fmtNum(vb * U.n(pre[k]) / 100, 0) : (U.n(pre[k]) > 0 ? 'stima da preset' : ''); };
      var loc1 = UI.grid([
        ED.amt(s, 'taxesForeign.propertyTaxAnnual', 'Imposta immobiliare locale (anno)', { dec: 0, placeholder: est('ptax'),
          help: 'Es. IBI (Spagna), taxe foncière (Francia), IMI (Portogallo), Grundsteuer (Germania), council tax (Regno Unito), property tax (USA). Importo annuo al 100%; vuoto = stima ' + pnum(pre.ptax) + ' del valore.' }),
        UI.bool(p, 'taxesForeign.propertyTaxCreditable', 'Scomputabile dall\'IVIE', { help: 'Le imposte patrimoniali pagate all\'estero sull\'immobile si detraggono dall\'IVIE fino a concorrenza.' }),
        ED.amt(s, 'taxesForeign.wealthTaxAnnual', 'Imposta patrimoniale estera (anno)', { dec: 0, placeholder: est('wealthPct'), help: 'Imposta sul patrimonio dovuta nel Paese per la quota dell\'immobile (sempre scomputabile dall\'IVIE).' }),
        !rented ? ED.amt(s, 'taxesForeign.imputedTaxAnnual', 'Imposta su reddito figurativo (anno)', { dec: 0, placeholder: est('imputedPct'),
          help: 'Imposta che alcuni Paesi applicano anche agli immobili non locati (es. Spagna: IRNR sul reddito figurativo pari all\'1,1-2% del valore catastale).' }) : null,
        ED.amt(s, 'taxesForeign.otherAnnual', 'Altre imposte estere (anno)', { dec: 0, help: 'Imposte non scomputabili dall\'IVIE (es. tasse locali sui servizi).' })
      ], 3);
      var rentHtml = rented ? UI.grid([
        UI.pct(p, 'taxesForeign.rentalTaxPct', 'Aliquota estera sui canoni', { dec: 2, placeholder: U.has(pre.rentTax) ? U.fmtNum(U.n(pre.rentTax), 2) : '', help: 'Imposta pagata nel Paese dell\'immobile sui canoni dei non residenti. Vuoto = preset del Paese.' }),
        UI.select(p, 'taxesForeign.rentalTaxBase', 'Base imponibile estera', { auto: 'Preset del Paese (' + lab(RENT_BASE_L, pre.rentBase || 'lordo') + ')', lordo: 'Canone lordo', netto: 'Canone netto (dopo spese e interessi)', pct: 'Percentuale del lordo (preset)' }),
        ED.amt(s, 'taxesForeign.foreignTaxableIncome', 'Imponibile estero effettivo (anno)', { dec: 0, help: 'Se conosci l\'imponibile dichiarato all\'estero (100%), sostituisce la stima. In Italia lo stesso importo concorre all\'IRPEF.' })
      ], 3) : '<p class="muted small">Immobile non locato: nessuna imposta estera sui canoni.</p>';
      var ivHtml = UI.grid([
        UI.select(p, 'taxesForeign.ivieBase', 'Base IVIE', IVIE_BASES, { help: 'Valore catastale estero per gli immobili in UE/SEE; altrimenti costo risultante dall\'atto o, in mancanza, valore di mercato.' }),
        ED.eur(s, 'taxesForeign.ivieValueOverride', 'Base IVIE manuale (100%)', { dec: 0, placeholder: 'calcolata', help: 'Valore in euro da usare come base: sostituisce il calcolo.' }),
        UI.bool(p, 'taxesForeign.foreignMainHome', 'Abitazione principale all\'estero', { help: 'IVIE non dovuta se non di lusso; per quelle di lusso aliquota ridotta e detrazione.' })
      ], 3);
      var cgHtml = UI.grid([
        UI.pct(p, 'taxesForeign.cgtPct', 'Aliquota estera sulla plusvalenza', { dec: 2, placeholder: U.has(pre.cgt) ? U.fmtNum(U.n(pre.cgt), 2) : '',
          help: 'Vuoto = regole del preset del Paese (aliquote, riduzioni per anni di possesso, imposte sul prezzo). L\'imposta effettivamente pagata si indica nella scheda Vendita.' })
      ], 3);
      var info = (pre.info ? UI.note('<b>' + cname + ':</b> ' + U.esc(pre.info) + ' <i>Valori indicativi da verificare.</i>', 'info') : UI.note('Nessun preset fiscale per ' + cname + ': inserisci gli importi effettivi (le stime sono a zero).', 'warn')) +
        (pre.warn ? UI.note(U.esc(pre.warn), 'warn') : '');
      main += UI.card('Imposte nel Paese dell\'immobile', info + loc1, { icon: 'globe' }) +
        UI.card('Redditi da locazione all\'estero', rentHtml, { icon: 'calendar' }) +
        UI.card('Italia: IVIE e quadro RW', ivHtml + UI.note('Con residenza fiscale italiana l\'immobile estero va indicato nel <b>quadro RW</b> della dichiarazione, con l\'<b>IVIE</b> (' + pnum(P.ivieRate) + ' annuo del valore). ' +
          'I canoni concorrono al reddito IRPEF; le imposte pagate all\'estero danno diritto al <b>credito d\'imposta</b> (art. 165 TUIR), nei limiti dell\'IRPEF italiana sullo stesso reddito. ' +
          'Gli immobili esteri non locati soggetti a IVIE non scontano IRPEF in Italia.', 'info'), { icon: 'flag' }) +
        UI.card('Plusvalenza all\'estero', cgHtml, { icon: 'shop' }) +
        UI.card('Altri oneri fiscali in Italia', otherIT('Voci in euro'), { icon: 'list' });
    }
    return layout(main, side(s, 'tasse', 'Carico fiscale annuo', 'chart'));
  };

  CALC.tasse = function (s) {
    var m = s.m, f = s.f, P = s.P, out = '', q = m.share < 1 ? ' (tua quota)' : '';
    var rows = (m.taxItems || []).map(function (t) { return [U.esc(t.label), eur(t.eur), !s.isIT && t.creditable ? 'Scomputabile dall\'IVIE.' : '']; });
    if (m.ivie) rows.push(['IVIE (al netto dei crediti)', eur(f.ivieTax)]);
    rows.push(['Totale', '<b>' + eur(f.propTax) + '</b>']);
    out += '<h4 class="sub-h">Imposte sull\'immobile' + q + '</h4>' + UI.kv(rows);
    if (s.isIT) {
      var im = m.imu || {};
      out += '<h4 class="sub-h">IMU</h4>' + UI.kv([
        im.base ? ['Base imponibile', eur(im.base)] : null,
        im.rate ? ['Aliquota', U.fmtNum(im.rate * 100, 2) + '%'] : null,
        ['IMU annua (100%)', eur(im.amount)],
        m.share < 1 ? ['Tua quota', eur(m.imuEur)] : null,
        m.imuEur > 0 ? ['Acconto 16/6 + saldo 16/12', eur(m.imuEur / 2) + ' + ' + eur(m.imuEur / 2)] : null
      ]) + (im.note ? '<p class="muted small">' + U.esc(im.note) + '</p>' : '');
    }
    if (m.ivie) {
      var iv = m.ivie, thr = U.n(P.ivieThreshold);
      out += '<h4 class="sub-h">IVIE' + q + '</h4>' + UI.kv([
        ['Base', iv.base ? eur(iv.base) : '—', iv.src ? 'Fonte: ' + iv.src + '.' : ''],
        ['Imposta lorda', eur(iv.gross)],
        ['Crediti per imposte estere', iv.credit ? '−' + eur(iv.credit) : eur(0)],
        ['IVIE dovuta', '<b>' + eur(f.ivieTax) + '</b>']
      ]) + (iv.note ? '<p class="muted small">' + U.esc(iv.note) + '.</p>' : '') +
        (!f.ivieTax && iv.gross > iv.credit ? '<p class="muted small">Non dovuta: importo non superiore a ' + eur(thr) + (P.ivieThresholdMode === 'totale' ? ' sul totale degli immobili esteri' : '') + '.</p>' : '');
    }
    var it = [];
    if (f.cedRate != null) it.push(['Cedolare secca ' + U.fmtNum(f.cedRate, 0) + '%', eur(f.cedTax)]);
    if (f.irBase > 0) {
      it.push(['Reddito imponibile IRPEF', eur(f.irBase)]);
      it.push(['IRPEF + addizionali', eur(f.irpef + f.add), 'Aliquota media sul reddito aggiuntivo, considerando gli altri redditi del profilo (Impostazioni).']);
    }
    if (f.foreignTax) it.push(['Imposte estere sui canoni', eur(f.foreignTax)]);
    if (f.ftc) it.push(['Credito d\'imposta (art. 165 TUIR)', '−' + eur(f.ftc)]);
    if (it.length) out += '<h4 class="sub-h">Imposte sui redditi' + q + '</h4>' + UI.kv(it.concat([['Totale', '<b>' + eur(f.incomeTax) + '</b>']]));
    var net = f.taxTotal - f.mortDed - f.ded;
    out += '<h4 class="sub-h">Carico fiscale annuo</h4>' + UI.kv([
      ['Imposte sull\'immobile', eur(f.propTax)],
      ['Imposte sui redditi', eur(f.incomeTax)],
      f.mortDed ? ['Detrazione interessi mutuo (' + U.fmtNum(U.n(P.mortgageInterestDeductionPct), 0) + '%)', '−' + eur(f.mortDed)] : null,
      f.ded ? ['Detrazioni lavori ' + U.year(m.asOf), '−' + eur(f.ded)] : null,
      ['Totale netto', '<b>' + eur(net) + '</b> <small class="muted">(' + eur(net / 12) + '/mese)</small>'],
      m.grossEur > 0 ? ['Incidenza sugli incassi', pct(net / m.grossEur, 1)] : null,
      m.valueEur > 0 ? ['Incidenza sul valore', pct(net / m.valueEur, 2)] : null
    ]);
    return out;
  };

  /* ---------- Vendita ---------- */
  function cgLabel(cg, P) {
    if (!cg) return '—';
    if (!cg.ruleTaxable) return '<span class="pos">Esente</span> <small class="muted">' + U.esc(cg.reason) + '</small>';
    if (!cg.taxable) return 'Nessuna imposta <small class="muted">(minusvalenza, non deducibile)</small>';
    return (cg.regime === 'sostitutiva' ? 'Imposta sostitutiva ' + U.fmtNum(U.n(P.cgtSubstitute), 0) + '%' : 'IRPEF ordinaria') + ' <small class="muted">' + U.esc(cg.reason) + '</small>';
  }
  function cgRows(s, cg) {
    var P = s.P, r = [
      ['Costo fiscale riconosciuto', eur(cg.basisEur), 'Prezzo + oneri accessori + lavori incrementativi documentati (Superbonus con regole speciali).'],
      ['Plusvalenza', '<b class="' + UI.cls(cg.gainEur) + '">' + eur(cg.gainEur) + '</b>' + (s.foreign && U.ok(cg.gainL) ? ' <small class="muted">(' + loc(s, cg.gainL) + ' in valuta, 100%)</small>' : '')],
      ['Tassazione in Italia', cgLabel(cg, P)]
    ];
    if (cg.taxable && s.isIT) r.push(['Confronto regimi', 'sostitutiva ' + eur(cg.sostEur) + ' · ordinaria ' + eur(cg.ordEur), 'L\'imposta sostitutiva si chiede al notaio al rogito; altrimenti la plusvalenza va in dichiarazione a tassazione IRPEF ordinaria.']);
    if (cg.taxable && !s.isIT) r.push(['IRPEF sulla plusvalenza', eur(cg.itTaxEur)]);
    if (!s.isIT) {
      r.push(['Imposta estera', eur(cg.foreignCgtEur)]);
      if (cg.creditEur) r.push(['Credito d\'imposta (art. 165 TUIR)', '−' + eur(cg.creditEur)]);
    }
    r.push(['Imposte totali sulla vendita', '<b>' + eur(cg.tax) + '</b>']);
    return r;
  }
  function resultRows(o) {
    return [
      ['Capitale proprio investito', eur(o.invested), 'Esborsi netti di tasca propria: prezzo e costi non coperti dal mutuo, rate, spese, imposte.'],
      ['Utile complessivo', '<b class="' + UI.cls(o.profit) + '">' + eur(o.profit) + '</b>', 'Incasso netto dalla vendita + flussi netti del periodo − capitale investito.'],
      ['ROI', '<b class="' + UI.cls(o.roi) + '">' + pct(o.roi) + '</b>'],
      ['ROI annualizzato', pct(o.roiAnn)],
      ['TIR (IRR)', pct(o.irr), 'Tasso interno di rendimento sui flussi datati: la misura più corretta per confrontare investimenti.'],
      U.ok(o.roiU) ? ['ROI senza mutuo', pct(o.roiU), 'Rendimento dell\'immobile come se fosse stato pagato tutto in contanti (senza effetto leva).'] : null,
      U.ok(o.irrU) ? ['TIR senza mutuo', pct(o.irrU)] : null
    ];
  }
  ED.cgRows = cgRows; ED.resultRows = resultRows;
  TABS.vendita = function (s) {
    var p = s.p, sa = p.sale || {}, m = s.m, sold = m.sold, rp = { dec: 0, ratePath: 'sale.fxRate' };
    var head = sold ? '' : UI.note('Compila questa scheda quando vendi e poi imposta lo stato <b>Venduto</b> (scheda Generale o pulsante qui sotto): ROI e metriche diventeranno <i>realizzati</i>. ' +
      'Prima della vendita il riquadro a destra simula l\'operazione con il prezzo concordato, quello richiesto o il valore di mercato.', 'info');
    var f1 = [
      UI.date(p, 'sale.date', sold ? 'Data di vendita (rogito)' : 'Data di vendita prevista'),
      ED.amt(s, 'sale.price', sold ? 'Prezzo di vendita' : 'Prezzo concordato', { dec: 0, ratePath: 'sale.fxRate', help: 'Importo al 100% nella valuta dell\'immobile.' }),
      ED.amt(s, 'sale.askingPrice', 'Prezzo richiesto (annuncio)', { dec: 0, help: 'Usato nella simulazione se manca il prezzo concordato e confrontato con i comparabili.' })
    ];
    if (s.foreign) {
      f1.push(UI.num(p, 'sale.fxRate', 'Cambio alla vendita (' + U.esc(s.cur) + ' per 1 €)', { dec: 6, placeholder: 'vuoto = cambio live', help: 'Cambio BCE del giorno del rogito di vendita: determina incasso e plusvalenza in euro.' }));
      f1.push(UI.text(p, 'sale.fxSource', 'Fonte del cambio', { placeholder: 'es. BCE 15/05/2026' }));
    }
    var html = head + UI.grid(f1, 3) + btnRow((s.foreign ? UI.btn('Cambio storico alla data di vendita', { cls: 'btn-sm', icon: 'refresh', act: 'fxhist', data: ' data-which="sale"' }) : '') +
      (!sold && !m.pipe ? UI.btn('Segna come venduto', { cls: 'btn-sm', icon: 'check', act: 'mark-sold' }) : ''));
    var costs = UI.grid([
      ED.amt(s, 'sale.agency', 'Provvigione agenzia (IVA inclusa)', rp),
      ED.amt(s, 'sale.otherCosts', 'Altre spese di vendita', { dec: 0, ratePath: 'sale.fxRate', help: 'Certificazioni e conformità, sanatorie, APE, cancellazione ipoteca, penali di estinzione del mutuo, traduzioni.' }),
      UI.text(p, 'sale.buyer', 'Acquirente / note', { placeholder: 'facoltativo' })
    ], 3) + (!U.has(sa.agency) && !U.has(sa.otherCosts) ? '<p class="muted small">Se vuoti, nelle simulazioni i costi di vendita sono stimati al ' + U.fmtNum(U.n(m.D.saleCostPct), 1) + '% del prezzo (Impostazioni).</p>' : '');
    var tax = UI.grid([
      s.isIT ? UI.select(p, 'sale.regime', 'Tassazione della plusvalenza', { auto: 'Automatica (la più conveniente)', sostitutiva: 'Imposta sostitutiva ' + U.fmtNum(U.n(s.P.cgtSubstitute), 0) + '% (al rogito)', ordinaria: 'IRPEF ordinaria (in dichiarazione)', esente: 'Esente (forzata)' })
        : UI.select(p, 'sale.regime', 'Plusvalenza in Italia', { auto: 'Automatica (IRPEF con credito per l\'imposta estera)', esente: 'Esente (forzata)' }),
      UI.bool(p, 'sale.mainResidenceMajority', 'Abitazione principale per la maggior parte del possesso', { help: 'Plusvalenza esente se l\'immobile è stato abitazione principale tua o dei familiari per la maggior parte del periodo tra acquisto e vendita (art. 67, c. 1, lett. b TUIR).' }),
      s.foreign ? ED.amt(s, 'sale.foreignCgtPaid', 'Imposta estera pagata sulla plusvalenza', { dec: 0, ratePath: 'sale.fxRate', help: 'Importo effettivo al 100%, comprese ritenute sul prezzo non rimborsate. Vuoto = stima dalla scheda Tasse o dal preset.' }) : null
    ], 3) + UI.note('La plusvalenza è tassata se vendi entro ' + U.n(s.P.cgtYears) + ' anni dall\'acquisto (dalla data del donante per le donazioni), salvo abitazione principale e immobili ereditati. ' +
      'I terreni edificabili sono sempre tassati; con lavori Superbonus valgono regole speciali per ' + U.n(s.P.cgtSuperbonusYears) + ' anni.', 'info');
    var main = shareNote(s) + UI.card(sold ? 'Vendita' : 'Vendita o simulazione', html, { icon: 'shop' }) +
      UI.card('Costi di vendita', costs, { icon: 'list' }) + UI.card('Plusvalenza e imposte', tax, { icon: 'file' });
    return layout(main, side(s, 'vendita', sold ? 'Risultato della vendita' : 'Simulazione di vendita', 'chart'));
  };

  ACT['mark-sold'] = function () {
    var p = ED.get();
    if (!p) return;
    var id = p.id;
    U.confirm('Segnare l\'immobile come venduto? Data e prezzo di vendita, se mancanti, saranno impostati a oggi e al prezzo richiesto (o al valore di mercato): verificali.', 'Segna come venduto').then(function (ok) {
      if (!ok) return;
      ED.withProp(id, function (x) {
        x.status = 'venduto';
        if (!x.sale) x.sale = {};
        if (!U.validDate(x.sale.date)) x.sale.date = U.todayISO();
        if (!U.has(x.sale.price)) x.sale.price = U.has(x.sale.askingPrice) ? x.sale.askingPrice : (x.valuation && U.has(x.valuation.marketValue) ? x.valuation.marketValue : null);
      });
      U.toast('Immobile segnato come venduto.', 'success');
    });
  };

  CALC.vendita = function (s) {
    var m = s.m, f = s.f, p = s.p, sa = p.sale || {}, P = s.P, out = '', c = m.cmp || {};
    if (m.pipe) return '<p class="muted small">Immobile non ancora acquistato: la vendita futura è stimata nella proiezione della scheda Analisi.</p>';
    var from = p.acquisitionMode === 'donazione' && U.validDate(p.purchase.originalDate) ? p.purchase.originalDate : m.buyDate;
    var free = U.validDate(from) ? U.addYears(from, U.n(P.cgtYears)) : null;
    if (m.sold) {
      var cg = f.cg || {};
      if (!U.has(sa.price)) out += UI.note('Prezzo di vendita mancante: i risultati non sono attendibili.', 'warn');
      out += '<h4 class="sub-h">Vendita del ' + U.fmtDate(m.saleDate) + '</h4>' + UI.kv([
        ['Prezzo' + (m.share < 1 ? ' (100%)' : ''), le(s, U.n(sa.price), U.n(sa.price) / m.rSell)],
        m.share < 1 ? ['Ricavo (tua quota)', eur(cg.proceedsEur)] : null,
        ['Costi di vendita', '−' + eur(cg.costsEur)],
        ['Anni di possesso', U.fmtYears(cg.holdYears)]
      ]) + UI.kv(cgRows(s, cg)) + UI.kv([
        m.debtAtSaleEur > 0 ? ['Mutuo da estinguere', '−' + eur(m.debtAtSaleEur)] : null,
        ['Incasso netto', '<b>' + eur(f.netSaleEur) + '</b>']
      ]);
      out += '<h4 class="sub-h">Risultato realizzato</h4>' + UI.kv(resultRows(f));
      return out;
    }
    var hasCosts = U.has(sa.agency) || U.has(sa.otherCosts);
    var price = U.has(sa.price) ? U.n(sa.price) : (U.has(sa.askingPrice) ? U.n(sa.askingPrice) : m.valueL);
    var src = U.has(sa.price) ? 'prezzo concordato' : (U.has(sa.askingPrice) ? 'prezzo richiesto' : 'valore di mercato');
    if (!(price > 0)) return '<p class="muted small">Indica un prezzo (o il valore di mercato nella scheda Catasto) per simulare la vendita.</p>';
    var r = C.simulateSale(m, s.ctx, {
      price: price, costs: hasCosts ? U.n(sa.agency) + U.n(sa.otherCosts) : null,
      date: U.validDate(sa.date) && sa.date > m.today ? sa.date : m.today, rate: U.n(sa.fxRate) > 0 ? U.n(sa.fxRate) : m.rNow
    });
    out += '<h4 class="sub-h">Vendita al ' + U.fmtDate(r.date) + ' <small class="muted">(' + src + ')</small></h4>' + UI.kv([
      ['Prezzo' + (m.share < 1 ? ' (100%)' : ''), le(s, r.priceL, r.priceL / r.rate)],
      m.share < 1 ? ['Ricavo (tua quota)', eur(r.proceedsEur)] : null,
      ['Costi di vendita', '−' + eur(r.costsEur) + (hasCosts ? '' : ' <small class="muted">(stima)</small>')],
      ['Anni di possesso', U.fmtYears(r.cg.holdYears)]
    ]) + UI.kv(cgRows(s, r.cg)) + UI.kv([
      r.debtEur > 0 ? ['Mutuo da estinguere', '−' + eur(r.debtEur)] : null,
      ['Incasso netto', '<b>' + eur(r.netEur) + '</b>']
    ]);
    out += '<h4 class="sub-h">Risultato dell\'investimento</h4>' + UI.kv(resultRows(r).concat([
      U.ok(r.breakEvenPriceL) ? ['Prezzo minimo di pareggio', loc(s, r.breakEvenPriceL), 'Prezzo di vendita (100%) sotto il quale l\'operazione complessiva va in perdita.'] : null
    ]));
    if (free && free > m.today && r.cg.ruleTaxable && p.type !== 'terreno_edificabile') {
      out += UI.note('Dal <b>' + U.fmtDate(free) + '</b> (oltre ' + U.n(P.cgtYears) + ' anni di possesso) la plusvalenza non sarà più tassabile in Italia' + (r.cg.taxable ? ': risparmio stimato ' + eur(r.cg.itTaxEur - r.cg.creditEur) + '.' : '.'), 'info');
    }
    var mk = [
      c.askSqmPrice ? ['Prezzo richiesto al m²', loc(s, c.askSqmPrice)] : null,
      c.sale && c.sale.n ? ['Mediana comparabili (' + c.sale.n + ')', loc(s, c.sale.med) + ' /m²'] : null,
      U.ok(c.askGapPct) ? ['Richiesta vs mercato', '<span class="' + (c.askGapPct > 0.1 ? 'neg' : 'pos') + '">' + (c.askGapPct > 0 ? '+' : '') + pct(c.askGapPct, 0) + '</span>', 'Oltre +10% gli immobili restano di solito più a lungo sul mercato.'] : null,
      c.omiMid ? ['Quotazione OMI media', loc(s, c.omiMid) + ' /m²'] : null
    ];
    if (mk.some(function (x) { return x; })) out += '<h4 class="sub-h">Confronto con il mercato</h4>' + UI.kv(mk);
    return out;
  };

  /* ---------- Documenti e promemoria ---------- */
  var DOC_MAX = 8 * 1048576, DOC_WARN = 2 * 1048576;
  function fmtBytes(b) {
    b = U.n(b);
    if (b < 1024) return U.fmtNum(b, 0) + ' B';
    if (b < 1048576) return U.fmtNum(b / 1024, 0) + ' KB';
    return U.fmtNum(b / 1048576, 1) + ' MB';
  }
  function docState(d, today) {
    if (!d || !U.validDate(d.expiry)) return '';
    var days = U.daysBetween(today, d.expiry);
    return days < 0 ? 'scaduto' : (days <= 60 ? 'in_scadenza' : '');
  }
  function docBtn(label, icon, act, i, cls) { return UI.btn(label, { cls: 'btn-sm' + (cls ? ' ' + cls : ''), icon: icon, act: act, data: ' data-i="' + i + '"' }); }

  TABS.documenti = function (s) {
    var p = s.p, today = U.todayISO();
    var docs = ED.list(s, 'documents', function (it, b, i) {
      var st = docState(it, today), link = U.safeUrl(it.url);
      var file = it.data ? '<span class="doc-file">' + U.icon('file') + ' ' + U.esc(it.fileName || it.name || 'allegato') + ' <small class="muted">(' + fmtBytes(it.size) + ')</small></span>' : '';
      var btns = docBtn(it.data ? 'Sostituisci file' : 'Allega file', 'upload', 'doc-up', i) +
        (it.data || link ? docBtn('Apri', 'external', 'doc-open', i) : '') +
        (it.data ? docBtn('Rimuovi file', 'trash', 'doc-clear', i, 'btn-ghost') : '');
      return UI.grid([
        UI.text(p, b + '.type', 'Tipo', { list: 'gpi-doc-types', placeholder: 'es. Rogito' }),
        UI.text(p, b + '.name', 'Nome / descrizione', { cls: 'span2' }),
        UI.date(p, b + '.date', 'Data del documento'),
        UI.text(p, b + '.url', 'Link (cloud, portale, PEC)', { cls: 'span2', placeholder: 'https://…', attrs: ' data-hard="1"' }),
        UI.date(p, b + '.expiry', 'Scadenza', { attrs: ' data-hard="1"', help: 'Es. fine validità APE (10 anni), polizza, contratto: compare tra le scadenze.' }),
        UI.text(p, b + '.notes', 'Note')
      ], 4) + '<div class="doc-bar">' + (st === 'scaduto' ? UI.badge('Scaduto', 'neg') : (st ? UI.badge('In scadenza', 'warn') : '')) + file + btnRow(btns) + '</div>';
    }, { addLabel: 'Aggiungi documento', noDup: true, empty: 'Nessun documento. Registra rogito, APE, planimetrie, visure, contratti e polizze: con la data di scadenza compariranno tra le scadenze.' });
    var rem = ED.list(s, 'reminders', function (it, b) {
      return UI.grid([
        UI.date(p, b + '.date', 'Data'),
        UI.text(p, b + '.title', 'Promemoria', { cls: 'span2', placeholder: 'es. Revisione caldaia, rinnovo polizza, adeguamento ISTAT' }),
        UI.select(p, b + '.repeat', 'Ripetizione', M.REPEAT),
        UI.text(p, b + '.notes', 'Note', { cls: 'span3' }),
        UI.bool(p, b + '.done', 'Completato')
      ], 4);
    }, { addLabel: 'Aggiungi promemoria', empty: 'Nessun promemoria. Le scadenze fiscali (IMU, IVIE, cedolare), di contratti e mutui sono già calcolate in automatico.' });
    var main = UI.card('Documenti', UI.datalist('gpi-doc-types', M.DOC_TYPES) + docs +
        '<p class="muted small">I file allegati restano solo in questo browser (IndexedDB), al massimo ' + fmtBytes(DOC_MAX) + ' ciascuno, e sono inclusi nel backup JSON. ' +
        'Per file pesanti è meglio un link a OneDrive, Google Drive o Dropbox.</p>', { icon: 'file' }) +
      UI.card('Promemoria', rem, { icon: 'bell', help: 'I promemoria ripetuti si ripropongono alla scadenza successiva; spunta "Completato" per chiuderli.' });
    return layout(main, side(s, 'documenti', 'Scadenze e archivio', 'calendar'));
  };

  CALC.documenti = function (s) {
    var p = s.p, m = s.m, today = U.todayISO(), docs = p.documents || [], rem = p.reminders || [];
    var bytes = sum(docs, function (d) { return d.data ? U.n(d.size) : 0; });
    var exp = docs.filter(function (d) { return docState(d, today) === 'scaduto'; }).length, soon = docs.filter(function (d) { return docState(d, today) === 'in_scadenza'; }).length;
    var types = uniq(docs.map(function (d) { return d.type; }).filter(Boolean));
    var missing = ['Rogito', 'APE', 'Planimetria', 'Visura catastale'].filter(function (t) { return types.indexOf(t) < 0; });
    if (!s.isIT) missing = missing.filter(function (t) { return t !== 'Visura catastale'; });
    if (p.loans && p.loans.length) { if (types.indexOf('Contratto di mutuo') < 0) missing.push('Contratto di mutuo'); }
    if (m.rented && types.indexOf('Contratto di locazione') < 0) missing.push('Contratto di locazione');
    var out = UI.kv([
      ['Documenti', String(docs.length) + (docs.filter(function (d) { return d.data; }).length ? ' <small class="muted">(' + docs.filter(function (d) { return d.data; }).length + ' con file, ' + fmtBytes(bytes) + ')</small>' : '')],
      exp ? ['Scaduti', '<span class="neg">' + exp + '</span>'] : null,
      soon ? ['In scadenza entro 60 giorni', '<span class="warn">' + soon + '</span>'] : null,
      ['Promemoria aperti', String(rem.filter(function (r) { return !r.done; }).length)]
    ]);
    if (missing.length && !m.pipe) out += '<p class="muted small">Documenti utili non ancora registrati: ' + U.esc(missing.join(', ')) + '.</p>';
    var next = sortDates((m.dates || []).filter(function (d) { return !d.past; })).slice(0, 10);
    out += '<h4 class="sub-h">Prossime scadenze</h4>' + (next.length ? UI.kv(next.map(function (d) {
      return [U.fmtDate(d.date), '<a href="' + s.A.editHref(p.id, d.tab || 'documenti') + '">' + U.esc(d.label) + '</a>' + (U.ok(d.amount) && d.amount ? ' <small class="muted">' + eur(d.amount) + '</small>' : ''), '', d.level === 'danger' ? 'neg' : (d.level === 'warn' ? 'warn' : '')];
    })) : '<p class="muted small">Nessuna scadenza nei prossimi mesi.</p>');
    return out;
  };

  ACT['doc-up'] = function (el) {
    var p = ED.get(), i = parseInt(el.getAttribute('data-i'), 10), d = p && p.documents ? p.documents[i] : null;
    if (!d) return;
    var id = p.id, docId = d.id;
    U.pickFile('').then(function (file) {
      if (!file) return null;
      if (file.size > DOC_MAX) { U.toast('File troppo grande (' + fmtBytes(file.size) + '): il massimo è ' + fmtBytes(DOC_MAX) + '. Inserisci un link a un servizio cloud.', 'error', 6000); return null; }
      var ask = file.size > DOC_WARN ? U.confirm('Il file pesa ' + fmtBytes(file.size) + ' e appesantisce backup ed esportazioni. Allegarlo comunque?', 'Allega') : Promise.resolve(true);
      return ask.then(function (ok) {
        if (!ok) return null;
        return U.readFile(file, true).then(function (data) {
          ED.withProp(id, function (x) {
            var doc = (x.documents || []).filter(function (z) { return z.id === docId; })[0];
            if (!doc) return;
            doc.data = data; doc.mime = file.type || ''; doc.size = file.size; doc.fileName = file.name;
            if (!doc.name) doc.name = file.name.replace(/\.[^.]+$/, '');
          });
          U.toast('File allegato: ' + file.name, 'success');
        });
      });
    }).catch(function (e) { U.toast('Impossibile leggere il file: ' + ((e && e.message) || e), 'error', 5000); });
  };
  ACT['doc-open'] = function (el) {
    var p = ED.get(), i = parseInt(el.getAttribute('data-i'), 10), d = p && p.documents ? p.documents[i] : null;
    if (!d) return;
    if (d.data) {
      try {
        var parts = String(d.data).split(','), meta = parts[0] || '', b64 = meta.indexOf(';base64') >= 0;
        var raw = b64 ? atob(parts.slice(1).join(',')) : decodeURIComponent(parts.slice(1).join(','));
        var bytes = new Uint8Array(raw.length);
        for (var k = 0; k < raw.length; k++) bytes[k] = raw.charCodeAt(k);
        var mime = String(d.mime || (meta.match(/^data:([^;,]+)/) || [])[1] || 'application/octet-stream').toLowerCase();
        /* si aprono nel browser solo formati passivi: HTML, SVG e simili potrebbero eseguire codice con i permessi dell'app */
        if (!/^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp)|text\/plain)$/.test(mime)) {
          U.download(d.fileName || d.name || 'documento', new Blob([bytes], { type: 'application/octet-stream' }));
          return;
        }
        var url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        var w = window.open(url, '_blank');
        if (!w) U.download(d.fileName || d.name || 'documento', new Blob([bytes], { type: mime }));
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      } catch (e) { U.toast('Allegato non leggibile.', 'error'); }
      return;
    }
    var link = U.safeUrl(d.url);
    if (link) window.open(link, '_blank', 'noopener');
    else U.toast('Nessun file o link valido (deve iniziare con http:// o https://).', 'warn');
  };
  ACT['doc-clear'] = function (el) {
    var p = ED.get(), i = parseInt(el.getAttribute('data-i'), 10), d = p && p.documents ? p.documents[i] : null;
    if (!d || !d.data) return;
    var id = p.id, docId = d.id;
    U.confirm('Rimuovere il file allegato? I dati del documento restano.', 'Rimuovi', true).then(function (ok) {
      if (!ok) return;
      ED.withProp(id, function (x) {
        var doc = (x.documents || []).filter(function (z) { return z.id === docId; })[0];
        if (doc) { doc.data = null; doc.mime = ''; doc.size = null; doc.fileName = ''; }
      });
    });
  };
})(window.GPI = window.GPI || {});
