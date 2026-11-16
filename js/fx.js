/* Cambi valuta in tempo reale (BCE via Frankfurter + open.er-api + fawazahmed0) — GPI.FX
   Tutti i tassi sono espressi come "unità di valuta per 1 EUR": EUR = importo_locale / tasso */
(function (G) {
  'use strict';
  var U = G.U, FX = {};
  var STALE_MS = 12 * 3600 * 1000;

  /* Valute confluite nell'euro: tassi fissi irrevocabili */
  var LEGACY = { ITL: 1936.27, DEM: 1.95583, FRF: 6.55957, ESP: 166.386, PTE: 200.482, GRD: 340.75, ATS: 13.7603, BEF: 40.3399, LUF: 40.3399, NLG: 2.20371, IEP: 0.787564, FIM: 5.94573, HRK: 7.5345, BGN: 1.95583, SIT: 239.64, CYP: 0.585274, MTL: 0.4293, SKK: 30.126, EEK: 15.6466, LVL: 0.702804, LTL: 3.4528 };
  /* Valute ancorate all'euro */
  var EUR_PEG = { BAM: 1.95583, XOF: 655.957, XAF: 655.957, KMF: 491.96775, CVE: 110.265, XPF: 119.33174, STN: 24.5 };
  /* Valute ancorate al dollaro (unità per 1 USD) */
  var USD_PEG = { AED: 3.6725, SAR: 3.75, QAR: 3.64, OMR: 0.384497, BHD: 0.376, JOD: 0.709, PAB: 1, BSD: 1, BMD: 1, BZD: 2, BBD: 2, XCD: 2.7, AWG: 1.79, ANG: 1.79, DJF: 177.721, KYD: 0.833333, ERN: 15 };
  /* Istantanea indicativa (11/11/2026) usata solo se non c'è connessione al primo avvio */
  var FALLBACK_DATE = '2026-11-11';
  var FALLBACK = { USD: 1.1127, GBP: 0.83618, CHF: 0.9234, JPY: 177.18, AUD: 1.6222, CAD: 1.5839, NZD: 1.9928, SEK: 11.051, NOK: 10.6145, DKK: 7.4755, PLN: 4.4038, CZK: 24.378, HUF: 365.08, RON: 5.3451, TRY: 55.8897, ISK: 136.8, BRL: 6.1827, MXN: 20.7623, ZAR: 18.4307, CNY: 7.4225, HKD: 8.7298, SGD: 1.4271, THB: 37.487, INR: 104.254, IDR: 20223.32, MYR: 4.5326, PHP: 70.379, KRW: 1487.57, ILS: 3.529, AED: 4.1083, SAR: 4.195, QAR: 4.072, MAD: 10.9335, TND: 3.3626, EGP: 59.6748, RSD: 117.627, ALL: 90.816, MKD: 61.497, GEL: 2.9112, UAH: 51.154, ARS: 1728.79, CLP: 1087.15, COP: 3676.1, PEN: 3.8201, UYU: 45.25, DOP: 68.08, CRC: 507.62, VND: 28652.9, MUR: 52.538, KES: 145.68, TWD: 36.832, KZT: 501.11, AMD: 404.49, AZN: 1.9083, MDL: 20.155, BYN: 3.359, RUB: 92.91 };

  var NAMES = { EUR: 'Euro', USD: 'Dollaro USA', GBP: 'Sterlina britannica', CHF: 'Franco svizzero', JPY: 'Yen giapponese', AUD: 'Dollaro australiano', CAD: 'Dollaro canadese', NZD: 'Dollaro neozelandese', SEK: 'Corona svedese', NOK: 'Corona norvegese', DKK: 'Corona danese', PLN: 'Złoty polacco', CZK: 'Corona ceca', HUF: 'Fiorino ungherese', RON: 'Leu rumeno', TRY: 'Lira turca', ISK: 'Corona islandese', BRL: 'Real brasiliano', MXN: 'Peso messicano', ZAR: 'Rand sudafricano', CNY: 'Renminbi cinese', HKD: 'Dollaro di Hong Kong', SGD: 'Dollaro di Singapore', THB: 'Baht thailandese', INR: 'Rupia indiana', IDR: 'Rupia indonesiana', MYR: 'Ringgit malese', PHP: 'Peso filippino', KRW: 'Won sudcoreano', ILS: 'Nuovo shekel israeliano', AED: 'Dirham degli Emirati', SAR: 'Riyal saudita', QAR: 'Riyal del Qatar', OMR: 'Rial dell\'Oman', BHD: 'Dinaro del Bahrein', KWD: 'Dinaro kuwaitiano', JOD: 'Dinaro giordano', MAD: 'Dirham marocchino', TND: 'Dinaro tunisino', EGP: 'Sterlina egiziana', DZD: 'Dinaro algerino', RSD: 'Dinaro serbo', ALL: 'Lek albanese', MKD: 'Denar macedone', BAM: 'Marco bosniaco', GEL: 'Lari georgiano', UAH: 'Grivnia ucraina', RUB: 'Rublo russo', BYN: 'Rublo bielorusso', MDL: 'Leu moldavo', ARS: 'Peso argentino', CLP: 'Peso cileno', COP: 'Peso colombiano', PEN: 'Sol peruviano', UYU: 'Peso uruguaiano', DOP: 'Peso dominicano', CRC: 'Colón costaricano', VND: 'Dong vietnamita', MUR: 'Rupia mauriziana', SCR: 'Rupia delle Seychelles', MVR: 'Rufiyaa maldiviana', KES: 'Scellino keniota', TWD: 'Nuovo dollaro taiwanese', KZT: 'Tenge kazako', AMD: 'Dram armeno', AZN: 'Manat azero', XOF: 'Franco CFA (BCEAO)', XAF: 'Franco CFA (BEAC)', XPF: 'Franco CFP', CVE: 'Escudo capoverdiano', LKR: 'Rupia singalese', PKR: 'Rupia pakistana', BDT: 'Taka bengalese', NGN: 'Naira nigeriana', GHS: 'Cedi ghanese', TZS: 'Scellino tanzaniano', XCD: 'Dollaro dei Caraibi orientali', BSD: 'Dollaro delle Bahamas', PAB: 'Balboa panamense', CUP: 'Peso cubano', ITL: 'Lira italiana (storica)', DEM: 'Marco tedesco (storico)', FRF: 'Franco francese (storico)', ESP: 'Peseta spagnola (storica)', PTE: 'Escudo portoghese (storico)', GRD: 'Dracma greca (storica)', ATS: 'Scellino austriaco (storico)', BEF: 'Franco belga (storico)', LUF: 'Franco lussemburghese (storico)', NLG: 'Fiorino olandese (storico)', IEP: 'Sterlina irlandese (storica)', FIM: 'Marco finlandese (storico)', HRK: 'Kuna croata (storica)', BGN: 'Lev bulgaro (storico)', SIT: 'Tallero sloveno (storico)', CYP: 'Sterlina cipriota (storica)', MTL: 'Lira maltese (storica)', SKK: 'Corona slovacca (storica)', EEK: 'Corona estone (storica)', LVL: 'Lats lettone (storico)', LTL: 'Litas lituano (storico)' };
  var PRIORITY = ['EUR', 'USD', 'GBP', 'CHF', 'AED', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'BRL', 'MXN', 'ZAR', 'THB', 'MAD', 'TND', 'ALL', 'RSD', 'ITL'];

  var data = null, overrides = {}, hist = {}, histLoaded = false, refreshing = null;
  FX.version = 1;
  FX.LEGACY = LEGACY; FX.EUR_PEG = EUR_PEG; FX.USD_PEG = USD_PEG;

  function bump() { FX.version++; U.bus.emit('fx:updated', FX.status()); }

  FX.init = function () {
    return G.DB.getKV('fx:latest').then(function (d) {
      if (d && d.rates) data = d;
      return G.DB.getKV('fx:hist');
    }).then(function (h) {
      hist = h || {}; histLoaded = true;
      if (!data || Date.now() - (data.fetchedAt || 0) > STALE_MS) FX.refresh().catch(function () { /* resta il dato in cache */ });
    }).catch(function () { /* nessuna cache */ });
  };

  FX.setOverrides = function (o) { overrides = o || {}; bump(); };

  FX.status = function () {
    if (!data) return { ok: false, date: FALLBACK_DATE, fetchedAt: null, sources: ['istantanea offline indicativa'], count: Object.keys(FALLBACK).length, offline: true };
    return { ok: true, date: data.date, fetchedAt: data.fetchedAt, sources: data.sources, count: Object.keys(data.rates).length, stale: Date.now() - data.fetchedAt > STALE_MS };
  };

  FX.refresh = function (force) {
    if (refreshing) return refreshing;
    if (!force && data && Date.now() - data.fetchedAt < STALE_MS) return Promise.resolve(data);
    var ecb = U.fetchJSON('https://api.frankfurter.dev/v1/latest?base=EUR').catch(function () { return null; });
    var er = U.fetchJSON('https://open.er-api.com/v6/latest/EUR').catch(function () { return null; });
    refreshing = Promise.all([ecb, er]).then(function (r) {
      var rates = {}, src = {}, sources = [], date = null;
      if (r[1] && r[1].rates) {
        Object.keys(r[1].rates).forEach(function (k) { var v = +r[1].rates[k]; if (v > 0) { rates[k] = v; src[k] = 'open.er-api.com'; } });
        sources.push('open.er-api.com');
        if (r[1].time_last_update_unix) date = U.iso(new Date(r[1].time_last_update_unix * 1000));
      }
      if (r[0] && r[0].rates) {
        Object.keys(r[0].rates).forEach(function (k) { var v = +r[0].rates[k]; if (v > 0) { rates[k] = v; src[k] = 'BCE'; } });
        sources.unshift('BCE (frankfurter.dev)');
        date = r[0].date || date;
      }
      if (Object.keys(rates).length) return { rates: rates, src: src, sources: sources, date: date };
      return fetchFawaz('latest');
    }).then(function (res) {
      if (!res) throw new Error('Nessuna fonte di cambio raggiungibile');
      res.rates.EUR = 1;
      data = { base: 'EUR', date: res.date || U.todayISO(), fetchedAt: Date.now(), sources: res.sources, rates: res.rates, src: res.src };
      bump();
      return G.DB.setKV('fx:latest', data).then(function () { return data; });
    });
    refreshing.then(function () { refreshing = null; }, function () { refreshing = null; });
    return refreshing;
  };

  function fetchFawaz(tag) {
    var urls = ['https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@' + tag + '/v1/currencies/eur.json'];
    if (tag === 'latest') urls.push('https://latest.currency-api.pages.dev/v1/currencies/eur.json');
    else urls.push('https://' + tag + '.currency-api.pages.dev/v1/currencies/eur.json');
    function tryAt(i) {
      if (i >= urls.length) return Promise.resolve(null);
      return U.fetchJSON(urls[i]).then(function (j) {
        if (!j || !j.eur) return tryAt(i + 1);
        var rates = {}, src = {};
        Object.keys(j.eur).forEach(function (k) {
          var K = k.toUpperCase(), v = +j.eur[k];
          if (/^[A-Z]{3}$/.test(K) && v > 0) { rates[K] = v; src[K] = 'fawazahmed0'; }
        });
        return { rates: rates, src: src, sources: ['currency-api (fawazahmed0)'], date: j.date };
      }, function () { return tryAt(i + 1); });
    }
    return tryAt(0);
  }

  FX.rateInfo = function (cur) {
    cur = (cur || 'EUR').toUpperCase();
    if (cur === 'EUR') return { rate: 1, source: 'EUR' };
    var ov = +overrides[cur];
    if (ov > 0) return { rate: ov, source: 'manuale' };
    if (LEGACY[cur]) return { rate: LEGACY[cur], source: 'tasso fisso di conversione in euro' };
    if (EUR_PEG[cur]) return { rate: EUR_PEG[cur], source: 'ancorata all\'euro' };
    var rates = data ? data.rates : FALLBACK;
    if (rates[cur] > 0) return { rate: rates[cur], source: data ? ((data.src && data.src[cur]) || 'live') + ' ' + U.fmtDate(data.date) : 'indicativo offline ' + U.fmtDate(FALLBACK_DATE) };
    if (USD_PEG[cur] && rates.USD > 0) return { rate: USD_PEG[cur] * rates.USD, source: 'ancorata al dollaro USA' };
    return { rate: null, source: 'non disponibile' };
  };
  FX.rate = function (cur) { return FX.rateInfo(cur).rate; };
  FX.toEur = function (amount, cur, rate) {
    if (!U.ok(amount)) return 0;
    if (!cur || cur === 'EUR') return amount;
    var r = rate > 0 ? rate : FX.rate(cur);
    return r > 0 ? amount / r : amount;
  };
  FX.convert = function (amount, from, to) {
    var a = FX.rate(from), b = FX.rate(to);
    return a > 0 && b > 0 ? amount / a * b : null;
  };

  /* Tasso storico alla data (per acquisto/vendita). Risolve {rate, source, date} */
  FX.historical = function (cur, date) {
    cur = (cur || 'EUR').toUpperCase();
    if (cur === 'EUR') return Promise.resolve({ rate: 1, source: 'EUR', date: date });
    if (LEGACY[cur]) return Promise.resolve({ rate: LEGACY[cur], source: 'tasso fisso di conversione in euro', date: date });
    if (EUR_PEG[cur]) return Promise.resolve({ rate: EUR_PEG[cur], source: 'ancorata all\'euro', date: date });
    if (!U.validDate(date) || date >= U.todayISO()) {
      var ri = FX.rateInfo(cur);
      return Promise.resolve({ rate: ri.rate, source: ri.source, date: U.todayISO() });
    }
    var key = cur + '|' + date;
    if (hist[key]) return Promise.resolve(hist[key]);
    var d = date < '1999-01-04' ? '1999-01-04' : date;
    var ecbCur = USD_PEG[cur] ? 'USD' : cur;
    return U.fetchJSON('https://api.frankfurter.dev/v1/' + d + '?base=EUR&symbols=' + ecbCur).then(function (j) {
      var v = j && j.rates ? +j.rates[ecbCur] : 0;
      if (!(v > 0)) throw new Error('n/d');
      var note = date < '1999-01-04' ? ' (primo cambio BCE disponibile)' : '';
      if (USD_PEG[cur]) return { rate: v * USD_PEG[cur], source: 'BCE ' + U.fmtDate(j.date) + ' via USD' + note, date: j.date };
      return { rate: v, source: 'BCE ' + U.fmtDate(j.date) + note, date: j.date };
    }).catch(function () {
      return fetchFawaz(d).then(function (r) {
        if (r && r.rates[cur] > 0) return { rate: r.rates[cur], source: 'currency-api ' + U.fmtDate(r.date || d), date: r.date || d };
        var ri = FX.rateInfo(cur);
        return { rate: ri.rate, source: 'storico non disponibile: usato cambio attuale', date: U.todayISO(), approx: true };
      });
    }).then(function (res) {
      if (res && res.rate > 0 && !res.approx) {
        hist[key] = res;
        if (histLoaded) G.DB.setKV('fx:hist', hist).catch(function () { /* ignora */ });
      }
      return res;
    });
  };

  FX.currencies = function () {
    var set = {};
    PRIORITY.forEach(function (c) { set[c] = 1; });
    Object.keys(data ? data.rates : FALLBACK).forEach(function (c) { set[c] = 1; });
    [LEGACY, EUR_PEG, USD_PEG, NAMES].forEach(function (m) { Object.keys(m).forEach(function (c) { set[c] = 1; }); });
    var rest = Object.keys(set).filter(function (c) { return PRIORITY.indexOf(c) < 0; }).sort();
    return PRIORITY.concat(rest);
  };
  var dn = null;
  try { dn = new Intl.DisplayNames(['it'], { type: 'currency' }); } catch (e) { dn = null; }
  FX.name = function (cur) {
    if (NAMES[cur]) return NAMES[cur];
    try { var n = dn ? dn.of(cur) : null; if (n && n !== cur) return n.charAt(0).toUpperCase() + n.slice(1); } catch (e) { /* ignora */ }
    return cur;
  };
  FX.liveRates = function () { return data ? data.rates : FALLBACK; };

  G.FX = FX;
})(window.GPI = window.GPI || {});
