# Gestione Patrimonio Immobiliare

Applicazione web gratuita per gestire un patrimonio immobiliare personale (fino a **1000 immobili**, residenziali e commerciali, in Italia e all'estero) dal punto di vista di una **persona fisica fiscalmente residente in Italia**.

È fatta solo di file statici (HTML, CSS e JavaScript, nessuna libreria esterna): si pubblica gratis su **GitHub Pages**, funziona su computer, tablet e telefono, si installa come app e lavora anche senza connessione. I dati restano **solo nel tuo browser**: non ci sono server, account né tracciamenti.

## Funzionalità

- **Dashboard** del patrimonio: valore, debito, patrimonio netto, flussi di cassa, rendimenti, distribuzione per Paese, tipologia, stato e gruppo, proiezione pluriennale e avvisi.
- **Elenco degli immobili** con ricerca, filtri, ordinamento, modifica in blocco, esportazione e stampa.
- **Scheda immobile** in 12 sezioni: Generale, Catasto & valori, Acquisto, Spese, Mutui, Locazione, Registro, Tasse, Vendita, Confronti, Documenti, Analisi.
- **Stati** posseduto, venduto e obiettivo (immobili che stai valutando), con le stesse analisi.
- **Valute**: ogni immobile estero usa la propria valuta locale; tutti gli importi sono convertiti in euro con i cambi BCE aggiornati, il cambio storico del giorno d'acquisto o un cambio manuale.
- **Fisco italiano** (normativa 2026, parametri modificabili):
  - imposte d'acquisto (registro, ipotecaria, catastale, prezzo-valore, prima casa, IVA);
  - IMU con riduzioni (comodato, canone concordato) e abitazioni di lusso;
  - IRPEF con addizionali oppure cedolare secca sugli affitti, detrazioni per lavori e interessi del mutuo;
  - imposta sostitutiva sul mutuo;
  - plusvalenza alla vendita (regola dei 5 anni, Superbonus, successioni, terreni edificabili) con imposta sostitutiva o tassazione ordinaria.
- **Immobili all'estero**: preset di imposte locali per Paese (modificabili), IVIE, credito per le imposte pagate all'estero, avvisi su Paesi senza convenzione o a fiscalità privilegiata.
- **Mutui** alla francese, all'italiana o a soli interessi, con piano d'ammortamento, rata e debito residuo aggiornabili dopo estinzioni parziali o rinegoziazioni.
- **Rendimenti**: rendimento lordo e netto, flusso di cassa, ROI, ROI annuo, IRR (XIRR), LTV, DSCR, prezzo di pareggio, simulazione di vendita e incasso netto.
- **Confronti con il mercato**: comparabili di vendita e affitto con mediana €/m², stima di valore e canone, importazione di annunci incollati e pulsante **«Invia a Patrimonio»** (bookmarklet) per Immobiliare.it, Idealista, Casa.it e altri portali.
- **Confronta** più immobili affiancati, **Mappa** (OpenStreetMap), **Scadenze** (fine contratti e disdette, IMU, registro, documenti, ultima rata dei mutui, fine dei 5 anni per la plusvalenza, promemoria ricorrenti) e pagina **Cambi valuta**.
- **Duplica** un immobile (anche in più copie o come simulazione), **copia e incolla** tra browser e dispositivi, **copia sezioni** (spese, tasse, locazione…) su altri immobili e modifica in blocco.
- **Backup** in JSON, anche **cifrato con password**, importazione con unione o sostituzione, esportazione CSV delle metriche, stampa e PDF.
- **Guida** integrata in 18 sezioni, con ricerca.

## Provarla subito

1. Scarica la cartella e apri `index.html` con un doppio clic (Chrome, Edge, Firefox o Safari aggiornati).
2. Nella Dashboard premi **Carica dati di esempio**, oppure importa `esempi/esempio-portafoglio.json` da **Impostazioni → Backup e dati → Importa**.
3. Apri la **Guida** dal menu per una panoramica completa.

Aperta come file locale l'app funziona quasi del tutto: non sono disponibili il pulsante «Invia a Patrimonio», l'installazione come app e l'uso senza connessione, mentre backup cifrato e lettura degli appunti dipendono dal browser. Per avere tutto, pubblicala online.

## Pubblicarla gratis su GitHub Pages

1. Crea un account gratuito su [GitHub](https://github.com/signup) e un nuovo repository **pubblico**, per esempio `patrimonio`.
2. Nel repository scegli **Add file → Upload files** e trascina **il contenuto** di questa cartella (non la cartella stessa): `index.html` deve trovarsi nella radice del repository. Conferma con **Commit changes**.
3. Apri **Settings → Pages**; in **Build and deployment** scegli **Deploy from a branch**, il ramo **main** e la cartella **/ (root)**, poi premi **Save**.
4. Dopo uno o due minuti l'app è online all'indirizzo `https://nome-utente.github.io/patrimonio/`.

> **Attenzione:** il repository pubblico rende visibile il **codice**, non i tuoi dati, che restano nel browser. **Non caricare mai i backup nel repository**: diventerebbero pubblici.

Il file `.nojekyll` evita che GitHub elabori i file. Va bene anche qualsiasi altro hosting statico (Netlify, Cloudflare Pages, un server web locale).

### Aggiornare l'app

Carica i file nuovi nello stesso modo: sostituiscono i precedenti e i dati nel browser restano intatti. **A ogni pubblicazione aumenta il numero `VERSION` in `sw.js`** (per esempio da `1.0.0` a `1.0.1`): così il service worker scarica la nuova versione e l'app mostra l'avviso «È disponibile una nuova versione».

### Installarla e usarla senza connessione

Dalla versione online puoi **installare** l'app (Chrome ed Edge: icona di installazione nella barra degli indirizzi; iPhone e iPad: Safari → **Condividi → Aggiungi alla schermata Home**; Android: **Installa app**). Dopo la prima apertura funziona anche **offline** con gli ultimi cambi salvati; aggiornamento dei cambi, mappa, ricerca delle coordinate e portali richiedono Internet.

## I tuoi dati

- Sono salvati nel database del browser (IndexedDB), **solo su questo dispositivo**, e sono legati al browser e all'**indirizzo** da cui usi l'app: un altro browser, un altro dispositivo o un altro indirizzo (per esempio il file locale rispetto alla versione online) partono vuoti.
- **Esporta un backup con regolarità** da Impostazioni → Backup e dati: cancellando i dati di navigazione del sito perdi gli immobili. L'app te lo ricorda se ci sono modifiche e sono passati più di 14 giorni dall'ultimo backup.
- Il **backup cifrato** usa AES-256-GCM con chiave derivata da PBKDF2-SHA256 (250.000 iterazioni) e richiede un browser che supporti la cifratura nella pagina: se il pulsante è disattivato, apri l'app online in HTTPS. Senza la password il file non è recuperabile.
- Per spostare i dati su un altro dispositivo esporta il backup e importalo sull'altro con la modalità **Unisci**. L'importazione accetta file fino a 300 MB; i documenti allegati (fino a 8 MB ciascuno) sono inclusi nel backup.

### Servizi esterni

L'app non invia a nessuno i tuoi immobili. Si collega soltanto a:

| Servizio | Uso | Dati inviati |
|---|---|---|
| [Frankfurter](https://frankfurter.dev) (BCE), [open.er-api.com](https://www.exchangerate-api.com), [currency-api](https://github.com/fawazahmed0/exchange-api) | Cambi aggiornati e storici | Solo codici valuta e date |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) e Nominatim | Mappa e ricerca delle coordinate | Le coordinate quando apri la mappa, l'indirizzo quando cerchi le coordinate |
| Portali immobiliari, Google, mappe, OMI | Link che apri tu | Città, tipologia o indirizzo contenuti nel link |

La pagina applica una Content Security Policy: esegue solo gli script dell'app e si collega solo ai servizi della tabella.

## Struttura dei file

```text
index.html              pagina dell'app (CSP, menu e icone)
manifest.webmanifest    dati per l'installazione come app
sw.js                   service worker per l'uso offline (VERSION da aumentare a ogni pubblicazione)
.nojekyll               pubblicazione su GitHub Pages senza elaborazione Jekyll
css/styles.css          aspetto grafico, tema chiaro e scuro, stampa
icons/                  icone dell'app
js/utils.js             funzioni comuni (numeri, date, testo, finestre)
js/db.js                archiviazione in IndexedDB
js/fx.js                cambi valuta
js/countries.js         Paesi, valute, preset fiscali esteri, province italiane
js/model.js             struttura dei dati e parametri predefiniti
js/tax-it.js            regole fiscali italiane
js/calc.js              calcoli di immobili, mutui, rendimenti e portafoglio
js/portals.js           portali immobiliari, annunci e bookmarklet
js/charts.js, js/ui.js  grafici SVG e componenti dell'interfaccia
js/demo.js              dati di esempio
js/app.js, js/boot.js   stato, salvataggi, importazione/esportazione e avvio
js/views/               pagine dell'app (dashboard, elenco, scheda, guida…)
esempi/                 portafoglio di esempio da importare
tests/                  test automatici
```

## Test

Apri `tests/test.html` nel browser (anche come file locale): vengono eseguiti 21 gruppi di test sui calcoli (formati numerici, cambi, IRPEF, IMU, imposte d'acquisto, plusvalenza, mutui, XIRR, comparabili, portali, portafoglio), compresa una prova di carico con 1000 immobili. I test non toccano i dati salvati nel browser.

## Avvertenze

Imposte, rendimenti e plusvalenze sono **stime indicative**, basate sulla normativa italiana in vigore nel 2026, sui parametri delle Impostazioni e su alcune semplificazioni descritte nella Guida (sezione «Avvertenze e fonti»). Se una norma cambia, aggiorna il parametro in Impostazioni. Prima di decisioni fiscali o di investimento consulta un commercialista o un consulente abilitato.

I portali immobiliari citati appartengono ai rispettivi proprietari e non sono collegati a questa applicazione.

## Licenza

[MIT](LICENSE): puoi usare, modificare e ripubblicare liberamente l'applicazione, che è fornita «così com'è», senza garanzie.
