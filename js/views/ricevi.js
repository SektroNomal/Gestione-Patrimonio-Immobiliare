/* Vista Importa annuncio: riceve i dati inviati dal bookmarklet e li aggiunge come confronto o come nuovo immobile obiettivo */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, M = G.MODEL, PT = G.PORTALS, FX = G.FX, VH = G.VH;
  var V = {}, root = null, off = null, offA = null;
  var st = { raw: null, r: null, err: '' };
  var MAX_CMP = 500, LAST = 'gpi-last-cmp';
  var KINDS = [['vendita', 'In vendita (prezzo)'], ['affitto', 'In affitto (canone mensile)']];

  function lastPid() { try { return localStorage.getItem(LAST) || ''; } catch (e) { return ''; } }
  function setLastPid(id) { try { localStorage.setItem(LAST, id); } catch (e) { /* archivio locale non disponibile */ } }
  function q(sel) { return root ? root.querySelector(sel) : null; }
  function str(x, n) { return x == null ? '' : String(x).trim().slice(0, n); }
  function pos(x) { var v = U.n(x); return v > 0 ? v : null; }
  function priceLabel(r) { return r.kind === 'affitto' ? 'Canone mensile' : 'Prezzo richiesto'; }

  /* Legge il parametro d (JSON {u, t, p, c, x} del bookmarklet); se è lo stesso già letto conserva le correzioni fatte dall'utente */
  function load(query) {
    var d = (query && query.d) || '';
    if (d && d === st.raw && st.r) return;
    st = { raw: d, r: null, err: '' };
    if (!d) return;
    try {
      var o;
      try { o = JSON.parse(d); } catch (e) { throw new Error('il testo ricevuto non è nel formato atteso'); }
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('formato non riconosciuto');
      var r = PT.fromPayload(o), cur = str(r.currency, 3).toUpperCase();
      st.r = {
        kind: r.kind === 'affitto' ? 'affitto' : 'vendita', price: pos(r.price),
        currency: FX.currencies().indexOf(cur) >= 0 ? cur : 'EUR', sqm: pos(r.sqm), rooms: pos(r.rooms),
        city: str(r.city, 120), title: str(r.title, 200), url: U.safeUrl(r.url), source: str(r.source, 80)
      };
      if (!st.r.url && !st.r.title && !st.r.price) throw new Error('nell\'annuncio non ci sono dati utili');
    } catch (e) { st.r = null; st.err = (e && e.message) || String(e); }
  }

  /* Anteprima del valore al m² (con controvalore in euro se la valuta è diversa) */
  function ppmHtml() {
    var r = st.r; if (!r) return '';
    var aff = r.kind === 'affitto', d = aff ? 2 : 0, price = pos(r.price), sqm = pos(r.sqm), fx = r.currency !== 'EUR';
    var eur = function (x, dd) { return fx ? ' <small class="muted">≈ ' + U.fmtEur(FX.toEur(x, r.currency), dd) + '</small>' : ''; };
    if (!price) return '<span class="muted">Inserisci ' + (aff ? 'il canone mensile' : 'il prezzo') + ' per vedere il valore al m².</span>';
    var out = priceLabel(r) + ': <b>' + U.fmtMoney(price, r.currency) + '</b>' + eur(price, 0);
    if (!sqm) return out + ' · <span class="warn">Indica la superficie: senza m² non si calcola il valore al m² usato nelle stime.</span>';
    out += ' · al m²: <b>' + U.fmtMoney(price / sqm, r.currency, d) + '</b>' + eur(price / sqm, d);
    if (aff) out += ' · all\'anno al m²: <b>' + U.fmtMoney(price * 12 / sqm, r.currency, 0) + '</b>';
    return out;
  }
  function drawPpm() { var el = q('[data-ppm]'); if (el) el.innerHTML = ppmHtml(); }

  function backBtns() {
    return UI.btn('Come si installa il bookmarklet', { href: '#/guida?s=bookmarklet', cls: 'btn-primary', icon: 'book' }) +
      UI.btn('Vai agli immobili', { href: '#/immobili', icon: 'home' });
  }
  function emptyHtml() {
    return (st.err ? UI.note('I dati ricevuti non sono leggibili: ' + U.esc(st.err) + '. Riprova dal bookmarklet oppure copia il testo dell\'annuncio e incollalo in <b>Scheda immobile → Confronti → Importa annunci</b>.', 'warn') : '') +
      UI.empty(st.err ? 'Annuncio non importato' : 'Nessun annuncio da importare',
        'Questa pagina riceve gli annunci inviati dal pulsante <b>«Invia a Patrimonio»</b> (un bookmarklet da aggiungere ai preferiti del browser): aprilo sulla pagina di un annuncio di immobiliare.it, idealista, casa.it o di un altro portale e i dati arriveranno qui.',
        backBtns(), 'bookmark');
  }

  function formHtml() {
    var r = st.r, A = G.APP, none = !A.props.length;
    var head = (r.source ? UI.badge(U.esc(r.source)) + ' ' : '') +
      (r.url ? UI.btn('Apri l\'annuncio', { href: r.url, blank: true, icon: 'external', cls: 'btn-sm' }) : '');
    var form = UI.grid([
      UI.select(r, 'kind', 'Tipo di annuncio', KINDS),
      UI.num(r, 'price', priceLabel(r), { id: 'rv-price', dec: 0 }),
      UI.select(r, 'currency', 'Valuta', UI.currencyOptions()),
      UI.num(r, 'sqm', 'Superficie', { suffix: 'm²', dec: 0 }),
      UI.int(r, 'rooms', 'Locali'),
      UI.text(r, 'city', 'Città / zona', { placeholder: 'es. Milano – Navigli' }),
      UI.text(r, 'title', 'Titolo', { cls: 'span2' }),
      UI.text(r, 'url', 'Link all\'annuncio', { type: 'url', cls: 'span2', placeholder: 'https://…' })
    ], 2) + '<p class="ppm" data-ppm>' + ppmHtml() + '</p>' +
      UI.note('La lettura automatica della pagina può sbagliare: confronta prezzo, superficie e valuta con l\'annuncio originale prima di salvarlo.');
    var acts = '<div class="btn-row">' +
      UI.btn('Aggiungi come confronto a un immobile…', { cls: 'btn-primary', icon: 'compare', act: 'add', disabled: none }) +
      UI.btn('Crea immobile obiettivo', { icon: 'star', act: 'create' }) +
      UI.btn('Ignora', { icon: 'x', act: 'cancel', cls: 'btn-ghost' }) + '</div>' +
      '<ul class="small muted">' +
      '<li><b>Confronto</b>: l\'annuncio si aggiunge ai comparabili dell\'immobile scelto e il suo valore al m² entra nella stima del valore di mercato' +
      ' (o del canone, se è un affitto). Il prezzo viene convertito nella valuta dell\'immobile.' + (none ? ' <span class="warn">Prima crea o importa almeno un immobile.</span>' : '') + '</li>' +
      '<li><b>Immobile obiettivo</b>: crea una nuova scheda con stato «Obiettivo» per simulare l\'acquisto (costi, tasse, mutuo, rendimento); ' +
      'prezzo, superficie e link vengono copiati e l\'annuncio diventa il suo primo confronto.</li></ul>';
    return UI.pageHead('Importa annuncio', 'Controlla i dati letti dalla pagina del portale e scegli cosa farne.') +
      UI.card('Annuncio ricevuto', form, { icon: 'bookmark', actions: head }) + UI.card('Cosa vuoi fare?', acts, { icon: 'check' });
  }

  function onChange(path) {
    if (path === 'kind') { var l = q('label[for="rv-price"] > span'); if (l) l.textContent = priceLabel(st.r); }
    drawPpm();
  }

  var ACT = {
    add: function () {
      var A = G.APP, r = st.r; if (!r) return;
      VH.pickProperty('Aggiungi l\'annuncio a…', { selected: lastPid(), okLabel: 'Aggiungi',
        text: 'Scegli l\'immobile da confrontare con l\'annuncio: di solito uno simile per zona, tipologia e dimensioni.' }).then(function (id) {
        var p = A.get(id); if (!p) return;
        if (!(p.comparables instanceof Array)) p.comparables = [];
        var c = PT.toComparable(r, p), u = U.safeUrl(c.url || '');
        c.kind = r.kind;
        var twin = p.comparables.some(function (x) {
          if (u && U.safeUrl(x.url || '') === u) return true;
          return (x.kind || 'vendita') === c.kind && U.n(c.price) > 0 && U.n(x.price) === U.n(c.price) && U.n(x.sqm) === U.n(c.sqm);
        });
        if (twin) { U.toast('L\'annuncio è già tra i confronti di «' + M.displayName(p) + '».', 'warn', 6000); return; }
        if (p.comparables.length >= MAX_CMP) { U.toast('Limite di ' + MAX_CMP + ' confronti per immobile raggiunto: elimina quelli vecchi.', 'warn', 6000); return; }
        p.comparables.push(c);
        setLastPid(p.id);
        A.save(p, true);
        U.toast('Annuncio aggiunto ai confronti di «' + M.displayName(p) + '».', 'success');
        A.go(A.editHref(p.id, 'confronti'), true);
      });
    },
    create: function () {
      var A = G.APP, r = st.r; if (!r) return;
      if (!A.room()) { A.limitMsg(); return; }
      var snap = JSON.parse(JSON.stringify(r));
      A.newDialog({ name: snap.title || ('Annuncio ' + snap.source).trim(), status: 'obiettivo', usage: 'seconda_casa', address: { city: snap.city },
        sqm: snap.sqm, rooms: snap.rooms, notes: snap.url ? 'Annuncio: ' + snap.url : '' }).then(function (np) {
        if (!np) return;
        var price = pos(snap.price);
        if (price && snap.currency !== np.currency) { var cv = FX.convert(price, snap.currency, np.currency); price = cv != null ? Math.round(cv) : null; }
        if (price) { if (snap.kind === 'affitto') np.valuation.estimatedRent = price; else np.purchase.price = price; }
        var c = PT.toComparable(snap, np); c.kind = snap.kind;
        if (!(np.comparables instanceof Array)) np.comparables = [];
        np.comparables.push(c);
        A.save(np, true);
      });
    },
    cancel: function () { G.APP.go('#/dashboard', true); }
  };

  V.render = function (el, route) {
    load(route.query);
    root = VH.mount(el, st.r ? formHtml() : UI.pageHead('Importa annuncio') + emptyHtml(), 'view-ricevi');
    if (st.r) off = UI.bind(root, st.r, onChange);
    offA = UI.actions(root, ACT);
  };
  V.onFx = function () { drawPpm(); };
  V.destroy = function () {
    if (off) off();
    if (offA) offA();
    off = offA = null;
    root = null;
  };

  G.VIEWS = G.VIEWS || {};
  G.VIEWS.ricevi = V;
})(window.GPI = window.GPI || {});
