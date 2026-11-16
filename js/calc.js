/* Motore di calcolo: costi, flussi, imposte, ROI, IRR, metriche, proiezioni e portafoglio (GPI.CALC)
   Convenzioni: gli importi sono inseriti al 100% nella valuta dell'immobile; i risultati sono in EUR
   pro quota (ownershipPct). Tassi di cambio = unità di valuta per 1 EUR (EUR = locale / tasso). */
(function (G) {
  'use strict';
  var U = G.U, MD = G.MODEL, T = G.TAX, C = {};
  var baseCache = {};
  var REP_STEP = { mensile: 1, trimestrale: 3, semestrale: 6, annuale: 12 };

  function FXr(cur) { return G.FX ? G.FX.rate(cur) : null; }
  function fxVersion() { return G.FX ? G.FX.version : 0; }
  function preset(cc, S) { var k = G.COUNTRIES; return k && k.preset ? (k.preset(cc, S) || {}) : {}; }
  function isEEA(cc) { var k = G.COUNTRIES; return cc === 'IT' || !!(k && k.isEEA && k.isEEA(cc)); }
  function isBlack(cc) { var k = G.COUNTRIES; return !!(k && k.isBlacklist && k.isBlacklist(cc)); }
  function freqMult(f) { var x = MD.FREQ[f]; return x ? x[1] : 1; }
  function pos(v) { var x = U.n(v); return x > 0 ? x : 0; }
  function pct(v) { return U.n(v) / 100; }
  function note(arr, level, msg, tab) { arr.push({ level: level, msg: msg, tab: tab || '' }); }
  function yStart(y) { return y + '-01-01'; }

  /* Mesi interi tra due date ISO: si toglie un mese se il giorno di b precede quello di a (salvo fine mese) */
  function monthDiff(a, b) {
    var x = U.parseDate(a), y = U.parseDate(b);
    if (!x || !y) return 0;
    var m = (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth());
    var lastY = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth() + 1, 0)).getUTCDate();
    if (y.getUTCDate() < x.getUTCDate() && y.getUTCDate() !== lastY) m -= 1;
    return m;
  }
  C.monthDiff = monthDiff;

  /* Prossima ricorrenza (>= oggi) di una data con ripetizione */
  function nextOcc(date, repeat, today) {
    if (!U.validDate(date)) return null;
    var st = REP_STEP[repeat];
    if (!st || date >= today) return date;
    var k = Math.ceil(monthDiff(date, today) / st), d = U.addMonths(date, k * st), guard = 0;
    while (d < today && guard++ < 1000) { k++; d = U.addMonths(date, k * st); }
    return d;
  }
  C.nextOcc = nextOcc;

  C.invalidate = function (id) { if (id) delete baseCache[id]; else baseCache = {}; };

  /* ---------- Mutui: piano di ammortamento ---------- */
  C.loanStats = function (loan, p, asOf) {
    var A = U.n(loan.amount), yrs = U.n(loan.years);
    if (!(A > 0 && yrs > 0)) return null;
    var N = Math.max(1, Math.round(yrs * 12)), i = U.n(loan.ratePct) / 1200;
    var start = U.validDate(loan.startDate) ? loan.startDate : (U.validDate(p.purchase.date) ? p.purchase.date : (asOf || U.todayISO()));
    var method = MD.LOAN_METHODS[loan.method] ? loan.method : 'francese';
    var annuity = i > 0 ? A * i / (1 - Math.pow(1 + i, -N)) : A / N;
    var fixed = pos(loan.paymentOverride) || annuity;
    var bal = [A], pay = [0], intr = [0], b = A, k;
    for (k = 1; k <= N; k++) {
      var it = b * i, pr;
      if (method === 'italiano') pr = A / N;
      else if (method === 'bullet') pr = 0;
      else pr = fixed - it;
      if (k === N) pr = b;
      pr = U.clamp(pr, 0, b);
      b -= pr;
      if (b < 1e-7) b = 0;
      bal.push(b); pay.push(it + pr); intr.push(it);
    }
    var kAt = function (d) { return U.clamp(monthDiff(start, d), 0, N); };
    var k0 = kAt(asOf || U.todayISO()), prepaid = 0;
    if (U.has(loan.balanceOverride) && U.n(loan.balanceOverride) >= 0 && bal[k0] > 0) {
      var B = U.n(loan.balanceOverride), f = B / bal[k0];
      prepaid = bal[k0] - B;
      for (k = k0; k <= N; k++) { bal[k] *= f; if (k > k0) { pay[k] *= f; intr[k] *= f; } }
    }
    var cumPay = [0], cumInt = [0];
    for (k = 1; k <= N; k++) { cumPay.push(cumPay[k - 1] + pay[k]); cumInt.push(cumInt[k - 1] + intr[k]); }
    /* Rate con scadenza nell'intervallo (a, b] */
    var between = function (a, b2) {
      var ka = a ? kAt(a) : 0, kb = kAt(b2);
      if (kb <= ka) return { pay: 0, int: 0, prin: 0, n: 0 };
      var py = cumPay[kb] - cumPay[ka], ii = cumInt[kb] - cumInt[ka];
      return { pay: py, int: ii, prin: py - ii, n: kb - ka };
    };
    /* Piano annuale per anno solare */
    var yearly = function () {
      var rows = {}, out = [];
      for (var j = 1; j <= N; j++) {
        var y = U.year(U.addMonths(start, j)), r = rows[y];
        if (!r) { r = rows[y] = { year: y, pay: 0, int: 0, prin: 0, balance: 0, n: 0 }; out.push(r); }
        r.pay += pay[j]; r.int += intr[j]; r.prin += pay[j] - intr[j]; r.balance = bal[j]; r.n++;
      }
      return out;
    };
    return {
      N: N, start: start, end: U.addMonths(start, N), amount: A, method: method, rate: i * 12,
      payment: pay[1], paymentNow: k0 < N ? pay[k0 + 1] : 0, balanceNow: bal[k0],
      totalInterest: cumInt[N], totalPaid: cumPay[N], remainingMonths: N - k0, paidInstallments: k0, prepaid: prepaid,
      bal: bal, pay: pay, intr: intr, cumPay: cumPay, cumInt: cumInt,
      kAt: kAt, balanceAt: function (d) { return bal[kAt(d)]; }, between: between, yearly: yearly
    };
  };

  /* ---------- IRR (XIRR) e VAN ---------- */
  C.xirr = function (flows) {
    var f = (flows || []).filter(function (x) { return x && U.ok(x.amount) && Math.abs(x.amount) > 1e-9 && U.validDate(x.date); })
      .map(function (x) { return { a: x.amount, d: x.date, t: 0 }; });
    if (f.length < 2) return null;
    if (!f.some(function (x) { return x.a > 0; }) || !f.some(function (x) { return x.a < 0; })) return null;
    f.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    var d0 = f[0].d, j, it;
    f.forEach(function (x) { x.t = U.daysBetween(d0, x.d) / 365; });
    if (!(f[f.length - 1].t > 0)) return null;
    var scale = U.sum(f, function (x) { return Math.abs(x.a); });
    var npv = function (r) { var s = 0; for (j = 0; j < f.length; j++) s += f[j].a / Math.pow(1 + r, f[j].t); return s; };
    var dnpv = function (r) { var s = 0; for (j = 0; j < f.length; j++) s -= f[j].t * f[j].a / Math.pow(1 + r, f[j].t + 1); return s; };
    var r = 0.1;
    for (it = 0; it < 50; it++) {
      var v = npv(r), dv = dnpv(r);
      if (!isFinite(v) || !isFinite(dv) || dv === 0) break;
      if (Math.abs(v) < 1e-9 * scale) return r;
      var nr = r - v / dv;
      if (!isFinite(nr)) break;
      if (nr <= -0.9999) nr = (r - 0.9999) / 2;
      if (Math.abs(nr - r) < 1e-12) { r = nr; break; }
      r = nr;
    }
    if (isFinite(r) && r > -0.9999 && Math.abs(npv(r)) < 1e-6 * scale) return r;
    var lo = -0.99, hi = 10, flo = npv(lo), fhi = npv(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (it = 0; it < 200; it++) {
      var mid = (lo + hi) / 2, fm = npv(mid);
      if (Math.abs(fm) < 1e-9 * scale || hi - lo < 1e-12) return mid;
      if (fm * flo < 0) hi = mid; else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  };
  C.npv = function (flows, ratePct, date0) {
    var r = U.n(ratePct) / 100, f = (flows || []).filter(function (x) { return x && U.ok(x.amount) && U.validDate(x.date); });
    if (!f.length) return null;
    var d0 = date0 || f.reduce(function (m, x) { return !m || x.date < m ? x.date : m; }, '');
    return U.sum(f, function (x) { return x.amount / Math.pow(1 + r, U.daysBetween(d0, x.date) / 365); });
  };

  /* ---------- Comparabili (valuta dell'immobile, 100%) ---------- */
  C.comps = function (p, S) {
    var D = (S && S.defaults) || {}, sqm = pos(p.sqm), list = p.comparables || [];
    var stats = function (kind) {
      var arr = list.filter(function (c) { return c && c.include !== false && (c.kind || 'vendita') === kind && pos(c.price) > 0 && pos(c.sqm) > 0; })
        .map(function (c) { return pos(c.price) / pos(c.sqm); });
      if (!arr.length) return { n: 0, med: null, min: null, max: null, mean: null };
      return { n: arr.length, med: U.median(arr), min: Math.min.apply(null, arr), max: Math.max.apply(null, arr), mean: U.mean(arr) };
    };
    var s = stats('vendita'), a = stats('affitto'), disc = pct(D.compDiscountPct), va = p.valuation || {};
    var r = { sale: s, rent: a, count: list.length, sqm: sqm };
    r.estValue = s.med && sqm ? s.med * sqm * (1 - disc) : null;
    r.estRent = a.med && sqm ? a.med * sqm : null;
    r.estYield = r.estValue && r.estRent ? r.estRent * 12 / r.estValue : null;
    r.ownSqmPrice = sqm && pos(p.purchase.price) ? pos(p.purchase.price) / sqm : null;
    r.gapPct = r.ownSqmPrice && s.med ? r.ownSqmPrice / s.med - 1 : null;
    r.valueSqmPrice = sqm && pos(va.marketValue) ? pos(va.marketValue) / sqm : null;
    r.valueGapPct = r.valueSqmPrice && s.med ? r.valueSqmPrice / s.med - 1 : null;
    r.askSqmPrice = sqm && pos(p.sale && p.sale.askingPrice) ? pos(p.sale.askingPrice) / sqm : null;
    r.askGapPct = r.askSqmPrice && s.med ? r.askSqmPrice / s.med - 1 : null;
    r.rentSqm = sqm && pos(p.rental.monthlyRent) ? pos(p.rental.monthlyRent) / sqm : null;
    r.rentGapPct = r.rentSqm && a.med ? r.rentSqm / a.med - 1 : null;
    r.omiMid = pos(va.omiMin) && pos(va.omiMax) ? (pos(va.omiMin) + pos(va.omiMax)) / 2 : (pos(va.omiMin) || pos(va.omiMax) || null);
    r.omiRentMid = pos(va.omiRentMin) && pos(va.omiRentMax) ? (pos(va.omiRentMin) + pos(va.omiRentMax)) / 2 : (pos(va.omiRentMin) || pos(va.omiRentMax) || null);
    r.omiValue = r.omiMid && sqm ? r.omiMid * sqm : null;
    r.omiRent = r.omiRentMid && sqm ? r.omiRentMid * sqm : null;
    return r;
  };
  /* ---------- Calcolo base del singolo immobile (indipendente dal resto del portafoglio) ---------- */
  function computeBase(p, S) {
    var P = S.params, D = S.defaults || {};
    var al = [], today = U.todayISO();
    var cc = p.country || 'IT', isIT = cc === 'IT', pre = isIT ? {} : preset(cc, S);
    var st = p.status, sold = st === 'venduto', pipe = !!MD.PIPELINE[st], active = !!MD.ACTIVE[st];
    var rented = MD.isRented(p), short = MD.isShort(p);
    var pu = p.purchase, sa = p.sale, re = p.rental, rc = p.recurring, tf = p.taxesForeign, va = p.valuation;
    var share = U.n(p.ownershipPct) / 100;
    if (!(share > 0 && share <= 1)) { share = 1; note(al, 'warn', 'Quota di possesso non valida: considerata al 100%.', 'generale'); }

    /* Cambi: tasso attuale, all'acquisto, alla vendita */
    var cur = p.currency || 'EUR', rNow = FXr(cur), foreignCur = cur !== 'EUR';
    if (!(rNow > 0)) { rNow = 1; note(al, 'danger', 'Cambio non disponibile per ' + cur + ': importi considerati alla pari con l\'euro. Imposta un cambio manuale nella sezione Cambi.', 'generale'); }
    var rBuy = pos(pu.fxRate) || rNow;
    if (foreignCur && !pos(pu.fxRate) && !pipe) note(al, 'info', 'Cambio alla data d\'acquisto non indicato: uso il cambio attuale (pulsante "Cambio storico" nella scheda Acquisto).', 'acquisto');
    var rSell = pos(sa.fxRate) || rNow;
    if (foreignCur && sold && !pos(sa.fxRate)) note(al, 'info', 'Cambio alla data di vendita non indicato: uso il cambio attuale.', 'vendita');
    var rOp = sold ? rSell : rNow;

    /* Date */
    var buyDate = U.validDate(pu.date) ? pu.date : null;
    if (!buyDate) { buyDate = today; if (!pipe) note(al, 'warn', 'Data di acquisto mancante: considerata la data odierna.', 'acquisto'); }
    var saleDate = null;
    if (sold) {
      saleDate = U.validDate(sa.date) ? sa.date : null;
      if (!saleDate) { saleDate = today; note(al, 'warn', 'Data di vendita mancante: considerata la data odierna.', 'vendita'); }
      if (saleDate < buyDate) note(al, 'danger', 'La data di vendita precede quella di acquisto.', 'vendita');
    }
    var asOf = U.maxDate(sold ? saleDate : today, buyDate);
    var holdYears = Math.max(0, U.yearsBetween(buyDate, asOf));

    /* Acquisto (valuta locale, 100%) */
    var ptx = T.purchaseTaxes(p, P, pre);
    var acqL = {
      price: pos(pu.price), taxes: pos(ptx.total), notary: pos(pu.notary), agency: pos(pu.agency), technical: pos(pu.technical), mortgage: pos(pu.mortgageCosts),
      other: U.sum(pu.otherCosts || [], function (c) { return pos(c && c.amount); })
    };
    acqL.costs = acqL.taxes + acqL.notary + acqL.agency + acqL.technical + acqL.mortgage + acqL.other;
    var priceEur = acqL.price / rBuy * share, acqCostsEur = acqL.costs / rBuy * share;
    var mortCostsEur = acqL.mortgage / rBuy * share, acqCostsBasisEur = acqCostsEur - mortCostsEur;
    if (!acqL.price && !pipe && p.acquisitionMode !== 'costruzione') note(al, 'warn', 'Prezzo (o valore) d\'acquisto mancante: rendimenti e ROI non calcolabili.', 'acquisto');

    /* Mutui */
    var loans = [], loanInEur = 0, subTaxEur = 0, debtEur = 0, debtAtSaleEur = 0, prepaidEur = 0, ds = { pay: 0, int: 0, prin: 0 };
    (p.loans || []).forEach(function (l) {
      var ls = l ? C.loanStats(l, p, asOf) : null;
      if (!ls) { if (l && (U.has(l.amount) || U.has(l.ratePct))) note(al, 'warn', 'Mutuo "' + (l.label || 'Mutuo') + '" incompleto: indica importo, tasso e durata.', 'mutui'); return; }
      var lc = l.currency || cur, rIn, rSvc;
      if (lc === cur) { rIn = U.daysBetween(buyDate, ls.start) > 183 ? rNow : rBuy; rSvc = rOp; }
      else { rIn = FXr(lc) || 1; rSvc = rIn; }
      var f = share / rSvc, w0, w1;
      if (sold) { w1 = saleDate; w0 = U.addMonths(saleDate, -12); }
      else if (pipe) { w0 = ls.start; w1 = U.addMonths(ls.start, 12); }
      else { w0 = asOf; w1 = U.addMonths(asOf, 12); }
      var b12 = ls.between(w0, w1);
      var x = {
        loan: l, stats: ls, currency: lc, rIn: rIn, rSvc: rSvc,
        inflowEur: ls.amount / rIn * share, subTaxEur: T.loanSubstituteTax(l, p, P) / rIn * share,
        debtEur: sold ? 0 : ls.balanceNow * f, debtAtSaleEur: sold ? ls.balanceNow * f : 0, prepaidEur: ls.prepaid * f,
        ds12: { pay: b12.pay * f, int: b12.int * f, prin: b12.prin * f }
      };
      loans.push(x);
      loanInEur += x.inflowEur; subTaxEur += x.subTaxEur; debtEur += x.debtEur; debtAtSaleEur += x.debtAtSaleEur; prepaidEur += x.prepaidEur;
      ds.pay += x.ds12.pay; ds.int += x.ds12.int; ds.prin += x.ds12.prin;
    });

    /* Arredi, lavori, spese extra: esborsi, costo fiscale, detrazioni */
    var items = [], capexBasisEur = 0, sbCessEur = 0, capexValueL = 0, itemsOutlayEur = 0, furnEur = 0, renoEur = 0, extraEur = 0, sbEnd = null, dedGroups = {};
    var addItems = function (arr, kind) {
      (arr || []).forEach(function (e) {
        var amt = pos(e && e.amount);
        if (!amt) return;
        var d = U.validDate(e.date) ? e.date : buyDate;
        var r = pos(e.fxRate) || (U.daysBetween(buyDate, d) > 183 ? rNow : rBuy);
        var amountEur = amt / r * share, y = U.year(d);
        var bonus = isIT && e.bonus && e.bonus !== 'nessuno' && MD.BONUS[e.bonus] ? e.bonus : null;
        var dp = bonus ? (U.has(e.deductionPct) ? U.n(e.deductionPct) : T.defaultDeductionPct(bonus, p, P, y)) : 0;
        var dy = bonus ? (pos(e.deductionYears) || T.defaultDeductionYears(bonus, P, y)) : 0;
        var cess = !!(bonus && e.cessione && dp > 0);
        var outlayL = cess ? (U.has(e.netCost) ? pos(e.netCost) : amt * Math.max(0, 1 - dp / 100)) : amt;
        var outlayEur = outlayL / r * share;
        var cap = kind === 'renovations' ? e.capitalized !== false : (kind === 'extraExpenses' ? e.capitalized === true : false);
        if (cap) {
          if (bonus === 'superbonus' && cess) sbCessEur += amountEur; else capexBasisEur += amountEur;
          capexValueL += amt;
        }
        if (bonus === 'superbonus') sbEnd = U.maxDate(sbEnd, U.validDate(e.endDate) ? e.endDate : d);
        if (bonus && dp > 0 && !cess) {
          var gk = bonus + '|' + y, g = dedGroups[gk] || (dedGroups[gk] = { bonus: bonus, year: y, amount100: 0, entries: [] });
          g.amount100 += amt / r;
          g.entries.push({ amountEur: amountEur, pct: dp, years: dy });
        }
        items.push({ id: e.id, kind: kind, label: e.description || '', date: d, amountL: amt, amountEur: amountEur, outlayEur: outlayEur, cap: cap, bonus: bonus, pct: dp, years: dy, cess: cess });
        itemsOutlayEur += outlayEur;
        if (kind === 'furnishing') furnEur += outlayEur; else if (kind === 'renovations') renoEur += outlayEur; else extraEur += outlayEur;
      });
    };
    addItems(p.furnishing, 'furnishing'); addItems(p.renovations, 'renovations'); addItems(p.extraExpenses, 'extraExpenses');
    /* Piano detrazioni per anno d'imposta (massimale per unità e per anno, ripartito sulla quota) */
    var dedSched = {}, dedTotalEur = 0;
    Object.keys(dedGroups).forEach(function (k) {
      var g = dedGroups[k], cap = T.deductionCap(g.bonus, P), sc = g.amount100 > 0 ? Math.min(1, cap / g.amount100) : 0;
      g.entries.forEach(function (e) {
        var yrs = Math.max(1, Math.round(e.years)), annual = e.amountEur * sc * e.pct / 100 / yrs;
        for (var j = 0; j < yrs; j++) dedSched[g.year + j] = (dedSched[g.year + j] || 0) + annual;
        dedTotalEur += annual * yrs;
      });
    });
    var saleYear = sold ? U.year(saleDate) : null;
    /* Con la vendita le rate residue passano all'acquirente (salvo diverso accordo nell'atto) */
    var deductionsIn = function (y) { return sold && y >= saleYear ? 0 : (dedSched[y] || 0); };

    /* Valore attuale */
    var cmp = C.comps(p, S), valueL = 0, valueSrc = '', valueEstimated = false;
    if (sold) {
      valueL = pos(sa.price); valueSrc = 'Prezzo di vendita';
      if (!valueL) note(al, 'warn', 'Prezzo di vendita mancante.', 'vendita');
    } else if (pos(va.marketValue)) {
      valueL = pos(va.marketValue);
      valueSrc = 'Valutazione' + (va.source ? ' – ' + va.source : '') + (U.validDate(va.date) ? ' (' + U.fmtDate(va.date) + ')' : '');
      if (active && U.validDate(va.date) && monthDiff(va.date, today) >= 12) note(al, 'info', 'Valutazione di mercato più vecchia di 12 mesi: aggiornala.', 'catasto');
    } else if (cmp.estValue) {
      valueL = cmp.estValue; valueEstimated = true;
      valueSrc = 'Stima da ' + cmp.sale.n + ' comparabili (mediana prezzo/m², sconto trattativa ' + U.fmtNum(U.n(D.compDiscountPct), 0) + '%)';
    } else if (cmp.omiValue) {
      valueL = cmp.omiValue; valueEstimated = true; valueSrc = 'Stima da quotazioni OMI (valore medio)';
    } else if (acqL.price + capexValueL > 0) {
      valueL = (acqL.price + capexValueL) * Math.pow(1 + pct(D.appreciationPct), holdYears); valueEstimated = true;
      valueSrc = 'Stima: prezzo + lavori rivalutati del ' + U.fmtNum(U.n(D.appreciationPct), 1) + '% annuo';
    }
    var valueEur = valueL / rOp * share;

    /* Ricavi da locazione (valuta locale, 100%) */
    var grossPotL = 0, grossL = 0, vac = 0;
    if (rented) {
      if (short) {
        if (pos(re.nightlyRate)) { grossPotL = pos(re.nightlyRate) * 365; grossL = grossPotL * U.clamp(U.has(re.occupancyPct) ? pct(re.occupancyPct) : 0.6, 0, 1); }
        else { grossPotL = pos(re.monthlyRent) * 12; grossL = grossPotL; }
      } else {
        vac = U.clamp(U.has(re.vacancyPct) ? pct(re.vacancyPct) : pct(D.vacancyPct), 0, 1);
        grossPotL = pos(re.monthlyRent) * 12;
        grossL = grossPotL * (1 - vac);
      }
      if (!grossPotL) note(al, 'warn', 'Immobile a reddito senza canone: inserisci il canone nella scheda Locazione.', 'locazione');
    }
    var grossEur = grossL / rOp * share, grossPotEur = grossPotL / rOp * share, yieldBaseEur = short ? grossEur : grossPotEur;
    var imputedEur = !rented && (p.usage === 'abitazione_principale' || p.usage === 'seconda_casa' || p.usage === 'uso_proprio') ? pos(re.imputedRentMonthly) * 12 / rOp * share : 0;

    /* Spese di gestione annue */
    var opex = [], tenantPays = rented && !short && rc.utilitiesPaidBy === 'inquilino';
    var living = !rented && (p.usage === 'abitazione_principale' || p.usage === 'uso_proprio');
    var ox = function (key, label, local, kind) { if (local > 0) opex.push({ key: key, label: label, local: local, eur: local / rOp * share, kind: kind || 'fixed' }); };
    var condoTen = rented && !short ? U.clamp(pct(rc.condoTenantSharePct), 0, 1) : 0;
    ox('condo', 'Spese condominiali ordinarie' + (condoTen ? ' (quota proprietario)' : ''), pos(rc.condoMonthly) * 12 * (1 - condoTen));
    ox('condoExtra', 'Spese condominiali straordinarie', pos(rc.condoExtraordinaryAnnual));
    if (!tenantPays) {
      [['water', 'Acqua', 'waterMonthly'], ['electricity', 'Luce', 'electricityMonthly'], ['gas', 'Gas', 'gasMonthly'], ['heating', 'Riscaldamento', 'heatingMonthly'], ['internet', 'Internet / TV', 'internetMonthly']].forEach(function (u) {
        ox(u[0], u[1], pos(rc[u[2]]) * 12, living ? 'living' : 'fixed');
      });
      ox('tari', 'TARI (rifiuti)', pos(rc.tariAnnual), living ? 'living' : 'fixed');
    }
    ox('insurance', 'Assicurazione', pos(rc.insuranceAnnual));
    ox('maintenance', 'Manutenzione ordinaria', pos(rc.maintenanceAnnual));
    ox('cleaning', 'Pulizie / biancheria', pos(rc.cleaningAnnual), short ? 'var' : 'fixed');
    if (rented) {
      ox('management', 'Gestione / property manager (' + U.fmtNum(U.n(rc.managementPct), 1) + '%)', grossL * pct(rc.managementPct), 'var');
      ox('platform', 'Commissioni piattaforme (' + U.fmtNum(U.n(rc.platformFeePct), 1) + '%)', grossL * pct(rc.platformFeePct), 'var');
    }
    (rc.other || []).forEach(function (o, i) { if (o) ox('other' + i, o.label || 'Altra spesa', pos(o.amount) * freqMult(o.freq)); });
    var livingIn = !!D.livingInRoi;
    var opexEur = U.sum(opex, function (o) { return o.kind === 'living' && !livingIn ? 0 : o.eur; });
    var opexLivingEur = U.sum(opex, function (o) { return o.kind === 'living' ? o.eur : 0; });
    var opexVarEur = U.sum(opex, function (o) { return o.kind === 'var' ? o.eur : 0; });
    var opexFixedEur = opexEur - opexVarEur;

    /* Imposte annue sull'immobile (EUR, pro quota) */
    var taxItems = [];
    var tx = function (key, label, eur, creditable) { if (eur > 0) taxItems.push({ key: key, label: label, eur: eur, creditable: !!creditable }); };
    var imuR = { amount: 0, base: 0, rate: 0, note: '' }, imuEur = 0;
    if (isIT) {
      imuR = T.imu(p, P); imuEur = pos(imuR.amount) * share;
      tx('imu', 'IMU', imuEur);
      if (imuR.note && imuR.note.indexOf('mancante') >= 0 && !pipe && !sold) note(al, 'warn', imuR.note, 'catasto');
    }
    ((p.taxesIT && p.taxesIT.other) || []).forEach(function (o, i) { if (o) tx('itOther' + i, o.label || 'Altra imposta/tributo', pos(o.amount) * freqMult(o.freq) * share); });
    var conc = !!(re.concordato || re.contractType === 'concordato_3_2' || re.contractType === 'studenti');
    var cedOk = rented && isIT && T.cedolareRate(p, P, 0) != null, regEur = 0;
    if (isIT && rented && !short && !cedOk && grossPotL > 0) {
      var regL = Math.max(U.n(P.registroLocazioneMin), grossPotL * pct(P.registroLocazione) * (conc && re.contractType !== 'studenti' ? 1 - pct(P.concordatoBaseReduction) : 1));
      regEur = regL * pct(P.registroLocazioneOwnerShare) / rOp * share;
      tx('registro', 'Imposta di registro contratto (quota locatore ' + U.fmtNum(U.n(P.registroLocazioneOwnerShare), 0) + '%)', regEur);
    }
    if (rented && isIT && re.taxRegime === 'cedolare' && !cedOk) note(al, 'warn', 'Cedolare secca non applicabile a questo immobile/contratto (es. locazione commerciale o unità non abitativa): applico la tassazione IRPEF ordinaria.', 'tasse');
    if (rented && !isIT && re.taxRegime === 'cedolare') note(al, 'info', 'La cedolare secca vale solo per immobili in Italia: i canoni esteri concorrono al reddito IRPEF con credito per le imposte pagate all\'estero.', 'tasse');
    if (isIT && short && active && !re.cin) note(al, 'info', 'Codice Identificativo Nazionale (CIN) non indicato: obbligatorio per locazioni brevi e turistiche.', 'locazione');

    /* Immobili esteri: imposte locali, IVIE, imposte sul reddito estere */
    var foreignTaxEur = 0, foreignIncomeITEur = 0, foreignCreditEur = 0, ivie = null;
    if (!isIT) {
      var vBase = valueL || acqL.price, estim = function (k) { return ' (stima ' + U.fmtNum(U.n(pre[k]), 2) + '% del valore)'; };
      var ptEntered = U.has(tf.propertyTaxAnnual);
      tx('ptaxForeign', 'Imposta immobiliare locale' + (ptEntered ? '' : estim('ptax')), (ptEntered ? pos(tf.propertyTaxAnnual) : vBase * pct(pre.ptax)) / rOp * share, tf.propertyTaxCreditable !== false);
      var wEntered = U.has(tf.wealthTaxAnnual);
      tx('wealthForeign', 'Imposta patrimoniale estera' + (wEntered ? '' : estim('wealthPct')), (wEntered ? pos(tf.wealthTaxAnnual) : vBase * pct(pre.wealthPct)) / rOp * share, true);
      if (!rented) {
        var iEntered = U.has(tf.imputedTaxAnnual);
        tx('imputedForeign', 'Imposta estera su reddito figurativo' + (iEntered ? '' : estim('imputedPct')), (iEntered ? pos(tf.imputedTaxAnnual) : vBase * pct(pre.imputedPct)) / rOp * share, isEEA(cc));
      }
      tx('otherForeign', 'Altre imposte estere', pos(tf.otherAnnual) / rOp * share, false);
      foreignCreditEur = U.sum(taxItems, function (t) { return t.creditable && t.key !== 'imu' && t.key.indexOf('itOther') !== 0 ? t.eur : 0; });
      var ivMode = tf.ivieBase || 'auto', ivB = 0, ivSrc = '';
      if (U.has(tf.ivieValueOverride)) { ivB = pos(tf.ivieValueOverride) * share; ivSrc = 'valore indicato manualmente (EUR)'; }
      else if (pos(p.cadastre.foreignValue) && (ivMode === 'catastale' || (ivMode === 'auto' && isEEA(cc)))) { ivB = pos(p.cadastre.foreignValue) / rNow * share; ivSrc = 'valore catastale estero'; }
      else if (acqL.price && ivMode !== 'mercato') { ivB = priceEur; ivSrc = 'costo d\'acquisto da atto'; }
      else if (valueL) { ivB = valueL / rNow * share; ivSrc = 'valore di mercato'; }
      var mainF = !!tf.foreignMainHome || p.usage === 'abitazione_principale', luxF = T.isLuxury(p), ivG = 0, ivNote = '';
      if (mainF && !luxF) ivNote = 'Abitazione principale non di lusso: IVIE non dovuta';
      else if (mainF) { ivG = Math.max(0, ivB * pct(P.ivieMainLuxRate) - U.n(P.ivieMainLuxDeduction) * share); ivNote = 'Abitazione principale di lusso: aliquota ridotta e detrazione'; }
      else ivG = ivB * pct(P.ivieRate);
      ivie = { base: ivB, gross: ivG, credit: Math.min(ivG, foreignCreditEur), src: ivSrc, note: ivNote };
      if (!ivB && !pipe) note(al, 'warn', 'Base IVIE non determinabile: indica prezzo d\'acquisto, valore catastale estero o valore di mercato.', 'tasse');
    }

    /* Basi imponibili per le imposte sui redditi (EUR, pro quota) */
    var renditaEur = isIT ? T.renditaTotal(p) * share : 0, cedBaseEur = 0, irpefBaseEur = 0;
    if (isIT && rented) {
      if (cedOk) cedBaseEur = grossEur;
      else irpefBaseEur = Math.max(renditaEur * 1.05, grossEur * (1 - pct(P.irpefFlatRentDeduction)) * (conc ? 1 - pct(P.concordatoBaseReduction) : 1));
    } else if (isIT) irpefBaseEur = T.nonRentedIrpefIncome(p, P) * share;
    if (!isIT && rented) {
      var rp = U.has(tf.rentalTaxPct) ? U.n(tf.rentalTaxPct) : U.n(pre.rentTax);
      var bMode = tf.rentalTaxBase && tf.rentalTaxBase !== 'auto' ? tf.rentalTaxBase : (pre.rentBase || 'lordo'), fb;
      if (U.has(tf.foreignTaxableIncome)) fb = pos(tf.foreignTaxableIncome) / rOp * share;
      else if (bMode === 'netto') fb = Math.max(0, grossEur - opexEur - U.sum(taxItems, function (t) { return t.eur; }) - ds.int);
      else if (bMode === 'lordo') fb = grossEur;
      else fb = grossEur * (U.has(pre.rentBasePct) ? pct(pre.rentBasePct) : 1);
      foreignTaxEur = fb * rp / 100;
      foreignIncomeITEur = rp > 0 ? fb : grossEur * (1 - pct(U.has(P.foreignRentForfait) ? P.foreignRentForfait : 15));
    }
    if (!isIT) {
      var cnm = G.COUNTRIES && G.COUNTRIES.name ? G.COUNTRIES.name(cc) : cc;
      if (pre.dtt === false) note(al, 'warn', 'Nessuna convenzione contro le doppie imposizioni tra Italia e ' + cnm + ': il credito per imposte estere (art. 165 TUIR) è comunque applicabile, ma verifica con un professionista.', 'tasse');
      if (isBlack(cc)) note(al, 'warn', cnm + ' è in elenco Paesi a fiscalità privilegiata: verifica obblighi dichiarativi e regole specifiche.', 'tasse');
      if (pre.warn) note(al, 'info', pre.warn, 'tasse');
    }

    /* Registro reale (entrate/uscite effettive) */
    var real = { in12: 0, out12: 0, inTot: 0, outTot: 0, byYear: {}, n: 0 }, l12 = U.addMonths(today, -12);
    (p.ledger || []).forEach(function (e) {
      var a = pos(e && e.amount);
      if (!a || !U.validDate(e.date)) return;
      var eur = a / rOp * share, inc = e.kind === 'entrata', y = U.year(e.date);
      var by = real.byYear[y] || (real.byYear[y] = { entrate: 0, uscite: 0 });
      if (inc) { real.inTot += eur; by.entrate += eur; } else { real.outTot += eur; by.uscite += eur; }
      if (e.date > l12 && e.date <= today) { if (inc) real.in12 += eur; else real.out12 += eur; }
      real.n++;
    });

    /* Scadenze (prossimi ~13 mesi) */
    var dates = [];
    if (active || pipe) {
      var horizon = U.addDays(today, 400);
      var dt = function (date, label, tab, level, allowPast, amount) {
        if (!U.validDate(date) || date > horizon || (date < today && !allowPast)) return;
        dates.push({ date: date, label: label, tab: tab || '', level: level || 'info', past: date < today, amount: amount || null, pid: p.id });
      };
      if (rented && U.validDate(re.endDate)) {
        dt(re.endDate, 'Scadenza contratto di locazione', 'locazione', 'warn', true);
        var comm = p.usage === 'locazione_commerciale' || re.contractType === 'commerciale_6_6' || re.contractType === 'alberghiero_9_9';
        if (!short) dt(U.addMonths(re.endDate, comm ? -12 : -6), 'Termine per l\'invio della disdetta (' + (comm ? 12 : 6) + ' mesi prima)', 'locazione', 'warn');
      }
      if (regEur > 0 && U.validDate(re.startDate)) dt(nextOcc(re.startDate, 'annuale', today), 'Registro annualità successive del contratto (entro 30 giorni)', 'tasse', 'info', false, regEur);
      loans.forEach(function (x) { dt(x.stats.end, 'Ultima rata del mutuo "' + (x.loan.label || 'Mutuo') + '"', 'mutui', 'info'); });
      (p.documents || []).forEach(function (d) { if (d && U.validDate(d.expiry)) dt(d.expiry, 'Scadenza documento: ' + (d.name || d.type || 'documento'), 'documenti', 'warn'); });
      (p.reminders || []).forEach(function (r) {
        if (!r || r.done || !U.validDate(r.date)) return;
        dt(r.repeat && r.repeat !== 'nessuna' ? nextOcc(r.date, r.repeat, today) : r.date, r.title || 'Promemoria', 'documenti', 'info', true);
      });
      if (active && U.validDate(va.date)) dt(U.addMonths(va.date, 12), 'Aggiornare la valutazione di mercato', 'catasto', 'info');
      if (active && imuEur > 0) {
        var yy = U.year(today);
        [yy, yy + 1].forEach(function (y) { dt(y + '-06-16', 'IMU – acconto', 'tasse', 'info', false, imuEur / 2); dt(y + '-12-16', 'IMU – saldo', 'tasse', 'info', false, imuEur / 2); });
      }
      var cgtFrom = p.acquisitionMode === 'donazione' && U.validDate(pu.originalDate) ? pu.originalDate : buyDate;
      if (active && p.acquisitionMode !== 'successione' && p.usage !== 'abitazione_principale' && p.type !== 'terreno_edificabile') dt(U.addYears(cgtFrom, U.n(P.cgtYears)), 'Fine dei ' + U.n(P.cgtYears) + ' anni: plusvalenza non più tassabile', 'vendita', 'info');
      if (active && sbEnd) dt(U.addYears(sbEnd, U.n(P.cgtSuperbonusYears)), 'Fine dei ' + U.n(P.cgtSuperbonusYears) + ' anni dai lavori Superbonus (plusvalenza)', 'vendita', 'info');
      if (active && isIT && pu.primaCasa) dt(U.addYears(buyDate, 5), 'Fine vincolo quinquennale agevolazioni "prima casa"', 'acquisto', 'info');
    }

    /* Altri avvisi */
    if (rented && active && U.validDate(re.endDate)) {
      if (re.endDate < today) note(al, 'warn', 'Contratto di locazione scaduto il ' + U.fmtDate(re.endDate) + ': rinnova o aggiorna i dati.', 'locazione');
      else if (U.daysBetween(today, re.endDate) <= 90) note(al, 'info', 'Contratto di locazione in scadenza il ' + U.fmtDate(re.endDate) + '.', 'locazione');
    }
    if (isIT && pu.primaCasa && (st === 'in_vendita' || sold) && (sold ? saleDate : today) < U.addYears(buyDate, 5))
      note(al, 'warn', 'Agevolazioni "prima casa": vendendo entro 5 anni dall\'acquisto occorre acquistare un\'altra abitazione principale entro un anno dalla vendita per non perderle (altrimenti differenza d\'imposta, interessi e sanzione del 30%).', 'acquisto');

    /* Totali */
    var costTotalEur = priceEur + acqCostsBasisEur + itemsOutlayEur;
    var finCostsEur = mortCostsEur + subTaxEur;
    var equityInvestedEur = Math.max(0, costTotalEur + finCostsEur - loanInEur) + Math.max(0, prepaidEur);
    var costBasisEur = priceEur + acqCostsBasisEur + capexBasisEur + sbCessEur;
    return {
      p: p, S: S, id: p.id, P: P, D: D, today: today, cc: cc, isIT: isIT, pre: pre, status: st, sold: sold, pipe: pipe, active: active,
      rented: rented, short: short, share: share, cur: cur, rNow: rNow, rBuy: rBuy, rSell: rSell, rOp: rOp,
      buyDate: buyDate, saleDate: saleDate, asOf: asOf, holdYears: holdYears,
      ptx: ptx, acqL: acqL, priceEur: priceEur, acqCostsEur: acqCostsEur, mortCostsEur: mortCostsEur, acqCostsBasisEur: acqCostsBasisEur,
      loans: loans, loanInEur: loanInEur, subTaxEur: subTaxEur, debtEur: debtEur, debtAtSaleEur: debtAtSaleEur, prepaidEur: prepaidEur, ds: ds,
      items: items, capexBasisEur: capexBasisEur, sbCessEur: sbCessEur, capexValueL: capexValueL, itemsOutlayEur: itemsOutlayEur,
      furnEur: furnEur, renoEur: renoEur, extraEur: extraEur, sbEnd: sbEnd, dedSched: dedSched, dedTotalEur: dedTotalEur, deductionsIn: deductionsIn,
      cmp: cmp, valueL: valueL, valueEur: valueEur, valueSrc: valueSrc, valueEstimated: valueEstimated,
      grossPotL: grossPotL, grossL: grossL, grossEur: grossEur, grossPotEur: grossPotEur, yieldBaseEur: yieldBaseEur, vacancy: vac, imputedEur: imputedEur,
      opex: opex, opexEur: opexEur, opexLivingEur: opexLivingEur, opexVarEur: opexVarEur, opexFixedEur: opexFixedEur,
      imu: imuR, imuEur: imuEur, taxItems: taxItems, taxItemsEur: U.sum(taxItems, function (t) { return t.eur; }), regEur: regEur,
      cedOk: cedOk, shortAgev: !!(isIT && short && cedOk && re.breveAliquotaAgevolata), cedBaseEur: cedBaseEur, irpefBaseEur: irpefBaseEur, renditaEur: renditaEur,
      foreignTaxEur: foreignTaxEur, foreignIncomeITEur: foreignIncomeITEur, foreignCreditEur: foreignCreditEur, ivie: ivie,
      real: real, dates: dates, alerts: al,
      costTotalEur: costTotalEur, finCostsEur: finCostsEur, equityInvestedEur: equityInvestedEur, costBasisEur: costBasisEur,
      _fin: {}, _proj: {}
    };
  }
  C.computeBase = computeBase;

  /* Cache dei calcoli base: chiave = ultima modifica + versione impostazioni + versione cambi + giorno */
  C.base = function (p, S, fresh) {
    var key = (p.updatedAt || '') + '|' + (S.rev || 0) + '|' + fxVersion() + '|' + U.todayISO(), c = baseCache[p.id];
    if (!fresh && c && c.p === p && c.key === key) return c.m;
    var m = computeBase(p, S);
    if (!fresh) baseCache[p.id] = { key: key, p: p, m: m };
    return m;
  };

  /* Contesto fiscale: aliquota IRPEF/addizionali incrementale media sul reddito immobiliare, ordine affitti brevi, soglia IVIE */
  function makeCtx(list, S, all, forceId) {
    var P = S.params, prof = S.profile || {}, other = pos(prof.otherIncome), inc = 0, ivTot = 0, shorts = [];
    list.forEach(function (m) {
      if (!(all || m.active || m.id === forceId)) return;
      inc += m.irpefBaseEur + m.foreignIncomeITEur;
      if (m.ivie) ivTot += m.ivie.gross;
      if (m.shortAgev) shorts.push(m);
    });
    var d = inc > 0 ? inc : 1000, t = T.incremental(other, d, P, prof), rank = {};
    shorts.sort(function (a, b) { return b.cedBaseEur - a.cedBaseEur; });
    shorts.forEach(function (m, i) { rank[m.id] = i; });
    return {
      S: S, irpefRate: t.irpef / d, addRate: t.add / d, shortRank: rank, shortCount: shorts.length,
      ivieZero: P.ivieThresholdMode === 'totale' && ivTot <= U.n(P.ivieThreshold), ivieTotal: ivTot, activeIncome: inc, otherIncome: other
    };
  }
  C.makeCtx = makeCtx;
  C.soloCtx = function (m, S) { return makeCtx([m], S, true); };
  C.portfolioCtx = function (props, S, override) {
    var list = [], om = null;
    (props || []).forEach(function (p) { if (!(override && p.id === override.id)) list.push(C.base(p, S)); });
    if (override) { om = C.base(override, S, true); list.push(om); }
    var ctx = makeCtx(list, S, false, override ? override.id : null);
    ctx.base = om;
    return ctx;
  };
  C.analyze = function (p, S, ctx) { var m = C.base(p, S); return C.finalize(m, ctx || C.soloCtx(m, S)); };
  /* ---------- Plusvalenza ---------- */
  /* Imposta estera sulla plusvalenza da preset Paese (valuta locale, 100%) */
  function presetCgt(pre, gainL, priceL, hy) {
    if (U.n(pre.cgtYears) > 0 && hy >= U.n(pre.cgtYears)) return 0;
    if (U.has(pre.cgtPrice) || U.has(pre.cgtPriceShort)) {
      var pr = U.has(pre.cgtPriceShort) && hy < U.n(pre.cgtShortYears) ? U.n(pre.cgtPriceShort) : U.n(pre.cgtPrice);
      return Math.max(0, priceL * pr / 100);
    }
    if (!(gainL > 0)) return 0;
    var rate = U.n(pre.cgt), g = gainL * (U.has(pre.cgtGainPct) ? pct(pre.cgtGainPct) : 1);
    if (U.has(pre.cgtLong) && hy >= U.n(pre.cgtLongYears)) rate = U.n(pre.cgtLong);
    var tf = U.n(pre.cgtTaperFrom), ty = U.n(pre.cgtYears);
    if (tf > 0 && ty > tf && hy > tf) g *= Math.max(0, 1 - (hy - tf) / (ty - tf));
    var t = g * rate / 100;
    if (U.has(pre.cgtAltPrice)) t = Math.min(t, priceL * U.n(pre.cgtAltPrice) / 100);
    return Math.max(0, t);
  }
  C.presetCgt = presetCgt;

  /* o = {priceL, costsL, date, rate}: prezzo e costi di vendita in valuta locale al 100%, data e cambio di vendita.
     Risultati in EUR pro quota. */
  C.cgt = function (m, ctx, o) {
    o = o || {};
    ctx = ctx || C.soloCtx(m, m.S);
    var p = m.p, P = m.P, pu = p.purchase, sa = p.sale || {}, tf = p.taxesForeign || {}, prof = (m.S && m.S.profile) || {};
    var date = U.validDate(o.date) ? U.maxDate(o.date, m.buyDate) : (m.saleDate || m.today);
    var rate = pos(o.rate) || (m.sold ? m.rSell : m.rNow), sh = m.share;
    var priceL = pos(o.priceL), costsL = pos(o.costsL);
    var from = p.acquisitionMode === 'donazione' && U.validDate(pu.originalDate) ? pu.originalDate : m.buyDate;
    var holdYears = Math.max(0, U.yearsBetween(from, date));
    var sbYears = m.sbEnd && m.sbEnd <= date ? Math.max(0, U.yearsBetween(m.sbEnd, date)) : (m.sbEnd ? 0 : null);
    var sbFactor = sbYears == null ? 1 : (sbYears <= 5 ? 0 : (sbYears <= 10 ? 0.5 : 1));
    var rule = T.capitalGainRule(p, P, holdYears, sbYears);
    var capEur = 0, sbEur = 0, capL = 0;
    m.items.forEach(function (it) {
      if (!it.cap || it.date > date) return;
      capL += it.amountL;
      if (it.bonus === 'superbonus' && it.cess) sbEur += it.amountEur; else capEur += it.amountEur;
    });
    var proceedsEur = priceL / rate * sh, costsEur = costsL / rate * sh;
    var basisEur = m.priceEur + m.acqCostsBasisEur + capEur + sbEur * sbFactor;
    var gainEur = proceedsEur - costsEur - basisEur;
    var taxable = rule.taxable && gainEur > 0, sost = 0, ord = 0, regime = 'esente';
    if (taxable) {
      ord = T.incremental(pos(ctx.otherIncome) + pos(ctx.activeIncome), gainEur, P, prof).total;
      sost = gainEur * pct(P.cgtSubstitute);
      if (!m.isIT) regime = 'ordinaria';
      else if (sa.regime === 'ordinaria' || sa.regime === 'sostitutiva') regime = sa.regime;
      else regime = sost <= ord ? 'sostitutiva' : 'ordinaria';
    }
    var itTax = regime === 'sostitutiva' ? sost : (regime === 'ordinaria' ? ord : 0);
    /* Imposta estera: importo pagato (valuta locale, 100%) > aliquota indicata > regole del preset */
    var foreignL = 0, gainL = 0;
    if (!m.isIT) {
      gainL = priceL - costsL - (m.acqL.price + m.acqL.costs - m.acqL.mortgage + capL);
      if (m.sold && U.has(sa.foreignCgtPaid) && !o.simulate) foreignL = pos(sa.foreignCgtPaid);
      else if (U.has(tf.cgtPct)) foreignL = Math.max(0, gainL) * pct(tf.cgtPct);
      else foreignL = presetCgt(m.pre || {}, gainL, priceL, holdYears);
    }
    var foreignEur = foreignL / rate * sh, credit = Math.min(foreignEur, itTax);
    var tax = itTax - credit + foreignEur;
    return {
      taxable: taxable, ruleTaxable: rule.taxable, reason: rule.reason, holdYears: holdYears, sbYears: sbYears, sbFactor: sbFactor,
      date: date, rate: rate, proceedsEur: proceedsEur, costsEur: costsEur, basisEur: basisEur, gainEur: gainEur, gainL: gainL,
      sostEur: sost, ordEur: ord, regime: regime, itTaxEur: itTax, foreignCgtEur: foreignEur, creditEur: credit, tax: tax,
      netEur: proceedsEur - costsEur - tax
    };
  };
  /* ---------- Flussi per anno solare dall'acquisto fino a "end" (EUR, pro quota) ----------
     f = valori annui di finalize. I valori annui correnti sono riportati agli altri anni con i tassi di crescita. */
  function streams(m, f, end) {
    var p = m.p, D = m.D, P = m.P, re = p.rental || {}, buy = m.buyDate;
    var lev = [], unl = [], rows = [], i, x;
    var add = function (arr, date, amount) { if (amount && isFinite(amount)) arr.push({ date: date, amount: amount }); };
    if (!(end >= buy)) end = buy;
    add(lev, buy, -(m.priceEur + m.acqCostsEur));
    add(unl, buy, -(m.priceEur + m.acqCostsBasisEur));
    for (i = 0; i < m.loans.length; i++) {
      x = m.loans[i];
      if (x.stats.start > end) continue;
      add(lev, x.stats.start, x.inflowEur - x.subTaxEur);
      if (x.prepaidEur > 0) {
        var pd = U.addDays(x.stats.start, Math.round(Math.max(0, U.daysBetween(x.stats.start, m.asOf)) / 2));
        if (pd <= end) add(lev, pd, -x.prepaidEur);
      }
    }
    for (i = 0; i < m.items.length; i++) { x = m.items[i]; if (x.date <= end) { add(lev, x.date, -x.outlayEur); add(unl, x.date, -x.outlayEur); } }
    var yRef = U.year(m.asOf), gi = 1 + pct(D.rentGrowthPct), gc = 1 + pct(D.costGrowthPct);
    var incSince = U.maxDate(U.validDate(re.incomeSince) ? re.incomeSince : buy, buy);
    var mainHome = m.isIT && p.usage === 'abitazione_principale', capInt = U.n(P.mortgageInterestCap) * m.share, dedPct = pct(P.mortgageInterestDeductionPct);
    /* Segmenti: anni solari, divisi anche alla data di riferimento (oggi o vendita) per separare storico e futuro */
    var y1 = U.year(end), bounds = [buy], y, j;
    for (y = U.year(buy) + 1; y <= y1; y++) bounds.push(yStart(y));
    if (m.asOf > buy && m.asOf < end) bounds.push(m.asOf);
    bounds.push(end);
    bounds.sort();
    for (j = 0; j + 1 < bounds.length; j++) {
      var a = bounds[j], b = bounds[j + 1];
      if (!(b > a)) continue;
      y = U.year(a);
      var dy = U.daysBetween(yStart(y), yStart(y + 1)), frac = U.daysBetween(a, b) / dy;
      var ia = U.maxDate(a, incSince), incFrac = b > ia ? U.daysBetween(ia, b) / dy : 0;
      var mid = U.addDays(a, Math.round(U.daysBetween(a, b) / 2));
      var kI = Math.pow(gi, y - yRef), kC = Math.pow(gc, y - yRef);
      var income = (m.grossEur - f.taxRent - m.opexVarEur) * incFrac * kI, imputed = m.imputedEur * frac * kI;
      var costs = (m.opexFixedEur + f.propTax + f.taxFixed) * frac * kC, dsP = 0, dsI = 0;
      for (i = 0; i < m.loans.length; i++) { x = m.loans[i]; var r = x.stats.between(a, b), k = m.share / x.rSvc; dsP += r.pay * k; dsI += r.int * k; }
      var mded = mainHome ? dedPct * Math.min(dsI, capInt * frac) : 0;
      /* Detrazioni: rata annua a fine anno; quelle dell'anno della vendita (reale o ipotetica) e successive passano all'acquirente */
      var ded = b === yStart(y + 1) && y < y1 ? m.deductionsIn(y) : 0;
      var opU = income + imputed - costs + ded;
      add(unl, mid, opU);
      add(lev, mid, opU - dsP + mded);
      rows.push({ year: y, from: a, to: b, frac: frac, income: income, imputed: imputed, costs: costs, debt: dsP, interest: dsI, mortDed: mded, ded: ded, net: opU - dsP + mded });
    }
    return { lev: lev, unl: unl, rows: rows };
  }
  C.streams = streams;

  /* Riepilogo di una serie di flussi con valore finale: utile, capitale investito (massima esposizione), ROI, IRR */
  function summarize(flows, term, date, years, noIrr) {
    var sorted = flows.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var cum = 0, minCum = 0, out = 0, i;
    for (i = 0; i < sorted.length; i++) {
      cum += sorted[i].amount;
      if (sorted[i].amount < 0) out -= sorted[i].amount;
      if (i === sorted.length - 1 || sorted[i + 1].date !== sorted[i].date) minCum = Math.min(minCum, cum);
    }
    var all = U.ok(term) && term !== 0 ? sorted.concat([{ date: date, amount: term }]) : sorted;
    var profit = cum + (U.ok(term) ? term : 0), invested = -minCum;
    var roi = invested > 0.005 ? profit / invested : null;
    var roiAnn = roi != null && roi > -1 && years >= 0.5 ? Math.pow(1 + roi, 1 / years) - 1 : null;
    return { flows: all, profit: profit, invested: invested, outflows: out, terminal: U.ok(term) ? term : 0, roi: roi, roiAnn: roiAnn, irr: noIrr ? null : C.xirr(all) };
  }
  C.summarize = summarize;
  /* Somma dei flussi con data successiva a d0 */
  function sumAfter(flows, d0) { var s = 0; for (var i = 0; i < flows.length; i++) if (flows[i].date > d0) s += flows[i].amount; return s; }
  /* ---------- Risultati completi del singolo immobile nel contesto fiscale del portafoglio ---------- */
  C.finalize = function (m, ctx) {
    ctx = ctx || C.soloCtx(m, m.S);
    var rank = ctx.shortRank && ctx.shortRank[m.id] != null ? ctx.shortRank[m.id] : null;
    var sig = ctx.irpefRate.toFixed(6) + '|' + ctx.addRate.toFixed(6) + '|' + rank + '|' + (ctx.ivieZero ? 1 : 0) + '|' + Math.round(ctx.activeIncome) + '|' + Math.round(ctx.otherIncome);
    if (m._fin[sig]) return m._fin[sig];
    var p = m.p, P = m.P, D = m.D, al = m.alerts.slice(), f = { m: m, id: m.id, p: p, sig: sig };

    /* Imposte sui redditi (EUR, pro quota): cedolare, IRPEF e addizionali all'aliquota media incrementale, imposte estere e credito */
    var cedRate = m.cedOk ? T.cedolareRate(p, P, rank) : null;
    f.cedRate = cedRate;
    f.cedTax = cedRate != null ? m.cedBaseEur * cedRate / 100 : 0;
    f.irBase = m.irpefBaseEur + m.foreignIncomeITEur;
    f.irpef = f.irBase * ctx.irpefRate;
    f.add = f.irBase * ctx.addRate;
    f.foreignTax = m.foreignTaxEur;
    f.ftc = Math.min(m.foreignTaxEur, m.foreignIncomeITEur * ctx.irpefRate);
    f.incomeTax = f.cedTax + f.irpef + f.add + f.foreignTax - f.ftc;
    f.taxRent = m.rented ? f.incomeTax : 0;
    f.taxFixed = m.rented ? 0 : f.incomeTax;

    /* IVIE: soglia per immobile o sul totale (impostazioni) */
    f.ivieTax = 0;
    if (m.ivie && !ctx.ivieZero && !(P.ivieThresholdMode !== 'totale' && m.ivie.gross <= U.n(P.ivieThreshold))) f.ivieTax = Math.max(0, m.ivie.gross - m.ivie.credit);
    f.propTax = m.taxItemsEur + f.ivieTax;
    f.taxTotal = f.incomeTax + f.propTax;

    /* Flussi annui a regime (12 mesi da oggi, o ultimi 12 mesi se venduto) */
    f.noi = m.grossEur + m.imputedEur - m.opexEur - f.propTax;
    f.noiCash = f.noi - m.imputedEur;
    f.mortDed = m.isIT && p.usage === 'abitazione_principale' ? pct(P.mortgageInterestDeductionPct) * Math.min(m.ds.int, U.n(P.mortgageInterestCap) * m.share) : 0;
    f.ded = m.deductionsIn(U.year(m.asOf));
    f.cfPre = f.noiCash - m.ds.pay;
    f.cfPost = f.cfPre - f.incomeTax + f.mortDed + f.ded;
    f.cfMonthly = f.cfPost / 12;

    /* Indicatori */
    var R = m.rented, sqm = pos(p.sqm), div = U.div;
    f.grossYield = R ? div(m.yieldBaseEur, m.priceEur) : null;
    f.grossYieldInv = R ? div(m.yieldBaseEur, m.costTotalEur) : null;
    f.netYield = R ? div(f.noiCash - f.incomeTax, m.costTotalEur) : null;
    f.capRate = R ? div(f.noiCash, m.valueEur) : (m.imputedEur > 0 ? div(f.noi, m.valueEur) : null);
    f.currentYield = R ? div(m.yieldBaseEur, m.valueEur) : null;
    f.coc = m.equityInvestedEur > 0 ? f.cfPost / m.equityInvestedEur : null;
    f.cocPre = m.equityInvestedEur > 0 ? f.cfPre / m.equityInvestedEur : null;
    f.dscr = R && m.ds.pay > 0 ? f.noiCash / m.ds.pay : null;
    var debt = m.sold ? m.debtAtSaleEur : m.debtEur;
    f.ltv = m.valueEur > 0 && debt > 0 ? debt / m.valueEur : (debt > 0 ? null : 0);
    f.ltc = m.costTotalEur > 0 ? m.loanInEur / m.costTotalEur : null;
    f.breakEven = R && m.grossPotEur > 0 ? (m.opexEur + f.propTax + m.ds.pay) / m.grossPotEur : null;
    f.grm = R && m.grossPotEur > 0 ? m.valueEur / m.grossPotEur : null;
    f.payback = f.cfPost > 0 && m.equityInvestedEur > 0 ? m.equityInvestedEur / f.cfPost : null;
    f.priceSqm = sqm && m.acqL.price ? m.acqL.price / sqm : null;
    f.costSqm = sqm && m.costTotalEur ? m.costTotalEur / m.share / sqm : null;
    f.valueSqm = sqm && m.valueL ? m.valueL / sqm : null;
    f.rentSqm = sqm && m.grossPotL ? m.grossPotL / 12 / sqm : null;
    f.debt = debt;
    f.equityEur = m.valueEur - debt;
    f.unrealizedEur = m.active ? m.valueEur - m.costBasisEur : null;
    f.annualCostEur = m.opexEur + f.propTax + f.incomeTax + m.ds.pay;

    if (m.active && R) {
      if (f.dscr != null && f.dscr < 1.2) note(al, f.dscr < 1 ? 'danger' : 'warn', 'DSCR ' + U.fmtNum(f.dscr, 2) + ': il reddito netto ' + (f.dscr < 1 ? 'non copre' : 'copre a fatica') + ' le rate del mutuo.', 'analisi');
      if (f.cfPost < 0) note(al, 'warn', 'Flusso di cassa netto annuo negativo (' + U.fmtEur(f.cfPost) + ').', 'analisi');
      if (f.breakEven != null && f.breakEven > 0.9) note(al, 'warn', 'Punto di pareggio al ' + U.fmtPct(f.breakEven, 0) + ' del canone potenziale: margine di sicurezza ridotto.', 'analisi');
    }
    if (m.active && f.ltv != null && f.ltv > 0.8) note(al, 'warn', 'Rapporto debito/valore (LTV) elevato: ' + U.fmtPct(f.ltv, 0) + '.', 'mutui');
    f.alerts = al;

    /* Storico dall'acquisto a oggi (o alla vendita) + valore finale netto (vendita reale o ipotetica oggi) */
    f.roiKind = m.sold ? 'realizzato' : (m.pipe ? 'proiezione' : 'ad oggi');
    f.includesImputed = m.imputedEur > 0;
    f.hist = null; f.cg = null; f.profit = null; f.invested = null; f.roi = null; f.roiAnn = null; f.irr = null; f.roiU = null; f.irrU = null; f.netSaleEur = null;
    m._fin[sig] = f;
    if (m.sold || m.active) {
      var sa = p.sale || {}, st = streams(m, f, m.asOf), cg, termU, termL;
      if (m.sold) {
        cg = C.cgt(m, ctx, { priceL: pos(sa.price), costsL: pos(sa.agency) + pos(sa.otherCosts), date: m.saleDate, rate: m.rSell });
        termU = cg.netEur; termL = termU - m.debtAtSaleEur;
      } else {
        cg = C.cgt(m, ctx, { priceL: m.valueL, costsL: m.valueL * pct(D.saleCostPct), date: m.today, rate: m.rNow, simulate: true });
        termU = cg.netEur; termL = termU - m.debtEur;
      }
      var h = summarize(st.lev, termL, m.asOf, m.holdYears), hu = summarize(st.unl, termU, m.asOf, m.holdYears);
      h.rows = st.rows; h.years = m.holdYears; h.unlevered = hu;
      f.hist = h; f.cg = cg; f.netSaleEur = termL;
      f.profit = h.profit; f.invested = h.invested; f.roi = h.roi; f.roiAnn = h.roiAnn; f.irr = h.irr;
      f.roiU = hu.roi; f.irrU = hu.irr; f.profitU = hu.profit;
      f.cashIn = U.sum(st.rows, function (r) { return r.net; });
    } else if (m.pipe) {
      var pr = projectionCore(m, f, ctx, U.n(D.projectionYears) || 10), last = pr && pr.rows.length ? pr.rows[pr.rows.length - 1] : null;
      if (last) {
        f.profit = last.profit; f.invested = last.invested; f.roi = last.roi; f.roiAnn = last.roiAnn; f.irr = last.irr;
        f.netSaleEur = last.netSaleEur; f.projYears = pr.years;
      }
    }
    if (m.active && f.roi != null && f.roi < 0) note(al, 'info', 'Rendimento complessivo ad oggi negativo (ROI ' + U.fmtPct(f.roi, 1) + ', considerando costi di vendita e imposte).', 'analisi');
    return f;
  };
  /* ---------- Proiezione: vendita ipotetica alla fine di ogni anno (da oggi, o dall'acquisto se in pipeline) ---------- */
  function debtAt(m, date) {
    var d = 0;
    for (var i = 0; i < m.loans.length; i++) d += m.loans[i].stats.balanceAt(date) * m.share / m.loans[i].rSvc;
    return d;
  }
  function projectionCore(m, f, ctx, years, opts) {
    opts = opts || {};
    if (m.sold) return null;
    years = U.clamp(Math.round(U.n(years) || 10), 1, 50);
    var light = !!opts.light, key = years + '|' + (light ? 1 : 0), cache = f._proj || (f._proj = {});
    if (cache[key]) return cache[key];
    var D = m.D, app = pct(D.appreciationPct), sc = pct(D.saleCostPct);
    var d0 = m.pipe ? m.buyDate : m.asOf, rows = [], prevFut = 0, initial = 0;
    for (var k = 1; k <= years; k++) {
      var end = U.addYears(d0, k), st = streams(m, f, end);
      if (k === 1) initial = -(U.sum(st.lev, function (x) { return x.amount; }) - sumAfter(st.lev, d0));
      var vL = m.valueL * Math.pow(1 + app, Math.max(0, U.yearsBetween(m.asOf, end)));
      var debt = debtAt(m, end), valueEur = vL / m.rNow * m.share;
      var cg = light ? null : C.cgt(m, ctx, { priceL: vL, costsL: vL * sc, date: end, rate: m.rNow, simulate: true });
      var netSale = (cg ? cg.netEur : valueEur * (1 - sc)) - debt;
      var fut = sumAfter(st.lev, d0), s = summarize(st.lev, netSale, end, U.yearsBetween(m.buyDate, end), light);
      rows.push({
        k: k, date: end, year: U.year(end), valueEur: valueEur, debtEur: debt, equityEur: valueEur - debt,
        cf: fut - prevFut, cumCf: fut, cgtEur: cg ? cg.tax : null, cgtRegime: cg ? cg.regime : null, cgtReason: cg ? cg.reason : '',
        netSaleEur: netSale, profit: s.profit, invested: s.invested, roi: s.roi, roiAnn: s.roiAnn, irr: s.irr
      });
      prevFut = fut;
    }
    var res = { years: years, start: d0, initialEur: initial, rows: rows };
    cache[key] = res;
    return res;
  }
  C.projection = function (m, ctx, years, opts) {
    ctx = ctx || C.soloCtx(m, m.S);
    return projectionCore(m, C.finalize(m, ctx), ctx, years, opts);
  };

  /* ---------- Simulazione di vendita: o = {price, costs, date, rate} (valuta locale, 100%) ---------- */
  C.simulateSale = function (m, ctx, o) {
    o = o || {};
    ctx = ctx || C.soloCtx(m, m.S);
    var f = C.finalize(m, ctx), D = m.D;
    var date = U.validDate(o.date) ? U.maxDate(o.date, m.buyDate) : m.today;
    var rate = pos(o.rate) || m.rNow, priceL = U.has(o.price) ? pos(o.price) : m.valueL;
    var costsL = U.has(o.costs) ? pos(o.costs) : priceL * pct(D.saleCostPct);
    var st = streams(m, f, date), debt = debtAt(m, date), yrs = U.yearsBetween(m.buyDate, date);
    var run = function (pL, cL, noIrr) {
      var cg = C.cgt(m, ctx, { priceL: pL, costsL: cL, date: date, rate: rate, simulate: true }), net = cg.netEur - debt;
      return { cg: cg, net: net, s: summarize(st.lev, net, date, yrs, noIrr) };
    };
    var r = run(priceL, costsL), costPctOfPrice = priceL > 0 ? costsL / priceL : pct(D.saleCostPct);
    /* Prezzo minimo per non andare in perdita (utile complessivo = 0), costi di vendita in proporzione */
    var be = null, lo = 0, hi = Math.max(priceL, m.valueL, m.acqL.price, 1) * 4;
    if (run(hi, hi * costPctOfPrice, true).s.profit > 0) {
      for (var i = 0; i < 60 && hi - lo > 1; i++) { var mid = (lo + hi) / 2; if (run(mid, mid * costPctOfPrice, true).s.profit >= 0) hi = mid; else lo = mid; }
      be = hi;
    }
    return {
      date: date, rate: rate, priceL: priceL, costsL: costsL, cg: r.cg, debtEur: debt, netEur: r.net,
      proceedsEur: r.cg.proceedsEur, costsEur: r.cg.costsEur, taxEur: r.cg.tax, profit: r.s.profit, invested: r.s.invested,
      roi: r.s.roi, roiAnn: r.s.roiAnn, irr: r.s.irr, breakEvenPriceL: be, rows: st.rows, holdYears: yrs
    };
  };
  /* ---------- Portafoglio: totali, raggruppamenti, avvisi e scadenze ---------- */
  function agg() { return { n: 0, value: 0, debt: 0, equity: 0, gross: 0, noi: 0, cfPre: 0, cfPost: 0, taxes: 0, opex: 0, ds: 0, cost: 0, invested: 0, unrealized: 0, profit: 0, sqm: 0 }; }
  function addAgg(a, m, f) {
    a.n++; a.value += m.valueEur; a.debt += f.debt; a.equity += f.equityEur; a.gross += m.grossEur; a.noi += f.noiCash;
    a.cfPre += f.cfPre; a.cfPost += f.cfPost; a.taxes += f.taxTotal; a.opex += m.opexEur; a.ds += m.ds.pay; a.cost += m.costTotalEur;
    a.invested += m.equityInvestedEur; a.unrealized += f.unrealizedEur || 0; a.profit += f.profit || 0; a.sqm += pos(m.p.sqm) * m.share;
  }
  C.portfolio = function (props, S) {
    var P = S.params, list = props || [];
    var bases = list.map(function (p) { return C.base(p, S); });
    var ctx = makeCtx(bases, S, false), fins = bases.map(function (m) { return C.finalize(m, ctx); });
    var A = agg(), sold = agg(), pipe = agg(), byId = {};
    var groups = { status: {}, country: {}, category: {}, type: {}, currency: {}, usage: {} };
    var R = { grossRented: 0, priceRented: 0, costRented: 0, netRented: 0, dsRented: 0, noiRented: 0, rentedN: 0, incomeTax: 0, propTax: 0, ded: 0, mortDed: 0, imputed: 0, foreignN: 0, shortN: 0, shortAgevN: 0 };
    var flowsAll = [], yearly = {}, alerts = [], dates = [];
    fins.forEach(function (f, i) {
      var m = bases[i], p = m.p;
      byId[m.id] = f;
      var g = function (dim, key) { var o = groups[dim]; (o[key] || (o[key] = agg())); addAgg(o[key], m, f); };
      g('status', m.status);
      if (m.active) {
        addAgg(A, m, f);
        g('country', m.cc); g('category', p.category || MD.typeCategory(p.type)); g('type', p.type); g('currency', m.cur); g('usage', p.usage);
        R.incomeTax += f.incomeTax; R.propTax += f.propTax; R.ded += f.ded; R.mortDed += f.mortDed; R.imputed += m.imputedEur;
        if (m.rented) {
          R.rentedN++; R.grossRented += m.yieldBaseEur; R.priceRented += m.priceEur; R.costRented += m.costTotalEur;
          R.netRented += f.noiCash - f.incomeTax; R.noiRented += f.noiCash; R.dsRented += m.ds.pay;
        }
        if (!m.isIT) R.foreignN++;
        if (m.isIT && m.short) R.shortN++;
        if (m.shortAgev) R.shortAgevN++;
      } else if (m.sold) addAgg(sold, m, f);
      else if (m.pipe) addAgg(pipe, m, f);
      if ((m.active || m.sold) && f.hist) {
        Array.prototype.push.apply(flowsAll, f.hist.flows);
        f.hist.rows.forEach(function (r) {
          var y = yearly[r.year] || (yearly[r.year] = { year: r.year, income: 0, costs: 0, debt: 0, net: 0 });
          y.income += r.income + r.imputed; y.costs += r.costs; y.debt += r.debt; y.net += r.net;
        });
      }
      var nm = MD.displayName(p);
      f.alerts.forEach(function (a) { if (m.active || m.pipe || a.level !== 'info') alerts.push({ level: a.level, msg: a.msg, tab: a.tab, pid: m.id, name: nm }); });
      m.dates.forEach(function (d) { dates.push({ date: d.date, label: d.label, tab: d.tab, level: d.level, past: d.past, amount: d.amount, pid: m.id, name: nm }); });
    });
    /* Avvisi a livello di portafoglio */
    var pal = [], maxShort = U.n(P.maxShortTermUnits) || 2;
    if (R.shortN > maxShort) note(pal, 'danger', R.shortN + ' immobili in Italia destinati a locazione breve (oltre ' + maxShort + '): l\'attività si presume svolta in forma d\'impresa (partita IVA, niente cedolare secca). Verifica con il tuo commercialista.', 'locazione');
    if (R.shortAgevN > 1) note(pal, 'warn', 'L\'aliquota agevolata del 21% sulle locazioni brevi spetta per un solo immobile: è applicata a quello con canone maggiore, agli altri il 26%.', 'locazione');
    if (R.foreignN > 0) note(pal, 'info', R.foreignN + ' immobili all\'estero: ricordati del quadro RW (monitoraggio), dell\'IVIE e del credito per le imposte pagate all\'estero.', 'tasse');
    pal.forEach(function (a) { alerts.unshift({ level: a.level, msg: a.msg, tab: a.tab, pid: null, name: 'Portafoglio' }); });
    var lv = { danger: 0, warn: 1, info: 2 };
    alerts.sort(function (a, b) { return (lv[a.level] == null ? 3 : lv[a.level]) - (lv[b.level] == null ? 3 : lv[b.level]); });
    dates.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    flowsAll.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var invested = 0, profit = 0;
    fins.forEach(function (f, i) { if ((bases[i].active || bases[i].sold) && f.hist) { invested += f.invested || 0; profit += f.profit || 0; } });
    var div = U.div;
    var kpi = {
      grossYield: div(R.grossRented, R.priceRented), netYield: div(R.netRented, R.costRented), ltv: A.value > 0 ? A.debt / A.value : null,
      dscr: R.dsRented > 0 ? R.noiRented / R.dsRented : null, cfMonthly: A.cfPost / 12, roi: invested > 0.005 ? profit / invested : null,
      irr: flowsAll.length > 1 ? C.xirr(flowsAll) : null, profit: profit, invested: invested, valueSqm: A.sqm > 0 ? A.value / A.sqm : null,
      incomeTax: R.incomeTax, propTax: R.propTax, ded: R.ded + R.mortDed, imputed: R.imputed
    };
    var yl = Object.keys(yearly).map(function (k) { return yearly[k]; }).sort(function (a, b) { return a.year - b.year; });
    return {
      S: S, ctx: ctx, bases: bases, fins: fins, byId: byId, total: A, sold: sold, pipe: pipe, groups: groups, rentStats: R, kpi: kpi,
      yearly: yl, alerts: alerts, dates: dates, count: { all: list.length, active: A.n, sold: sold.n, pipe: pipe.n, rented: R.rentedN, foreign: R.foreignN }
    };
  };

  /* Proiezione aggregata degli immobili posseduti (senza imposte sulla plusvalenza, calcolo rapido) */
  C.portfolioProjection = function (port, years) {
    years = U.clamp(Math.round(U.n(years) || 10), 1, 50);
    var rows = [], d0 = U.todayISO(), k;
    for (k = 1; k <= years; k++) { var dt = U.addYears(d0, k); rows.push({ k: k, date: dt, year: U.year(dt), valueEur: 0, debtEur: 0, equityEur: 0, cf: 0, cumCf: 0, netSaleEur: 0 }); }
    port.bases.forEach(function (m, i) {
      if (!m.active) return;
      var pr = projectionCore(m, port.fins[i], port.ctx, years, { light: true });
      if (!pr) return;
      pr.rows.forEach(function (r, j) {
        var t = rows[j];
        t.valueEur += r.valueEur; t.debtEur += r.debtEur; t.equityEur += r.equityEur; t.cf += r.cf; t.cumCf += r.cumCf; t.netSaleEur += r.netSaleEur;
      });
    });
    return { years: years, rows: rows };
  };

  G.CALC = C;
})(window.GPI = window.GPI || {});
