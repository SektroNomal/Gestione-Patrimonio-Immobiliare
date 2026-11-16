/* Test automatici di Gestione Patrimonio Immobiliare (ES5, senza dipendenze).
   Apri tests/test.html nel browser: i test usano solo i moduli di calcolo e non toccano i dati salvati. */
(function (G) {
  'use strict';
  var U = G.U, FX = G.FX, M = G.MODEL, T = G.TAX, C = G.CALC, PT = G.PORTALS, DEMO = G.DEMO;
  var results = [], out = document.getElementById('out');

  function fail(msg) { throw new Error(msg); }
  function show(v) { try { return typeof v === 'string' ? '"' + v + '"' : JSON.stringify(v); } catch (e) { return String(v); } }
  function eq(a, b, what) { if (a !== b) fail((what ? what + ': ' : '') + 'atteso ' + show(b) + ', ottenuto ' + show(a)); }
  function near(a, b, tol, what) {
    tol = tol == null ? 0.01 : tol;
    if (typeof a !== 'number' || !isFinite(a) || Math.abs(a - b) > tol) fail((what ? what + ': ' : '') + 'atteso ' + b + ' (±' + tol + '), ottenuto ' + show(a));
  }
  function ok(c, what) { if (!c) fail(what || 'condizione non verificata'); }
  function test(name, fn) {
    var t0 = Date.now(), r = { name: name, ok: true, msg: '' };
    try { fn(); } catch (e) { r.ok = false; r.msg = e && e.message ? e.message : String(e); }
    r.ms = Date.now() - t0;
    results.push(r);
    var li = document.createElement('li'), sm = document.createElement('small');
    li.className = r.ok ? 'ok' : 'ko';
    li.textContent = name + (r.ok ? '' : ' — ' + r.msg);
    sm.textContent = ' (' + r.ms + ' ms)';
    li.appendChild(sm);
    out.appendChild(li);
  }

  var P = M.defaultParams(), S = M.defaultSettings();
  function unit(cat, rendita) { var u = M.newCadUnit(); u.categoria = cat; u.rendita = rendita; return u; }
  /* Immobile di prova: o = campi da sovrascrivere; cat/rendita = unità catastale principale */
  function prop(o, cat, rendita) {
    var p = M.newProperty(o);
    if (cat) p.cadastre.units = [unit(cat, rendita)];
    return p;
  }

  /* ---------- Utilità ---------- */
  test('Numeri: formati italiani, inglesi e suffissi', function () {
    eq(U.parseNum('250.000,50'), 250000.5);
    eq(U.parseNum('250,000.50'), 250000.5);
    eq(U.parseNum('1.500'), 1500);
    eq(U.parseNum('€ 1.200'), 1200);
    eq(U.parseNum('10k'), 10000);
    eq(U.parseNum('abc'), null);
    eq(U.parseNum(''), null);
  });
  test('Numeri: separatore delle migliaia anche a 4 cifre', function () {
    eq(U.fmtNum(2929), '2.929');
    eq(U.fmtEur(2929).indexOf('2.929'), 0, 'importo in euro');
    eq(U.fmtPct(12.5), '1.250,0%', 'percentuale');
    eq(U.fmtNum(999), '999');
  });
  test('Testo: escape HTML, link sicuri e slug', function () {
    eq(U.esc('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    eq(U.safeUrl('javascript:alert(1)'), '');
    eq(U.safeUrl(' https://www.idealista.it/x '), 'https://www.idealista.it/x');
    eq(U.slug("Sant'Agata Bolognese"), 'sant-agata-bolognese');
  });
  test('Date: fine mese e anni bisestili', function () {
    eq(U.addMonths('2024-01-31', 1), '2024-02-29');
    eq(U.addMonths('2023-01-31', 1), '2023-02-28');
    eq(U.addYears('2020-02-29', 1), '2021-02-28');
    near(U.yearsBetween('2020-01-01', '2030-01-01'), 10, 0.01);
  });

  /* ---------- Cambi valuta (tassi = unità di valuta per 1 euro) ---------- */
  test('Cambi: valute storiche, ancorate e conversioni', function () {
    eq(FX.rate('EUR'), 1);
    eq(FX.rate('ITL'), 1936.27);
    eq(FX.rate('XOF'), 655.957);
    near(FX.toEur(1936.27 * 1000, 'ITL'), 1000, 1e-6, 'lire → euro');
    eq(FX.convert(100, 'EUR', 'EUR'), 100);
    ok(FX.rate('USD') > 0, 'cambio USD disponibile (istantanea offline)');
    near(FX.toEur(FX.rate('USD') * 100, 'USD'), 100, 1e-6, 'dollari → euro');
    near(FX.convert(100, 'EUR', 'USD'), FX.rate('USD') * 100, 1e-6, 'euro → dollari');
  });
  test('Cambi: valuta sconosciuta e cambio manuale', function () {
    eq(FX.rate('XYZ'), null);
    eq(FX.rateInfo('XYZ').source, 'non disponibile');
    eq(FX.toEur(500, 'XYZ'), 500, 'importo lasciato invariato');
    FX.setOverrides({ USD: 1.2 });
    try {
      eq(FX.rate('USD'), 1.2);
      eq(FX.rateInfo('USD').source, 'manuale');
      near(FX.toEur(120, 'USD'), 100, 1e-9);
    } finally { FX.setOverrides({}); }
    ok(FX.rate('USD') !== 1.2, 'cambio manuale rimosso');
  });

  /* ---------- Modello dati ---------- */
  test('Normalizzazione di dati importati', function () {
    var p = M.normalize({ id: 'abc', type: 'astronave', status: 'boh', country: 'ita', currency: 'usdx', ownershipPct: 0, tags: 'a, b', cadastre: { units: [] }, loans: [{ amount: 1000 }] });
    eq(p.id, 'abc');
    eq(p.type, 'altro');
    eq(p.status, 'posseduto');
    eq(p.country, 'IT');
    eq(p.currency, 'USD');
    eq(p.ownershipPct, 100);
    eq(p.tags.join('|'), 'a|b');
    eq(p.cadastre.units.length, 1, 'unità catastali');
    eq(p.loans[0].method, 'francese', 'campi predefiniti del mutuo');
    eq(p.loans[0].amount, 1000);
    ok(!!p.loans[0].id, 'id del mutuo');
    eq(p.schema, M.SCHEMA);
  });
  test('Duplicazione e copia come obiettivo', function () {
    var src = M.newProperty({ name: 'X', code: 'C1', status: 'venduto', comparables: [M.newComparable({ price: 1 })], ledger: [M.newLedger({ amount: 5 })], loans: [M.newLoan()] });
    src.sale.price = 300000;
    var c = M.duplicate(src, {}, 2);
    eq(c.name, 'X (copia 2)');
    eq(c.code, 'C1-2');
    ok(c.id !== src.id, 'nuovo id');
    ok(c.loans[0].id !== src.loans[0].id, 'nuovo id del mutuo');
    eq(c.comparables.length, 0, 'comparabili');
    eq(c.ledger.length, 0, 'movimenti');
    eq(c.status, 'posseduto', 'stato dopo la copia di un venduto');
    eq(c.sale.price, null, 'dati di vendita azzerati');
    eq(src.name, 'X', 'originale invariato');
    eq(M.duplicate(src, { asTarget: true }).status, 'obiettivo');
    eq(M.duplicate(src, { suffix: false }).name, 'X');
  });

  /* ---------- Paesi e province ---------- */
  test('Paesi, valute e province', function () {
    var K = G.COUNTRIES;
    eq(K.name('US'), 'Stati Uniti');
    eq(K.currency('CH'), 'CHF');
    eq(K.currency('ZZ'), 'EUR', 'valuta predefinita');
    ok(K.isEU('FR') && !K.isEU('NO') && K.isEEA('NO'), 'Unione europea e Spazio economico europeo');
    ok(K.isBlacklist('AE') && !K.isBlacklist('CH'), 'Paesi a fiscalità privilegiata');
    eq(K.findProvince('milano'), 'MI');
    eq(K.findProvince('rm'), 'RM');
    eq(K.provinceRegion('MI'), 'Lombardia');
    eq(K.preset('FR', { countryOverrides: { FR: { transfer: 9.9 } } }).transfer, 9.9, 'personalizzazione del preset');
    ok(K.preset('FR', { countryOverrides: { FR: { transfer: '' } } }).transfer !== '', 'valore vuoto ignorato');
  });

  /* ---------- Fisco italiano (parametri 2026 predefiniti) ---------- */
  test('IRPEF a scaglioni 2026', function () {
    eq(T.irpef(0, P), 0);
    near(T.irpef(28000, P), 6440);
    near(T.irpef(50000, P), 13700);
    near(T.irpef(250000, P), 100140, 0.01, 'oltre 200.000 € detrazioni ridotte di 440 €');
    near(T.incremental(28000, 22000, P, { regionalPct: 0, municipalPct: 0 }).irpef, 7260, 0.01, 'imposta marginale al 33%');
  });
  test('IMU: seconda casa, esenzioni, riduzioni e lusso', function () {
    var r = T.imu(prop({}, 'A/2', 1000), P);
    near(r.base, 168000, 0.01, 'base imponibile (rendita × 1,05 × 160)');
    near(r.amount, 1780.8, 0.01, 'seconda casa all\'1,06%');
    eq(T.imu(prop({ usage: 'abitazione_principale' }, 'A/2', 1000), P).amount, 0, 'abitazione principale');
    eq(T.imu(prop({ country: 'FR' }, 'A/2', 1000), P).amount, 0, 'immobile estero');
    near(T.imu(prop({ usage: 'comodato' }, 'A/2', 1000), P).amount, 890.4, 0.01, 'comodato (base ridotta del 50%)');
    near(T.imu(prop({ taxesIT: { comodato: true } }, 'A/2', 1000), P).amount, 890.4, 0.01, 'comodato indicato nella scheda Tasse');
    near(T.imu(prop({ usage: 'locazione_lunga', rental: { concordato: true } }, 'A/2', 1000), P).amount, 1335.6, 0.01, 'canone concordato (-25%)');
    near(T.imu(prop({ usage: 'abitazione_principale' }, 'A/8', 1000), P).amount, 640, 0.01, 'abitazione principale di lusso (0,5% - 200 €)');
    near(T.imu(prop({}, 'C/1', 1000), P).amount, 612.15, 0.01, 'negozio C/1 (moltiplicatore 55)');
    eq(T.imu(prop({ taxesIT: { imuMode: 'manuale', imuManual: 321 } }, 'A/2', 1000), P).amount, 321, 'importo manuale');
    eq(T.imu(prop({ taxesIT: { imuMode: 'esente' } }, 'A/2', 1000), P).amount, 0, 'esente');
  });
  test('Imposte d\'acquisto: prezzo-valore, prima casa, IVA ed estero', function () {
    near(T.purchaseTaxes(prop({ purchase: { price: 200000, primaCasa: true } }, 'A/2', 1000), P).total, 2410, 0.01, 'prima casa da privato (2% del valore catastale + 50 + 50)');
    near(T.purchaseTaxes(prop({ purchase: { price: 200000 } }, 'A/2', 1000), P).total, 11440, 0.01, 'seconda casa da privato (9% + 50 + 50)');
    near(T.purchaseTaxes(prop({ purchase: { price: 200000, primaCasa: true } }, 'A/2', 300), P).total, 1100, 0.01, 'imposta di registro minima 1.000 €');
    near(T.purchaseTaxes(prop({ purchase: { price: 200000, primaCasa: true, sellerType: 'impresa_iva' } }, 'A/2', 1000), P).total, 8600, 0.01, 'da impresa: IVA 4% + 3 × 200 €');
    near(T.purchaseTaxes(prop({ country: 'US', currency: 'USD', purchase: { price: 300000 } }), P, { transfer: 7 }).total, 21000, 0.01, 'estero secondo il preset');
    eq(T.purchaseTaxes(prop({ purchase: { price: 200000, taxMode: 'manuale', taxManual: 1234 } }, 'A/2', 1000), P).total, 1234, 'importo manuale');
    eq(T.purchaseTaxes(prop({ acquisitionMode: 'costruzione', purchase: { price: 50000 } }), P).total, 0, 'costruzione in proprio');
  });
  test('Plusvalenza: regola dei 5 anni ed esenzioni', function () {
    eq(T.capitalGainRule(prop({}), P, 3).taxable, true, 'vendita entro 5 anni');
    eq(T.capitalGainRule(prop({}), P, 6).taxable, false, 'oltre 5 anni');
    eq(T.capitalGainRule(prop({}), P, 8, 3).taxable, true, 'Superbonus concluso da meno di 10 anni');
    eq(T.capitalGainRule(prop({ usage: 'abitazione_principale' }), P, 2).taxable, false, 'abitazione principale');
    eq(T.capitalGainRule(prop({ acquisitionMode: 'successione' }), P, 1).taxable, false, 'immobile ereditato');
    eq(T.capitalGainRule(prop({ type: 'terreno_edificabile' }), P, 20).taxable, true, 'terreno edificabile');
    eq(T.capitalGainRule(prop({ sale: { regime: 'esente' } }), P, 1).taxable, false, 'esenzione manuale');
  });
  test('Imposta sostitutiva sul mutuo', function () {
    var l = M.newLoan();
    l.amount = 100000;
    near(T.loanSubstituteTax(l, prop({ purchase: { primaCasa: true } }, 'A/2', 1000), P), 250, 0.001, 'prima casa 0,25%');
    near(T.loanSubstituteTax(l, prop({}, 'A/2', 1000), P), 2000, 0.001, 'altre abitazioni 2%');
    eq(T.loanSubstituteTax(l, prop({ country: 'ES' }, 'A/2', 1000), P), 0, 'mutuo estero');
  });

  /* ---------- Calcoli finanziari ---------- */
  test('Mutuo alla francese e all\'italiana', function () {
    var l = M.newLoan(), p = prop({}), s;
    l.amount = 100000; l.ratePct = 3; l.years = 20; l.startDate = '2020-01-01';
    s = C.loanStats(l, p, '2020-01-01');
    eq(s.N, 240, 'numero di rate');
    near(s.payment, 554.598, 0.01, 'rata costante');
    near(s.totalInterest, 33103.5, 0.5, 'interessi totali');
    eq(s.bal[240], 0, 'debito estinto all\'ultima rata');
    near(s.balanceAt('2030-01-01'), s.bal[120], 1e-9, 'debito residuo a metà durata');
    l.method = 'italiano';
    s = C.loanStats(l, p, '2020-01-01');
    near(s.payment, 666.667, 0.001, 'prima rata (quota capitale costante)');
    near(s.totalInterest, 30125, 0.01, 'interessi totali');
    l.amount = 0;
    eq(C.loanStats(l, p), null, 'mutuo senza importo');
  });
  test('Rendimento interno (XIRR) e valore attuale netto', function () {
    var f = [{ amount: -1000, date: '2025-01-01' }, { amount: 1100, date: '2026-01-01' }];
    near(C.xirr(f), 0.1, 1e-6, 'IRR annuo');
    near(C.npv(f, 10), 0, 1e-6, 'VAN al 10%');
    eq(C.xirr([{ amount: -1000, date: '2025-01-01' }, { amount: -5, date: '2026-01-01' }]), null, 'flussi dello stesso segno');
    eq(C.xirr([]), null, 'nessun flusso');
  });
  test('Comparabili: mediana €/m² e stime', function () {
    var p = prop({ sqm: 100 });
    p.comparables = [
      M.newComparable({ kind: 'vendita', price: 300000, sqm: 100 }),
      M.newComparable({ kind: 'vendita', price: 200000, sqm: 80 }),
      M.newComparable({ kind: 'vendita', price: 350000, sqm: 100 }),
      M.newComparable({ kind: 'vendita', price: 999999, sqm: 10, include: false }),
      M.newComparable({ kind: 'affitto', price: 1000, sqm: 80 }),
      M.newComparable({ kind: 'affitto', price: 1400, sqm: 100 }),
      M.newComparable({ kind: 'affitto', price: 1300, sqm: 100 })
    ];
    var r = C.comps(p, S);
    eq(r.sale.n, 3, 'escluso il comparabile non incluso');
    near(r.sale.med, 3000, 1e-9, 'mediana €/m² di vendita');
    near(r.estValue, 285000, 0.01, 'valore stimato (sconto trattativa 5%)');
    near(r.estRent, 1300, 0.01, 'canone mensile stimato');
  });
  test('Immobile estero in comproprietà: cambio d\'acquisto e quota', function () {
    var p = M.newProperty({ country: 'US', currency: 'USD', ownershipPct: 50, purchase: { date: '2020-01-01', price: 222540, fxRate: 1.1127 } });
    var m = C.base(p, S, true);
    near(m.share, 0.5, 1e-12, 'quota di possesso');
    near(m.priceEur, 100000, 0.01, 'prezzo in euro pro quota');
  });

  /* ---------- Portali immobiliari ---------- */
  test('Lettura di annunci incollati', function () {
    var r = PT.parse('Trilocale 85 m² € 250.000 https://www.immobiliare.it/annunci/1/')[0];
    ok(!!r, 'annuncio riconosciuto');
    eq(r.price, 250000, 'prezzo');
    eq(r.sqm, 85, 'superficie');
    eq(r.rooms, 3, 'locali');
    eq(r.source, 'immobiliare.it', 'portale');
    eq(r.kind, 'vendita', 'tipo');
    eq(PT.parse('').length, 0, 'testo vuoto');
    var c = PT.toComparable(r, prop({}));
    eq(c.price, 250000, 'comparabile: prezzo');
    eq(c.source, 'immobiliare.it', 'comparabile: portale');
    eq(c.include, true, 'comparabile incluso');
  });
  test('Bookmarklet e dati ricevuti dal portale', function () {
    eq(PT.bookmarklet('https://esempio.github.io/patrimonio/#/').indexOf('javascript:'), 0);
    var r = PT.fromPayload({ u: 'https://www.immobiliare.it/affitto-case/x', t: 'Bilocale', x: '€ 900/mese 50 mq' });
    eq(r.kind, 'affitto', 'affitto riconosciuto dal link');
    eq(r.price, 900, 'canone');
    eq(r.sqm, 50, 'superficie');
    eq(r.source, 'immobiliare.it', 'portale');
    eq(PT.domain('https://www.idealista.it/x'), 'idealista.it');
    r = PT.fromPayload({ u: 'https://www.idealista.it/immobile/1/', t: 'Bilocale', x: '€ 150.000 60 m²', c: 'Forl\\u00ec' });
    eq(r.city, 'Forlì', 'località dai dati strutturati della pagina');
    eq(PT.fromPayload({ u: 'https://www.casa.it/x', t: 'Bilocale in vendita a Lecce', x: '€ 90.000', c: 'Bari' }).city, 'Lecce', 'il titolo prevale');
  });
  test('Città ricavata dal titolo dell\'annuncio', function () {
    eq(PT.cityOf('Trilocale via Roma 10, Torino - 85 m² - Immobiliare.it'), 'Torino', 'indirizzo seguito dalla città');
    eq(PT.cityOf('Bilocale in affitto a Roma (RM)'), 'Roma', 'sigla della provincia');
    eq(PT.cityOf('Appartamento in vendita in via Paolo Sarpi, 10'), '', 'solo indirizzo');
    eq(PT.cityOf('Attico con terrazzo, Ottimo stato'), '', 'nessuna città');
  });

  /* ---------- Portafoglio ---------- */
  test('Portafoglio dimostrativo', function () {
    var list = DEMO.sample(), port = C.portfolio(list, S), pr;
    eq(list.length, 10, 'immobili di esempio');
    eq(port.count.all, 10);
    eq(port.count.active, 8, 'posseduti');
    eq(port.count.sold, 1, 'venduti');
    eq(port.count.pipe, 1, 'obiettivi');
    eq(port.count.foreign, 2, 'all\'estero');
    ok(isFinite(port.total.value) && port.total.value > 0, 'valore totale');
    ok(isFinite(port.total.debt) && port.total.debt >= 0, 'debito totale');
    pr = C.portfolioProjection(port, 10);
    eq(pr.rows.length, 10, 'anni di proiezione');
    ok(pr.rows.every(function (x) { return isFinite(x.valueEur) && isFinite(x.cumCf) && isFinite(x.netSaleEur); }), 'proiezione numerica');
  });
  test('Prova di carico: 1000 immobili', function () {
    var list = DEMO.random(1000), t0 = Date.now(), port, pr, ms;
    eq(list.length, 1000);
    port = C.portfolio(list, S);
    pr = C.portfolioProjection(port, 10);
    ms = Date.now() - t0;
    eq(port.count.all, 1000);
    eq(pr.rows.length, 10);
    ok(isFinite(port.total.value) && isFinite(port.kpi.cfMonthly), 'totali numerici');
    ok(ms < 10000, 'calcolo in ' + ms + ' ms (limite 10 s)');
  });

  /* ---------- Riepilogo ---------- */
  var ko = results.filter(function (r) { return !r.ok; }).length, txt = (results.length - ko) + ' superati, ' + ko + ' falliti';
  var sum = document.getElementById('summary');
  sum.textContent = txt;
  sum.className = ko ? 'fail' : 'pass';
  document.body.setAttribute('data-result', ko ? 'fail' : 'pass');
  document.body.setAttribute('data-summary', txt);
  document.title = (ko ? '✘ ' : '✔ ') + txt + ' – Test GPI';
})(window.GPI = window.GPI || {});
