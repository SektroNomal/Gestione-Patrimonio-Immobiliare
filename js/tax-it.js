/* Regole fiscali italiane (residente fiscale in Italia) — funzioni pure parametrizzate (GPI.TAX)
   Valori INDICATIVI: verificare sempre con il proprio commercialista. Parametri modificabili in Impostazioni. */
(function (G) {
  'use strict';
  var U = G.U, T = {};

  function cat(c) { return String(c || '').toUpperCase().replace(/\s+/g, '').replace('-', '/'); }
  T.normCat = cat;
  T.LUX_CATS = { 'A/1': 1, 'A/8': 1, 'A/9': 1 };
  T.PERT_CATS = { 'C/2': 1, 'C/6': 1, 'C/7': 1 };

  /* Moltiplicatori IMU (rendita rivalutata del 5%) */
  T.imuMultiplier = function (c) {
    c = cat(c);
    if (!c) return 160;
    if (c === 'A/10') return 80;
    if (c.charAt(0) === 'A') return 160;
    if (c.charAt(0) === 'B') return 140;
    if (c === 'C/1') return 55;
    if (c === 'C/3' || c === 'C/4' || c === 'C/5') return 140;
    if (c.charAt(0) === 'C') return 160;
    if (c === 'D/5') return 80;
    if (c.charAt(0) === 'D') return 65;
    if (c === 'T') return 135;
    return 0;
  };
  /* Moltiplicatori per l'imposta di registro (valore catastale) */
  T.registroMultiplier = function (c, primaCasa, P) {
    c = cat(c);
    if (c === 'A/10' || c.charAt(0) === 'D') return 60;
    if (c === 'C/1' || c.charAt(0) === 'E') return 40.8;
    if (c.charAt(0) === 'B') return 140;
    return primaCasa ? P.prezzoValorePrimaCasa : P.prezzoValoreOther;
  };

  T.units = function (p) { return ((p.cadastre && p.cadastre.units) || []).filter(function (u) { return u && (U.n(u.rendita) > 0 || u.categoria); }); };
  T.mainCat = function (p) {
    var u = T.units(p).filter(function (x) { return !x.pertinenza; })[0];
    return u ? cat(u.categoria) : (G.MODEL.TYPES[p.type] ? G.MODEL.TYPES[p.type][2] : '');
  };
  T.isLuxury = function (p) {
    if (p.purchase && p.purchase.lusso) return true;
    return T.units(p).some(function (u) { return !u.pertinenza && T.LUX_CATS[cat(u.categoria)]; });
  };
  T.hasC1 = function (p) { return T.units(p).some(function (u) { return cat(u.categoria) === 'C/1'; }) || (!T.units(p).length && (p.type === 'negozio' || p.type === 'ristorante')); };
  T.renditaTotal = function (p) { return U.sum(T.units(p), function (u) { return cat(u.categoria) === 'T' ? 0 : U.n(u.rendita); }); };
  T.isResidentialUse = function (p) {
    var c = T.mainCat(p);
    if (c) return c.charAt(0) === 'A' && c !== 'A/10';
    return p.category === 'residenziale';
  };

  /* Valore catastale ai fini del registro (prezzo-valore): somma unità A/B/C */
  T.cadastralValueRegistro = function (p, P) {
    var prima = !!p.purchase.primaCasa;
    return U.sum(T.units(p), function (u) {
      var c = cat(u.categoria);
      if (c === 'T') return 0;
      return U.n(u.rendita) * 1.05 * T.registroMultiplier(c, prima && (c.charAt(0) === 'A' || T.PERT_CATS[c]), P);
    });
  };

  function item(label, amount, hint) { return { label: label, amount: Math.max(0, amount || 0), hint: hint || '' }; }

  /* Imposte d'acquisto (nella valuta dell'immobile). preset = parametri Paese estero */
  T.purchaseTaxes = function (p, P, preset) {
    var pu = p.purchase, price = U.n(pu.price), items = [], notes = [];
    if (pu.taxMode === 'manuale') {
      items.push(item('Imposte d\'acquisto (importo manuale)', U.n(pu.taxManual)));
      return { items: items, total: items[0].amount, notes: notes };
    }
    if (p.acquisitionMode === 'costruzione') {
      notes.push('Costruzione in proprio: nessuna imposta di trasferimento. Inserisci il costo del terreno come prezzo e i costi di costruzione tra i lavori.');
      return { items: items, total: 0, notes: notes };
    }
    if (p.country !== 'IT') {
      var pct = preset && U.ok(preset.transfer) ? preset.transfer : 0;
      items.push(item('Imposte di trasferimento estere (stima ' + U.fmtNum(pct, 1) + '% del prezzo)', price * pct / 100));
      notes.push('Stima da preset Paese: modifica le imposte in modalità manuale se conosci l\'importo esatto.');
      if (preset && preset.transferNote) notes.push(preset.transferNote);
      return { items: items, total: items[0].amount, notes: notes };
    }
    var mode = p.acquisitionMode, type = p.type, catg = p.category;
    if (mode === 'successione' || mode === 'donazione') {
      var vc = T.cadastralValueRegistro(p, P) || price;
      if (pu.primaCasa) {
        items.push(item('Imposta ipotecaria (fissa, prima casa)', P.succFixedPrimaCasa), item('Imposta catastale (fissa, prima casa)', P.succFixedPrimaCasa));
      } else {
        items.push(item('Imposta ipotecaria ' + P.succIpo + '%', Math.max(200, vc * P.succIpo / 100)), item('Imposta catastale ' + P.succCat + '%', Math.max(200, vc * P.succCat / 100)));
      }
      notes.push('Imposta di successione/donazione esclusa (franchigia 1 milione € per coniuge e figli): se dovuta aggiungila in "Altri costi d\'acquisto".');
    } else if (type === 'terreno_agricolo' || type === 'terreno_edificabile') {
      var r = type === 'terreno_agricolo' ? P.regAgricolo : P.regEdificabile;
      items.push(item('Imposta di registro ' + r + '%', Math.max(P.regMin, price * r / 100)), item('Imposta ipotecaria (fissa)', P.regFixedPrivate), item('Imposta catastale (fissa)', P.regFixedPrivate));
      if (type === 'terreno_agricolo') notes.push('Coltivatori diretti e IAP possono beneficiare di aliquote agevolate (verifica).');
    } else if (pu.sellerType === 'impresa_iva') {
      if (!T.isResidentialUse(p) && catg !== 'pertinenza') {
        items.push(item('IVA ' + P.ivaCommercial + '%', price * P.ivaCommercial / 100), item('Imposta di registro (fissa)', P.ivaFixed),
          item('Imposta ipotecaria ' + P.ipoCommercialIva + '%', price * P.ipoCommercialIva / 100), item('Imposta catastale ' + P.catCommercialIva + '%', price * P.catCommercialIva / 100));
        notes.push('Immobile strumentale da impresa: per un privato senza partita IVA l\'IVA è un costo non detraibile.');
      } else {
        var lux = T.isLuxury(p);
        var iva = lux ? P.ivaLuxury : (pu.primaCasa ? P.ivaPrimaCasa : P.ivaResidential);
        items.push(item('IVA ' + iva + '%', price * iva / 100), item('Imposta di registro (fissa)', P.ivaFixed), item('Imposta ipotecaria (fissa)', P.ivaFixed), item('Imposta catastale (fissa)', P.ivaFixed));
        if (pu.primaCasa && lux) notes.push('Agevolazione prima casa non applicabile alle categorie A/1, A/8, A/9.');
      }
    } else {
      var resid = (catg === 'residenziale' || catg === 'pertinenza') && (T.isResidentialUse(p) || catg === 'pertinenza');
      var prima = !!pu.primaCasa && resid && !T.isLuxury(p);
      var rate = prima ? P.regPrimaCasa : P.regOther;
      var base = price, baseLabel = 'sul prezzo';
      if (resid) {
        var vc2 = T.cadastralValueRegistro(p, P);
        if (vc2 > 0) { base = vc2; baseLabel = 'sul valore catastale (prezzo-valore)'; }
        else notes.push('Rendita catastale mancante: base = prezzo. Inserisci la rendita nella scheda Catasto per applicare il "prezzo-valore".');
      }
      items.push(item('Imposta di registro ' + rate + '% ' + baseLabel, Math.max(P.regMin, base * rate / 100)), item('Imposta ipotecaria (fissa)', P.regFixedPrivate), item('Imposta catastale (fissa)', P.regFixedPrivate));
      if (pu.primaCasa && !prima) notes.push('Agevolazione prima casa non applicabile a questa tipologia/categoria.');
    }
    return { items: items, total: U.sum(items, function (i) { return i.amount; }), notes: notes };
  };

  /* Imposta sostitutiva sul mutuo (solo mutui erogati in Italia, valuta EUR) */
  T.loanSubstituteTax = function (loan, p, P) {
    if (loan.substituteTaxMode === 'manuale') return U.n(loan.substituteTax);
    if (loan.substituteTaxMode === 'nessuna') return 0;
    if (p.country !== 'IT') return 0;
    var resid = T.isResidentialUse(p) || p.category === 'pertinenza';
    var pct = resid && !p.purchase.primaCasa ? P.loanSubstituteOther : P.loanSubstitutePrimaCasa;
    return U.n(loan.amount) * pct / 100;
  };

  /* IMU annua (EUR, 100% dell'immobile) */
  T.imu = function (p, P) {
    var t = p.taxesIT || {};
    if (p.country !== 'IT') return { amount: 0, base: 0, rate: 0, note: '' };
    if (t.imuMode === 'esente') return { amount: 0, base: 0, rate: 0, note: 'Esente (impostazione manuale)' };
    if (t.imuMode === 'manuale') return { amount: U.n(t.imuManual), base: 0, rate: 0, note: 'Importo IMU manuale' };
    var main = p.usage === 'abitazione_principale', lux = T.isLuxury(p);
    if (main && !lux) return { amount: 0, base: 0, rate: 0, note: 'Abitazione principale (non A/1, A/8, A/9) e pertinenze: esenti IMU' };
    var base = 0, note = '';
    if (U.has(t.imuBaseManual)) base = U.n(t.imuBaseManual);
    else if (p.type === 'terreno_edificabile') { base = U.n(p.valuation.marketValue) || U.n(p.purchase.price); note = 'Base = valore venale in comune commercio (stima)'; }
    else {
      T.units(p).forEach(function (u) {
        var c = cat(u.categoria), r = U.n(u.rendita);
        base += c === 'T' ? r * 1.25 * 135 : r * 1.05 * T.imuMultiplier(c);
      });
      if (!base) note = 'Rendita catastale mancante: IMU non calcolabile (inseriscila nella scheda Catasto & valori o imposta un importo manuale)';
    }
    if (t.comodato || p.usage === 'comodato') base *= (1 - P.imuComodatoReduction / 100);
    if (t.storicoInagibile) base *= (1 - P.imuInagibileReduction / 100);
    var rate = U.has(t.imuRatePct) ? U.n(t.imuRatePct) : (main ? P.imuMainLuxRate : P.imuRate);
    var amt = base * rate / 100;
    if (main) amt = Math.max(0, amt - P.imuMainLuxDeduction);
    if (p.usage === 'locazione_lunga' && (p.rental.concordato || p.rental.contractType === 'concordato_3_2' || p.rental.contractType === 'studenti')) amt *= (1 - P.imuConcordatoReduction / 100);
    return { amount: amt, base: base, rate: rate / 100, note: note };
  };

  /* IRPEF a scaglioni e addizionali (semplificate, aliquota media regionale e comunale) */
  T.irpef = function (income, P) {
    var b = P.irpefBrackets || [], tax = 0, prev = 0;
    income = Math.max(0, income || 0);
    for (var i = 0; i < b.length; i++) {
      var lim = b[i][0] == null || b[i][0] === '' ? Infinity : +b[i][0], rate = +b[i][1] / 100;
      if (income > prev) tax += (Math.min(income, lim) - prev) * rate;
      prev = lim;
      if (income <= lim) break;
    }
    /* Dal 2026 (L.199/2025) oltre 200.000 € di reddito le detrazioni sono ridotte di 440 € */
    if (U.n(P.irpefHighIncomeThreshold) > 0 && income > P.irpefHighIncomeThreshold) tax += U.n(P.irpefHighIncomeClawback);
    return tax;
  };
  T.addizionali = function (income, profile) { return Math.max(0, income || 0) * (U.n(profile.regionalPct) + U.n(profile.municipalPct)) / 100; };
  T.incremental = function (base, extra, P, profile) {
    base = Math.max(0, base || 0); extra = extra || 0;
    var hi = Math.max(0, base + extra);
    var irpef = T.irpef(hi, P) - T.irpef(base, P), add = T.addizionali(hi, profile) - T.addizionali(base, profile);
    return { irpef: irpef, add: add, total: irpef + add };
  };
  T.marginalRate = function (income, P, profile) {
    var b = P.irpefBrackets || [], prev = 0;
    for (var i = 0; i < b.length; i++) {
      var lim = b[i][0] == null || b[i][0] === '' ? Infinity : +b[i][0];
      if (income < lim) return (+b[i][1] + U.n(profile.regionalPct) + U.n(profile.municipalPct)) / 100;
      prev = lim;
    }
    return 0.43;
  };

  /* Reddito fondiario IRPEF di un immobile italiano NON locato (EUR, 100%) */
  T.nonRentedIrpefIncome = function (p, P) {
    if (p.country !== 'IT') return 0;
    if (p.usage === 'abitazione_principale' || p.usage === 'comodato') return 0;
    if (!p.sameComuneAsMainHome) return 0;
    if (p.category === 'terreno' || p.category === 'commerciale') return 0;
    var r = T.renditaTotal(p) * 1.05;
    if (P.irpefNonRentedOneThird) r *= 4 / 3;
    return r * P.irpefNonRentedSameComunePct / 100;
  };

  /* Regime cedolare: aliquota applicabile o null se non ammessa */
  T.cedolareRate = function (p, P, shortIndex) {
    if (p.country !== 'IT') return null;
    if (p.rental.taxRegime !== 'cedolare') return null;
    if (p.usage === 'locazione_commerciale') return null;
    if (!T.isResidentialUse(p) && p.category !== 'pertinenza') return null;
    if (p.usage === 'locazione_breve') {
      if (p.rental.breveAliquotaAgevolata && (shortIndex == null || shortIndex === 0)) return P.cedolare;
      return P.cedolareBreveDalSecondo;
    }
    if (p.rental.concordato || p.rental.contractType === 'concordato_3_2' || p.rental.contractType === 'studenti') return P.cedolareConcordato;
    return P.cedolare;
  };

  /* Percentuale detrazione lavori se non indicata, in base all'anno della spesa (regole 2026: L.199/2025) */
  T.defaultDeductionPct = function (bonus, p, P, year) {
    var main = p.usage === 'abitazione_principale';
    year = year || (P.taxYear || 2026);
    switch (bonus) {
      case 'ristrutturazione': case 'ecobonus': case 'sismabonus':
        if (year <= 2024) return 50;
        if (year <= 2026) return main ? P.renoMainPct : P.renoOtherPct;
        return main ? 36 : 30;
      case 'mobili': return U.has(P.mobiliPct) ? P.mobiliPct : 50;
      case 'superbonus':
        if (year <= 2022) return 110;
        if (year === 2023) return 90;
        if (year === 2024) return 70;
        if (year === 2025) return 65;
        return 0;
      default: return 0;
    }
  };
  T.deductionCap = function (bonus, P) { return bonus === 'mobili' ? U.n(P.mobiliCap) || 5000 : (bonus === 'superbonus' || bonus === 'altro' ? Infinity : U.n(P.renoCap) || 96000); };
  /* Anni di ripartizione: Superbonus 5 (spese ≤2021), 4 (2022-2023), 10 (dal 2024); Sismabonus 5 fino al 2024 */
  T.defaultDeductionYears = function (bonus, P, year) {
    if (bonus === 'superbonus') {
      if (year && year <= 2021) return 5;
      if (year && year <= 2023) return 4;
      return 10;
    }
    if (bonus === 'sismabonus' && year && year <= 2024) return 5;
    return U.n(P.renoYears) || 10;
  };

  /* Esenzione plusvalenza: {taxable, reason} */
  T.capitalGainRule = function (p, P, holdYears, superbonusYears) {
    var s = p.sale || {};
    if (s.regime === 'esente') return { taxable: false, reason: 'Esente (impostato manualmente)' };
    if (p.type === 'terreno_edificabile') return { taxable: true, reason: 'Terreno edificabile: plusvalenza sempre tassabile' };
    if (p.acquisitionMode === 'successione') return { taxable: false, reason: 'Immobile ricevuto per successione: plusvalenza non tassabile' };
    var mainMaj = !!s.mainResidenceMajority || p.usage === 'abitazione_principale';
    if (mainMaj) return { taxable: false, reason: 'Abitazione principale per la maggior parte del periodo di possesso' };
    if (superbonusYears != null && superbonusYears < P.cgtSuperbonusYears) return { taxable: true, reason: 'Lavori Superbonus conclusi da meno di ' + P.cgtSuperbonusYears + ' anni' };
    if (holdYears != null && holdYears > P.cgtYears) return { taxable: false, reason: 'Posseduto da oltre ' + P.cgtYears + ' anni' };
    return { taxable: true, reason: 'Vendita entro ' + P.cgtYears + ' anni dall\'acquisto' + (p.acquisitionMode === 'donazione' ? ' (dal donante)' : '') };
  };

  G.TAX = T;
})(window.GPI = window.GPI || {});
