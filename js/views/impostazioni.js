/* Vista Impostazioni: profilo fiscale, ipotesi di calcolo, parametri fiscali italiani, preset dei Paesi esteri, aspetto, backup e dati */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, M = G.MODEL, K = G.COUNTRIES, DB = G.DB, T = G.TAX, VH = G.VH;
  var V = {}, root = null, off = null, offB = null, offIn = [], saveS = null, tmr = null;
  var st = { cc: '' };
  var PAGES = [12, 25, 50, 100, 250];
  var RENT_BASE = {
    lordo: 'canone lordo',
    netto: 'canone al netto delle spese deducibili (stimate dalle spese indicate nella scheda)',
    pct: 'percentuale del canone lordo (campo «Base imponibile canoni»)'
  };

  /* Parametri fiscali italiani: [chiave, etichetta, tipo, aiuto, opzioni]. Tipi: pct, eur, int, bool, coef, sel */
  var GROUPS = [
    { k: 'irpef', t: 'IRPEF', items: [
      ['irpefHighIncomeThreshold', 'Soglia dei redditi elevati', 'eur', 'Oltre questa soglia di reddito complessivo il beneficio della riduzione dell\'aliquota del secondo scaglione viene neutralizzato (L. 199/2025).'],
      ['irpefHighIncomeClawback', 'Maggiore imposta oltre la soglia', 'eur', 'Importo aggiunto all\'IRPEF quando il reddito supera la soglia dei redditi elevati.']
    ] },
    { k: 'redditi', t: 'Redditi da immobili (IRPEF)', items: [
      ['irpefFlatRentDeduction', 'Deduzione forfettaria sui canoni', 'pct', 'Riduzione forfettaria del canone tassato in via ordinaria (IRPEF). Il reddito non scende comunque sotto la rendita catastale rivalutata.'],
      ['irpefNonRentedSameComunePct', 'Quota imponibile degli immobili non locati', 'pct', 'Le abitazioni non locate situate nello stesso Comune dell\'abitazione principale concorrono all\'IRPEF per questa quota della rendita rivalutata, oltre a pagare l\'IMU.'],
      ['irpefNonRentedOneThird', 'Maggiorazione di un terzo della rendita per gli immobili a disposizione', 'bool', 'Per le abitazioni tenute a disposizione la rendita rivalutata è aumentata di un terzo.'],
      ['foreignRentForfait', 'Deduzione sui canoni esteri non tassati all\'estero', 'pct', 'Se il canone non è tassato nel Paese in cui si trova l\'immobile, in Italia si dichiara il canone lordo ridotto di questa percentuale.']
    ] },
    { k: 'affitti', t: 'Locazioni e cedolare secca', items: [
      ['cedolare', 'Cedolare secca a canone libero', 'pct'],
      ['cedolareConcordato', 'Cedolare secca a canone concordato', 'pct', 'Aliquota ridotta per i contratti a canone concordato nei Comuni ad alta tensione abitativa.'],
      ['cedolareBreveDalSecondo', 'Cedolare sulle locazioni brevi oltre il primo immobile', 'pct', 'La cedolare sugli affitti brevi resta al 21% per un solo immobile scelto dal contribuente; sugli altri si applica questa aliquota.'],
      ['maxShortTermUnits', 'Massimo di immobili in locazione breve senza impresa', 'int', 'Oltre questo numero di unità la locazione breve si presume svolta in forma imprenditoriale.']
    ] },
    { k: 'registro', t: 'Imposta di registro sui contratti di locazione', items: [
      ['registroLocazione', 'Aliquota sul canone annuo', 'pct', 'Dovuta solo con la tassazione ordinaria: con la cedolare secca il registro non si paga.'],
      ['registroLocazioneOwnerShare', 'Quota a carico del proprietario', 'pct', 'Per legge l\'imposta è ripartita in parti uguali tra locatore e conduttore.'],
      ['registroLocazioneMin', 'Imposta minima annua', 'eur'],
      ['concordatoBaseReduction', 'Riduzione della base per il canone concordato', 'pct', 'Riduzione applicata sia alla base del registro sia al reddito IRPEF dei contratti a canone concordato.']
    ] },
    { k: 'imu', t: 'IMU', items: [
      ['imuRate', 'Aliquota IMU predefinita', 'pct', 'Usata quando nella scheda dell\'immobile non è indicata l\'aliquota deliberata dal Comune.'],
      ['imuMainLuxRate', 'Aliquota abitazione principale di lusso (A/1, A/8, A/9)', 'pct'],
      ['imuMainLuxDeduction', 'Detrazione abitazione principale di lusso', 'eur'],
      ['imuConcordatoReduction', 'Riduzione dell\'imposta per il canone concordato', 'pct'],
      ['imuComodatoReduction', 'Riduzione della base per il comodato a parenti', 'pct', 'Comodato d\'uso gratuito a genitori o figli che vi abitano, nel rispetto dei requisiti di legge.'],
      ['imuInagibileReduction', 'Riduzione della base per immobili inagibili o storici', 'pct']
    ] },
    { k: 'ivie', t: 'Immobili all\'estero (IVIE)', items: [
      ['ivieRate', 'Aliquota IVIE', 'pct', 'Si applica al costo d\'acquisto o al valore di mercato; dall\'imposta si scomputano le imposte patrimoniali pagate nel Paese in cui si trova l\'immobile.'],
      ['ivieMainLuxRate', 'Aliquota abitazione principale di lusso', 'pct'],
      ['ivieMainLuxDeduction', 'Detrazione abitazione principale di lusso', 'eur'],
      ['ivieThreshold', 'Soglia di esenzione', 'eur', 'L\'IVIE non è dovuta se l\'importo non supera questa soglia.'],
      ['ivieThresholdMode', 'Applicazione della soglia', 'sel', 'Scegli come applicare la soglia di esenzione: le interpretazioni differiscono, verifica con il tuo consulente.',
        { immobile: 'Per singolo immobile', totale: 'Sull\'imposta complessiva' }]
    ] },
    { k: 'cgt', t: 'Plusvalenze', items: [
      ['cgtSubstitute', 'Imposta sostitutiva sulla plusvalenza', 'pct', 'In alternativa alla tassazione ordinaria, l\'imposta sostitutiva può essere richiesta al notaio al momento del rogito.'],
      ['cgtYears', 'Anni oltre i quali la plusvalenza non è tassata', 'int'],
      ['cgtSuperbonusYears', 'Anni per gli immobili con lavori Superbonus', 'int', 'Periodo di tassabilità esteso per gli immobili su cui sono stati eseguiti interventi agevolati con il Superbonus.']
    ] },
    { k: 'mutuo', t: 'Mutui', items: [
      ['loanSubstitutePrimaCasa', 'Imposta sostitutiva mutuo prima casa', 'pct'],
      ['loanSubstituteOther', 'Imposta sostitutiva mutuo altri immobili', 'pct'],
      ['mortgageInterestDeductionPct', 'Detrazione degli interessi passivi', 'pct', 'Detrazione IRPEF degli interessi del mutuo per l\'acquisto dell\'abitazione principale.'],
      ['mortgageInterestCap', 'Tetto degli interessi detraibili', 'eur', 'Limite annuo per mutuo, ripartito in base alla quota di intestazione.']
    ] },
    { k: 'lavori', t: 'Detrazioni per lavori', items: [
      ['renoMainPct', 'Ristrutturazione abitazione principale (fino al 2026)', 'pct', 'Dal 2027 il calcolo usa le aliquote previste dalla legge (36% abitazione principale, 30% altri immobili).'],
      ['renoOtherPct', 'Ristrutturazione altri immobili (fino al 2026)', 'pct'],
      ['renoCap', 'Tetto di spesa per unità', 'eur'],
      ['renoYears', 'Rate annuali', 'int'],
      ['mobiliPct', 'Bonus mobili', 'pct'],
      ['mobiliCap', 'Tetto di spesa bonus mobili', 'eur']
    ] },
    { k: 'acquisto', t: 'Imposte d\'acquisto', items: [
      ['regPrimaCasa', 'Registro prima casa (acquisto da privato)', 'pct'],
      ['regOther', 'Registro altri immobili (acquisto da privato)', 'pct'],
      ['regMin', 'Imposta di registro minima', 'eur'],
      ['regAgricolo', 'Registro terreni agricoli', 'pct'],
      ['regEdificabile', 'Registro terreni edificabili', 'pct'],
      ['regFixedPrivate', 'Ipotecaria e catastale fisse da privato (ciascuna)', 'eur'],
      ['ivaPrimaCasa', 'IVA prima casa (acquisto da impresa)', 'pct'],
      ['ivaResidential', 'IVA abitazioni (acquisto da impresa)', 'pct'],
      ['ivaLuxury', 'IVA abitazioni di lusso', 'pct'],
      ['ivaCommercial', 'IVA immobili strumentali', 'pct'],
      ['ivaFixed', 'Imposte fisse con IVA (ciascuna)', 'eur', 'Registro, ipotecaria e catastale in misura fissa sugli acquisti soggetti a IVA.'],
      ['ipoCommercialIva', 'Ipotecaria su strumentali con IVA', 'pct'],
      ['catCommercialIva', 'Catastale su strumentali con IVA', 'pct'],
      ['prezzoValorePrimaCasa', 'Coefficiente prezzo-valore prima casa', 'coef', 'Moltiplicatore della rendita catastale rivalutata del 5%: con il prezzo-valore il registro si calcola sul valore catastale invece che sul prezzo.'],
      ['prezzoValoreOther', 'Coefficiente prezzo-valore altre abitazioni', 'coef']
    ] },
    { k: 'succ', t: 'Successioni e donazioni', items: [
      ['succIpo', 'Imposta ipotecaria', 'pct'],
      ['succCat', 'Imposta catastale', 'pct'],
      ['succFixedPrimaCasa', 'Ipotecaria e catastale fisse con agevolazione prima casa (ciascuna)', 'eur']
    ] }
  ];

  function S() { return G.APP.S; }
  function q(sel) { return root ? root.querySelector(sel) : null; }
  function listen(el, ev, fn) { if (!el) return; el.addEventListener(ev, fn); offIn.push(function () { el.removeEventListener(ev, fn); }); }
  function fmtBytes(b) {
    if (!U.ok(b)) return '—';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return U.fmtNum(b, i && b < 10 ? 1 : 0) + ' ' + u[i];
  }

  /* Campo di un parametro fiscale (percorso params.<chiave>) */
  function pfield(it) {
    var path = 'params.' + it[0], label = it[1], t = it[2], o = { help: it[3] || '' };
    if (t === 'pct') return UI.pct(S(), path, label, o);
    if (t === 'int') return UI.int(S(), path, label, o);
    if (t === 'bool') return UI.bool(S(), path, label, o);
    if (t === 'sel') return UI.select(S(), path, label, it[4], o);
    if (t === 'coef') { o.suffix = '×'; o.dec = 'plain'; return UI.num(S(), path, label, o); }
    o.suffix = '€'; o.dec = 0;
    return UI.num(S(), path, label, o);
  }

  /* ---------- Scaglioni IRPEF: l'ultimo scaglione non ha limite superiore ---------- */
  function fromLabel(i, prev) { return i ? 'oltre ' + U.fmtNum(prev, 0) + ' €' : 'da 0 €'; }
  function bracketsHtml() {
    var b = S().params.irpefBrackets || [], prev = 0, rows = [];
    b.forEach(function (r, i) {
      var last = i === b.length - 1, n = i + 1;
      rows.push('<tr><td class="muted" data-ib-from>' + fromLabel(i, prev) + '</td>' +
        '<td>' + (last ? '<input type="text" disabled placeholder="senza limite" aria-label="Limite superiore dello scaglione ' + n + '">' :
          '<input type="text" inputmode="decimal" autocomplete="off" data-ib-l="' + i + '" value="' + U.esc(U.fmtInput(r[0], 0)) + '" aria-label="Limite superiore dello scaglione ' + n + ' in euro">') + '</td>' +
        '<td><input type="text" inputmode="decimal" autocomplete="off" data-ib-r="' + i + '" value="' + U.esc(U.fmtInput(r[1], 2)) + '" aria-label="Aliquota dello scaglione ' + n + ' in percentuale"></td>' +
        '<td>' + (b.length > 1 ? UI.btn('', { cls: 'btn-sm btn-icon btn-ghost', icon: 'trash', act: 'ibdel', data: ' data-i="' + i + '"', title: 'Elimina lo scaglione' }) : '') + '</td></tr>');
      if (!last && U.ok(+r[0])) prev = +r[0];
    });
    return '<div class="tbl-wrap"><table class="tbl tbl-compact tbl-ib"><thead><tr><th>Reddito</th><th>Fino a (€)</th><th>Aliquota (%)</th><th></th></tr></thead><tbody>' +
      rows.join('') + '</tbody></table></div>' +
      '<div class="actions">' + UI.btn('Aggiungi scaglione', { cls: 'btn-sm', icon: 'plus', act: 'ibadd' }) + '</div>';
  }
  function drawBrackets() { var box = q('[data-ib-box]'); if (box) box.innerHTML = bracketsHtml(); }
  /* Aggiorna etichette e formattazione senza ridisegnare la tabella, per non perdere il focus */
  function syncBrackets() {
    var box = q('[data-ib-box]'), b = S().params.irpefBrackets, prev = 0;
    if (!box) return;
    var cells = box.querySelectorAll('[data-ib-from]');
    for (var i = 0; i < cells.length && i < b.length; i++) {
      var le = box.querySelector('[data-ib-l="' + i + '"]'), re = box.querySelector('[data-ib-r="' + i + '"]');
      cells[i].textContent = fromLabel(i, prev);
      if (le) le.value = U.fmtInput(b[i][0], 0);
      if (re) re.value = U.fmtInput(b[i][1], 2);
      if (U.ok(b[i][0])) prev = b[i][0];
    }
  }
  function setBrackets(list, redraw) {
    var before = JSON.stringify(list);
    list.sort(function (a, b) { return (a[0] == null ? Infinity : a[0]) - (b[0] == null ? Infinity : b[0]); });
    list[list.length - 1][0] = null;
    S().params.irpefBrackets = list;
    saveS(); updMarg();
    if (redraw || JSON.stringify(list) !== before) drawBrackets(); else syncBrackets();
  }
  /* Legge la tabella: con un valore non valido evidenzia il campo e non salva */
  function readBrackets() {
    var box = q('[data-ib-box]'), cur = S().params.irpefBrackets || [], out = [], bad = false;
    if (!box) return;
    cur.forEach(function (r, i) {
      var le = box.querySelector('[data-ib-l="' + i + '"]'), re = box.querySelector('[data-ib-r="' + i + '"]');
      var lim = le ? U.parseNum(le.value) : null, rate = re ? U.parseNum(re.value, { pct: true }) : null;
      var limOk = !le || (U.ok(lim) && lim > 0), rateOk = U.ok(rate) && rate >= 0 && rate <= 100;
      if (le) le.classList.toggle('invalid', !limOk);
      if (re) re.classList.toggle('invalid', !rateOk);
      if (!limOk || !rateOk) { bad = true; return; }
      out.push([le ? Math.round(lim) : null, U.round(rate, 4)]);
    });
    if (bad || !out.length) return;
    setBrackets(out);
  }

  /* ---------- Aliquota marginale stimata ---------- */
  function margHtml() {
    var s = S(), inc = U.n(s.profile.otherIncome), r = T.marginalRate(inc, s.params, s.profile);
    return 'Aliquota marginale stimata (IRPEF + addizionali): <b>' + VH.pct(r, 2) + '</b>' +
      '<small class="muted"> · usata per i canoni tassati in via ordinaria e per il confronto con la cedolare secca</small>';
  }
  function updMarg() { var el = q('[data-marg]'); if (el) el.innerHTML = margHtml(); }

  /* ---------- Sezioni ---------- */
  function secProfilo() {
    var s = S();
    var body = UI.grid([
      UI.num(s, 'profile.otherIncome', 'Altri redditi annui (esclusi gli immobili)', { suffix: '€', dec: 0,
        help: 'Reddito complessivo senza gli immobili (lavoro, pensione, impresa): serve a stimare l\'aliquota marginale IRPEF applicata ai redditi immobiliari tassati in via ordinaria.' }),
      UI.pct(s, 'profile.regionalPct', 'Addizionale regionale IRPEF', { help: 'Aliquota media della tua Regione. Le Regioni con aliquote a scaglioni si possono approssimare con l\'aliquota dello scaglione marginale.' }),
      UI.pct(s, 'profile.municipalPct', 'Addizionale comunale IRPEF', { help: 'Aliquota deliberata dal Comune di residenza (fino allo 0,8%, o di più per alcuni grandi Comuni).' })
    ], 3) + '<p class="marg" data-marg>' + margHtml() + '</p>';
    return UI.card('Profilo fiscale', body, { id: 's-profilo', icon: 'calc',
      help: 'Dati personali usati per stimare le imposte sui redditi da immobili. Restano solo nel tuo browser.' });
  }
  function secIpotesi() {
    var s = S();
    var body = UI.grid([
      UI.pct(s, 'defaults.appreciationPct', 'Rivalutazione annua degli immobili', { help: 'Stima il valore attuale quando manca una valutazione o un numero sufficiente di comparabili, ed è usata nelle proiezioni.' }),
      UI.pct(s, 'defaults.rentGrowthPct', 'Crescita annua dei canoni', { help: 'Usata nelle proiezioni dei flussi di cassa.' }),
      UI.pct(s, 'defaults.costGrowthPct', 'Crescita annua dei costi', { help: 'Inflazione delle spese di gestione nelle proiezioni.' }),
      UI.pct(s, 'defaults.vacancyPct', 'Sfitto e insoluti (% del canone)', { help: 'Quota di canone persa per periodi senza inquilino o mancati pagamenti, se non indicata nella scheda dell\'immobile.' }),
      UI.pct(s, 'defaults.saleCostPct', 'Costi di vendita (% del prezzo)', { help: 'Agenzia, certificazioni e altre spese del venditore: usati nelle simulazioni di vendita e nel valore netto di realizzo.' }),
      UI.pct(s, 'defaults.compDiscountPct', 'Sconto di trattativa sui comparabili', { help: 'I prezzi richiesti negli annunci sono ridotti di questa percentuale per stimare il valore di mercato.' }),
      UI.int(s, 'defaults.projectionYears', 'Anni di proiezione', { help: 'Orizzonte delle proiezioni nella dashboard e nelle schede (da 1 a 40 anni).' }),
      UI.select(s, 'defaults.pageSize', 'Immobili per pagina nell\'elenco', PAGES.map(function (n) { return [n, String(n)]; }), { numeric: true }),
      UI.bool(s, 'defaults.livingInRoi', 'Includi le utenze degli immobili in uso proprio nei rendimenti', {
        help: 'Per abitazione principale e immobili a uso proprio, utenze e TARI sono costi di vita: per impostazione predefinita sono esclusi da rendimenti e ROI.' })
    ], 3);
    return UI.card('Ipotesi di calcolo', body, { id: 's-ipotesi', icon: 'trend',
      help: 'Valori predefiniti usati quando la scheda dell\'immobile non indica un dato specifico.' });
  }
  function secFisco() {
    var body = UI.note('Valori indicativi aggiornati al 2026 per un residente fiscale in Italia. Le norme cambiano spesso: <b>verifica sempre con il tuo commercialista</b> e aggiorna qui le aliquote se necessario.', 'warn');
    GROUPS.forEach(function (g, i) {
      var inner = UI.grid(g.items.map(pfield), 3);
      if (g.k === 'irpef') inner = '<div data-ib-box>' + bracketsHtml() + '</div>' + inner;
      body += UI.details(g.t, inner, i === 0, 'grp-' + g.k);
    });
    return UI.card('Parametri fiscali italiani', body, { id: 's-fisco', icon: 'sliders',
      actions: UI.btn('Ripristina i valori predefiniti', { cls: 'btn-sm', icon: 'undo', act: 'resetparams' }) });
  }

  /* ---------- Paesi esteri: personalizzazione dei preset ---------- */
  function ccOv(cc) { var o = S().countryOverrides || {}; return o[cc] || {}; }
  function ccCount(cc) { var o = ccOv(cc); return Object.keys(o).filter(function (k) { return U.has(o[k]); }).length; }
  function ccLabel(c) { return c.name + ' (' + c.code + ')' + (ccCount(c.code) ? ' •' : ''); }
  function ccStateHtml(cc) {
    var n = ccCount(cc);
    return n ? UI.badge(n === 1 ? '1 valore personalizzato' : n + ' valori personalizzati', 'warn') : UI.badge('valori predefiniti', 'b-soft');
  }
  function ccBoxHtml(cc) {
    var base = K.preset(cc), path = 'countryOverrides.' + cc + '.', notes = [];
    var items = K.FIELDS.map(function (f) {
      var k = f[0], isInt = /(Years|From)$/.test(k), bv = base[k];
      var o = { placeholder: U.ok(bv) ? U.fmtInput(bv, isInt ? 0 : 4) : '—' };
      if (isInt) { o.suffix = 'anni'; return UI.int(S(), path + k, f[1], o); }
      return UI.pct(S(), path + k, f[1], o);
    });
    if (base.info) notes.push(UI.note(U.esc(base.info), 'info'));
    if (base.transferNote) notes.push(UI.note(U.esc(base.transferNote), ''));
    if (base.rentBase) notes.push(UI.note('Base imponibile dei canoni: <b>' + U.esc(RENT_BASE[base.rentBase] || base.rentBase) + '</b>' +
      (base.rentBase === 'pct' && U.ok(base.rentBasePct) ? ' (predefinita ' + U.fmtNum(base.rentBasePct, 0) + '%)' : '') + '.', ''));
    if (base.warn) notes.push(UI.note(U.esc(base.warn), 'warn'));
    return '<div class="cc-head"><span data-cc-state>' + ccStateHtml(cc) + '</span>' +
      UI.btn('Ripristina il preset', { cls: 'btn-sm', icon: 'undo', act: 'ccreset' }) + '</div>' +
      '<p class="muted small">Lascia vuoto un campo per usare il valore predefinito, mostrato in grigio. Le aliquote sono stime per un residente fiscale italiano che possiede l\'immobile come persona fisica.</p>' +
      UI.grid(items, 4) + notes.join('');
  }
  function drawCc() { var box = q('[data-cc-box]'); if (box) box.innerHTML = ccBoxHtml(st.cc); }
  function updCcState() {
    var el = q('[data-cc-state]'), sel = q('[data-cc]');
    if (el) el.innerHTML = ccStateHtml(st.cc);
    if (sel && sel.selectedIndex >= 0) {
      var c = K.list().filter(function (x) { return x.code === st.cc; })[0];
      if (c) sel.options[sel.selectedIndex].textContent = ccLabel(c);
    }
  }
  function secPaesi() {
    var opts = K.list().filter(function (c) { return c.preset; }).map(function (c) {
      return '<option value="' + c.code + '"' + (c.code === st.cc ? ' selected' : '') + '>' + U.esc(ccLabel(c)) + '</option>';
    }).join('');
    var body = '<p>Ogni Paese ha un preset con le principali imposte locali, usato per stimare i costi degli immobili esteri. ' +
      'Qui puoi correggerlo: la modifica vale per tutti gli immobili del Paese che non indicano un valore specifico nella scheda. ' +
      'In Italia le imposte estere sono poi considerate per il credito d\'imposta e lo scomputo dall\'IVIE.</p>' +
      '<label class="fld fld-inline"><span>Paese</span><div class="inp"><select data-cc data-nobind>' + opts + '</select></div></label>' +
      '<div data-cc-box>' + ccBoxHtml(st.cc) + '</div>';
    return UI.card('Paesi esteri', body, { id: 's-paesi', icon: 'map',
      help: 'I Paesi con il segno • hanno valori personalizzati.' });
  }

  /* ---------- Aspetto ---------- */
  function secAspetto() {
    var body = UI.grid([
      UI.select(S(), 'theme', 'Tema', { auto: 'Automatico (come il sistema)', light: 'Chiaro', dark: 'Scuro' }, {
        help: 'Puoi cambiare tema anche con il pulsante in alto a destra.' })
    ], 3);
    return UI.card('Aspetto', body, { id: 's-aspetto', icon: 'star' });
  }

  /* ---------- Backup e dati ---------- */
  var STORE = { idb: 'IndexedDB (database del browser)', ls: 'localStorage (spazio ridotto: esporta spesso un backup)', mem: 'solo memoria: i dati NON vengono conservati alla chiusura' };
  function bkHtml() {
    var A = G.APP, mode = DB.mode(), out = UI.kv([
      ['Ultimo backup completo', A.lastBackup ? U.fmtDateTime(A.lastBackup) : 'mai', 'Data dell\'ultima esportazione completa (JSON o cifrata) eseguita da questo browser.'],
      ['Immobili archiviati', U.fmtNum(A.props.length) + ' su ' + U.fmtNum(A.MAX) + ' disponibili'],
      ['Archiviazione', U.esc(STORE[mode] || mode), 'I dati restano solo in questo browser e su questo dispositivo: nessun server li riceve.'],
      ['Spazio occupato', '<span data-store>…</span>'],
      ['Archiviazione persistente', '<span data-pers>…</span>', 'Se attiva, il browser non elimina automaticamente i dati quando lo spazio sul disco scarseggia.']
    ]);
    if (A.backupDue()) out += UI.note('Hai modifiche più recenti dell\'ultimo backup, che risale a più di 14 giorni fa: esporta un backup e conservalo in un luogo sicuro.', 'warn');
    if (mode === 'mem') out += UI.note('Il browser non consente di salvare i dati (navigazione privata o archiviazione disattivata): <b>esporta un backup prima di chiudere la pagina</b>.', 'danger');
    else if (mode === 'ls') out += UI.note('IndexedDB non è disponibile: i dati sono salvati in localStorage, che ha uno spazio limitato.', 'warn');
    return out;
  }
  function fillStore() {
    DB.estimate().then(function (e) {
      var el = q('[data-store]'); if (!el) return;
      if (!e || !U.ok(e.usage)) { el.textContent = 'non disponibile'; return; }
      var fr = e.quota ? e.usage / e.quota : null;
      el.innerHTML = fmtBytes(e.usage) + (e.quota ? ' <small class="muted">su ' + fmtBytes(e.quota) + ' disponibili (' + VH.pct(fr, 2) + ')</small>' + UI.pbar(fr, 'pbar-sm', VH.pct(fr, 2)) : '');
    });
  }
  function fillPers() {
    DB.persisted().then(function (p) {
      var el = q('[data-pers]'); if (!el) return;
      el.innerHTML = p ? UI.badge('attiva', 'pos') :
        UI.badge('non attiva', 'warn') + ' ' + UI.btn('Richiedi', { cls: 'btn-sm', icon: 'lock', act: 'persist', title: 'Chiedi al browser di conservare i dati in modo permanente' });
    });
  }
  function drawBk() {
    var box = q('[data-bk]'); if (!box) return;
    box.innerHTML = bkHtml(); fillStore(); fillPers();
  }
  function secDati() {
    var A = G.APP, enc = A.canEncrypt();
    var acts = '<div class="actions">' +
      UI.btn('Esporta backup (JSON)', { cls: 'btn-primary', icon: 'download', act: 'exp', title: 'Tutti gli immobili e le impostazioni in un file JSON' }) +
      UI.btn('Backup cifrato', { icon: 'lock', act: 'expenc', disabled: !enc, title: enc ? 'Backup protetto da password (AES-256)' : 'Disponibile solo aprendo l\'app da HTTPS' }) +
      UI.btn('Importa', { icon: 'upload', act: 'imp', title: 'Carica un backup JSON (anche cifrato) o un file di immobili' }) +
      UI.btn('Esporta metriche (CSV)', { icon: 'list', act: 'csv', title: 'Tabella apribile con Excel' }) + '</div>';
    return UI.card('Backup e dati', acts + '<div data-bk>' + bkHtml() + '</div>', { id: 's-dati', icon: 'download',
      help: 'Il backup JSON contiene immobili e impostazioni: puoi usarlo per spostare i dati su un altro browser o dispositivo.' });
  }
  function secDanger() {
    var body = '<p>Operazioni irreversibili: esporta prima un backup.</p><div class="actions">' +
      UI.btn('Carica i dati di esempio', { icon: 'building', act: 'demo', title: 'Aggiunge alcuni immobili dimostrativi a quelli esistenti' }) +
      UI.btn('Ripristina tutte le impostazioni', { icon: 'undo', act: 'resetall' }) +
      UI.btn('Elimina tutti gli immobili', { cls: 'btn-danger', icon: 'trash', act: 'wipe' }) + '</div>';
    return UI.card('Zona pericolosa', body, { id: 's-reset', icon: 'alert', cls: 'card-danger' });
  }

  /* ---------- Modifiche dei campi ---------- */
  function onChange(path, v) {
    var m = /^countryOverrides\.([A-Z]{2})\.(\w+)$/.exec(path), s = S();
    if (m) {
      var ov = s.countryOverrides || {};
      if (v == null && ov[m[1]]) {
        delete ov[m[1]][m[2]];
        if (!Object.keys(ov[m[1]]).length) delete ov[m[1]];
      }
      updCcState();
    } else if (path === 'theme') {
      G.APP.applyTheme();
    } else if (v == null && /^(params|defaults|profile)\./.test(path)) {
      /* Campo svuotato: torna al valore predefinito (mostrato all'uscita dal campo) */
      var d = U.get(M.defaultSettings(), path);
      if (d !== undefined) U.set(s, path, d);
    } else if (path === 'defaults.projectionYears' && U.ok(v)) {
      s.defaults.projectionYears = U.clamp(Math.round(v), 1, 40);
    }
    if (path.indexOf('profile.') === 0 || path.indexOf('params.irpef') === 0) updMarg();
    saveS();
  }

  /* ---------- Azioni ---------- */
  function actions() {
    var A = G.APP;
    return {
      'goto': function (el) {
        var t = q('#' + el.getAttribute('data-s'));
        if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      ibadd: function () {
        var b = U.clone(S().params.irpefBrackets || []), top = 0;
        b.forEach(function (r) { if (U.ok(r[0]) && r[0] > top) top = r[0]; });
        b.splice(Math.max(0, b.length - 1), 0, [top + 10000, b.length ? b[b.length - 1][1] : 0]);
        setBrackets(b, true);
      },
      ibdel: function (el) {
        var b = U.clone(S().params.irpefBrackets || []), i = +el.getAttribute('data-i');
        if (b.length < 2 || !(i >= 0 && i < b.length)) return;
        b.splice(i, 1);
        setBrackets(b, true);
      },
      resetparams: function () {
        U.confirm('Ripristinare tutti i parametri fiscali italiani ai valori predefiniti? Profilo, ipotesi di calcolo e preset dei Paesi esteri non cambiano.', 'Ripristina').then(function (ok) {
          if (!ok) return;
          saveS.flush();
          A.S.params = M.defaultParams();
          A.saveSettings(); A.render(true);
          U.toast('Parametri fiscali ripristinati', 'success');
        });
      },
      ccreset: function () {
        if (!ccCount(st.cc)) { U.toast('Il preset non ha valori personalizzati', 'info'); return; }
        delete S().countryOverrides[st.cc];
        saveS(); drawCc(); updCcState();
        U.toast('Preset ripristinato: ' + K.name(st.cc), 'success');
      },
      exp: function () { A.exportJSON(); drawBk(); },
      expenc: function () { var p = A.exportEncrypted(); if (p && p.then) p.then(drawBk); },
      imp: function () { A.importFile(); },
      csv: function () {
        if (!A.props.length) { U.toast('Non ci sono immobili da esportare', 'info'); return; }
        A.exportCSV();
      },
      persist: function () {
        DB.persist().then(function (ok) {
          U.toast(ok ? 'Archiviazione persistente attivata' : 'Il browser non ha concesso l\'archiviazione persistente: esporta regolarmente un backup.', ok ? 'success' : 'warn', 5000);
          fillPers();
        });
      },
      demo: function () { if (A.room()) A.loadDemo(); else A.limitMsg(); },
      wipe: function () {
        var n = A.props.length;
        if (!n) { U.toast('Non ci sono immobili da eliminare', 'info'); return; }
        U.confirm('Eliminare definitivamente <b>' + U.fmtNum(n) + '</b> immobili con tutti i loro dati? L\'operazione non si può annullare: esporta prima un backup.', 'Elimina tutto', true).then(function (ok) {
          if (!ok) return;
          A.replaceAll([]).then(function () { U.toast('Tutti gli immobili sono stati eliminati', 'success'); A.render(true); });
        });
      },
      resetall: function () {
        U.confirm('Ripristinare tutte le impostazioni (profilo, ipotesi, parametri fiscali, preset dei Paesi, cambi manuali e tema)? Gli immobili non vengono modificati.', 'Ripristina tutto', true).then(function (ok) {
          if (!ok) return;
          saveS.flush();
          var rev = A.S.rev || 1;
          A.S = M.normalizeSettings({}); A.S.rev = rev;
          A.saveSettings(); A.render(true);
          U.toast('Impostazioni ripristinate', 'success');
        });
      }
    };
  }

  /* ---------- Rendering ---------- */
  var TOC = [['s-profilo', 'Profilo fiscale'], ['s-ipotesi', 'Ipotesi'], ['s-fisco', 'Parametri fiscali'], ['s-paesi', 'Paesi esteri'],
    ['s-aspetto', 'Aspetto'], ['s-dati', 'Backup e dati'], ['s-reset', 'Zona pericolosa']];
  V.render = function (el, route) {
    var A = G.APP, qp = (route && route.query) || {};
    saveS = U.debounce(function () { G.APP.saveSettings(); }, 500);
    var ccs = K.list().filter(function (c) { return c.preset; });
    st.cc = K.hasPreset(qp.p) ? qp.p : (K.hasPreset(st.cc) ? st.cc : (ccs.length ? ccs[0].code : ''));
    var html = UI.pageHead('Impostazioni', 'Le modifiche si salvano automaticamente in questo browser.') +
      '<nav class="toc" aria-label="Sezioni delle impostazioni">' + TOC.map(function (x) {
        return '<button type="button" class="chip" data-act="goto" data-s="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</nav>' +
      secProfilo() + secIpotesi() + secFisco() + (st.cc ? secPaesi() : '') + secAspetto() + secDati() + secDanger();
    root = VH.mount(el, html, 'v-settings');
    offB = UI.bind(root, S, onChange);
    off = UI.actions(root, actions());
    listen(root, 'change', function (ev) {
      var t = ev.target;
      if (!t || !t.hasAttribute) return;
      if (t.hasAttribute('data-cc')) {
        st.cc = t.value;
        A.setQuery(st.cc ? { p: st.cc } : {});
        drawCc();
      } else if (t.hasAttribute('data-ib-l') || t.hasAttribute('data-ib-r')) readBrackets();
    });
    fillStore(); fillPers();
    /* ?s=<id sezione>: apertura diretta di una sezione (link dalla Guida) */
    if (qp.s && /^s-[a-z]+$/.test(qp.s)) {
      tmr = setTimeout(function () { tmr = null; var t = q('#' + qp.s); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); }, 30);
    }
  };
  V.onFx = function () {};
  V.destroy = function () {
    if (tmr) { clearTimeout(tmr); tmr = null; }
    if (saveS) saveS.flush();
    if (off) off();
    if (offB) offB();
    offIn.forEach(function (f) { f(); });
    offIn = []; off = null; offB = null; root = null;
  };

  G.VIEWS = G.VIEWS || {};
  G.VIEWS.impostazioni = V;
})(window.GPI = window.GPI || {});
