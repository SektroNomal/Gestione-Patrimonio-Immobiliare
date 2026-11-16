/* Guida in linea: uso dell'applicazione, regole di calcolo e fiscali applicate, pulsante «Invia a Patrimonio»,
   backup e pubblicazione gratuita su GitHub Pages. I parametri mostrati sono quelli attivi nelle Impostazioni. */
(function (G) {
  'use strict';
  var U = G.U, UI = G.UI, VH = G.VH, PT = G.PORTALS, M = G.MODEL;
  var V = {}, root = null, off = null, offIn = [], timer = null;

  function q(sel) { return root ? root.querySelector(sel) : null; }
  function listen(el, ev, fn) { if (!el) return; el.addEventListener(ev, fn); offIn.push(function () { el.removeEventListener(ev, fn); }); }

  /* ---------- Mattoni di testo ---------- */
  function p(html) { return '<p>' + html + '</p>'; }
  function ul(items) { return '<ul class="g-list">' + items.filter(Boolean).map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>'; }
  function ol(items) { return '<ol class="steps">' + items.filter(Boolean).map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>'; }
  function h(t) { return '<h4 class="sub-h">' + t + '</h4>'; }
  function kbd(k) { return '<kbd>' + U.esc(k) + '</kbd>'; }
  function lnk(route, label, query) { return '<a href="' + U.esc(G.APP.href(route, null, query || null)) + '">' + label + '</a>'; }
  function ext(url, label) { return '<a href="' + U.esc(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'; }
  function tbl(head, rows) {
    return UI.table(head.map(function (t, i) { return { label: t, render: function (r) { return r[i]; } }; }), rows, { cls: 'tbl-compact g-tbl' });
  }
  function faq(qs, ans) { return UI.details(qs, ans, false, 'g-faq'); }

  /* ---------- Valori attivi (Impostazioni) ---------- */
  function S() { return (G.APP && G.APP.S) || M.defaultSettings(); }
  function Pm() { return S().params || M.defaultParams(); }
  function Dm() { return S().defaults || M.defaultSettings().defaults; }
  function Pf() { return S().profile || M.defaultSettings().profile; }
  function pc(v) {
    var x = U.n(v), d = Math.round(x) === x ? 0 : (Math.round(x * 10) === x * 10 ? 1 : 2);
    return U.fmtNum(x, d) + '%';
  }
  function eu(v) { return U.fmtEur(U.n(v), 0); }
  function nn(v) { return U.fmtNum(U.n(v), 0); }
  function maxProps() { return (G.APP && G.APP.MAX) || M.MAX_PROPERTIES || 1000; }

  /* ---------- Pulsante «Invia a Patrimonio» (bookmarklet) ---------- */
  function appUrl() { return String(location.href).split('#')[0]; }
  function bmCode() {
    var code = '';
    try { code = PT && PT.bookmarklet ? PT.bookmarklet(appUrl()) : ''; } catch (e) { code = ''; }
    return code;
  }
  function bmHtml() {
    var href = bmCode(), file = /^file:/i.test(appUrl());
    return '<ol class="steps">' +
      '<li>Mostra la barra dei preferiti del browser (Ctrl+Maiusc+B in Chrome ed Edge).</li>' +
      '<li>Trascina il pulsante <b>Invia a Patrimonio</b> qui sotto sulla barra dei preferiti. In alternativa usa <b>Copia codice</b> e crea un nuovo preferito incollando il codice come indirizzo (URL).</li>' +
      '<li>Apri un annuncio su Idealista, Immobiliare.it, Casa.it o un altro portale e fai clic sul preferito.</li>' +
      '<li>Si apre questa applicazione: scegli l\'immobile a cui aggiungere l\'annuncio e verifica prezzo e superficie.</li></ol>' +
      (file ? UI.note('Stai usando l\'applicazione come file locale: il pulsante funziona solo con l\'app pubblicata online (ad esempio su GitHub Pages, vedi la sezione <b>Pubblicare l\'app gratis</b>).', 'warn') : '') +
      (href ? '<div class="btn-row"><a class="btn btn-sm bm-link" href="' + U.esc(href) + '" data-act="bm-info" title="Trascinami sulla barra dei preferiti">' + U.icon('bookmark') + '<span>Invia a Patrimonio</span></a>' +
        UI.btn('Copia codice', { cls: 'btn-sm', icon: 'copy', act: 'bm-copy' }) + '</div>' : UI.note('Pulsante non disponibile in questo browser.', 'warn'));
  }
  /* ---------- Sezioni ---------- */
  function sInizio() {
    return p('L\'applicazione gestisce fino a <b>' + nn(maxProps()) + ' immobili</b> residenziali e commerciali, in Italia e all\'estero: valori, spese, mutui, affitti, imposte, vendita e rendimenti, con importi nella valuta locale convertiti in euro. Funziona interamente nel browser: i dati restano sul tuo dispositivo e nessun server li riceve.') +
      h('Per cominciare') +
      ol([
        'Imposta il tuo <b>profilo fiscale</b> in ' + lnk('impostazioni', 'Impostazioni → Profilo fiscale', { s: 's-profilo' }) + ': altri redditi IRPEF (servono per calcolare l\'aliquota marginale), addizionali regionale e comunale, anno fiscale.',
        'Se vuoi vedere subito come funziona, carica i <b>dati di esempio</b>: pulsante <b>Carica esempi</b> nell\'elenco degli immobili ancora vuoto, oppure <b>Carica i dati di esempio</b> in ' + lnk('impostazioni', 'Impostazioni → Zona pericolosa', { s: 's-reset' }) + '. Sono 10 immobili fittizi in Italia, Spagna e Stati Uniti, che puoi eliminare quando vuoi.',
        'Crea un immobile con <b>Nuovo immobile</b> (in alto): indica nome, tipologia, Paese, città, stato e utilizzo. Si apre la scheda, che completi sezione per sezione; i calcoli si aggiornano mentre scrivi.',
        'Consulta la ' + lnk('dashboard', 'Dashboard') + ' per i totali del portafoglio, gli avvisi e le prossime scadenze.',
        'Esporta regolarmente un <b>backup</b> (pulsante <b>Backup</b> nell\'elenco degli immobili oppure ' + lnk('impostazioni', 'Impostazioni → Backup e dati', { s: 's-dati' }) + '): i dati sono salvati solo in questo browser.'
      ]) +
      h('Le pagine') +
      tbl(['Pagina', 'A cosa serve'], [
        [lnk('dashboard', 'Dashboard'), 'Valore, patrimonio netto, debito, flussi di cassa, rendimenti, composizione, classifica, imposte stimate, avvisi, scadenze e proiezione pluriennale.'],
        [lnk('immobili', 'Immobili'), 'Elenco con ricerca, filtri, ordinamento, selezione multipla, modifica in blocco, duplicazione, importazione ed esportazione.'],
        [lnk('confronta', 'Confronta'), 'Confronto affiancato da 2 a 10 immobili, con indicatori e grafici.'],
        [lnk('mappa', 'Mappa'), 'Posizione degli immobili su OpenStreetMap, ricerca delle coordinate, riepilogo per Paese e città.'],
        [lnk('scadenze', 'Scadenze'), 'Calendario di IMU, contratti e disdette, fine dei mutui, documenti in scadenza e promemoria, esportabile nel tuo calendario (.ics).'],
        [lnk('cambi', 'Cambi valuta'), 'Stato dei cambi, convertitore, valute del portafoglio, cambi manuali.'],
        [lnk('impostazioni', 'Impostazioni'), 'Profilo fiscale, ipotesi di calcolo, parametri fiscali italiani, preset dei Paesi esteri, aspetto, backup e dati.'],
        [lnk('guida', 'Guida'), 'Questa pagina. Usa la casella di ricerca qui sopra per trovare un argomento.']
      ]) +
      h('Scorciatoie') +
      ul([
        kbd('/') + ' porta alla ricerca globale in alto; ' + kbd('Invio') + ' apre l\'elenco degli immobili filtrato per il testo digitato.',
        kbd('Esc') + ' svuota la ricerca, chiude le finestre di dialogo e, sugli schermi piccoli, il menu laterale.',
        'Nell\'elenco immobili, ' + kbd('Maiusc') + ' + clic su una casella seleziona tutto l\'intervallo dall\'ultima casella cliccata.',
        'Il pulsante del tema, in alto, passa da automatico (come il sistema) a chiaro e a scuro. L\'indicatore dei cambi, accanto, mostra se i tassi sono aggiornati: un clic li aggiorna subito.'
      ]) +
      h('Servizi esterni') +
      p('L\'app si collega a Internet solo per: tassi di cambio (Frankfurter/BCE e servizi di riserva), ricerca delle coordinate e mappa (OpenStreetMap/Nominatim, solo quando lo chiedi), link ai portali immobiliari e all\'Agenzia delle Entrate (si aprono in una nuova scheda). Non ci sono account, pubblicità né statistiche di utilizzo. Senza connessione l\'app continua a funzionare con gli ultimi cambi salvati.');
  }

  function sImmobili() {
    var st = M.STATUS, us = M.USAGE;
    return p('Ogni immobile ha uno <b>stato</b> e un <b>utilizzo</b>: lo stato decide se entra nei totali, l\'utilizzo decide quali imposte si applicano.') +
      tbl(['Stato', 'Come viene considerato'], [
        ['<b>' + st.posseduto + '</b>', 'Entra nei totali del portafoglio, nei flussi di cassa e nelle imposte annuali.'],
        ['<b>' + st.in_vendita + '</b>', 'Come «Posseduto» (è ancora tuo); nella scheda Vendita puoi simulare prezzo, costi e imposte.'],
        ['<b>' + st.venduto + '</b>', 'Esce dai totali correnti; incasso, plusvalenza, imposte, ROI e TIR restano nel riepilogo dei venduti.'],
        ['<b>' + st.in_acquisto + '</b>', 'Trattativa in corso: escluso dai totali, riepilogato a parte con il capitale necessario.'],
        ['<b>' + st.obiettivo + '</b>', 'Immobile da valutare o scenario di prova: escluso dai totali, utile per simulazioni e confronti.']
      ]) +
      h('Utilizzo') +
      tbl(['Utilizzo', 'Effetti principali (Italia)'], [
        [us.abitazione_principale, 'IMU esente salvo A/1, A/8, A/9; nessuna IRPEF sulla rendita; plusvalenza esente se è stata abitazione principale per la maggior parte del possesso. Affitto figurativo facoltativo (scheda Locazione).'],
        [us.seconda_casa + ', ' + us.sfitto + ', ' + us.ristrutturazione, 'IMU piena. Se l\'immobile è nello stesso Comune dell\'abitazione principale (casella nella scheda Generale), IRPEF su una quota della rendita rivalutata.'],
        [us.locazione_lunga, 'Canone tassato con cedolare secca o IRPEF ordinaria; contratti concordati e per studenti con aliquota e IMU ridotte.'],
        [us.locazione_breve, 'Cedolare per gli affitti brevi: aliquota ordinaria su un immobile a scelta, maggiorata sugli altri; oltre un certo numero di immobili si presume l\'attività d\'impresa.'],
        [us.locazione_commerciale, 'Niente cedolare: canone in IRPEF ordinaria; disdetta 12 mesi prima della scadenza.'],
        [us.uso_proprio + ', ' + us.comodato, 'IMU piena; per il comodato a parenti in linea retta la base IMU si riduce del ' + pc(Pm().imuComodatoReduction) + ' (scheda Tasse). Per l\'uso proprio e la seconda casa puoi indicare un affitto figurativo.']
      ]) +
      h('Elenco, filtri e selezione') +
      ul([
        'Filtra per stato, categoria, tipologia, Paese («Tutti tranne l\'Italia» per l\'estero), utilizzo, gruppo, etichetta, valuta e avvisi (i filtri compaiono quando ci sono almeno due valori diversi). Cerca per nome, città, indirizzo, codice, etichetta o inquilino; scegli ordinamento, numero di immobili per pagina e vista a tabella o a schede.',
        'Seleziona più immobili con le caselle per <b>confrontarli</b> (da 2 a 10), duplicarli, esportarli in JSON o CSV, eliminarli o modificarli in blocco.',
        '<b>Modifica in blocco</b>: cambia stato o utilizzo, assegna o togli un gruppo (scrivi «-» per toglierlo), aggiungi o rimuovi etichette, rivaluta il valore di mercato di una percentuale (aggiorna anche la data della stima), adegua canoni e tariffe (ad esempio all\'indice ISTAT) e, se vuoi, annota la modifica nelle note.',
        '<b>Gruppi</b> (uno per immobile, es. «Lombardia», «Società») ed <b>etichette</b> (più di una, es. «affitto», «da vendere») servono per filtrare, raggruppare e confrontare.',
        '<b>Comproprietà</b>: nella scheda Generale indica la tua quota (es. 50%). Inserisci sempre gli importi al 100%: valori, spese, imposte e mutui vengono calcolati sulla tua quota.'
      ]);
  }
  function sScheda() {
    return p('Facendo clic su un immobile si apre la sua <b>scheda</b>, divisa in 12 sezioni. I campi si salvano <b>automaticamente</b> mentre scrivi e i risultati nei riquadri si aggiornano subito. I campi con il simbolo <b>?</b> hanno una spiegazione: passaci sopra con il mouse o toccalo.') +
      tbl(['Sezione', 'Cosa contiene'], [
        ['<b>Generale</b>', 'Nome, codice, gruppo ed etichette; tipologia, stato, utilizzo e modalità di acquisizione; indirizzo, coordinate (pulsante <b>Trova coordinate</b>), Paese e valuta; superficie, locali, piano, classe energetica; quota di proprietà; note.'],
        ['<b>Catasto & valori</b>', 'Italia: unità catastali (foglio, particella, subalterno, categoria, classe, rendita), una per ogni abitazione, negozio o box. Estero: valore catastale o fiscale locale. Valore di mercato con data e fonte, quotazioni OMI o di zona, storico delle valutazioni.'],
        ['<b>Acquisto</b>', 'Data e prezzo (o valore dichiarato per successioni e donazioni), venditore privato o impresa, prima casa, lusso, nuova costruzione; imposte calcolate in automatico o inserite a mano; notaio, agenzia, tecnici, spese del mutuo e altri costi. Per l\'estero, cambio alla data del rogito.'],
        ['<b>Spese</b>', 'Condominio, assicurazione, manutenzione, utenze, TARI, gestione e commissioni delle piattaforme, altri costi ricorrenti; spese una tantum per arredi, lavori (con detrazioni fiscali) ed extra.'],
        ['<b>Mutui</b>', 'Uno o più finanziamenti con valuta, importo, tasso, durata, data e tipo di ammortamento; rata e debito residuo effettivi facoltativi; imposta sostitutiva; piano di ammortamento.'],
        ['<b>Locazione</b>', 'Contratto, canone o tariffa a notte con occupazione, sfitto, date, deposito, inquilino, CIN; regime fiscale (cedolare o IRPEF) e canone concordato. Se non è locato: affitto figurativo facoltativo.'],
        ['<b>Registro</b>', 'Incassi e spese reali per confrontarli con le stime, con il pulsante <b>Genera 12 mesi di affitto</b>.'],
        ['<b>Tasse</b>', 'Italia: IMU automatica o manuale, riduzioni, altri tributi locali. Estero: imposte del Paese, redditi da locazione, IVIE e quadro RW, plusvalenza estera.'],
        ['<b>Vendita</b>', 'Prezzo, data, costi di vendita, regime della plusvalenza; finché non vendi, simula l\'operazione con il prezzo concordato, richiesto o il valore di mercato. Pulsante <b>Segna come venduto</b>.'],
        ['<b>Confronti</b>', 'Ricerca sui portali, importazione di annunci e comparabili con mediana al m² e stima del valore e del canone.'],
        ['<b>Documenti</b>', 'Rogito, APE, visure, contratti, polizze: link o file allegati (fino a 8 MB ciascuno) con data di scadenza; promemoria anche ripetuti. PDF, immagini e testo si aprono nel browser; gli altri formati vengono scaricati.'],
        ['<b>Analisi</b>', 'Tutti gli indicatori, proiezione pluriennale, flussi per anno, simulazione di vendita e sensitività alla rivalutazione.']
      ]) +
      h('Intestazione della scheda') +
      ul([
        '<b>Elenco</b> torna all\'elenco con i filtri che avevi; le frecce passano all\'immobile precedente o successivo dell\'elenco filtrato.',
        'Il riquadro della foto permette di aggiungere un\'immagine dell\'immobile (ridotta e salvata nel browser).',
        '<b>Duplica</b>, <b>Copia</b>, <b>Copia sezioni</b> e <b>Simula</b> sono spiegati nella sezione <b>Copiare e duplicare</b>; seguono stampa, esportazione JSON ed eliminazione.',
        'Gli <b>indicatori</b> in alto riassumono valore, patrimonio netto, cash flow, rendimento, ROI e TIR. Il badge <b>stima</b> segnala che il valore attuale non è inserito da te ma ricavato da comparabili, OMI o prezzo più lavori.'
      ]) +
      h('Valore attuale dell\'immobile') +
      ol([
        'Prezzo di vendita, se l\'immobile è venduto.',
        'Valore di mercato inserito nella scheda Catasto & valori (dopo 12 mesi un avviso ti invita ad aggiornarlo).',
        'Mediana al m² dei comparabili inseriti nella scheda Confronti, meno lo sconto di trattativa (' + pc(Dm().compDiscountPct) + ', modificabile nelle Impostazioni).',
        'Valore medio OMI o di zona per la superficie.',
        'Prezzo d\'acquisto più lavori, rivalutati del ' + pc(Dm().appreciationPct) + ' annuo.'
      ]) +
      p('Gli importi si inseriscono sempre <b>al 100%</b> e nella <b>valuta dell\'immobile</b>; i risultati sono calcolati sulla tua quota di proprietà e convertiti in euro.');
  }

  function sValute() {
    return p('Ogni immobile ha la valuta del suo Paese, scelta in automatico e modificabile nella scheda Generale. Tutti gli importi della scheda si inseriscono in quella valuta; accanto ai campi compare il controvalore in euro.') +
      h('Quale cambio viene usato') +
      tbl(['Importo', 'Cambio'], [
        ['Prezzo e costi di acquisto', 'Cambio alla data del rogito, se indicato nella scheda Acquisto (pulsante <b>Cambio storico alla data di acquisto</b>, dati BCE dal 1999); altrimenti il cambio attuale, con un avviso.'],
        ['Mutui nella stessa valuta', 'Erogazione al cambio dell\'acquisto (al cambio attuale se il mutuo parte più di 6 mesi dopo); rate e debito residuo al cambio attuale.'],
        ['Mutui in un\'altra valuta', 'Ad esempio un mutuo in euro per una casa a Miami: importi convertiti con il cambio attuale della valuta del mutuo (nessun effetto cambio se il mutuo è in euro).'],
        ['Arredi, lavori e spese extra', 'Cambio indicato nella voce; altrimenti quello dell\'acquisto se la spesa è entro 6 mesi dal rogito, poi il cambio attuale.'],
        ['Canoni, spese correnti, valore attuale', 'Cambio attuale (per gli immobili venduti, il cambio alla data di vendita).'],
        ['Prezzo di vendita e plusvalenza', 'Cambio alla data di vendita, se indicato nella scheda Vendita; altrimenti il cambio attuale.']
      ]) +
      h('Da dove arrivano i cambi') +
      ul([
        'Cambi ufficiali della <b>BCE</b> (tramite Frankfurter), integrati da open.er-api.com e, se servono, da currency-api (fawazahmed0) per le valute che la BCE non pubblica.',
        'I cambi si aggiornano all\'avvio e quando sono più vecchi di 12 ore; l\'indicatore in alto mostra lo stato e con un clic forza l\'aggiornamento. Senza connessione si usano gli ultimi cambi salvati.',
        'Le vecchie valute dell\'area euro (lira, peseta, marco…) usano il <b>tasso fisso</b> di conversione; alcune valute ancorate all\'euro o al dollaro sono calcolate dall\'ancoraggio.',
        'Nella pagina ' + lnk('cambi', 'Cambi valuta') + ' trovi il convertitore, l\'esposizione del portafoglio per valuta e i <b>cambi manuali</b>, che prevalgono su quelli scaricati (utile per un cambio concordato o una valuta non quotata).'
      ]) +
      UI.note('Per gli immobili esteri il cambio pesa sul risultato: una valuta che si svaluta riduce in euro valore e canoni anche se in valuta locale crescono. ROI e TIR in euro includono questo effetto.', 'info');
  }

  function sAcquisto() {
    var P = Pm(), fx = eu(P.regFixedPrivate);
    return p('Nella scheda <b>Acquisto</b> indichi data, prezzo e provenienza (compravendita, asta, successione, donazione, costruzione in proprio). Le <b>imposte d\'acquisto</b> sono calcolate in automatico; se conosci l\'importo esatto dal rogito scegli «Importo manuale».') +
      h('Imposte calcolate per gli immobili in Italia') +
      tbl(['Caso', 'Imposte'], [
        ['Da privato, abitazione prima casa', 'Registro ' + pc(P.regPrimaCasa) + ' (minimo ' + eu(P.regMin) + '), ipotecaria e catastale ' + fx + ' ciascuna.'],
        ['Da privato, altre abitazioni', 'Registro ' + pc(P.regOther) + ' (minimo ' + eu(P.regMin) + '), ipotecaria e catastale ' + fx + ' ciascuna.'],
        ['Da privato, immobili non abitativi', 'Registro ' + pc(P.regOther) + ' sul prezzo (minimo ' + eu(P.regMin) + '), ipotecaria e catastale ' + fx + ' ciascuna.'],
        ['Terreni', 'Registro ' + pc(P.regAgricolo) + ' per i terreni agricoli e ' + pc(P.regEdificabile) + ' per quelli edificabili, ipotecaria e catastale ' + fx + ' ciascuna.'],
        ['Da impresa con IVA, abitazioni', 'IVA ' + pc(P.ivaPrimaCasa) + ' prima casa, ' + pc(P.ivaResidential) + ' altre abitazioni, ' + pc(P.ivaLuxury) + ' se di lusso; registro, ipotecaria e catastale ' + eu(P.ivaFixed) + ' ciascuna.'],
        ['Da impresa con IVA, immobili strumentali', 'IVA ' + pc(P.ivaCommercial) + ', registro ' + eu(P.ivaFixed) + ', ipotecaria ' + pc(P.ipoCommercialIva) + ' e catastale ' + pc(P.catCommercialIva) + '. Senza partita IVA l\'IVA è un costo non recuperabile.'],
        ['Successione e donazione', 'Ipotecaria ' + pc(P.succIpo) + ' e catastale ' + pc(P.succCat) + ' del valore catastale (minimo 200 € ciascuna); con i requisiti prima casa ' + eu(P.succFixedPrimaCasa) + ' ciascuna. L\'imposta di successione o donazione, se dovuta oltre le franchigie, va aggiunta tra gli altri costi.'],
        ['Costruzione in proprio', 'Nessuna imposta di trasferimento: indica come prezzo il costo del terreno e della costruzione, oppure il terreno come prezzo e la costruzione tra i lavori (scheda Spese).']
      ]) +
      p('Per le abitazioni e le loro pertinenze acquistate da privati il registro si calcola sul <b>valore catastale</b> (rendita × 1,05 × ' + nn(P.prezzoValorePrimaCasa) + ' per la prima casa, × ' + nn(P.prezzoValoreOther) + ' negli altri casi) se inserisci la rendita nella scheda Catasto & valori: è il sistema del «prezzo-valore». Senza rendita la base è il prezzo.') +
      h('Agevolazione prima casa') +
      ul([
        'Vale per le abitazioni non di lusso (categorie catastali diverse da A/1, A/8 e A/9) e per una pertinenza per ciascuna categoria C/2, C/6 e C/7.',
        'Requisiti principali: residenza nel Comune dell\'immobile entro 18 mesi (o lavoro nel Comune), nessun\'altra abitazione nello stesso Comune, nessun altro immobile acquistato con l\'agevolazione, salvo venderlo entro 2 anni dal nuovo acquisto.',
        'Se vendi entro 5 anni e non acquisti entro un anno dalla vendita un\'altra abitazione principale perdi l\'agevolazione: si pagano la differenza d\'imposta, gli interessi e la sanzione del 30%. Il termine di un anno non è stato raddoppiato.',
        'In Scadenze trovi la data di fine del vincolo quinquennale per gli immobili acquistati con l\'agevolazione.'
      ]) +
      h('Costi accessori e costo fiscale') +
      ul([
        'Notaio, agenzia, tecnici e altri costi d\'acquisto si sommano al prezzo nel <b>capitale investito</b> e nel <b>costo fiscale</b> che riduce la plusvalenza.',
        'Spese bancarie del mutuo (istruttoria, perizia) e imposta sostitutiva sono <b>costi di finanziamento</b>: riducono ROI e TIR, ma non entrano nel costo fiscale.',
        'Immobili esteri: le imposte di trasferimento sono stimate con la percentuale del Paese (modificabile in ' + lnk('impostazioni', 'Impostazioni → Paesi', { s: 's-paesi' }) + '). Se conosci l\'importo passa a «Importo manuale» e indica il cambio alla data del rogito.',
        'Successione e donazione: come prezzo indica il valore dichiarato. Gli immobili ereditati non generano plusvalenza tassabile; per quelli donati i 5 anni decorrono dall\'acquisto del donante (indica la data nella scheda).'
      ]);
  }

  function sMutui() {
    var P = Pm();
    return p('Nella scheda <b>Mutui</b> puoi inserire più finanziamenti per lo stesso immobile: mutuo ipotecario, prestito per i lavori, finanziamento del venditore. Inserisci i dati del contratto al 100%, anche se il mutuo è cointestato: rate e debito sono calcolati sulla tua quota.') +
      tbl(['Ammortamento', 'Come funziona'], [
        ['<b>Francese</b>', 'Rata costante: all\'inizio paghi soprattutto interessi, poi sempre più capitale. È il più diffuso.'],
        ['<b>Italiano</b>', 'Quota di capitale costante: rate più alte all\'inizio e poi decrescenti, meno interessi in totale.'],
        ['<b>Bullet</b>', 'Solo interessi per tutta la durata; il capitale si restituisce con l\'ultima rata.']
      ]) +
      ul([
        'La prima rata cade un mese dopo la data di erogazione (se manca, si usa la data di acquisto).',
        'Per i mutui a tasso variabile indica il tasso attuale (indice più spread) e aggiornalo quando cambia.',
        '<b>Rata effettiva</b>: se la rata della banca è diversa da quella calcolata (spese di incasso, arrotondamenti) inseriscila; vale per l\'ammortamento francese.',
        '<b>Debito residuo oggi</b>: dopo estinzioni parziali, surroghe o rinegoziazioni indica il debito attuale. Le rate future vengono riproporzionate e il rimborso anticipato conta come capitale investito.',
        'Ogni mutuo mostra il <b>piano di ammortamento annuale</b>. Il debito residuo riduce il patrimonio netto e, alla vendita, viene estinto con il ricavato.',
        'Un mutuo può avere una valuta diversa dall\'immobile, ad esempio un mutuo in euro per una casa all\'estero (vedi <b>Valute e cambi</b>).'
      ]) +
      h('Imposte e detrazioni in Italia') +
      ul([
        '<b>Imposta sostitutiva</b> trattenuta all\'erogazione: ' + pc(P.loanSubstitutePrimaCasa) + ' per la prima casa e gli immobili non abitativi, ' + pc(P.loanSubstituteOther) + ' per le altre abitazioni. Per gli immobili esteri non si applica, salvo che tu indichi l\'importo a mano.',
        '<b>Detrazione degli interessi</b>: ' + pc(P.mortgageInterestDeductionPct) + ' degli interessi passivi fino a ' + eu(P.mortgageInterestCap) + ' l\'anno, solo per l\'abitazione principale in Italia; il tetto si divide tra i cointestatari.',
        'Per gli immobili locati gli interessi non si deducono né dall\'IRPEF né dalla cedolare: pesano sul cash flow e sui rendimenti con leva.'
      ]) +
      UI.note('<b>Leva finanziaria</b>: il mutuo riduce il capitale proprio investito. Se il rendimento dell\'immobile supera il costo del debito, ROI e TIR con leva aumentano; altrimenti diminuiscono. Nella scheda Analisi trovi il TIR con e senza leva.', 'info');
  }
  function sTasse() {
    var P = Pm(), br = P.irpefBrackets || [], prev = 0;
    var sc = br.map(function (b) {
      var lim = b[0] == null || b[0] === '' ? null : U.n(b[0]);
      var r = [lim == null ? 'Oltre ' + eu(prev) : (prev ? 'Da ' + eu(prev) + ' a ' + eu(lim) : 'Fino a ' + eu(lim)), pc(b[1])];
      if (lim != null) prev = lim;
      return r;
    });
    return p('Le imposte sulla proprietà si impostano nella scheda <b>Tasse</b>, quelle sui canoni nella scheda <b>Locazione</b>. Il riquadro <b>Carico fiscale annuo</b> della scheda Tasse riepiloga per la tua quota imposte sull\'immobile, imposte sui redditi e detrazioni; la ' + lnk('dashboard', 'Dashboard') + ' mostra il totale del portafoglio.') +
      h('IMU') +
      p('In modalità <b>Calcolo automatico</b> la base imponibile è la rendita catastale (scheda Catasto & valori) rivalutata del 5% e moltiplicata per il coefficiente della categoria; l\'IMU è base × aliquota comunale. Se non indichi l\'aliquota deliberata dal Comune si usa quella predefinita (' + pc(P.imuRate) + ').') +
      tbl(['Categoria catastale', 'Moltiplicatore'], [
        ['A (tranne A/10), C/2, C/6, C/7', '160'],
        ['A/10 uffici e studi privati', '80'],
        ['B, C/3, C/4, C/5', '140'],
        ['C/1 negozi e botteghe', '55'],
        ['D (tranne D/5)', '65'],
        ['D/5 banche e assicurazioni', '80'],
        ['Terreni agricoli', 'reddito dominicale × 1,25 × 135'],
        ['Terreni edificabili', 'valore venale (valore di mercato della scheda)']
      ]) +
      ul([
        'Abitazione principale e pertinenze: <b>esenti</b>, tranne le categorie di lusso A/1, A/8 e A/9 (aliquota ' + pc(P.imuMainLuxRate) + ' e detrazione di ' + eu(P.imuMainLuxDeduction) + ').',
        'Comodato a parenti in linea retta: base ridotta del ' + pc(P.imuComodatoReduction) + '. Immobili storici o inagibili: base ridotta del ' + pc(P.imuInagibileReduction) + '.',
        'Locazione a canone concordato (anche transitoria o per studenti): IMU ridotta del ' + pc(P.imuConcordatoReduction) + '.',
        'Con <b>Importo manuale</b> inserisci l\'IMU effettiva; con <b>Esente</b> la azzeri (ad esempio per i terreni dei coltivatori diretti). Puoi anche indicare la base imponibile a mano.',
        'Acconto il <b>16 giugno</b> e saldo il <b>16 dicembre</b>: le rate compaiono nella pagina ' + lnk('scadenze', 'Scadenze') + '.'
      ]) +
      h('Canoni: cedolare secca o IRPEF') +
      tbl(['Regime', 'Come si calcola'], [
        ['Cedolare secca', pc(P.cedolare) + ' del canone lordo, ' + pc(P.cedolareConcordato) + ' a canone concordato. Niente addizionali, imposta di registro e bollo sul contratto.'],
        ['Locazioni brevi (fino a 30 giorni)', 'Cedolare ' + pc(P.cedolare) + ' per un solo immobile a scelta (opzione «Aliquota agevolata su questo immobile»), ' + pc(P.cedolareBreveDalSecondo) + ' per gli altri. Se l\'opzione è attiva su più immobili, il ' + pc(P.cedolare) + ' va a quello con il canone maggiore.'],
        ['IRPEF ordinaria', 'Si tassa il maggiore tra la rendita rivalutata del 5% e il canone ridotto del ' + pc(P.irpefFlatRentDeduction) + ' (e di un ulteriore ' + pc(P.concordatoBaseReduction) + ' a canone concordato), con aliquota IRPEF e addizionali.']
      ]) +
      ul([
        'La cedolare non vale per le locazioni commerciali, per le unità non abitative (salvo le pertinenze) e per gli immobili esteri: in questi casi l\'app applica l\'IRPEF e mostra un avviso.',
        'Oltre ' + nn(P.maxShortTermUnits) + ' immobili in locazione breve l\'attività si presume d\'impresa. Per ogni locazione breve o turistica serve il <b>CIN</b> (Codice Identificativo Nazionale), da indicare nella scheda Locazione.',
        'In regime IRPEF il contratto sconta l\'<b>imposta di registro</b>: ' + pc(P.registroLocazione) + ' del canone annuo (minimo ' + eu(P.registroLocazioneMin) + '), ridotta del ' + pc(P.concordatoBaseReduction) + ' a canone concordato; a carico del locatore il ' + pc(P.registroLocazioneOwnerShare) + '.',
        'Abitazioni <b>non locate</b> nello stesso Comune dell\'abitazione principale (opzione nella scheda Generale): IRPEF sul ' + pc(P.irpefNonRentedSameComunePct) + ' della rendita rivalutata' + (P.irpefNonRentedOneThird ? ' e aumentata di un terzo' : '') + '. Negli altri casi l\'IMU sostituisce l\'IRPEF.'
      ]) +
      h('Aliquota IRPEF applicata') +
      p('I redditi immobiliari in regime IRPEF si sommano agli <b>altri redditi</b> del ' + lnk('impostazioni', 'profilo fiscale', { s: 's-profilo' }) + ': l\'app calcola IRPEF e addizionali sul totale e ne sottrae quelle sui soli altri redditi. L\'aliquota media che ne risulta si applica a ogni immobile, in proporzione al suo reddito.') +
      tbl(['Scaglione di reddito', 'Aliquota IRPEF'], sc) +
      p('Oltre ' + eu(P.irpefHighIncomeThreshold) + ' di reddito le detrazioni si riducono di ' + eu(P.irpefHighIncomeClawback) + '. Le addizionali regionale e comunale sono quelle del profilo. Scaglioni e aliquote sono modificabili in ' + lnk('impostazioni', 'Impostazioni → Parametri fiscali', { s: 's-fisco' }) + '.') +
      h('Detrazioni per i lavori') +
      tbl(['Bonus', 'Detrazione'], [
        ['Ristrutturazione, ecobonus, sismabonus', 'Spese 2025-2026: ' + pc(P.renoMainPct) + ' sull\'abitazione principale, ' + pc(P.renoOtherPct) + ' sugli altri immobili; dal 2027 36% e 30%; fino al 2024 50%. Tetto di ' + eu(P.renoCap) + ' per unità e per anno, in ' + nn(P.renoYears) + ' rate annuali.'],
        ['Bonus mobili', pc(P.mobiliPct) + ' fino a ' + eu(P.mobiliCap) + ', in ' + nn(P.renoYears) + ' rate.'],
        ['Superbonus', '110% fino al 2022, 90% nel 2023, 70% nel 2024, 65% nel 2025; rate in 4, 5 o 10 anni secondo l\'anno di spesa.']
      ]) +
      ul([
        'Le detrazioni si impostano su ogni voce della scheda <b>Spese</b>: tipo di bonus, percentuale e numero di rate sono proposti in base all\'anno e puoi modificarli.',
        'Con <b>sconto in fattura</b> o <b>cessione del credito</b> non c\'è detrazione: l\'esborso è il costo netto pagato.',
        'Le rate spettano fino a capienza dell\'IRPEF lorda di ogni anno. Se vendi l\'immobile, quelle residue passano all\'acquirente (salvo diverso accordo nell\'atto).',
        'I lavori straordinari aumentano il <b>costo fiscale</b> che riduce la plusvalenza, salvo indicazione contraria; le spese extra solo se lo indichi (servono fatture e bonifici); arredi e spese ricorrenti mai.'
      ]) +
      UI.note('I parametri fiscali riflettono le regole in vigore nel 2026 (Legge di Bilancio 2026). Le stime non sostituiscono la dichiarazione dei redditi: verifica i casi particolari con un professionista.', 'warn');
  }
  function sEstero() {
    var P = Pm(), tot = P.ivieThresholdMode === 'totale';
    return p('Per un immobile all\'estero scegli il Paese nella scheda Generale: valuta, imposte d\'acquisto e regole fiscali vengono proposte dai <b>preset</b> di 37 Paesi (valori indicativi 2025-2026 per un residente fiscale italiano). Puoi modificarli in ' + lnk('impostazioni', 'Impostazioni → Paesi', { s: 's-paesi' }) + ' e, per il singolo immobile, nella scheda <b>Tasse</b>. Il preset mostra anche note e avvisi del Paese, per esempio l\'assenza di una convenzione contro le doppie imposizioni.') +
      h('Imposte pagate nel Paese') +
      tbl(['Voce', 'Esempi', 'Scomputabile dall\'IVIE'], [
        ['Imposta immobiliare locale', 'IBI (Spagna), taxe foncière (Francia), IMI (Portogallo), Grundsteuer (Germania), council tax, property tax', 'Sì, salvo diversa indicazione'],
        ['Imposta patrimoniale', 'Impuesto sobre el Patrimonio, IFI', 'Sì'],
        ['Imposta sul reddito figurativo (immobili non locati)', 'IRNR spagnola', 'Sì, nei Paesi UE/SEE'],
        ['Altre imposte annue', 'Tributi non patrimoniali', 'No']
      ]) +
      p('Se non inserisci gli importi effettivi, l\'app li stima in percentuale del valore secondo il preset e lo segnala accanto alla voce.') +
      h('Canoni da immobili esteri') +
      ul([
        '<b>Nel Paese</b>: imposta sui canoni con l\'aliquota del preset o quella che indichi, calcolata sul canone lordo, sul netto, su una percentuale del lordo oppure sul reddito imponibile estero che inserisci.',
        '<b>In Italia</b>: niente cedolare secca; i canoni concorrono all\'IRPEF per il reddito tassato all\'estero o, se all\'estero non sono tassati, per il canone ridotto del ' + pc(P.foreignRentForfait) + '.',
        'Dall\'IRPEF si detrae il <b>credito per le imposte estere</b> (art. 165 TUIR), fino all\'IRPEF italiana dovuta su quel reddito.'
      ]) +
      h('IVIE') +
      ul([
        'Aliquota ' + pc(P.ivieRate) + ' sulla base imponibile: valore catastale estero nei Paesi UE/SEE, altrimenti costo risultante dall\'atto d\'acquisto, in mancanza valore di mercato. Puoi scegliere la base o indicarla in euro.',
        'Abitazione principale all\'estero non di lusso: esente. Di lusso: ' + pc(P.ivieMainLuxRate) + ' con detrazione di ' + eu(P.ivieMainLuxDeduction) + '.',
        'Dall\'IVIE si scomputano le imposte patrimoniali pagate all\'estero sullo stesso immobile.',
        'Non è dovuta se l\'imposta non supera ' + eu(P.ivieThreshold) + (tot ? ' sul totale degli immobili' : ' per immobile') + ' (scelta in Impostazioni → Parametri fiscali).',
        'Gli immobili esteri non locati soggetti a IVIE non scontano IRPEF in Italia. L\'IVIE si versa alle scadenze dell\'IRPEF (saldo e acconti).'
      ]) +
      UI.note('Gli immobili all\'estero vanno indicati nel <b>quadro RW</b> della dichiarazione dei redditi. Per i Paesi a fiscalità privilegiata l\'app mostra un avviso: verifica gli obblighi con un professionista.', 'warn');
  }

  function sVendita() {
    var P = Pm(), D = Dm();
    return p('Quando vendi, compila la scheda <b>Vendita</b> e imposta lo stato <b>Venduto</b> (oppure usa il pulsante «Segna come venduto»): ROI e indicatori diventano <i>realizzati</i> e l\'immobile esce dal patrimonio corrente. Prima della vendita la scheda simula l\'operazione con il prezzo concordato, quello richiesto o il valore di mercato.') +
      ul([
        'Prezzo al 100% nella valuta dell\'immobile. Per gli immobili esteri indica il <b>cambio del giorno del rogito</b> (pulsante «Cambio storico alla data di vendita»).',
        'Costi di vendita: provvigione dell\'agenzia e altre spese (APE, conformità, cancellazione dell\'ipoteca, penali). Se mancano, nelle simulazioni sono stimati al ' + pc(D.saleCostPct) + ' del prezzo.',
        'Con l\'incasso si estingue il debito residuo dei mutui alla data di vendita.'
      ]) +
      h('Quando la plusvalenza è tassata') +
      ol([
        'Mai, se scegli «Esente (forzata)».',
        'Sempre per i terreni edificabili.',
        'Mai per gli immobili ricevuti in successione.',
        'Mai se l\'immobile è stato abitazione principale tua o dei familiari per la maggior parte del possesso (art. 67 TUIR).',
        'Sempre se i lavori Superbonus sono finiti da meno di ' + nn(P.cgtSuperbonusYears) + ' anni (salvo successione e abitazione principale).',
        'Mai dopo ' + nn(P.cgtYears) + ' anni di possesso; per le donazioni conta la data d\'acquisto del donante.',
        'Negli altri casi è tassata.'
      ]) +
      h('Come si calcola') +
      p('<b>Plusvalenza</b> = prezzo di vendita − costi di vendita − costo fiscale. Il costo fiscale comprende prezzo d\'acquisto, oneri d\'acquisto (imposte, notaio, agenzia; escluse le spese del mutuo) e lavori che aumentano il costo. Le spese Superbonus con sconto in fattura o cessione non si contano se la vendita avviene entro 5 anni dalla fine dei lavori e contano al 50% tra 5 e 10 anni. Per gli immobili esteri gli importi sono convertiti con i cambi delle rispettive date. La minusvalenza non è deducibile.') +
      tbl(['Regime (immobili in Italia)', 'Imposta'], [
        ['Imposta sostitutiva', pc(P.cgtSubstitute) + ' della plusvalenza, versata tramite il notaio al rogito'],
        ['IRPEF ordinaria', 'Aliquote IRPEF e addizionali sulla plusvalenza sommata agli altri redditi, in dichiarazione'],
        ['Automatica', 'L\'app sceglie il regime con l\'imposta minore']
      ]) +
      p('Per gli immobili all\'estero la plusvalenza tassabile in Italia va in IRPEF, con credito per l\'imposta estera. Inserisci l\'imposta effettivamente pagata nel Paese (comprese ritenute sul prezzo non rimborsate); altrimenti è stimata con l\'aliquota della scheda Tasse o con le regole del preset (esenzioni dopo un certo numero di anni, riduzioni progressive, imposte sul prezzo).') +
      p('<b>Incasso netto</b> = prezzo − costi di vendita − imposte − debito residuo. Per provare prezzi e date diversi senza modificare i dati usa la <b>Simulazione di vendita</b> nella scheda Analisi, oppure «Crea copia per simulazione».') +
      UI.note('Le detrazioni per lavori ancora da fruire passano all\'acquirente, salvo diverso accordo nell\'atto: dopo la vendita l\'app non le conteggia più.', 'info');
  }
  function sMetriche() {
    var D = Dm();
    return p('Gli indicatori sono nella scheda <b>Analisi</b> di ogni immobile e, aggregati, nella ' + lnk('dashboard', 'Dashboard') + '. Gli importi sono in euro e riferiti alla tua quota. I valori annui considerano i 12 mesi da oggi (gli ultimi 12 mesi per gli immobili venduti).') +
      h('Reddito e flussi di cassa') +
      tbl(['Indicatore', 'Calcolo'], [
        ['NOI (reddito operativo netto)', 'Canoni attesi al netto dello sfitto − spese di gestione − imposte sull\'immobile (IMU, IVIE, imposte locali), prima delle rate e delle imposte sul reddito'],
        ['Flusso di cassa ante imposte', 'NOI incassato − rate dei mutui'],
        ['Flusso di cassa netto', 'Flusso ante imposte − imposte sul reddito + detrazioni dell\'anno (bonus edilizi e interessi del mutuo sull\'abitazione principale)'],
        ['Costo annuo complessivo', 'Spese + imposte + rate dei mutui']
      ]) +
      h('Rendimenti') +
      tbl(['Indicatore', 'Calcolo'], [
        ['Rendimento lordo', 'Canone annuo / prezzo d\'acquisto (anche sul costo totale: prezzo + oneri d\'acquisto + lavori, arredi e spese extra)'],
        ['Rendimento netto', '(NOI − imposte sul reddito) / costo totale'],
        ['Rendimento sul valore attuale', 'Canone annuo / valore di mercato'],
        ['Cap rate', 'NOI / valore di mercato'],
        ['Cash on cash', 'Flusso di cassa netto / capitale proprio investito (anche ante imposte)'],
        ['GRM', 'Valore / canone annuo potenziale: quanti anni di canone vale l\'immobile'],
        ['Rientro del capitale', 'Capitale proprio investito / flusso di cassa netto annuo']
      ]) +
      h('Debito e rischio') +
      tbl(['Indicatore', 'Calcolo', 'Avviso se'], [
        ['DSCR', 'NOI / rate annue dei mutui', 'sotto 1,2 (sotto 1 il reddito non copre le rate)'],
        ['LTV', 'Debito residuo / valore di mercato', 'oltre 80%'],
        ['LTC', 'Mutuo erogato / costo totale', '—'],
        ['Occupazione di pareggio', '(Spese + imposte sull\'immobile + rate) / canone potenziale', 'oltre 90%'],
        ['Patrimonio netto', 'Valore di mercato − debito residuo', '—'],
        ['Plusvalenza latente', 'Valore di mercato − costo fiscale', '—']
      ]) +
      h('ROI e TIR') +
      ul([
        '<b>ROI</b> = utile / capitale investito. L\'utile somma tutti i flussi datati (acquisto, oneri, lavori, canoni netti, spese, imposte, rate) e il valore finale netto: la vendita reale oppure, per gli immobili posseduti, una vendita ipotetica oggi al valore di mercato, dedotti costi di vendita, imposta sulla plusvalenza e debito residuo.',
        'Il <b>capitale investito</b> è la massima esposizione di cassa raggiunta: con un mutuo è il capitale proprio, non il prezzo dell\'immobile.',
        '<b>ROI annuo</b> = (1 + ROI)^(1/anni) − 1, mostrato dopo almeno 6 mesi di possesso.',
        '<b>TIR</b> (IRR): tasso annuo che azzera il valore attuale dei flussi, ognuno alla sua data. È l\'indicatore più adatto a confrontare investimenti di durata e impegno diversi.',
        '<b>ROI e TIR senza leva</b>: come se l\'immobile fosse stato pagato in contanti. Il confronto con i valori normali misura l\'effetto del mutuo.',
        'Il ROI è <i>realizzato</i> per i venduti, <i>ad oggi</i> per i posseduti e una <i>proiezione</i> a ' + nn(D.projectionYears) + ' anni per gli immobili in trattativa o obiettivo.'
      ]) +
      h('Proiezioni e ipotesi') +
      p('Nella scheda Analisi la proiezione stima per ogni anno futuro valore, debito, flussi e una vendita ipotetica a fine anno, con le ipotesi predefinite (rivalutazione ' + pc(D.appreciationPct) + ', canoni +' + pc(D.rentGrowthPct) + ', costi +' + pc(D.costGrowthPct) + ' all\'anno, sfitto ' + pc(D.vacancyPct) + ', costi di vendita ' + pc(D.saleCostPct) + ') modificabili in ' + lnk('impostazioni', 'Impostazioni → Ipotesi', { s: 's-ipotesi' }) + '; lo sfitto si può indicare anche nella scheda Locazione del singolo immobile. L\'orizzonte della proiezione si sceglie nella scheda; la tabella di <b>sensitività</b> mostra come cambia il risultato con rivalutazioni diverse.') +
      UI.note('Per gli immobili che usi tu puoi indicare nella scheda Locazione un <b>affitto figurativo</b>, cioè l\'affitto che risparmi: entra nel ROI come beneficio di godimento, ma non è un incasso e non è tassato. Utenze e TARI degli immobili in uso proprio sono costi di vita e restano fuori dai rendimenti, salvo diversa scelta in Impostazioni → Ipotesi.', 'info');
  }

  function sConfronti() {
    return p('La scheda <b>Confronti</b> di ogni immobile raccoglie annunci simili in vendita o in affitto (i <i>comparabili</i>) per stimarne valore di mercato e canone. La stima è uno dei criteri del <b>valore attuale</b> descritti nella sezione <b>Scheda immobile</b>.') +
      h('Cerca sui portali') +
      p('Il riquadro propone link di ricerca già impostati sulla città e sulla tipologia dell\'immobile, divisi per gruppi: i portali del Paese dell\'immobile e, per l\'Italia, le quotazioni OMI su GEOPOI dell\'Agenzia delle Entrate. Se nella scheda Generale manca la città, un avviso ti invita a indicarla. I portali non consentono ad altre pagine di leggere i loro annunci: per portarli nell\'app usa il copia-incolla oppure il pulsante <b>Invia a Patrimonio</b>.') +
      h('Importa annunci') +
      ol([
        'Sulla pagina del portale copia il testo di uno o più annunci, anche l\'intera pagina dei risultati (' + kbd('Ctrl') + '+' + kbd('A') + ' e poi ' + kbd('Ctrl') + '+' + kbd('C') + ').',
        'Incollalo nella casella del riquadro <b>Importa annunci</b> e premi <b>Analizza testo</b>: l\'app riconosce prezzo, superficie, locali e link. Sono accettati anche i dati JSON esportati dall\'app.',
        'Nella tabella controlla i dati, scegli per ogni riga <b>In vendita</b> o <b>In affitto</b>, togli la spunta agli annunci da scartare e premi <b>Aggiungi selezionati</b>.'
      ]) +
      h('Annunci comparabili') +
      ul([
        'Ogni comparabile ha tipo, titolo, fonte, prezzo (o canone mensile) nella valuta dell\'immobile, superficie, locali, data, zona, link e note. <b>Apri annuncio</b> apre il link in una nuova scheda.',
        'Togli la spunta a <b>Includi nelle statistiche</b> per escludere un annuncio anomalo senza cancellarlo; <b>Rimuovi esclusi</b> elimina tutti gli annunci esclusi.',
        '<b>Ordina</b> mette prima le vendite e poi ordina per prezzo al m² crescente; <b>CSV</b> esporta l\'elenco per Excel. Ogni immobile può avere fino a 500 comparabili.'
      ]) +
      h('Riepilogo e stime') +
      tbl(['Stima', 'Calcolo'], [
        ['Valore stimato', 'Mediana del prezzo al m² degli annunci in vendita × superficie dell\'immobile, meno lo sconto di trattativa del ' + pc(Dm().compDiscountPct) + ': gli annunci riportano prezzi richiesti, di solito più alti di quelli effettivi.'],
        ['Canone stimato', 'Mediana del canone mensile al m² degli annunci in affitto × superficie.'],
        ['Rendimento lordo stimato', 'Canone stimato × 12 / valore stimato.']
      ]) +
      p('Con <b>Usa come valore di mercato</b> e <b>Usa come canone stimato</b> le stime vengono scritte nella scheda Catasto & valori, dove puoi correggerle. Il riepilogo confronta con la mediana anche il tuo prezzo d\'acquisto, il valore inserito, il prezzo richiesto e il canone, e mostra le quotazioni OMI se le hai inserite. Servono almeno 3-5 annunci simili per una stima affidabile.') +
      h('Confrontare i tuoi immobili') +
      p('La pagina ' + lnk('confronta', 'Confronta') + ' affianca da 2 a 10 immobili del portafoglio con indicatori e grafici ed evidenzia il valore migliore di ogni riga. Selezionali nell\'elenco degli immobili e premi <b>Confronta</b>, oppure aggiungili dalla pagina stessa.');
  }

  function sBookmarklet() {
    return p('<b>Invia a Patrimonio</b> è un preferito speciale (<i>bookmarklet</i>): quando stai guardando un annuncio su un portale, un clic legge prezzo, superficie, locali, città (quando il titolo o i dati della pagina la indicano) e link e li invia a questa applicazione. Nulla passa da server esterni: i dati viaggiano nell\'indirizzo della pagina che si apre.') +
      h('Installazione') +
      bmHtml() +
      h('Cosa succede dopo il clic') +
      ul([
        'Si apre la pagina <b>Importa annuncio</b> con i dati letti: puoi correggere tipo (vendita o affitto), prezzo, valuta, superficie, locali, zona, titolo e link. Il prezzo viene poi convertito nella valuta dell\'immobile.',
        '<b>Aggiungi come confronto a un immobile…</b> chiede a quale immobile aggiungerlo (di solito uno simile per zona, tipologia e dimensioni) e apre la sua scheda Confronti. Gli annunci già presenti vengono riconosciuti e non sono aggiunti due volte.',
        '<b>Crea immobile obiettivo</b> crea un nuovo immobile in stato «Obiettivo / simulazione» con i dati dell\'annuncio, utile per valutare un possibile acquisto.',
        '<b>Ignora</b> chiude la pagina senza salvare nulla.'
      ]) +
      UI.note('La lettura automatica può sbagliare, perché ogni portale organizza la pagina a modo suo: confronta sempre prezzo, superficie e valuta con l\'annuncio originale. Se il pulsante non riconosce i dati, copia il testo dell\'annuncio e usa <b>Importa annunci</b> nella scheda Confronti.', 'warn') +
      p('Il pulsante si collega all\'indirizzo da cui lo installi: se pubblichi l\'app altrove o cambi indirizzo, installalo di nuovo da questa pagina. Non funziona se apri l\'app come file locale (indirizzo che inizia con <code>file:</code>).');
  }

  function sMappaScad() {
    return h('Mappa') +
      ul([
        'La pagina ' + lnk('mappa', 'Mappa') + ' riepiloga gli immobili per Paese e città, con il valore di mercato per Paese, e mostra la posizione dell\'immobile selezionato.',
        'La mappa interattiva di OpenStreetMap si carica solo quando premi <b>Carica la mappa (OpenStreetMap)</b>: fino ad allora nessuna posizione esce dal browser.',
        '<b>Trova coordinate</b> cerca latitudine e longitudine dall\'indirizzo con il servizio gratuito Nominatim di OpenStreetMap, dopo averti chiesto il consenso: viene inviato solo l\'indirizzo. <b>Trova coordinate mancanti</b> lo fa per un massimo di 20 immobili alla volta, al ritmo di una richiesta al secondo.',
        'Puoi anche inserire le coordinate a mano nella scheda Generale (in Google Maps fai clic destro sul punto e copia i numeri). Ogni immobile ha i link per aprirlo in OpenStreetMap o Google Maps e per modificarne l\'indirizzo.'
      ]) +
      h('Scadenze') +
      p('La pagina ' + lnk('scadenze', 'Scadenze') + ' raccoglie le scadenze già passate e quelle dei prossimi 13 mesi di tutti gli immobili non venduti, divise per mese, con filtri per periodo e priorità. Con <b>Esporta calendario (.ics)</b> le importi in Google Calendar, Outlook o nel calendario del telefono.') +
      tbl(['Scadenza', 'Da dove nasce'], [
        ['IMU: acconto 16 giugno, saldo 16 dicembre', 'Scheda Tasse (immobili in Italia con IMU dovuta), con l\'importo stimato di ciascuna rata.'],
        ['Fine del contratto e termine per la disdetta', 'Scheda Locazione: disdetta 6 mesi prima della scadenza, 12 per le locazioni commerciali.'],
        ['Imposta di registro delle annualità successive', 'Contratti in regime IRPEF: da versare entro 30 giorni dall\'inizio di ogni annualità.'],
        ['Ultima rata del mutuo', 'Scheda Mutui.'],
        ['Documenti in scadenza e promemoria', 'Scheda Documenti: polizze, certificazioni e promemoria, anche ripetuti ogni mese, 3 mesi, 6 mesi o anno.'],
        ['Valutazione da aggiornare', '12 mesi dopo la data della stima del valore di mercato.'],
        ['Fine dei vincoli fiscali', 'Termine dei ' + nn(Pm().cgtYears) + ' anni per la plusvalenza, dei ' + nn(Pm().cgtSuperbonusYears) + ' anni dai lavori Superbonus e del vincolo quinquennale della prima casa.']
      ]) +
      UI.note('Gli importi sono stime e non comprendono le scadenze di IRPEF, cedolare e IVIE, che seguono quelle della dichiarazione dei redditi. Le date di versamento che cadono di sabato o in un giorno festivo slittano al primo giorno lavorativo successivo.', 'info');
  }

  function sCopia() {
    return p('Molti immobili hanno spese, tasse o contratti simili: invece di riscriverli puoi duplicare un immobile intero, copiarlo in un altro browser o applicare solo alcune sezioni ad altri immobili.') +
      h('Dalla scheda dell\'immobile') +
      tbl(['Pulsante', 'Cosa fa'], [
        [U.icon('copy') + ' <b>Duplica</b>', 'Crea una o più copie dell\'immobile con tutti i dati: acquisto, spese, mutui, tasse, locazione.'],
        [U.icon('paste') + ' <b>Copia</b>', 'Copia l\'immobile negli appunti: con <b>Incolla</b> nell\'elenco lo ricrei qui o in un altro browser o dispositivo. Se gli appunti non sono disponibili, la copia resta in memoria fino alla chiusura della pagina.'],
        [U.icon('list') + ' <b>Copia sezioni</b>', 'Applica ad altri immobili le sezioni scelte di questo immobile, per esempio le spese ricorrenti o le tasse estere.'],
        [U.icon('star') + ' <b>Simula</b>', 'Crea una copia in stato «Obiettivo / simulazione» per provare scenari (prezzo, mutuo, affitto) senza toccare l\'originale né i totali del patrimonio. Lo stesso fa <b>Crea copia per simulazione</b> nella scheda Analisi.']
      ]) +
      p('Negli elenchi della scheda (spese, lavori, mutui, documenti…) il pulsante ' + U.icon('copy') + ' <b>Duplica voce</b> copia una singola riga.') +
      h('Opzioni di duplicazione') +
      ul([
        'Puoi scegliere se copiare anche confronti di mercato (attivo), documenti allegati, registro entrate/uscite, promemoria e dati di vendita (non attivi).',
        '<b>Crea come «Obiettivo / simulazione»</b> esclude le copie dai totali del patrimonio; <b>Aggiungi «(copia)» al nome</b> aiuta a distinguerle.',
        'Indica il <b>numero di copie</b>: utile per caricare in fretta più unità simili dello stesso stabile. Il dialogo mostra i posti liberi rispetto al limite di ' + nn(maxProps()) + ' immobili.'
      ]) +
      h('Dall\'elenco degli immobili') +
      ul([
        'Ogni riga ha i pulsanti <b>Duplica</b> e <b>Copia</b>. <b>Incolla</b> legge gli appunti (se il browser lo consente), poi la copia in memoria; altrimenti apre una casella dove incollare il testo copiato. Se incolli un solo immobile si apre subito la sua scheda.',
        'Selezionando più immobili con le caselle (' + kbd('Maiusc') + '+clic seleziona un intervallo) puoi duplicarli, confrontarli, modificarli in blocco, esportarli in JSON o CSV, eliminarli oppure usare <b>Copia sezioni da…</b>: scegli l\'immobile di origine e poi le sezioni da copiare su quelli selezionati.',
        '<b>Modifica</b> in blocco cambia stato, utilizzo, gruppo ed etichette, rivaluta i valori di mercato o adegua i canoni di una percentuale (per esempio l\'indice ISTAT).'
      ]) +
      h('Copia sezioni') +
      p('Nel dialogo <b>Copia sezioni su altri immobili</b> scegli una o più delle ' + nn(G.APP && G.APP.SECTIONS ? G.APP.SECTIONS.length : 19) + ' sezioni (dati generali, indirizzo, catasto, acquisto, arredamento, lavori, spese extra, mutui, spese ricorrenti, locazione, tasse italiane ed estere, valutazione, vendita, confronti, registro, documenti, promemoria, gruppo ed etichette) e gli immobili di destinazione, aiutandoti con il filtro e i pulsanti <b>Tutti</b> e <b>Nessuno</b>.') +
      UI.note('Le sezioni copiate <b>sostituiscono</b> quelle degli immobili di destinazione, non si sommano. Esporta un backup prima delle copie in blocco più ampie.', 'warn');
  }

  function sDati() {
    return p('I dati sono salvati automaticamente nel database del browser (IndexedDB), solo su questo dispositivo: nessun server li riceve. Se il browser non lo consente (per esempio in navigazione privata) l\'app usa uno spazio più piccolo o la sola memoria e mostra un avviso.') +
      UI.note('I dati sono legati al browser e all\'indirizzo da cui usi l\'app: un altro browser, un altro dispositivo o un altro indirizzo partono vuoti. Cancellando i dati di navigazione del sito perdi gli immobili: esporta un backup con regolarità.', 'warn') +
      h('Backup') +
      ul([
        '<b>Esporta backup (JSON)</b>, in ' + lnk('impostazioni', 'Impostazioni → Backup e dati', { s: 's-dati' }) + ' o dall\'elenco degli immobili, salva immobili e impostazioni nel file <code>patrimonio-immobiliare-AAAA-MM-GG.json</code>.',
        '<b>Backup cifrato</b> protegge il file con una password di almeno 8 caratteri (cifratura AES-256-GCM, chiave derivata con PBKDF2-SHA256 e 250.000 iterazioni). Richiede un browser che supporti la cifratura in una pagina sicura: se il pulsante è disattivato, apri l\'app online in HTTPS (per esempio da GitHub Pages). <b>Senza la password il backup non è recuperabile.</b>',
        'Se hai modifiche e l\'ultimo backup risale a più di 14 giorni fa, l\'app te lo ricorda.',
        'Nella stessa sezione vedi lo spazio occupato e puoi chiedere al browser l\'<b>archiviazione persistente</b> (pulsante <b>Richiedi</b>), che impedisce la cancellazione automatica dei dati quando il disco è pieno.'
      ]) +
      h('Importare') +
      p('<b>Importa</b> accetta i backup JSON, anche cifrati, e i file di immobili esportati dall\'app (fino a 300 MB). Puoi scegliere come trattare i dati:') +
      tbl(['Modalità', 'Effetto'], [
        ['<b>Unisci</b> (predefinita)', 'Aggiorna gli immobili già presenti, riconosciuti dallo stesso identificativo, con la versione del file e aggiunge quelli nuovi.'],
        ['<b>Aggiungi come copie</b>', 'Aggiunge tutti gli immobili del file come nuovi, senza toccare quelli esistenti.'],
        ['<b>Sostituisci tutto</b>', 'Cancella gli immobili attuali e li sostituisce con quelli del file (chiede conferma).']
      ]) +
      p('Puoi importare anche le impostazioni contenute nel backup. Per spostare i dati su un altro dispositivo: esporta il backup, copialo (chiavetta, cloud personale, e-mail a te stesso) e importalo sull\'altro browser.') +
      h('Esportazioni') +
      ul([
        '<b>Esporta metriche (CSV)</b>: una riga per immobile con valori, costi, flussi e rendimenti, da aprire con Excel. Il CSV serve solo per l\'analisi: per ricaricare i dati usa il JSON.',
        'Dalla scheda dell\'immobile puoi esportarne il JSON ' + U.icon('download') + ' o stamparla ' + U.icon('print') + ' (anche in PDF, scegliendo «Salva come PDF» nella finestra di stampa).',
        'I documenti allegati (fino a 8 MB ciascuno) sono salvati nel browser e inclusi nel backup JSON, che può diventare grande.'
      ]);
  }
  function sPubblica() {
    var here = appUrl(), online = /^https?:/i.test(here);
    return p('L\'app è fatta solo di file statici (HTML, CSS e JavaScript), senza server né database online: puoi pubblicarla gratuitamente su <b>GitHub Pages</b> e usarla da qualsiasi browser, anche da tablet e telefono. ' +
        (online ? 'In questo momento la stai usando dall\'indirizzo <code>' + U.esc(here) + '</code>.' : 'In questo momento la stai usando come file locale.')) +
      h('Pubblicare su GitHub Pages') +
      ol([
        'Crea un account gratuito su ' + ext('https://github.com/signup', 'GitHub') + ' e un nuovo repository <b>pubblico</b> (pulsante <b>New</b>), per esempio <code>patrimonio</code>.',
        'Nel repository scegli <b>Add file → Upload files</b> e trascina <b>il contenuto</b> della cartella dell\'app, non la cartella stessa: <code>index.html</code> deve stare nella radice del repository, insieme alle cartelle <code>css</code>, <code>js</code> e <code>icons</code> e agli altri file (<code>sw.js</code>, <code>manifest.webmanifest</code>…). Conferma con <b>Commit changes</b>.',
        'Apri <b>Settings → Pages</b>; in <b>Build and deployment</b> scegli <b>Deploy from a branch</b>, il ramo <b>main</b> e la cartella <b>/ (root)</b>, poi premi <b>Save</b>.',
        'Dopo uno o due minuti l\'app è online all\'indirizzo <code>https://nome-utente.github.io/patrimonio/</code>, indicato in cima alla pagina Settings → Pages.',
        'Apri l\'indirizzo, aggiungilo ai preferiti, installa il pulsante ' + lnk('guida', 'Invia a Patrimonio', { s: 'bookmarklet' }) + ' e importa il backup dei dati che avevi in un altro browser.'
      ]) +
      UI.note('Con un account gratuito il repository deve essere pubblico: chiunque può vedere il <b>codice</b> dell\'app, ma non i tuoi dati, che restano nel tuo browser. <b>Non caricare mai i backup nel repository</b>: diventerebbero pubblici.', 'warn') +
      h('Aggiornare l\'app') +
      ul([
        'Carica i file nuovi nello stesso modo (<b>Add file → Upload files</b>): sostituiscono i precedenti, mentre i dati nel browser restano intatti.',
        'Alla successiva apertura online l\'app usa la nuova versione; se compare l\'avviso <b>È disponibile una nuova versione</b>, ricarica la pagina.'
      ]) +
      h('Installarla e usarla senza connessione') +
      ul([
        'Puoi <b>installare</b> l\'app come un programma: in Chrome ed Edge con l\'icona di installazione nella barra degli indirizzi o dal menu del browser; su iPhone e iPad con <b>Condividi → Aggiungi alla schermata Home</b> in Safari; su Android con <b>Installa app</b> o <b>Aggiungi a schermata Home</b>.',
        'Dopo la prima apertura online l\'app funziona anche <b>senza connessione</b>, con gli ultimi cambi salvati; aggiornamento dei cambi, mappa, ricerca delle coordinate e portali richiedono Internet.'
      ]) +
      h('Altre possibilità') +
      ul([
        'Puoi aprire <code>index.html</code> direttamente dal computer con un doppio clic: schede, calcoli e backup funzionano, ma non il pulsante Invia a Patrimonio, l\'installazione come app né l\'uso senza connessione; backup cifrato e lettura degli appunti dipendono dal browser.',
        'Va bene anche qualsiasi altro servizio per siti statici (per esempio Netlify o Cloudflare Pages) o un server web sul tuo computer.',
        '<b>Ogni indirizzo ha i propri dati</b>: se passi dal file locale alla versione online, o cambi indirizzo, esporta un backup dal vecchio e importalo nel nuovo.'
      ]);
  }

  function sFaq() {
    return faq('Dove sono salvati i miei dati? Qualcuno può vederli?',
        p('Solo nel browser di questo dispositivo. L\'app non ha server né account: né GitHub né altri ricevono i tuoi immobili. Escono dal browser soltanto l\'indirizzo, quando chiedi di trovare le coordinate, e le coordinate, quando carichi la mappa (entrambi verso OpenStreetMap), oltre ai dati contenuti nei link che apri tu: città e tipologia per i portali, indirizzo o coordinate per le mappe. Le richieste dei cambi non contengono dati tuoi.')) +
      faq('Posso usare l\'app su più dispositivi?',
        p('Sì, ma i dati non si sincronizzano da soli: esporta il backup da un dispositivo e importalo sull\'altro con la modalità <b>Unisci</b>, che sostituisce gli immobili già presenti con la versione del file e aggiunge i nuovi. Modifica i dati su un dispositivo alla volta, altrimenti le modifiche fatte sull\'altro vengono sovrascritte.')) +
      faq('Funziona senza Internet?',
        p('Sì, dopo la prima apertura dell\'app pubblicata online: schede, calcoli e backup funzionano con gli ultimi cambi salvati. Servono la connessione l\'aggiornamento dei cambi, la mappa, la ricerca delle coordinate e i portali.')) +
      faq('Che cosa succede quando raggiungo ' + nn(maxProps()) + ' immobili?',
        p('Non puoi crearne altri: duplicazioni, incolla e importazioni si fermano al limite con un avviso. Elimina gli immobili che non servono più, per esempio le vecchie simulazioni, dopo averli salvati in un backup.')) +
      faq('I calcoli fiscali sono affidabili?',
        p('Sono <b>stime</b> basate sulle regole e sulle aliquote indicate nelle Impostazioni, con alcune semplificazioni (vedi <b>Avvertenze</b>): non sostituiscono la dichiarazione dei redditi né il parere di un professionista.')) +
      faq('Le aliquote sono aggiornate? Cosa faccio se cambia una norma?',
        p('I valori predefiniti seguono la normativa in vigore nel 2026. Se una regola cambia, correggi il parametro in ' + lnk('impostazioni', 'Impostazioni → Parametri fiscali italiani', { s: 's-fisco' }) + ' o, per l\'estero, nel preset del Paese in ' + lnk('impostazioni', 'Impostazioni → Paesi esteri', { s: 's-paesi' }) + ': tutti i calcoli si aggiornano. <b>Ripristina i valori predefiniti</b> annulla le modifiche.')) +
      faq('Perché i risultati di un immobile estero cambiano anche se non ho modificato nulla?',
        p('Perché gli importi in valuta locale sono convertiti in euro ai cambi aggiornati: valore, canoni e debito seguono il cambio del giorno. Per fissare un cambio usa i cambi manuali nella pagina ' + lnk('cambi', 'Cambi valuta') + '.')) +
      faq('Perché il pulsante Invia a Patrimonio non ha letto prezzo o superficie?',
        p('Ogni portale organizza la pagina in modo diverso e la cambia spesso. Correggi i dati nella pagina Importa annuncio, oppure copia il testo dell\'annuncio e usa <b>Importa annunci</b> nella scheda Confronti.')) +
      faq('Ho eliminato un immobile per errore: posso recuperarlo?',
        p('L\'eliminazione chiede conferma e non si può annullare. Puoi recuperarlo solo da un backup, importato con la modalità <b>Unisci</b>: l\'immobile eliminato torna, ma anche gli altri immobili contenuti nel backup tornano alla versione del file. Se li hai modificati dopo il backup, esporta prima un backup aggiornato.')) +
      faq('Come stampo o salvo un PDF?',
        p('Usa il pulsante ' + U.icon('print') + ' nella Dashboard, nell\'elenco degli immobili o nella scheda dell\'immobile, oppure ' + kbd('Ctrl') + '+' + kbd('P') + ', e scegli <b>Salva come PDF</b> come stampante. Menu e pulsanti non vengono stampati.')) +
      faq('Come gestisco un palazzo con più appartamenti?',
        p('Puoi creare un solo immobile con più unità catastali nella scheda Catasto & valori, se lo gestisci come un\'unica proprietà, oppure un immobile per ogni unità: usa <b>Duplica</b> con più copie e assegna a tutte lo stesso <b>gruppo</b> per vederle insieme. La seconda soluzione permette affitti, spese e vendite separati.')) +
      faq('Ho cambiato browser o computer e non vedo più i miei immobili',
        p('I dati sono legati al browser e all\'indirizzo dell\'app: importa l\'ultimo backup nel nuovo browser. Se non hai un backup, riapri il vecchio browser allo stesso indirizzo ed esportalo da lì.'));
  }

  function sAvvertenze() {
    return UI.note('<b>Strumento di stima, non di consulenza.</b> Imposte, rendimenti e plusvalenze sono calcolati in modo indicativo, sulla base della normativa italiana in vigore nel 2026, dei parametri delle Impostazioni e di alcune semplificazioni. Prima di decisioni fiscali o di investimento verifica sempre con un commercialista o un consulente abilitato.', 'warn') +
      h('Principali semplificazioni') +
      ul([
        'L\'IRPEF sui redditi degli immobili è la differenza tra l\'imposta sul reddito complessivo e quella sui soli altri redditi del profilo fiscale; le addizionali regionale e comunale sono calcolate con un\'aliquota media. Non sono considerate le detrazioni per lavoro e familiari né gli oneri deducibili.',
        'Le detrazioni per i lavori e per gli interessi del mutuo sull\'abitazione principale sono considerate per intero nei flussi, una rata all\'anno, senza verificare la capienza dell\'IRPEF lorda: se le tue imposte sono basse, una parte potrebbe andare persa.',
        'Per gli immobili esteri le imposte locali sono stimate con i preset dei Paesi, che riassumono regole spesso più articolate (regioni, scaglioni, deduzioni): se possibile inserisci gli importi effettivi.',
        'I valori di mercato stimati (comparabili, OMI, rivalutazione) e le proiezioni dipendono dalle ipotesi scelte; i cambi sono quelli del giorno o quelli indicati da te.'
      ]) +
      h('Fonti e licenze') +
      ul([
        'Cambi: Banca Centrale Europea tramite ' + ext('https://frankfurter.dev', 'Frankfurter') + ', ' + ext('https://www.exchangerate-api.com', 'ExchangeRate-API') + ' (open.er-api.com) e ' + ext('https://github.com/fawazahmed0/exchange-api', 'currency-api') + '.',
        'Mappe e coordinate: © ' + ext('https://www.openstreetmap.org/copyright', 'contributori di OpenStreetMap') + ', servizio Nominatim. Quotazioni OMI: Agenzia delle Entrate.',
        'I portali immobiliari citati appartengono ai rispettivi proprietari e non sono collegati a questa applicazione.',
        'Applicazione distribuita con licenza <b>MIT</b>, «così com\'è» e senza garanzie: puoi usarla, modificarla e ripubblicarla liberamente.'
      ]);
  }
  /* ---------- Vista ---------- */
  /* [chiave, titolo, icona, contenuto, etichetta breve per l'indice] */
  var SECS = [
    ['inizio', 'Primi passi', 'home', sInizio],
    ['immobili', 'Elenco degli immobili', 'building', sImmobili, 'Immobili'],
    ['scheda', 'Scheda immobile', 'edit', sScheda],
    ['valute', 'Valute e cambi', 'currency', sValute],
    ['acquisto', 'Acquisto e imposte d\'acquisto', 'calc', sAcquisto, 'Acquisto'],
    ['mutui', 'Mutui', 'trend', sMutui],
    ['tasse', 'Imposte italiane sugli immobili', 'sliders', sTasse, 'Imposte italiane'],
    ['estero', 'Immobili all\'estero', 'globe', sEstero, 'Estero'],
    ['vendita', 'Vendita e plusvalenza', 'tag', sVendita, 'Vendita'],
    ['metriche', 'Rendimenti e indicatori', 'chart', sMetriche, 'Rendimenti'],
    ['confronti', 'Confronti con il mercato', 'compare', sConfronti, 'Confronti'],
    ['bookmarklet', 'Pulsante «Invia a Patrimonio»', 'bookmark', sBookmarklet, 'Invia a Patrimonio'],
    ['mappa', 'Mappa e scadenze', 'map', sMappaScad],
    ['copia', 'Copiare e duplicare', 'copy', sCopia, 'Copiare'],
    ['dati', 'Backup e dati', 'download', sDati, 'Backup'],
    ['pubblica', 'Pubblicare l\'app gratis', 'upload', sPubblica, 'Pubblicare'],
    ['faq', 'Domande frequenti', 'info', sFaq, 'FAQ'],
    ['avvertenze', 'Avvertenze e fonti', 'alert', sAvvertenze, 'Avvertenze']
  ];
  var idx = {};

  function secHtml(s) {
    var body;
    try { body = s[3](); } catch (e) {
      console.error(e);
      body = UI.note('Questa sezione non può essere mostrata: ' + U.esc((e && e.message) || String(e)), 'danger');
    }
    return UI.card(s[1], body, { id: 'g-' + s[0], icon: s[2], cls: 'g-sec',
      actions: UI.btn('Indice', { cls: 'btn-sm btn-ghost', icon: 'list', act: 'top', title: 'Torna all\'indice degli argomenti' }) });
  }
  function words(raw) { return U.norm(raw).replace(/[^a-z0-9%€.,'\s-]/g, ' ').split(/\s+/).filter(Boolean); }
  function search(raw) {
    var w = words(raw), shown = 0;
    SECS.forEach(function (s) {
      var card = q('#g-' + s[0]), chip = q('.toc [data-s="' + s[0] + '"]');
      if (!card) return;
      var hit = w.every(function (x) { return idx[s[0]].indexOf(x) >= 0; });
      card.hidden = !hit;
      if (chip) chip.hidden = !hit;
      if (hit) shown++;
      if (hit && w.length) {
        Array.prototype.forEach.call(card.querySelectorAll('details'), function (d) {
          var t = U.norm(d.textContent);
          d.open = w.every(function (x) { return t.indexOf(x) >= 0; });
        });
      }
    });
    var none = q('#g-none');
    if (none) none.hidden = shown > 0;
    return shown;
  }
  function goTo(k, smooth) {
    var t = q('#g-' + k), inp = q('.g-search');
    if (!t) return;
    if (t.hidden && inp) { inp.value = ''; search(''); }
    if (t.scrollIntoView) t.scrollIntoView(smooth ? { behavior: 'smooth', block: 'start' } : { block: 'start' });
  }
  function openAll() { if (root) Array.prototype.forEach.call(root.querySelectorAll('details'), function (d) { d.open = true; }); }

  function actions() {
    return {
      'goto': function (el) { goTo(el.getAttribute('data-s'), true); },
      top: function () {
        var t = q('.toc');
        if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
      print: function () { openAll(); window.print(); },
      'bm-info': function () {
        U.toast('Trascina il pulsante «Invia a Patrimonio» sulla barra dei preferiti, poi usalo dalla pagina di un annuncio.', 'info', 6000);
      },
      'bm-copy': function () {
        var c = bmCode();
        if (!c) { U.toast('Pulsante non disponibile in questo browser.', 'error'); return; }
        U.copyText(c).then(function () {
          U.toast('Codice copiato: crea un nuovo preferito e incollalo come indirizzo (URL).', 'success', 6000);
        }, function () {
          U.toast('Copia non riuscita: trascina il pulsante sulla barra dei preferiti.', 'error', 6000);
        });
      }
    };
  }

  V.render = function (el, route) {
    var qp = (route && route.query) || {};
    var html = UI.pageHead('Guida', 'Come usare l\'applicazione, quali regole di calcolo e fiscali applica, come proteggere e pubblicare i tuoi dati.',
        UI.btn('Stampa', { cls: 'btn-sm', icon: 'print', act: 'print', title: 'Stampa la guida o salvala in PDF' })) +
      '<div class="g-search-wrap">' + U.icon('search') +
      '<input type="search" class="g-search" placeholder="Cerca nella guida: IMU, cedolare, plusvalenza, backup…" aria-label="Cerca nella guida" autocomplete="off"></div>' +
      '<nav class="toc" aria-label="Argomenti della guida">' + SECS.map(function (s) {
        return '<button type="button" class="chip" data-act="goto" data-s="' + s[0] + '">' + U.icon(s[2]) + '<span>' + (s[4] || s[1]) + '</span></button>';
      }).join('') + '</nav>' +
      '<p id="g-none" class="muted" hidden>Nessun argomento contiene tutte le parole cercate: prova con un termine diverso o più breve.</p>' +
      SECS.map(secHtml).join('');
    root = VH.mount(el, html, 'v-guide');
    off = UI.actions(root, actions());
    idx = {};
    SECS.forEach(function (s) { var c = q('#g-' + s[0]); idx[s[0]] = c ? U.norm(s[1] + ' ' + (s[4] || '') + ' ' + c.textContent) : ''; });

    var inp = q('.g-search');
    listen(inp, 'input', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; search(inp.value); }, 150);
    });
    listen(inp, 'keydown', function (e) {
      if (e.key === 'Escape') { inp.value = ''; search(''); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (timer) { clearTimeout(timer); timer = null; }
        search(inp.value);
        var first = null;
        SECS.forEach(function (s) { var c = q('#g-' + s[0]); if (!first && c && !c.hidden) first = s[0]; });
        if (first) goTo(first, true);
      }
    });
    listen(window, 'beforeprint', openAll);

    /* ?s=<sezione> apre direttamente un argomento (anche g-<sezione>); ?q=<testo> avvia una ricerca */
    var key = String(qp.s || '').replace(/^g-/, '');
    if (qp.q && inp) { inp.value = String(qp.q); search(inp.value); }
    if (key && /^[a-z]+$/.test(key) && q('#g-' + key)) {
      timer = setTimeout(function () { timer = null; goTo(key, false); }, 30);
    }
  };
  V.onFx = function () {};
  V.destroy = function () {
    if (timer) { clearTimeout(timer); timer = null; }
    if (off) off();
    offIn.forEach(function (f) { f(); });
    offIn = []; off = null; root = null; idx = {};
  };

  G.VIEWS = G.VIEWS || {};
  G.VIEWS.guida = V;
})(window.GPI = window.GPI || {});
