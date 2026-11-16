/* Gestione Patrimonio Immobiliare — dati di esempio e generatore per test di carico (GPI.DEMO) */
(function (G) {
  'use strict';
  var U = G.U, M = G.MODEL, K = G.COUNTRIES;

  var mon = function (k) { return U.addMonths(U.todayISO(), k).slice(0, 8) + '01'; };
  var ago = function (y, m) { return mon(-((y || 0) * 12 + (m || 0))); };
  var ahead = function (y, m) { return mon((y || 0) * 12 + (m || 0)); };
  var cad = function (cat, rendita, o) { return M.deepMerge(M.newCadUnit(), M.deepMerge({ categoria: cat, rendita: rendita }, o || {})); };
  var exp = function (date, description, amount, o) { return M.newExpense(M.deepMerge({ date: date, description: description, amount: amount }, o || {})); };
  var loan = function (label, amount, ratePct, years, startDate, o) {
    return M.deepMerge(M.newLoan(), M.deepMerge({ label: label, amount: amount, ratePct: ratePct, years: years, startDate: startDate }, o || {}));
  };
  var comp = function (kind, source, title, price, sqm, rooms, o) {
    return M.newComparable(M.deepMerge({ kind: kind, source: source, title: title, price: price, sqm: sqm, rooms: rooms, date: ago(0, 1) }, o || {}));
  };
  /* Canoni incassati e spese degli ultimi n mesi nel registro movimenti */
  var rents = function (n, amount, desc, extra) {
    var out = [];
    for (var i = n; i >= 1; i--) out.push(M.newLedger({ date: U.addDays(mon(-i), 4), kind: 'entrata', category: 'Affitto', amount: amount, description: desc || 'Canone mensile' }));
    (extra || []).forEach(function (e) { out.push(M.newLedger({ date: e[0], kind: e[1] || 'uscita', category: e[2], amount: e[3], description: e[4] || '' })); });
    return out;
  };
  var addr = function (street, city, zip, lat, lng, prov) {
    var pc = prov || K.findProvince(city) || '';
    return { street: street, city: city, province: pc, region: pc ? K.provinceRegion(pc) : '', zip: zip, lat: lat, lng: lng };
  };

  /* Portafoglio dimostrativo: tipologie, paesi, valute e regimi fiscali diversi */
  var sample = function () {
    var list = [];
    var b1 = ago(6, 2), r1 = ago(2, 0);
    list.push({
      name: 'Bilocale Milano Navigli', code: 'MI-01', group: 'Lombardia', tags: ['affitto', 'cedolare'],
      type: 'appartamento', usage: 'locazione_lunga', address: addr('Via Vigevano 18', 'Milano', '20144', 45.4536, 9.1735),
      sqm: 62, rooms: 2, bathrooms: 1, floor: '3', yearBuilt: 1965, energyClass: 'E',
      cadastre: { units: [cad('A/2', 1053.57, { foglio: '471', particella: '112', sub: '14', classe: '3', consistenza: '3,5 vani' })] },
      purchase: { date: b1, price: 285000, notary: 2900, agency: 9150, technical: 650, mortgageCosts: 1300 },
      furnishing: [exp(U.addMonths(b1, 2), 'Cucina, camera e soggiorno', 11500)],
      renovations: [exp(U.addMonths(b1, 1), 'Rifacimento bagno e impianto elettrico', 18000, { bonus: 'ristrutturazione' })],
      loans: [loan('Mutuo 25 anni tasso fisso', 200000, 1.6, 25, b1)],
      recurring: { condoMonthly: 165, condoTenantSharePct: 30, condoExtraordinaryAnnual: 400, utilitiesPaidBy: 'inquilino', insuranceAnnual: 290, maintenanceAnnual: 500 },
      rental: { contractType: 'libero_4_4', monthlyRent: 1350, startDate: r1, endDate: U.addYears(r1, 4), taxRegime: 'cedolare', deposit: 2700, tenant: 'G. Bianchi' },
      valuation: { marketValue: 342000, date: ago(0, 3), source: 'Stima agenzia', omiMin: 4700, omiMax: 6300, omiRentMin: 17.5, omiRentMax: 23 },
      comparables: [
        comp('vendita', 'immobiliare.it', 'Bilocale ristrutturato Navigli', 349000, 60, 2),
        comp('vendita', 'idealista.it', 'Bilocale con balcone Porta Genova', 329000, 58, 2),
        comp('vendita', 'casa.it', 'Bilocale da riordinare via Vigevano', 298000, 65, 2),
        comp('affitto', 'immobiliare.it', 'Bilocale arredato Navigli', 1450, 60, 2),
        comp('affitto', 'idealista.it', 'Bilocale Porta Genova', 1300, 55, 2)
      ],
      ledger: rents(6, 1350, 'Canone mensile', [[ago(0, 2), 'uscita', 'Spese condominiali', 495, 'Rata condominiale trimestrale'], [ago(0, 4), 'uscita', 'Manutenzione ordinaria', 180, 'Sostituzione caldaia: intervento tecnico']]),
      documents: [M.newDocument({ type: 'Rogito', name: 'Atto di compravendita', date: b1 }), M.newDocument({ type: 'APE', name: 'Attestato di prestazione energetica', date: ago(6, 3), expiry: ahead(3, 9) })],
      reminders: [M.newReminder({ date: ahead(0, 2), title: 'Rinnovo polizza casa', repeat: 'annuale' }), M.newReminder({ date: U.addMonths(U.addYears(r1, 4), -6), title: 'Termine per la disdetta del contratto 4+4' })]
    });
    var b2 = ago(9, 5);
    list.push({
      name: 'Bivilla Treviso', code: 'TV-01', group: 'Veneto', tags: ['prima casa'],
      type: 'bivilla', usage: 'abitazione_principale', address: addr('Via Santa Bona Nuova 41', 'Treviso', '31100', 45.6777, 12.2265),
      sqm: 165, landSqm: 320, rooms: 5, bathrooms: 2, floor: 'T-1', yearBuilt: 1998, energyClass: 'B',
      cadastre: { units: [cad('A/7', 1146.53, { classe: '2', consistenza: '8 vani' }), cad('C/6', 92.96, { classe: '4', consistenza: '28 m²', pertinenza: true })] },
      purchase: { date: b2, price: 318000, primaCasa: true, notary: 3100, agency: 9540, technical: 400, mortgageCosts: 900 },
      furnishing: [exp(ago(2, 1), 'Mobili cucina ed elettrodomestici A', 9200, { bonus: 'mobili' })],
      renovations: [
        exp(ago(3, 2), 'Cappotto termico e sostituzione infissi', 46000, { bonus: 'ecobonus' }),
        exp(ago(2, 3), 'Impianto fotovoltaico 6 kW con accumulo', 14500, { bonus: 'ristrutturazione' })
      ],
      loans: [loan('Mutuo prima casa', 220000, 2.1, 25, b2)],
      recurring: { waterMonthly: 35, electricityMonthly: 55, gasMonthly: 95, internetMonthly: 29, insuranceAnnual: 460, maintenanceAnnual: 1200, tariAnnual: 310 },
      rental: { imputedRentMonthly: 1300 },
      valuation: { marketValue: 405000, date: ago(0, 6), source: 'Perizia banca', omiMin: 1900, omiMax: 2500 },
      reminders: [M.newReminder({ date: ahead(0, 4), title: 'Manutenzione caldaia e controllo fumi', repeat: 'annuale' })]
    });
    var b3 = ago(12, 0);
    var units3 = [];
    for (var u = 1; u <= 6; u++) units3.push(cad('A/3', 680 + u * 22.5, { foglio: '201', particella: '57', sub: String(u + 2), classe: '2', consistenza: (u % 2 ? '4' : '5') + ' vani' }));
    list.push({
      name: 'Palazzina Bologna (6 unità)', code: 'BO-01', group: 'Emilia-Romagna', tags: ['affitto', 'cielo-terra', 'comproprietà'],
      type: 'palazzo', usage: 'locazione_lunga', ownershipPct: 50, unitsCount: 6, address: addr('Via del Pratello 77', 'Bologna', '40122', 44.4952, 11.3297),
      sqm: 480, landSqm: 120, rooms: 27, bathrooms: 6, floor: 'T-3', yearBuilt: 1932, energyClass: 'F',
      cadastre: { units: units3 },
      purchase: { date: b3, price: 1080000, notary: 9800, agency: 32400, technical: 3500, mortgageCosts: 2500 },
      renovations: [exp(ago(3, 0), 'Rifacimento tetto e facciata (sconto in fattura)', 140000, { bonus: 'altro', cessione: true, netCost: 56000 })],
      loans: [loan('Mutuo ipotecario', 600000, 3.2, 20, b3)],
      recurring: { electricityMonthly: 85, insuranceAnnual: 2300, maintenanceAnnual: 6500, managementPct: 6, cleaningAnnual: 2400 },
      rental: { contractType: 'libero_4_4', monthlyRent: 5400, vacancyPct: 8, startDate: ago(3, 0), taxRegime: 'ordinaria', tenant: '6 inquilini' },
      valuation: { marketValue: 1620000, date: ago(0, 8), source: 'Stima OMI e agenzia', omiMin: 2900, omiMax: 3700, omiRentMin: 11, omiRentMax: 14.5 },
      ledger: rents(6, 5400, 'Canoni 6 unità', [[ago(0, 3), 'uscita', 'Agenzia / gestione', 1944, 'Gestione trimestrale']])
    });
    var b4 = ago(7, 0), r4 = ago(5, 0);
    list.push({
      name: 'Negozio Torino San Salvario', code: 'TO-01', group: 'Piemonte', tags: ['commerciale', 'affitto'],
      type: 'negozio', usage: 'locazione_commerciale', address: addr('Via Madama Cristina 54', 'Torino', '10125', 45.0573, 7.6812),
      sqm: 85, rooms: 2, bathrooms: 1, floor: 'T', yearBuilt: 1910, energyClass: 'G',
      cadastre: { units: [cad('C/1', 2650.8, { classe: '6', consistenza: '70 m²' })] },
      purchase: { date: b4, price: 190000, notary: 2400, agency: 5700, technical: 300 },
      renovations: [exp(U.addMonths(b4, 2), 'Adeguamento impianti e vetrine', 15000)],
      recurring: { condoMonthly: 55, insuranceAnnual: 380, maintenanceAnnual: 400 },
      rental: { contractType: 'commerciale_6_6', monthlyRent: 1450, startDate: r4, endDate: U.addYears(r4, 6), taxRegime: 'ordinaria', deposit: 4350, tenant: 'Caffetteria Rossi S.r.l.' },
      valuation: { marketValue: 205000, date: ago(1, 0), source: 'Stima agenzia', omiMin: 1700, omiMax: 2600, omiRentMin: 11, omiRentMax: 16 },
      ledger: rents(6, 1450, 'Canone negozio', [[ago(0, 5), 'uscita', 'Tasse e imposte', 811, 'IMU acconto']]),
      reminders: [M.newReminder({ date: ahead(0, 1), title: 'Aggiornamento ISTAT del canone', repeat: 'annuale' })]
    });
    var b5 = ago(4, 3);
    list.push({
      name: 'Appartamento Valencia Ruzafa', code: 'ES-01', group: 'Spagna', tags: ['estero', 'affitti brevi'],
      type: 'appartamento', usage: 'locazione_breve', country: 'ES', currency: 'EUR',
      address: { street: 'Carrer de Cuba 22', city: 'Valencia', region: 'Comunitat Valenciana', zip: '46006', lat: 39.4627, lng: -0.3747 },
      sqm: 78, rooms: 3, bathrooms: 2, floor: '2', yearBuilt: 1958, energyClass: 'E',
      cadastre: { foreignValue: 96500 },
      purchase: { date: b5, price: 215000, notary: 1900, technical: 900, otherCosts: [M.newCostItem({ label: 'Gestoría, NIE e traduzioni', amount: 450, freq: 'una_tantum' })] },
      furnishing: [exp(U.addMonths(b5, 2), 'Arredo completo per affitti turistici', 14000)],
      renovations: [exp(U.addMonths(b5, 1), 'Ristrutturazione cucina e bagni', 22000)],
      recurring: { condoMonthly: 75, waterMonthly: 28, electricityMonthly: 70, internetMonthly: 35, insuranceAnnual: 260, maintenanceAnnual: 800, tariAnnual: 95, managementPct: 18, platformFeePct: 15, cleaningAnnual: 3200 },
      rental: { contractType: 'breve', nightlyRate: 98, occupancyPct: 68, startDate: U.addMonths(b5, 3) },
      taxesForeign: { propertyTaxAnnual: 545 },
      valuation: { marketValue: 255000, date: ago(0, 2), source: 'idealista.com', estimatedRent: 1300 },
      comparables: [
        comp('vendita', 'idealista.com', 'Piso reformado Ruzafa', 265000, 80, 3, { city: 'Valencia' }),
        comp('vendita', 'fotocasa.es', 'Piso con balcón Ruzafa', 239000, 75, 3, { city: 'Valencia' }),
        comp('affitto', 'idealista.com', 'Piso amueblado Ruzafa', 1350, 78, 3, { city: 'Valencia' })
      ]
    });
    var b6 = ago(5, 1), y6 = U.year(U.todayISO()) + (U.todayISO().slice(5) > '04-15' ? 1 : 0);
    list.push({
      name: 'Condo Miami Brickell', code: 'US-01', group: 'USA', tags: ['estero', 'USD', 'affitto'],
      type: 'appartamento', usage: 'locazione_lunga', country: 'US', currency: 'USD',
      address: { street: '1100 S Miami Ave', city: 'Miami', province: 'FL', region: 'Florida', zip: '33130', lat: 25.7629, lng: -80.1936 },
      sqm: 72, rooms: 3, bathrooms: 2, floor: '18', yearBuilt: 2008,
      purchase: { date: b6, price: 395000, fxRate: 1.19, fxSource: 'BCE', notary: 11800, technical: 650 },
      furnishing: [exp(U.addMonths(b6, 1), 'Arredi e tende', 9000)],
      loans: [loan('Mortgage 30 anni fisso', 237000, 4.375, 30, b6, { currency: 'USD' })],
      recurring: { condoMonthly: 780, utilitiesPaidBy: 'inquilino', insuranceAnnual: 2600, maintenanceAnnual: 1000, managementPct: 8 },
      rental: { contractType: 'estero', monthlyRent: 3300, vacancyPct: 5, startDate: ago(1, 2), endDate: ahead(0, 10), deposit: 6600, tenant: 'J. Smith' },
      taxesForeign: { propertyTaxAnnual: 7350 },
      valuation: { marketValue: 445000, date: ago(0, 1), source: 'Zillow' },
      comparables: [comp('vendita', 'zillow.com', '2 bd / 2 ba condo Brickell', 459000, 75, 3, { city: 'Miami' }), comp('affitto', 'zillow.com', '2 bd / 2 ba condo Brickell', 3400, 75, 3, { city: 'Miami' })],
      reminders: [M.newReminder({ date: y6 + '-04-15', title: 'Dichiarazione USA (1040-NR) e quadro RW/IVIE in Italia', repeat: 'annuale' })]
    });
    list.push({
      name: 'Box auto Milano Città Studi', code: 'MI-02', group: 'Lombardia', tags: ['box', 'affitto'],
      type: 'box', usage: 'locazione_lunga', address: addr('Via Giovanni Pascoli 30', 'Milano', '20133', 45.4787, 9.2262),
      sqm: 14, floor: 'S1', yearBuilt: 1975,
      cadastre: { units: [cad('C/6', 185.92, { classe: '7', consistenza: '13 m²' })] },
      purchase: { date: ago(3, 0), price: 38000, notary: 1300, agency: 1140 },
      recurring: { condoMonthly: 12 },
      rental: { contractType: 'altro', monthlyRent: 160, startDate: ago(2, 6), taxRegime: 'ordinaria' },
      valuation: { marketValue: 42000, date: ago(0, 6), source: 'Annunci in zona' }
    });
    var b7 = ago(4, 6), s7 = ago(0, 4);
    list.push({
      name: 'Monolocale Firenze Santo Spirito', code: 'FI-01', group: 'Toscana', tags: ['affitti brevi', 'venduto'],
      type: 'monolocale', status: 'venduto', usage: 'locazione_breve', address: addr('Via Maffia 12', 'Firenze', '50125', 43.7672, 11.2465),
      sqm: 38, rooms: 1, bathrooms: 1, floor: '1', yearBuilt: 1850, energyClass: 'F',
      cadastre: { units: [cad('A/3', 464.81, { classe: '4', consistenza: '2,5 vani' })] },
      purchase: { date: b7, price: 160000, notary: 2300, agency: 4800 },
      furnishing: [exp(U.addMonths(b7, 3), 'Arredo e biancheria', 8000)],
      renovations: [exp(U.addMonths(b7, 2), 'Ristrutturazione completa', 25000, { bonus: 'ristrutturazione' })],
      recurring: { condoMonthly: 45, waterMonthly: 20, electricityMonthly: 55, gasMonthly: 30, internetMonthly: 28, insuranceAnnual: 180, tariAnnual: 310, platformFeePct: 15, cleaningAnnual: 2400 },
      rental: { contractType: 'breve', nightlyRate: 115, occupancyPct: 72, startDate: U.addMonths(b7, 4), endDate: s7, cin: 'IT048017C2DEMO0001' },
      sale: { date: s7, price: 215000, agency: 6450, otherCosts: 600, regime: 'auto' },
      valuation: { marketValue: 215000, date: s7, source: 'Prezzo di vendita' },
      ledger: rents(0, 0, '', [[ago(0, 9), 'entrata', 'Affitto', 2650, 'Incassi piattaforma (mese)'], [ago(0, 8), 'entrata', 'Affitto', 2380, 'Incassi piattaforma (mese)'], [ago(0, 8), 'uscita', 'Pulizie', 240, 'Pulizie cambio ospiti']]),
      documents: [M.newDocument({ type: 'Rogito', name: 'Atto di vendita', date: s7 })]
    });
    list.push({
      name: 'Casa al mare Sanremo', code: 'IM-01', group: 'Liguria', tags: ['eredità', 'casa vacanze'],
      type: 'appartamento', usage: 'seconda_casa', acquisitionMode: 'successione', ownershipPct: 50,
      address: addr('Corso Imperatrice 28', 'Sanremo', '18038', 43.8159, 7.7684, 'IM'),
      sqm: 90, rooms: 4, bathrooms: 1, floor: '4', yearBuilt: 1962, energyClass: 'F',
      cadastre: { units: [cad('A/2', 1162.03, { classe: '2', consistenza: '5,5 vani' })] },
      purchase: { date: ago(3, 8), price: 146416, originalDate: '1994-05-20', technical: 900 },
      recurring: { condoMonthly: 140, waterMonthly: 15, electricityMonthly: 25, gasMonthly: 20, insuranceAnnual: 210, maintenanceAnnual: 600, tariAnnual: 280 },
      valuation: { marketValue: 460000, date: ago(0, 5), source: 'Valore dell\'intero immobile (stima)', omiMin: 4300, omiMax: 6400 },
      comparables: [comp('vendita', 'immobiliare.it', 'Quadrilocale vista mare corso Imperatrice', 495000, 95, 4, { city: 'Sanremo' }), comp('vendita', 'casa.it', 'Appartamento fronte mare', 430000, 88, 4, { city: 'Sanremo' })],
      notes: 'Ereditato in comproprietà al 50% con il fratello. Valore dichiarato in successione = valore catastale (rendita × 1,05 × 120). Importi di spese e valori riferiti all\'intero immobile: il gestionale applica la quota.'
    });
    var b9 = ahead(0, 2);
    list.push({
      name: 'Trilocale Torino Crocetta (obiettivo)', code: 'TO-02', group: 'Piemonte', tags: ['obiettivo', 'da valutare'],
      type: 'appartamento', status: 'obiettivo', usage: 'locazione_lunga', address: addr('Corso Galileo Ferraris 120', 'Torino', '10129', 45.0571, 7.6655),
      sqm: 88, rooms: 3, bathrooms: 1, floor: '2', yearBuilt: 1938, energyClass: 'F',
      cadastre: { units: [cad('A/2', 790.18, { classe: '3', consistenza: '5 vani' })] },
      purchase: { date: b9, price: 265000, notary: 2800, agency: 7950, technical: 500, mortgageCosts: 1200 },
      renovations: [exp(U.addMonths(b9, 1), 'Rinfrescata, infissi e caldaia', 21000, { bonus: 'ristrutturazione' })],
      furnishing: [exp(U.addMonths(b9, 2), 'Arredo per affitto', 9000)],
      loans: [loan('Mutuo 25 anni (simulazione)', 185000, 3.1, 25, b9)],
      recurring: { condoMonthly: 130, condoTenantSharePct: 30, utilitiesPaidBy: 'inquilino', insuranceAnnual: 250, maintenanceAnnual: 500 },
      rental: { contractType: 'concordato_3_2', concordato: true, monthlyRent: 1100, startDate: U.addMonths(b9, 3), taxRegime: 'cedolare' },
      valuation: { marketValue: 300000, date: ago(0, 0), source: 'Stima dopo i lavori', omiMin: 2300, omiMax: 3300, omiRentMin: 9.5, omiRentMax: 12.5, estimatedRent: 1100 },
      comparables: [
        comp('vendita', 'idealista.it', 'Trilocale ristrutturato Crocetta', 309000, 90, 3, { city: 'Torino' }),
        comp('vendita', 'immobiliare.it', 'Trilocale con balcone corso Einaudi', 279000, 85, 3, { city: 'Torino' }),
        comp('vendita', 'casa.it', 'Trilocale da ristrutturare Crocetta', 239000, 92, 3, { city: 'Torino' }),
        comp('vendita', 'immobiliare.it', 'Trilocale signorile corso Galileo Ferraris', 325000, 95, 3, { city: 'Torino' }),
        comp('affitto', 'immobiliare.it', 'Trilocale arredato Crocetta', 1150, 85, 3, { city: 'Torino' }),
        comp('affitto', 'idealista.it', 'Trilocale Politecnico', 1050, 80, 3, { city: 'Torino' }),
        comp('affitto', 'casa.it', 'Trilocale corso Duca degli Abruzzi', 1200, 90, 3, { city: 'Torino' })
      ],
      notes: 'Scenario d\'acquisto: confronta prezzo, affitto atteso e annunci in zona prima di fare un\'offerta.'
    });
    return list.map(function (o, i) {
      var p = M.newProperty(o);
      p.category = o.category || M.typeCategory(p.type);
      p.createdAt = p.updatedAt = Date.now() + i;
      return p;
    });
  };

  /* Generatore di immobili casuali per le prove di carico (fino a 1000 schede) */
  var CITIES_IT = [
    ['Milano', 'MI', 45.4642, 9.19, 5300], ['Roma', 'RM', 41.9028, 12.4964, 3500], ['Torino', 'TO', 45.0703, 7.6869, 2300],
    ['Napoli', 'NA', 40.8518, 14.2681, 3000], ['Bologna', 'BO', 44.4949, 11.3426, 3700], ['Firenze', 'FI', 43.7696, 11.2558, 4400],
    ['Genova', 'GE', 44.4056, 8.9463, 2000], ['Venezia', 'VE', 45.4408, 12.3155, 3800], ['Verona', 'VR', 45.4384, 10.9916, 2600],
    ['Padova', 'PD', 45.4064, 11.8768, 2300], ['Bari', 'BA', 41.1171, 16.8719, 2300], ['Palermo', 'PA', 38.1157, 13.3615, 1500],
    ['Catania', 'CT', 37.5079, 15.083, 1500], ['Cagliari', 'CA', 39.2238, 9.1217, 2600], ['Trieste', 'TS', 45.6495, 13.7768, 2200],
    ['Trento', 'TN', 46.0748, 11.1217, 3200], ['Bergamo', 'BG', 45.6983, 9.6773, 2500], ['Brescia', 'BS', 45.5416, 10.2118, 2300],
    ['Lecce', 'LE', 40.3515, 18.175, 1600], ['Pescara', 'PE', 42.4618, 14.2161, 2000]
  ];
  /* [paese, valuta, città, lat, lng, prezzo al m² in valuta locale, paese SEE] */
  var CITIES_X = [
    ['ES', 'EUR', 'Madrid', 40.4168, -3.7038, 5200, 1], ['FR', 'EUR', 'Paris', 48.8566, 2.3522, 9800, 1], ['PT', 'EUR', 'Lisboa', 38.7223, -9.1393, 5600, 1],
    ['US', 'USD', 'Miami', 25.7617, -80.1918, 6500, 0], ['GB', 'GBP', 'London', 51.5072, -0.1276, 8500, 0], ['CH', 'CHF', 'Lugano', 46.0037, 8.9511, 9000, 0],
    ['DE', 'EUR', 'Berlin', 52.52, 13.405, 5300, 1], ['HR', 'EUR', 'Split', 43.5081, 16.4402, 3800, 1], ['GR', 'EUR', 'Athina', 37.9838, 23.7275, 2700, 1],
    ['AE', 'AED', 'Dubai', 25.2048, 55.2708, 16000, 0]
  ];
  /* tipo: [m² min, m² max, coefficiente sul prezzo al m²] */
  var RTYPES = {
    appartamento: [50, 130, 1], monolocale: [25, 40, 1.1], attico: [90, 200, 1.25], bivilla: [110, 220, 0.95], casa_singola: [110, 240, 0.9],
    villa: [180, 400, 1.1], villetta_schiera: [100, 180, 0.95], palazzo: [350, 1200, 0.8], negozio: [40, 200, 0.9], ufficio: [60, 250, 0.85],
    magazzino: [80, 600, 0.35], box: [12, 20, 0.5], posto_auto: [10, 14, 0.35]
  };
  var RTYPE_POOL = ['appartamento', 'appartamento', 'appartamento', 'appartamento', 'appartamento', 'monolocale', 'attico', 'bivilla', 'casa_singola',
    'villa', 'villetta_schiera', 'palazzo', 'negozio', 'negozio', 'ufficio', 'magazzino', 'box', 'posto_auto'];
  var RES_USAGE = ['locazione_lunga', 'locazione_lunga', 'locazione_lunga', 'locazione_lunga', 'locazione_breve', 'locazione_breve', 'seconda_casa', 'seconda_casa', 'sfitto', 'comodato'];
  var LONG_CONTRACTS = ['libero_4_4', 'libero_4_4', 'concordato_3_2', 'transitorio', 'studenti'];

  var random = function (n, startIndex) {
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    var ri = function (a, b) { return Math.floor(rnd(a, b + 1)); };
    var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
    var r10 = function (x) { return Math.round(x / 10) * 10; };
    var r1k = function (x) { return Math.round(x / 1000) * 1000; };
    var out = [], base = startIndex || 0, now = Date.now();
    for (var i = 0; i < n; i++) {
      var k = base + i + 1, it = Math.random() < 0.8;
      var c = it ? pick(CITIES_IT) : pick(CITIES_X);
      var type = pick(RTYPE_POOL), tt = RTYPES[type], cat = M.typeCategory(type);
      var sqm = ri(tt[0], tt[1]), cur = it ? 'EUR' : c[1];
      var price = Math.max(5000, r1k(sqm * (it ? c[4] : c[5]) * tt[2] * rnd(0.75, 1.3)));
      var status = pick(['posseduto', 'posseduto', 'posseduto', 'posseduto', 'posseduto', 'posseduto', 'posseduto', 'posseduto', 'in_vendita', 'venduto', 'obiettivo']);
      var sold = status === 'venduto', target = status === 'obiettivo';
      var date = target ? ahead(0, ri(1, 6)) : ago(ri(sold ? 2 : 0, 15), ri(0, 11));
      var held = Math.max(0, U.yearsBetween(date, U.todayISO()));
      var usage = cat === 'commerciale' ? (Math.random() < 0.8 ? 'locazione_commerciale' : 'sfitto') :
        cat === 'pertinenza' ? (Math.random() < 0.6 ? 'locazione_lunga' : 'seconda_casa') : pick(RES_USAGE);
      var rented = !!M.RENTED[usage], short = usage === 'locazione_breve';
      var contract = !rented ? 'libero_4_4' : short ? 'breve' : !it ? 'estero' : cat === 'commerciale' ? 'commerciale_6_6' : cat === 'pertinenza' ? 'altro' : pick(LONG_CONTRACTS);
      var occ = ri(50, 78);
      var lat = U.round(c[it ? 2 : 3] + rnd(-0.03, 0.03), 5), lng = U.round(c[it ? 3 : 4] + rnd(-0.04, 0.04), 5);
      var o = {
        name: 'Test ' + k + ' – ' + (it ? c[0] : c[2]), code: 'T' + ('000' + k).slice(-4), group: 'Test di carico', tags: ['test'],
        type: type, category: cat, status: status, usage: usage, country: it ? 'IT' : c[0], currency: cur,
        address: it ? addr('Via di prova ' + ri(1, 200), c[0], '', lat, lng, c[1]) : { street: 'Test street ' + ri(1, 200), city: c[2], region: '', zip: '', lat: lat, lng: lng },
        sqm: sqm, rooms: cat === 'pertinenza' ? null : Math.max(1, Math.round(sqm / 28)), bathrooms: cat === 'pertinenza' ? null : (sqm > 90 ? 2 : 1),
        floor: String(ri(0, 6)), yearBuilt: ri(1900, 2023), energyClass: pick(M.ENERGY.slice(1)), unitsCount: type === 'palazzo' ? ri(4, 14) : 1,
        purchase: { date: date, price: price, notary: r10(rnd(1500, 3500) * (it ? 1 : price / 250000)), agency: Math.random() < 0.6 ? r10(price * 0.03) : null },
        recurring: {
          condoMonthly: /villa|casa_singola|bivilla|palazzo/.test(type) ? null : r10(sqm * rnd(1, 2.5)),
          insuranceAnnual: r10(rnd(150, 600)), maintenanceAnnual: r10(price * rnd(0.002, 0.006)), tariAnnual: it ? r10(sqm * rnd(2, 4)) : null,
          electricityMonthly: rented && !short ? null : r10(rnd(30, 80)), waterMonthly: rented && !short ? null : r10(rnd(15, 35)),
          internetMonthly: short ? 30 : null, utilitiesPaidBy: rented && !short ? 'inquilino' : 'proprietario',
          managementPct: short ? ri(15, 22) : null, platformFeePct: short ? 15 : null, cleaningAnnual: short ? r10(rnd(1500, 3500)) : null
        },
        rental: {
          contractType: contract, concordato: contract === 'concordato_3_2', startDate: rented ? U.addMonths(date, ri(1, 4)) : '',
          monthlyRent: rented && !short ? r10(price * rnd(0.04, 0.075) / 12) : null,
          nightlyRate: short ? Math.round(price * rnd(0.08, 0.12) / 365 / (occ / 100)) : null, occupancyPct: occ,
          taxRegime: cat === 'residenziale' ? (Math.random() < 0.8 ? 'cedolare' : 'ordinaria') : 'ordinaria'
        },
        valuation: { marketValue: r1k(price * Math.pow(1 + rnd(-0.01, 0.05), held)), date: ago(0, ri(0, 6)), source: 'Stima casuale (test)' }
      };
      if (it) o.cadastre = { units: [cad(M.TYPES[type][2] || 'A/3', U.round(price * rnd(0.3, 0.55) / 126, 2))] };
      else {
        if (c[6]) o.cadastre = { foreignValue: r1k(price * rnd(0.3, 0.5)) };
        var fr = G.FX && G.FX.rate ? G.FX.rate(cur) : null;
        if (cur !== 'EUR' && fr > 0) o.purchase.fxRate = U.round(fr * rnd(0.92, 1.08), 4);
      }
      if (Math.random() < 0.5 && cat !== 'pertinenza') o.loans = [loan('Mutuo', r1k(price * rnd(0.5, 0.8)), U.round(rnd(1, 4.5), 2), pick([15, 20, 25, 30]), date)];
      if (sold) o.sale = { date: ago(0, ri(1, 11)), price: r1k(price * rnd(1, 1.4)), agency: r10(price * 0.03), regime: 'auto' };
      if (status === 'in_vendita') o.sale = { askingPrice: r1k(o.valuation.marketValue * rnd(1.03, 1.12)) };
      var p = M.newProperty(o);
      p.category = cat;
      p.createdAt = p.updatedAt = now + i;
      out.push(p);
    }
    return out;
  };

  G.DEMO = { sample: sample, random: random };
})(window.GPI = window.GPI || {});
