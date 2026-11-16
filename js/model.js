/* Modello dati: enumerazioni, fabbrica immobili, normalizzazione, duplicazione, impostazioni (GPI.MODEL) */
(function (G) {
  'use strict';
  var U = G.U, M = {};
  M.SCHEMA = 1;
  M.MAX_PROPERTIES = 1000;

  M.CATEGORIES = { residenziale: 'Residenziale', commerciale: 'Commerciale', misto: 'Misto (resid. + comm.)', terreno: 'Terreno', pertinenza: 'Pertinenza / box' };

  /* tipo: [etichetta, categoria, categoria catastale tipica, categoria portali] */
  M.TYPES = {
    appartamento: ['Appartamento', 'residenziale', 'A/2', 'case'],
    attico: ['Attico', 'residenziale', 'A/2', 'case'],
    monolocale: ['Monolocale / studio', 'residenziale', 'A/3', 'case'],
    loft: ['Loft / open space', 'residenziale', 'A/3', 'case'],
    mansarda: ['Mansarda', 'residenziale', 'A/3', 'case'],
    casa_singola: ['Casa singola / indipendente', 'residenziale', 'A/7', 'case'],
    villa: ['Villa', 'residenziale', 'A/7', 'ville'],
    bivilla: ['Bivilla / bifamiliare', 'residenziale', 'A/7', 'ville'],
    villetta_schiera: ['Villetta a schiera', 'residenziale', 'A/7', 'ville'],
    porzione_casa: ['Porzione di casa', 'residenziale', 'A/3', 'case'],
    rustico: ['Rustico / casale / masseria', 'residenziale', 'A/4', 'case'],
    palazzo: ['Intero palazzo / stabile', 'residenziale', 'A/3', 'palazzi'],
    residence: ['Unità in residence / multiproprietà', 'residenziale', 'A/3', 'case'],
    palazzo_misto: ['Palazzo misto (abitazioni + negozi)', 'misto', 'A/3', 'palazzi'],
    negozio: ['Negozio / locale commerciale', 'commerciale', 'C/1', 'negozi'],
    ufficio: ['Ufficio / studio professionale', 'commerciale', 'A/10', 'uffici'],
    capannone: ['Capannone / industriale', 'commerciale', 'D/7', 'capannoni'],
    laboratorio: ['Laboratorio artigianale', 'commerciale', 'C/3', 'capannoni'],
    magazzino: ['Magazzino / deposito', 'commerciale', 'C/2', 'magazzini'],
    hotel: ['Hotel / B&B / struttura ricettiva', 'commerciale', 'D/2', 'hotel'],
    ristorante: ['Ristorante / bar', 'commerciale', 'C/1', 'negozi'],
    edificio_commerciale: ['Edificio commerciale intero', 'commerciale', 'D/8', 'palazzi'],
    box: ['Box / garage', 'pertinenza', 'C/6', 'garage'],
    posto_auto: ['Posto auto', 'pertinenza', 'C/6', 'garage'],
    cantina: ['Cantina / soffitta', 'pertinenza', 'C/2', 'magazzini'],
    terreno_agricolo: ['Terreno agricolo', 'terreno', 'T', 'terreni'],
    terreno_edificabile: ['Terreno edificabile', 'terreno', '', 'terreni'],
    altro: ['Altro', 'residenziale', '', 'case']
  };

  M.STATUS = { posseduto: 'Posseduto', in_vendita: 'In vendita', venduto: 'Venduto', in_acquisto: 'In acquisto / trattativa', obiettivo: 'Obiettivo / simulazione' };
  M.ACTIVE = { posseduto: 1, in_vendita: 1 };
  M.PIPELINE = { in_acquisto: 1, obiettivo: 1 };

  M.USAGE = {
    abitazione_principale: 'Abitazione principale',
    seconda_casa: 'Seconda casa / a disposizione',
    locazione_lunga: 'Affitto lungo termine',
    locazione_breve: 'Affitto breve / turistico',
    locazione_commerciale: 'Locazione commerciale',
    uso_proprio: 'Uso proprio / strumentale',
    comodato: 'Comodato d\'uso gratuito',
    sfitto: 'Sfitto',
    ristrutturazione: 'In ristrutturazione'
  };
  M.RENTED = { locazione_lunga: 1, locazione_breve: 1, locazione_commerciale: 1 };

  M.ACQ_MODES = { acquisto: 'Compravendita', asta: 'Asta giudiziaria', successione: 'Successione (eredità)', donazione: 'Donazione', costruzione: 'Costruzione in proprio' };
  M.SELLER_TYPES = { privato: 'Privato (imposta di registro)', impresa_iva: 'Impresa / costruttore (IVA)' };
  M.CONTRACTS = {
    libero_4_4: 'Canone libero 4+4', concordato_3_2: 'Canone concordato 3+2', transitorio: 'Transitorio (1-18 mesi)',
    studenti: 'Studenti universitari', commerciale_6_6: 'Commerciale 6+6', alberghiero_9_9: 'Alberghiero 9+9',
    breve: 'Locazione breve (< 30 gg)', estero: 'Contratto estero', altro: 'Altro'
  };
  M.ENERGY = ['', 'A4', 'A3', 'A2', 'A1', 'B', 'C', 'D', 'E', 'F', 'G'];
  M.BONUS = { nessuno: 'Nessuna detrazione', ristrutturazione: 'Bonus ristrutturazione', ecobonus: 'Ecobonus', sismabonus: 'Sismabonus', superbonus: 'Superbonus', mobili: 'Bonus mobili', altro: 'Altra detrazione' };
  M.LOAN_METHODS = { francese: 'Francese (rata costante)', italiano: 'Italiano (quota capitale costante)', bullet: 'Solo interessi (bullet)' };
  /* Il registro movimenti contiene solo la gestione corrente: acquisto, arredi e lavori sono già nelle rispettive sezioni */
  M.LEDGER_CATS = ['Affitto', 'Rimborso spese', 'Spese condominiali', 'Utenze', 'Manutenzione ordinaria', 'Tasse e imposte', 'Rata mutuo', 'Assicurazione', 'Agenzia / gestione', 'Pulizie', 'Commissioni piattaforma', 'Altro'];
  M.FREQ = { mensile: ['Mensile', 12], bimestrale: ['Bimestrale', 6], trimestrale: ['Trimestrale', 4], semestrale: ['Semestrale', 2], annuale: ['Annuale', 1] };
  M.DOC_TYPES = ['Rogito', 'Compromesso', 'Contratto di locazione', 'APE', 'Planimetria', 'Visura catastale', 'Contratto di mutuo', 'Polizza assicurativa', 'Fattura', 'Foto', 'Perizia', 'Altro'];
  M.CADASTRAL_CATS = ['A/1', 'A/2', 'A/3', 'A/4', 'A/5', 'A/6', 'A/7', 'A/8', 'A/9', 'A/10', 'A/11', 'B/1', 'B/2', 'B/3', 'B/4', 'B/5', 'B/6', 'B/7', 'B/8', 'C/1', 'C/2', 'C/3', 'C/4', 'C/5', 'C/6', 'C/7', 'D/1', 'D/2', 'D/3', 'D/4', 'D/5', 'D/6', 'D/7', 'D/8', 'D/9', 'D/10', 'E/1', 'F/2', 'F/3', 'T'];

  M.typeLabel = function (t) { return M.TYPES[t] ? M.TYPES[t][0] : (t || '—'); };
  M.typeCategory = function (t) { return M.TYPES[t] ? M.TYPES[t][1] : 'residenziale'; };
  M.isRented = function (p) { return !!M.RENTED[p.usage]; };
  M.isShort = function (p) { return p.usage === 'locazione_breve'; };

  M.newCadUnit = function () { return { foglio: '', particella: '', sub: '', categoria: '', classe: '', consistenza: '', rendita: null, pertinenza: false }; };
  M.newLoan = function () { return { id: U.uid(), label: 'Mutuo', currency: '', amount: null, ratePct: null, years: 20, startDate: '', method: 'francese', paymentOverride: null, balanceOverride: null, substituteTaxMode: 'auto', substituteTax: null }; };
  /* Spesa una tantum (arredi, lavori, extra). capitalized: null = automatico (lavori sì, extra no, arredi mai).
     cessione = credito ceduto / sconto in fattura: netCost = costo effettivamente sostenuto */
  M.newExpense = function (o) {
    return deepMerge({ id: U.uid(), date: '', description: '', amount: null, fxRate: null, bonus: 'nessuno', deductionPct: null, deductionYears: null, capitalized: null, cessione: false, netCost: null, endDate: '' }, o || {});
  };
  /* Voce di costo generica: freq una tra M.FREQ (o 'una_tantum' per i costi d'acquisto) */
  M.newCostItem = function (o) { return deepMerge({ id: U.uid(), label: '', amount: null, freq: 'annuale' }, o || {}); };
  M.newComparable = function (o) {
    return deepMerge({ id: U.uid(), kind: 'vendita', source: '', url: '', title: '', city: '', price: null, sqm: null, rooms: null, date: U.todayISO(), notes: '', include: true }, o || {});
  };
  M.LEDGER_INCOME = { 'Affitto': 1, 'Rimborso spese': 1 };
  M.newLedger = function (o) { return deepMerge({ id: U.uid(), date: U.todayISO(), kind: 'entrata', category: 'Affitto', amount: null, description: '' }, o || {}); };
  M.newDocument = function (o) { return deepMerge({ id: U.uid(), type: 'Altro', name: '', url: '', date: '', expiry: '', notes: '', data: '', mime: '', size: 0 }, o || {}); };
  M.REPEAT = { nessuna: 'Una volta', mensile: 'Ogni mese', trimestrale: 'Ogni 3 mesi', semestrale: 'Ogni 6 mesi', annuale: 'Ogni anno' };
  M.newReminder = function (o) { return deepMerge({ id: U.uid(), date: '', title: '', notes: '', repeat: 'nessuna', done: false }, o || {}); };

  M.newProperty = function (o) {
    var now = Date.now();
    var p = {
      id: U.uid(), schema: M.SCHEMA, createdAt: now, updatedAt: now,
      name: '', code: '', tags: [], group: '',
      category: 'residenziale', type: 'appartamento', status: 'posseduto', usage: 'seconda_casa', acquisitionMode: 'acquisto',
      country: 'IT', currency: 'EUR', ownershipPct: 100,
      address: { street: '', city: '', province: '', region: '', zip: '', lat: null, lng: null },
      sameComuneAsMainHome: false,
      sqm: null, landSqm: null, rooms: null, bathrooms: null, floor: '', yearBuilt: null, energyClass: '', unitsCount: 1,
      notes: '', thumb: '',
      cadastre: { units: [M.newCadUnit()], foreignValue: null },
      purchase: { date: '', price: null, fxRate: null, fxSource: '', sellerType: 'privato', primaCasa: false, lusso: false, newBuild: false, taxMode: 'auto', taxManual: null, notary: null, agency: null, technical: null, mortgageCosts: null, otherCosts: [], originalDate: '' },
      furnishing: [], renovations: [], extraExpenses: [],
      loans: [],
      recurring: { condoMonthly: null, condoTenantSharePct: 0, condoExtraordinaryAnnual: null, waterMonthly: null, electricityMonthly: null, gasMonthly: null, heatingMonthly: null, internetMonthly: null, utilitiesPaidBy: 'proprietario', insuranceAnnual: null, maintenanceAnnual: null, tariAnnual: null, managementPct: null, platformFeePct: null, cleaningAnnual: null, other: [] },
      rental: { contractType: 'libero_4_4', monthlyRent: null, nightlyRate: null, occupancyPct: 60, vacancyPct: null, startDate: '', endDate: '', taxRegime: 'cedolare', concordato: false, breveAliquotaAgevolata: true, cin: '', deposit: null, tenant: '', imputedRentMonthly: null, incomeSince: '' },
      taxesIT: { imuMode: 'auto', imuRatePct: null, imuManual: null, imuBaseManual: null, comodato: false, storicoInagibile: false, other: [] },
      taxesForeign: { propertyTaxAnnual: null, propertyTaxCreditable: true, rentalTaxPct: null, rentalTaxBase: 'auto', foreignTaxableIncome: null, wealthTaxAnnual: null, imputedTaxAnnual: null, otherAnnual: null, ivieBase: 'auto', ivieValueOverride: null, cgtPct: null, foreignMainHome: false },
      sale: { date: '', price: null, fxRate: null, fxSource: '', agency: null, otherCosts: null, regime: 'auto', mainResidenceMajority: false, foreignCgtPaid: null, askingPrice: null },
      valuation: { marketValue: null, date: '', source: '', omiMin: null, omiMax: null, omiRentMin: null, omiRentMax: null, estimatedRent: null, history: [] },
      comparables: [], ledger: [], documents: [], reminders: []
    };
    return o ? deepMerge(p, o) : p;
  };

  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function deepMerge(base, over) {
    Object.keys(over || {}).forEach(function (k) {
      var v = over[k];
      if (isObj(v) && isObj(base[k])) deepMerge(base[k], v);
      else if (v === null && (isObj(base[k]) || Array.isArray(base[k]))) return;
      else if (Array.isArray(base[k]) && v !== undefined && !Array.isArray(v)) return;
      else if (v !== undefined) base[k] = v;
    });
    return base;
  }
  M.deepMerge = deepMerge;

  /* Completa i campi mancanti (import, versioni precedenti) e corregge i tipi */
  M.normalize = function (raw) {
    var p = M.newProperty();
    var id = raw && raw.id ? String(raw.id) : p.id;
    var r = U.clone(raw || {});
    if (typeof r.tags === 'string') r.tags = r.tags.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    deepMerge(p, r);
    p.id = id; p.schema = M.SCHEMA;
    if (!M.TYPES[p.type]) p.type = 'altro';
    if (!M.STATUS[p.status]) p.status = 'posseduto';
    if (!M.USAGE[p.usage]) p.usage = 'seconda_casa';
    if (!M.CATEGORIES[p.category]) p.category = M.typeCategory(p.type);
    p.country = String(p.country || 'IT').toUpperCase().slice(0, 2);
    p.currency = String(p.currency || 'EUR').toUpperCase().slice(0, 3);
    if (!(p.ownershipPct > 0 && p.ownershipPct <= 100)) p.ownershipPct = 100;
    if (!Array.isArray(p.tags)) p.tags = String(p.tags || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    ['furnishing', 'renovations', 'extraExpenses', 'loans', 'comparables', 'ledger', 'documents', 'reminders'].forEach(function (k) {
      if (!Array.isArray(p[k])) p[k] = [];
      p[k].forEach(function (it) { if (it && typeof it === 'object' && !it.id) it.id = U.uid(); });
    });
    if (!Array.isArray(p.cadastre.units) || !p.cadastre.units.length) p.cadastre.units = [M.newCadUnit()];
    if (!Array.isArray(p.purchase.otherCosts)) p.purchase.otherCosts = [];
    if (!Array.isArray(p.recurring.other)) p.recurring.other = [];
    if (!Array.isArray(p.taxesIT.other)) p.taxesIT.other = [];
    if (!Array.isArray(p.valuation.history)) p.valuation.history = [];
    p.loans.forEach(function (l) { deepMerge(l, deepMerge(M.newLoan(), U.clone(l))); });
    if (!p.createdAt) p.createdAt = Date.now();
    if (!p.updatedAt) p.updatedAt = p.createdAt;
    return p;
  };

  /* Duplicazione con nuovi id. opts: {comparables, documents, ledger, sale, reminders, asTarget, suffix} */
  M.duplicate = function (src, opts, n) {
    opts = opts || {};
    var c = U.clone(src), now = Date.now();
    c.id = U.uid(); c.createdAt = now; c.updatedAt = now;
    c.name = (src.name || 'Immobile') + (opts.suffix === false ? '' : ' (copia' + (n ? ' ' + n : '') + ')');
    if (c.code) c.code = c.code + '-' + (n || 'C');
    if (!opts.comparables) c.comparables = [];
    if (!opts.documents) c.documents = [];
    if (!opts.ledger) c.ledger = [];
    if (!opts.reminders) c.reminders = [];
    if (!opts.sale) {
      c.sale = M.newProperty().sale;
      if (c.status === 'venduto') c.status = 'posseduto';
    }
    if (opts.asTarget) c.status = 'obiettivo';
    ['furnishing', 'renovations', 'extraExpenses', 'loans', 'comparables', 'ledger', 'documents', 'reminders'].forEach(function (k) {
      (c[k] || []).forEach(function (it) { if (it && typeof it === 'object') it.id = U.uid(); });
    });
    return c;
  };

  M.displayName = function (p) {
    if (p.name) return p.name;
    var a = [M.typeLabel(p.type)];
    if (p.address && p.address.city) a.push(p.address.city);
    return a.join(' – ');
  };
  M.location = function (p) {
    var a = p.address || {}, parts = [];
    if (a.city) parts.push(a.city + (a.province && p.country === 'IT' ? ' (' + a.province + ')' : ''));
    if (p.country && p.country !== 'IT') parts.push(G.COUNTRIES ? G.COUNTRIES.name(p.country) : p.country);
    return parts.join(', ') || '—';
  };

  /* Impostazioni predefinite. I parametri fiscali sono modificabili dall'utente. */
  M.defaultParams = function () {
    return {
      irpefBrackets: [[28000, 23], [50000, 33], [null, 43]], irpefHighIncomeThreshold: 200000, irpefHighIncomeClawback: 440,
      cedolare: 21, cedolareConcordato: 10, cedolareBreveDalSecondo: 26, maxShortTermUnits: 2,
      imuRate: 1.06, imuMainLuxRate: 0.5, imuMainLuxDeduction: 200, imuConcordatoReduction: 25, imuComodatoReduction: 50, imuInagibileReduction: 50,
      registroLocazione: 2, registroLocazioneOwnerShare: 50, registroLocazioneMin: 67, concordatoBaseReduction: 30,
      irpefFlatRentDeduction: 5, irpefNonRentedSameComunePct: 50, irpefNonRentedOneThird: true,
      foreignRentForfait: 15,
      ivieRate: 1.06, ivieMainLuxRate: 0.4, ivieMainLuxDeduction: 200, ivieThreshold: 200, ivieThresholdMode: 'immobile',
      cgtSubstitute: 26, cgtYears: 5, cgtSuperbonusYears: 10,
      loanSubstitutePrimaCasa: 0.25, loanSubstituteOther: 2,
      mortgageInterestDeductionPct: 19, mortgageInterestCap: 4000,
      renoMainPct: 50, renoOtherPct: 36, renoCap: 96000, renoYears: 10, mobiliPct: 50, mobiliCap: 5000,
      regPrimaCasa: 2, regOther: 9, regMin: 1000, regAgricolo: 15, regEdificabile: 9, regFixedPrivate: 50, ivaFixed: 200,
      ivaPrimaCasa: 4, ivaResidential: 10, ivaLuxury: 22, ivaCommercial: 22, ipoCommercialIva: 3, catCommercialIva: 1,
      prezzoValorePrimaCasa: 110, prezzoValoreOther: 120,
      succIpo: 2, succCat: 1, succFixedPrimaCasa: 200
    };
  };
  M.defaultSettings = function () {
    return {
      version: 1, theme: 'auto',
      profile: { otherIncome: 40000, regionalPct: 1.23, municipalPct: 0.8, mainHomeComune: '', taxYear: 2026 },
      params: M.defaultParams(),
      defaults: { appreciationPct: 2, rentGrowthPct: 2, costGrowthPct: 2, vacancyPct: 5, saleCostPct: 4, compDiscountPct: 5, projectionYears: 10, pageSize: 25, discountRatePct: 5, livingInRoi: false },
      countryOverrides: {}, fxOverrides: {}
    };
  };
  M.normalizeSettings = function (s) {
    var d = M.defaultSettings();
    deepMerge(d, U.clone(s || {}));
    if (!Array.isArray(d.params.irpefBrackets) || !d.params.irpefBrackets.length) d.params.irpefBrackets = M.defaultParams().irpefBrackets;
    return d;
  };

  G.MODEL = M;
})(window.GPI = window.GPI || {});
