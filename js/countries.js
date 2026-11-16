/* Paesi, valute, province italiane e preset fiscali esteri indicativi (GPI.COUNTRIES)
   I preset sono stime medie da verificare: aliquote in % (transfer = imposte d'acquisto sul prezzo,
   ptax/wealthPct/imputedPct = % annua del valore, rentTax = % sul reddito da locazione, cgt* = plusvalenza). */
(function (G) {
  'use strict';
  var K = {};
  /* Codice ISO|Nome italiano|Valuta di default */
  var RAW = [
    'IT|Italia|EUR;SM|San Marino|EUR;VA|Città del Vaticano|EUR;MC|Monaco|EUR;FR|Francia|EUR;ES|Spagna|EUR;PT|Portogallo|EUR',
    'DE|Germania|EUR;AT|Austria|EUR;CH|Svizzera|CHF;LI|Liechtenstein|CHF;GB|Regno Unito|GBP;IE|Irlanda|EUR;NL|Paesi Bassi|EUR',
    'BE|Belgio|EUR;LU|Lussemburgo|EUR;DK|Danimarca|DKK;SE|Svezia|SEK;NO|Norvegia|NOK;FI|Finlandia|EUR;IS|Islanda|ISK',
    'EE|Estonia|EUR;LV|Lettonia|EUR;LT|Lituania|EUR;PL|Polonia|PLN;CZ|Repubblica Ceca|CZK;SK|Slovacchia|EUR;HU|Ungheria|HUF',
    'SI|Slovenia|EUR;HR|Croazia|EUR;BA|Bosnia ed Erzegovina|BAM;RS|Serbia|RSD;ME|Montenegro|EUR;MK|Macedonia del Nord|MKD',
    'AL|Albania|ALL;XK|Kosovo|EUR;GR|Grecia|EUR;BG|Bulgaria|EUR;RO|Romania|RON;MD|Moldavia|MDL;UA|Ucraina|UAH',
    'BY|Bielorussia|BYN;RU|Russia|RUB;MT|Malta|EUR;CY|Cipro|EUR;TR|Turchia|TRY;AD|Andorra|EUR;GI|Gibilterra|GBP',
    'GE|Georgia|GEL;AM|Armenia|AMD;AZ|Azerbaigian|AZN;AE|Emirati Arabi Uniti|AED;SA|Arabia Saudita|SAR;QA|Qatar|QAR',
    'OM|Oman|OMR;BH|Bahrein|BHD;KW|Kuwait|KWD;JO|Giordania|JOD;IL|Israele|ILS;LB|Libano|USD;EG|Egitto|EGP',
    'MA|Marocco|MAD;TN|Tunisia|TND;DZ|Algeria|DZD;SN|Senegal|XOF;CV|Capo Verde|CVE;KE|Kenya|KES;TZ|Tanzania|TZS',
    'ZA|Sudafrica|ZAR;MU|Mauritius|MUR;SC|Seychelles|SCR;NG|Nigeria|NGN;GH|Ghana|GHS;TH|Thailandia|THB;VN|Vietnam|VND',
    'ID|Indonesia|IDR;MY|Malesia|MYR;SG|Singapore|SGD;PH|Filippine|PHP;JP|Giappone|JPY;KR|Corea del Sud|KRW;CN|Cina|CNY',
    'HK|Hong Kong|HKD;TW|Taiwan|TWD;IN|India|INR;LK|Sri Lanka|LKR;MV|Maldive|MVR;KZ|Kazakistan|KZT;AU|Australia|AUD',
    'NZ|Nuova Zelanda|NZD;US|Stati Uniti|USD;CA|Canada|CAD;MX|Messico|MXN;BR|Brasile|BRL;AR|Argentina|USD;CL|Cile|CLP',
    'CO|Colombia|COP;PE|Perù|PEN;UY|Uruguay|USD;EC|Ecuador|USD;PA|Panama|USD;CR|Costa Rica|USD;DO|Repubblica Dominicana|USD',
    'CU|Cuba|CUP;BS|Bahamas|BSD;KY|Isole Cayman|KYD;BB|Barbados|BBD;VE|Venezuela|USD;PY|Paraguay|PYG;BO|Bolivia|BOB'
  ].join(';');
  var NAMES = {}, CUR = {}, ORDER = [];
  RAW.split(';').forEach(function (s) {
    var a = s.split('|');
    if (a.length < 3) return;
    NAMES[a[0]] = a[1]; CUR[a[0]] = a[2]; ORDER.push(a[0]);
  });

  var EEA = {};
  'AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK'.split(' ').forEach(function (c) { EEA[c] = 1; });
  /* Paesi a fiscalità privilegiata (DM 4/5/1999 e successive modifiche; Svizzera esclusa dal 2024) */
  var BLACK = {};
  'AD MC AE BS BH BB BZ BM BN CR DM EC PH GI DJ GD GG HK IM KY CK MH VG JE LB LR MO MY MV MU MS NR NU OM PA PF SC SG KN LC VC TW TO TC TV VU WS'.split(' ').forEach(function (c) { BLACK[c] = 1; });
  var EXTRA_NAMES = { BZ: 'Belize', BM: 'Bermuda', BN: 'Brunei', DM: 'Dominica', DJ: 'Gibuti', GD: 'Grenada', GG: 'Guernsey', IM: 'Isola di Man', CK: 'Isole Cook', MH: 'Isole Marshall', VG: 'Isole Vergini Britanniche', JE: 'Jersey', LR: 'Liberia', MO: 'Macao', MS: 'Montserrat', NR: 'Nauru', NU: 'Niue', PF: 'Polinesia Francese', KN: 'Saint Kitts e Nevis', LC: 'Saint Lucia', VC: 'Saint Vincent e Grenadine', TO: 'Tonga', TC: 'Turks e Caicos', TV: 'Tuvalu', VU: 'Vanuatu', WS: 'Samoa' };
  Object.keys(EXTRA_NAMES).forEach(function (c) { if (!NAMES[c]) { NAMES[c] = EXTRA_NAMES[c]; CUR[c] = 'USD'; ORDER.push(c); } });
  CUR.GG = CUR.JE = CUR.IM = 'GBP'; CUR.PF = 'XPF'; CUR.MO = 'MOP';

  /* Regioni e province italiane (sigla|nome|regione) */
  var REGIONS = { ABR: 'Abruzzo', BAS: 'Basilicata', CAL: 'Calabria', CAM: 'Campania', EMR: 'Emilia-Romagna', FVG: 'Friuli-Venezia Giulia', LAZ: 'Lazio', LIG: 'Liguria', LOM: 'Lombardia', MAR: 'Marche', MOL: 'Molise', PIE: 'Piemonte', PUG: 'Puglia', SAR: 'Sardegna', SIC: 'Sicilia', TOS: 'Toscana', TAA: 'Trentino-Alto Adige', UMB: 'Umbria', VDA: 'Valle d\'Aosta', VEN: 'Veneto' };
  var PROV_RAW = [
    'AG|Agrigento|SIC;AL|Alessandria|PIE;AN|Ancona|MAR;AO|Aosta|VDA;AR|Arezzo|TOS;AP|Ascoli Piceno|MAR;AT|Asti|PIE;AV|Avellino|CAM',
    'BA|Bari|PUG;BT|Barletta-Andria-Trani|PUG;BL|Belluno|VEN;BN|Benevento|CAM;BG|Bergamo|LOM;BI|Biella|PIE;BO|Bologna|EMR',
    'BZ|Bolzano|TAA;BS|Brescia|LOM;BR|Brindisi|PUG;CA|Cagliari|SAR;CL|Caltanissetta|SIC;CB|Campobasso|MOL;CE|Caserta|CAM',
    'CT|Catania|SIC;CZ|Catanzaro|CAL;CH|Chieti|ABR;CO|Como|LOM;CS|Cosenza|CAL;CR|Cremona|LOM;KR|Crotone|CAL;CN|Cuneo|PIE',
    'EN|Enna|SIC;FM|Fermo|MAR;FE|Ferrara|EMR;FI|Firenze|TOS;FG|Foggia|PUG;FC|Forlì-Cesena|EMR;FR|Frosinone|LAZ;GE|Genova|LIG',
    'GO|Gorizia|FVG;GR|Grosseto|TOS;IM|Imperia|LIG;IS|Isernia|MOL;AQ|L\'Aquila|ABR;SP|La Spezia|LIG;LT|Latina|LAZ;LE|Lecce|PUG',
    'LC|Lecco|LOM;LI|Livorno|TOS;LO|Lodi|LOM;LU|Lucca|TOS;MC|Macerata|MAR;MN|Mantova|LOM;MS|Massa-Carrara|TOS;MT|Matera|BAS',
    'ME|Messina|SIC;MI|Milano|LOM;MO|Modena|EMR;MB|Monza e Brianza|LOM;NA|Napoli|CAM;NO|Novara|PIE;NU|Nuoro|SAR;OR|Oristano|SAR',
    'PD|Padova|VEN;PA|Palermo|SIC;PR|Parma|EMR;PV|Pavia|LOM;PG|Perugia|UMB;PU|Pesaro e Urbino|MAR;PE|Pescara|ABR;PC|Piacenza|EMR',
    'PI|Pisa|TOS;PT|Pistoia|TOS;PN|Pordenone|FVG;PZ|Potenza|BAS;PO|Prato|TOS;RG|Ragusa|SIC;RA|Ravenna|EMR;RC|Reggio Calabria|CAL',
    'RE|Reggio Emilia|EMR;RI|Rieti|LAZ;RN|Rimini|EMR;RM|Roma|LAZ;RO|Rovigo|VEN;SA|Salerno|CAM;SS|Sassari|SAR;SV|Savona|LIG',
    'SI|Siena|TOS;SR|Siracusa|SIC;SO|Sondrio|LOM;SU|Sud Sardegna|SAR;TA|Taranto|PUG;TE|Teramo|ABR;TR|Terni|UMB;TO|Torino|PIE',
    'TP|Trapani|SIC;TN|Trento|TAA;TV|Treviso|VEN;TS|Trieste|FVG;UD|Udine|FVG;VA|Varese|LOM;VE|Venezia|VEN;VB|Verbano-Cusio-Ossola|PIE',
    'VC|Vercelli|PIE;VR|Verona|VEN;VV|Vibo Valentia|CAL;VI|Vicenza|VEN;VT|Viterbo|LAZ;OG|Ogliastra|SAR;OT|Gallura Nord-Est Sardegna|SAR',
    'VS|Medio Campidano|SAR;CI|Sulcis Iglesiente|SAR'
  ].join(';');
  var PROV = {}, PROV_REG = {};
  PROV_RAW.split(';').forEach(function (s) { var a = s.split('|'); if (a.length === 3) { PROV[a[0]] = a[1]; PROV_REG[a[0]] = a[2]; } });

  /* Preset fiscali per Paese (valori indicativi 2025-2026 per un residente fiscale italiano persona fisica).
     transfer: imposte d'acquisto % prezzo; ptax: imposta immobiliare annua % valore; wealthPct: patrimoniale % valore;
     imputedPct: imposta su reddito figurativo (immobile non locato) % valore; rentTax: % sul reddito da locazione
     calcolato su rentBase ('lordo' | 'netto' | 'pct' = rentBasePct% del lordo); dtt: convenzione con l'Italia;
     cgt: % sulla plusvalenza; cgtYears: anni oltre cui è esente; cgtTaperFrom: inizio riduzione lineare;
     cgtLong/cgtLongYears: aliquota dopo N anni; cgtGainPct: quota della plusvalenza tassata;
     cgtPrice/cgtPriceShort/cgtShortYears: imposta % sul prezzo di vendita; cgtAltPrice: tetto % sul prezzo. */
  var P = {};
  P.IT = { portals: ['immobiliare.it', 'idealista.it', 'casa.it', 'subito.it', 'wikicasa.it'] };
  P.ES = { transfer: 8, transferNote: 'Spagna: ITP 6-11% secondo la Comunidad Autónoma sugli immobili usati (stima 8%); nuova costruzione IVA 10% + AJD 0,5-1,5%.',
    ptax: 0.3, imputedPct: 0.1, rentTax: 19, rentBase: 'netto', cgt: 19,
    info: 'IBI comunale annuo; IRNR 19% (residenti UE) sui canoni al netto delle spese; immobile non locato: IRNR 19% su reddito figurativo (1,1-2% del valore catastale); plusvalenza 19% con ritenuta del 3% sul prezzo a carico dell\'acquirente; plusvalía municipal a carico del venditore.',
    warn: 'Spagna: Impuesto sobre el Patrimonio per non residenti oltre 700.000 € di patrimonio spagnolo netto (e imposta di solidarietà oltre 3 milioni).',
    portals: ['idealista.com', 'fotocasa.es', 'pisos.com', 'habitaclia.com'] };
  P.FR = { transfer: 6.3, transferNote: 'Francia: droits de mutation 5,8-6,3% sugli immobili esistenti (stima 6,3%); nel nuovo circa 0,7% oltre IVA inclusa nel prezzo. Onorari notarili a parte.',
    ptax: 0.5, rentTax: 27.5, rentBase: 'pct', rentBasePct: 70, cgt: 26.5, cgtTaperFrom: 5, cgtYears: 30,
    info: 'Taxe foncière annua (più taxe d\'habitation sulle residenze secondarie); canoni: aliquota minima non residenti 20% + 7,5% prélèvement de solidarité, regime micro-foncier con abbattimento 30%; plusvalenza 19% + 7,5% (residenti UE affiliati a previdenza di altro Stato UE), riduzioni progressive dal 6° anno, esenzione IRPEF dopo 22 anni e prelievi sociali dopo 30 (approssimazione lineare).',
    warn: 'Francia: verifica la taxe d\'habitation sulle residenze secondarie (con eventuale maggiorazione comunale) e l\'IFI se il patrimonio immobiliare netto supera 1,3 milioni €.',
    portals: ['seloger.com', 'leboncoin.fr', 'bienici.com', 'pap.fr'] };
  P.PT = { transfer: 7, transferNote: 'Portogallo: IMT progressivo fino al 6-7,5% + Imposto do Selo 0,8% (stima complessiva 7%).',
    ptax: 0.3, rentTax: 25, rentBase: 'netto', cgt: 28, cgtGainPct: 50,
    info: 'IMI 0,3-0,45% del valore patrimoniale tributario; canoni dei non residenti 25% sul netto; plusvalenza dei residenti UE tassata sul 50% del guadagno (stima 28%).',
    warn: 'Portogallo: AIMI (addizionale IMI) 0,7-1,5% oltre 600.000 € di valore patrimoniale per persona.',
    portals: ['idealista.pt', 'imovirtual.com', 'casa.sapo.pt'] };
  P.DE = { transfer: 5.5, transferNote: 'Germania: Grunderwerbsteuer 3,5-6,5% secondo il Land (stima 5,5%); notaio e catasto (Grundbuch) circa 1,5-2% a parte.',
    ptax: 0.2, rentTax: 20, rentBase: 'netto', cgt: 30, cgtYears: 10,
    info: 'Grundsteuer annua; canoni dei non residenti ad aliquote progressive 14-45% + 5,5% solidarietà sul netto (stima 20%), ammortamento deducibile; plusvalenza privata esente dopo 10 anni di possesso, altrimenti tassata ad aliquota progressiva (stima 30%).',
    portals: ['immobilienscout24.de', 'immowelt.de', 'kleinanzeigen.de'] };
  P.GB = { transfer: 8, transferNote: 'Regno Unito (Inghilterra): SDLT a scaglioni 0-12% + 5% sulle abitazioni ulteriori + 2% per i non residenti (stima 8%); Scozia LBTT e Galles LTT con regole proprie.',
    ptax: 0.5, rentTax: 20, rentBase: 'netto', cgt: 24,
    info: 'Council tax a carico dell\'occupante; canoni tassati 20/40/45% sul netto (Non-Resident Landlord Scheme, personal allowance per cittadini UE); plusvalenza dei non residenti (NRCGT) 18-24% da dichiarare entro 60 giorni.',
    portals: ['rightmove.co.uk', 'zoopla.co.uk', 'onthemarket.com'] };
  P.CH = { transfer: 1.5, transferNote: 'Svizzera: imposta sui trapassi 0-3,3% secondo il Cantone (stima 1,5%); notaio e registro fondiario a parte.',
    ptax: 0.1, wealthPct: 0.3, imputedPct: 0.5, rentTax: 22, rentBase: 'netto', cgt: 25,
    info: 'Imposta fondiaria cantonale (dove prevista); imposta cantonale sulla sostanza sul valore dell\'immobile; valore locativo (Eigenmietwert) tassato come reddito se non locato; imposta cantonale sugli utili immobiliari decrescente con gli anni di possesso.',
    warn: 'Svizzera: la Lex Koller limita l\'acquisto da parte di non residenti (in genere solo case di vacanza autorizzate). Abolizione del valore locativo approvata nel 2025, entrata in vigore non prima del 2028.',
    portals: ['homegate.ch', 'immoscout24.ch', 'comparis.ch'] };
  P.AT = { transfer: 4.6, transferNote: 'Austria: Grunderwerbsteuer 3,5% + iscrizione tavolare 1,1%.',
    ptax: 0.05, rentTax: 20, rentBase: 'netto', cgt: 30,
    info: 'Grundsteuer molto bassa; canoni dei non residenti ad aliquote progressive sul netto (stima 20%); plusvalenza ImmoESt 30% (esenzione per abitazione principale; 4,2% del prezzo per immobili acquistati prima del 31/3/2002).',
    portals: ['willhaben.at', 'immobilienscout24.at', 'immowelt.at'] };
  P.GR = { transfer: 3.09, transferNote: 'Grecia: imposta di trasferimento 3,09% sul valore oggettivo; nuove costruzioni con IVA 24% (sospesa fino a fine 2026).',
    ptax: 0.15, rentTax: 20, rentBase: 'pct', rentBasePct: 95, cgt: 0,
    info: 'ENFIA annua; canoni tassati 15% fino a 12.000 €, 35% fino a 35.000 €, 45% oltre (stima 20% sul 95% del lordo); imposta sulla plusvalenza immobiliare sospesa fino al 31/12/2026.',
    warn: 'Grecia: i proprietari non residenti devono presentare la dichiarazione dei redditi greca (codice fiscale AFM) e possono subire redditi presunti (tekmiria).',
    portals: ['spitogatos.gr', 'xe.gr'] };
  P.HR = { transfer: 3, transferNote: 'Croazia: imposta sul trasferimento 3% (nuove costruzioni con IVA 25% invece dell\'imposta).',
    ptax: 0.15, rentTax: 12, rentBase: 'pct', rentBasePct: 70, cgt: 24, cgtYears: 2,
    info: 'Imposta sugli immobili non abitati in modo permanente (0,60-8 €/m² dal 2025); locazioni lunghe 12% con deduzione forfettaria 30%; locazioni turistiche con imposta forfettaria per posto letto; plusvalenza esente dopo 2 anni.',
    portals: ['njuskalo.hr', 'index.hr', 'crozilla.com'] };
  P.SI = { transfer: 2, transferNote: 'Slovenia: imposta sul trasferimento 2% (di norma a carico del venditore salvo accordi); nuove costruzioni con IVA 9,5-22%.',
    ptax: 0.1, rentTax: 25, rentBase: 'pct', rentBasePct: 90, cgt: 25, cgtTaperFrom: 5, cgtYears: 20,
    info: 'Contributo per l\'uso del suolo edificabile (NUSZ); canoni 25% con deduzione forfettaria 10%; plusvalenza 25% decrescente dopo 5 anni ed esente dopo 20 (approssimazione lineare).',
    portals: ['nepremicnine.net', 'bolha.com'] };
  P.AL = { transfer: 0.5, transferNote: 'Albania: imposta sul trasferimento a carico del venditore; per l\'acquirente solo diritti di registrazione e notaio (stima 0,5%).',
    ptax: 0.05, rentTax: 15, rentBase: 'lordo', cgt: 15,
    info: 'Imposta sugli edifici 0,05% del valore (0,2% commerciale); canoni 15% sul lordo; plusvalenza 15%.',
    portals: ['merrjep.al', 'njoftime.com'] };
  P.RO = { transfer: 0.5, transferNote: 'Romania: nessuna imposta di trasferimento per l\'acquirente; onorari notarili e iscrizione al catasto (stima 0,5%).',
    ptax: 0.1, rentTax: 10, rentBase: 'pct', rentBasePct: 80, cgtPrice: 1, cgtPriceShort: 3, cgtShortYears: 3,
    info: 'Imposta sugli edifici 0,08-0,2% del valore imponibile; canoni 10% sull\'80% del lordo; alla vendita imposta del 3% sul prezzo se posseduto meno di 3 anni, 1% oltre.',
    portals: ['imobiliare.ro', 'storia.ro', 'olx.ro'] };
  P.BG = { transfer: 2.5, transferNote: 'Bulgaria: imposta comunale sul trasferimento 0,1-3% (stima 2,5%) + notaio e registrazione.',
    ptax: 0.1, rentTax: 10, rentBase: 'pct', rentBasePct: 90, cgt: 10, cgtYears: 5,
    info: 'Imposta immobiliare 0,01-0,45% del valore fiscale + tassa rifiuti; canoni 10% con deduzione 10%; plusvalenza 10%, esente per una abitazione posseduta oltre 3 anni o due immobili oltre 5 anni. Euro dal 1/1/2026.',
    portals: ['imot.bg', 'alo.bg', 'homes.bg'] };
  P.CZ = { transfer: 0, transferNote: 'Repubblica Ceca: imposta sull\'acquisto abolita dal 2020; solo diritti di registrazione.',
    ptax: 0.05, rentTax: 15, rentBase: 'pct', rentBasePct: 70, cgt: 15, cgtYears: 10,
    info: 'Imposta immobiliare molto bassa (al m²); canoni 15% (23% sui redditi elevati) con deduzione forfettaria 30%; plusvalenza 15%, esente dopo 10 anni (5 per acquisti ante 2021).',
    portals: ['sreality.cz', 'bezrealitky.cz', 'reality.idnes.cz'] };
  P.HU = { transfer: 4, transferNote: 'Ungheria: imposta di registro 4% sul valore di mercato.',
    ptax: 0.1, rentTax: 15, rentBase: 'pct', rentBasePct: 90, cgt: 15, cgtTaperFrom: 1, cgtYears: 5,
    info: 'Imposta comunale sugli edifici (dove prevista); canoni 15% con costi forfettari 10%; plusvalenza 15% ridotta dal 3° anno ed esente dopo 5 anni.',
    portals: ['ingatlan.com', 'jofogas.hu'] };
  P.PL = { transfer: 2, transferNote: 'Polonia: PCC 2% sul mercato secondario; nel nuovo IVA inclusa nel prezzo. Onorari notarili regolamentati.',
    ptax: 0.02, rentTax: 8.5, rentBase: 'lordo', cgt: 19, cgtYears: 5,
    info: 'Imposta immobiliare al m² molto bassa; canoni con forfait 8,5% sul lordo (12,5% oltre 100.000 PLN); plusvalenza 19% se venduto entro 5 anni dalla fine dell\'anno d\'acquisto.',
    portals: ['otodom.pl', 'olx.pl', 'morizon.pl'] };
  P.NL = { transfer: 8, transferNote: 'Paesi Bassi: overdrachtsbelasting 8% sugli immobili residenziali non adibiti ad abitazione propria (2% abitazione principale).',
    ptax: 0.1, wealthPct: 2.2, rentTax: 0, cgt: 0,
    info: 'OZB comunale annua; il reddito dell\'immobile è tassato nel Box 3 su un rendimento presunto (stima 2,2% del valore annuo) in sostituzione della tassazione dei canoni effettivi e della plusvalenza.',
    portals: ['funda.nl', 'pararius.nl', 'jaap.nl'] };
  P.BE = { transfer: 12, transferNote: 'Belgio: diritti di registro 12% (Fiandre) o 12,5% (Vallonia e Bruxelles); aliquote ridotte solo per l\'abitazione propria.',
    ptax: 0.4, rentTax: 10, rentBase: 'lordo', cgt: 16.5, cgtYears: 5,
    info: 'Précompte immobilier sul reddito catastale indicizzato; le locazioni residenziali private sono tassate sul reddito catastale indicizzato maggiorato (stima 10% del canone lordo); plusvalenza 16,5% se venduto entro 5 anni (fabbricati).',
    portals: ['immoweb.be', 'zimmo.be', 'immovlan.be'] };
  P.IE = { transfer: 1, transferNote: 'Irlanda: stamp duty 1% fino a 1 milione €, 2% oltre (6% oltre 1,5 milioni); nel nuovo IVA 13,5% inclusa nel prezzo.',
    ptax: 0.1, rentTax: 25, rentBase: 'netto', cgt: 33,
    info: 'Local Property Tax a scaglioni; canoni dei non residenti 20/40% sul netto (ritenuta 20% dell\'inquilino senza agente fiscale); plusvalenza 33%.',
    portals: ['daft.ie', 'myhome.ie'] };
  P.MT = { transfer: 5, transferNote: 'Malta: imposta di bollo 5%; i non residenti UE/non UE possono aver bisogno del permesso AIP fuori dalle Special Designated Areas.',
    ptax: 0, rentTax: 15, rentBase: 'lordo', cgtPrice: 8, cgtPriceShort: 5, cgtShortYears: 5,
    info: 'Nessuna imposta immobiliare annua; canoni residenziali con ritenuta definitiva 15% sul lordo; imposta sul trasferimento 8% del prezzo (5% entro 5 anni dall\'acquisto, 10% per immobili acquistati prima del 2004).',
    portals: ['maltapark.com', 'frank.com.mt', 'remax-malta.com'] };
  P.CY = { transfer: 3, transferNote: 'Cipro: diritti di trasferimento 3-8% ridotti del 50% se non si applica IVA (stima 3%); nel nuovo IVA 19% (5% per abitazione principale).',
    ptax: 0.02, rentTax: 10, rentBase: 'pct', rentBasePct: 80, cgt: 20,
    info: 'Imposta immobiliare abolita dal 2017 (restano tasse comunali); canoni a scaglioni progressivi con esenzione 20%; plusvalenza 20% con franchigie a vita.',
    portals: ['bazaraki.com', 'buysellcyprus.com'] };
  P.ME = { transfer: 3, transferNote: 'Montenegro: imposta sul trasferimento 3% fino a 150.000 €, poi progressiva fino al 6%.',
    ptax: 0.3, rentTax: 15, rentBase: 'pct', rentBasePct: 80, cgt: 15,
    info: 'Imposta immobiliare comunale 0,25-1% del valore di mercato; canoni 15%; plusvalenza 15%.',
    portals: ['realitica.com', 'nekretnine.co.me'] };
  P.TR = { transfer: 4, transferNote: 'Turchia: tapu harcı 4% (2% acquirente e 2% venditore per legge, spesso interamente a carico dell\'acquirente).',
    ptax: 0.2, rentTax: 20, rentBase: 'pct', rentBasePct: 85, cgt: 20, cgtYears: 5,
    info: 'Emlak vergisi 0,1-0,6% del valore catastale; canoni ad aliquote progressive 15-40% con deduzione forfettaria 15%; plusvalenza progressiva, esente dopo 5 anni.',
    warn: 'Turchia: alta inflazione e forte svalutazione della lira turca; valuta i risultati sia in EUR sia in valuta locale.',
    portals: ['sahibinden.com', 'hepsiemlak.com', 'emlakjet.com'] };
  P.MC = { transfer: 4.5, transferNote: 'Monaco: diritti di registrazione 4,5% (7,5% tramite società) + notaio.',
    ptax: 0, rentTax: 0, cgt: 0,
    info: 'Nessuna imposta immobiliare, sui canoni o sulla plusvalenza per le persone fisiche (salvo cittadini francesi).',
    portals: ['savills.mc', 'chambre-immobiliere-monaco.mc'] };
  P.US = { transfer: 1, transferNote: 'Stati Uniti: transfer tax statale/locale 0-2% (stima 1%) + closing costs 2-5% da inserire tra i costi.',
    ptax: 1.1, rentTax: 20, rentBase: 'netto', cgt: 30, cgtLong: 15, cgtLongYears: 1,
    info: 'Property tax 0,3-2,5% secondo lo Stato (media 1,1%); canoni tassati sul netto con elezione ECI (altrimenti 30% sul lordo) più eventuali imposte statali; plusvalenza federale 15-20% oltre 1 anno, recapture ammortamento 25%; FIRPTA: ritenuta 15% sul prezzo a credito.',
    warn: 'Stati Uniti: imposta di successione federale per non residenti sui beni USA oltre 60.000 $ (la convenzione Italia-USA può ridurla). Valuta una struttura (LLC) con un consulente.',
    portals: ['zillow.com', 'realtor.com', 'redfin.com'] };
  P.CA = { transfer: 1.5, transferNote: 'Canada: land transfer tax provinciale 0,5-3% (stima 1,5%) + eventuali imposte per acquirenti stranieri (fino al 20-25% in BC e Ontario).',
    ptax: 0.8, rentTax: 25, rentBase: 'lordo', cgt: 25,
    info: 'Property tax comunale; canoni con ritenuta 25% sul lordo (o dichiarazione sez. 216 sul netto); 50% della plusvalenza tassato ad aliquote progressive federali e provinciali (stima 25% del guadagno), ritenuta sez. 116 alla vendita.',
    warn: 'Canada: divieto federale di acquisto di immobili residenziali da parte di non canadesi (prorogato fino al 2027) e tasse locali su immobili sfitti.',
    portals: ['realtor.ca', 'housesigma.com'] };
  P.BR = { transfer: 3, transferNote: 'Brasile: ITBI comunale 2-3% + registro e cartório circa 1%.',
    ptax: 0.5, rentTax: 15, rentBase: 'lordo', cgt: 15,
    info: 'IPTU comunale; canoni dei non residenti con ritenuta 15% sul lordo (25% per residenti in paradisi fiscali); plusvalenza 15-22,5% progressiva.',
    portals: ['zapimoveis.com.br', 'vivareal.com.br', 'imovelweb.com.br'] };
  P.DO = { transfer: 3, transferNote: 'Repubblica Dominicana: imposta di trasferimento 3% sul valore più alto tra prezzo e stima catastale.',
    ptax: 0.5, rentTax: 27, rentBase: 'lordo', cgt: 27, dtt: false,
    info: 'IPI 1% annuo sul valore eccedente la soglia di esenzione (stima 0,5% del valore); canoni dei non residenti con ritenuta 27%; plusvalenza 27% con rivalutazione per inflazione.',
    portals: ['supercasas.com', 'corotos.com.do'] };
  P.MX = { transfer: 3, transferNote: 'Messico: ISAI statale 2-5% (stima 3%) + notaio 1-2%.',
    ptax: 0.1, rentTax: 25, rentBase: 'lordo', cgt: 35, cgtAltPrice: 25,
    info: 'Predial comunale; canoni dei non residenti con ritenuta 25% sul lordo; plusvalenza: 25% del prezzo lordo oppure 35% del guadagno con rappresentante fiscale in Messico (si usa il minore).',
    warn: 'Messico: nella zona ristretta (50 km dalla costa, 100 km dai confini) gli stranieri possono acquistare solo tramite fideicomiso bancario (costo annuo da inserire nelle spese).',
    portals: ['inmuebles24.com', 'vivanuncios.com.mx', 'lamudi.com.mx'] };
  P.AE = { transfer: 4, transferNote: 'Emirati Arabi Uniti (Dubai): DLD transfer fee 4% + commissioni amministrative e di registrazione.',
    ptax: 0, rentTax: 0, cgt: 0,
    info: 'Nessuna imposta immobiliare, sui canoni o sulla plusvalenza per le persone fisiche; spese di servizio (service charges) da inserire tra le spese condominiali.',
    portals: ['bayut.com', 'propertyfinder.ae', 'dubizzle.com'] };
  P.TH = { transfer: 1, transferNote: 'Thailandia: diritto di trasferimento 2% (di solito diviso con il venditore); i costi del venditore dipendono dagli anni di possesso.',
    ptax: 0.03, rentTax: 15, rentBase: 'pct', rentBasePct: 70, cgtPrice: 1, cgtPriceShort: 3.3, cgtShortYears: 5,
    info: 'Land and building tax 0,02-0,1%; canoni ad aliquote progressive con deduzione forfettaria 30%; alla vendita ritenuta sul valore stimato (circa 1%) + Specific Business Tax 3,3% entro 5 anni (altrimenti bollo 0,5%).',
    warn: 'Thailandia: gli stranieri non possono possedere terreni; ammesse unità in condominio entro la quota stranieri del 49% o diritti di superficie/locazioni lunghe.',
    portals: ['ddproperty.com', 'hipflat.co.th', 'fazwaz.com'] };
  P.TN = { transfer: 6, transferNote: 'Tunisia: diritti di registrazione 5% + conservazione fondiaria 1%; per gli stranieri serve l\'autorizzazione del governatore.',
    ptax: 0.05, rentTax: 15, rentBase: 'pct', rentBasePct: 70, cgt: 10,
    info: 'Taxe sur les immeubles bâtis; canoni ad aliquote progressive con deduzione 30%; plusvalenza immobiliare 10% (aliquote maggiori per vendite ravvicinate).',
    portals: ['tayara.tn', 'mubawab.tn'] };
  P.MA = { transfer: 5.5, transferNote: 'Marocco: diritti di registrazione 4% + conservazione fondiaria 1,5% + notaio circa 1%.',
    ptax: 0.3, rentTax: 10, rentBase: 'lordo', cgt: 20,
    info: 'Taxe de services communaux e taxe d\'habitation sulla residenza secondaria; canoni con ritenuta definitiva 10% (15% oltre 120.000 MAD annui); plusvalenza (TPI) 20% del guadagno con minimo 3% del prezzo.',
    portals: ['mubawab.ma', 'avito.ma', 'sarouty.ma'] };
  P.KE = { transfer: 4, transferNote: 'Kenya: imposta di bollo 4% in area urbana (2% rurale).',
    ptax: 0.15, rentTax: 30, rentBase: 'lordo', cgt: 15, dtt: false,
    info: 'Land rates delle contee; canoni dei non residenti con ritenuta 30% sul lordo; plusvalenza 15%.',
    portals: ['buyrentkenya.com', 'property24.co.ke'] };
  P.CV = { transfer: 1.5, transferNote: 'Capo Verde: IUP 1,5% sul valore della transazione.',
    ptax: 0.1, rentTax: 20, rentBase: 'lordo', cgt: 1, dtt: false,
    info: 'IUP annuo circa 0,1% del valore; canoni dei non residenti con ritenuta circa 20%; plusvalenze soggette a IUP con aliquote ridotte (verifica caso per caso).',
    portals: [] };
  P.JP = { transfer: 3, transferNote: 'Giappone: imposta di acquisizione immobiliare 3% + imposta di registrazione e bollo sul valore catastale (stima complessiva 3% del prezzo).',
    ptax: 0.7, rentTax: 20, rentBase: 'netto', cgt: 39.63, cgtLong: 20.315, cgtLongYears: 5,
    info: 'Fixed asset tax 1,4% + city planning tax 0,3% del valore catastale; canoni dei non residenti a aliquote progressive sul netto (ritenuta 20,42% se l\'inquilino è una società); plusvalenza 39,63% entro 5 anni, 20,315% oltre (ritenuta 10,21% sul prezzo a credito).',
    portals: ['suumo.jp', 'homes.co.jp', 'realestate.co.jp'] };
  P.AU = { transfer: 12, transferNote: 'Australia: stamp duty statale circa 4-5,5% + sovrattassa per acquirenti stranieri 7-9% (stima complessiva 12%).',
    ptax: 0.5, rentTax: 30, rentBase: 'netto', cgt: 30,
    info: 'Council rates annue più land tax con sovrattassa per proprietari esteri (2-5% del valore del terreno); canoni dei non residenti 30% dal primo dollaro sul netto; plusvalenza 30% senza lo sconto del 50% per i non residenti, ritenuta 15% sul prezzo a credito.',
    warn: 'Australia: serve l\'approvazione FIRB e dal 1/4/2025 al 31/3/2027 è vietato agli stranieri acquistare abitazioni esistenti; le sovrattasse annue sui proprietari esteri possono essere elevate.',
    portals: ['realestate.com.au', 'domain.com.au'] };

  /* ---------- API ---------- */
  K.REGIONS = REGIONS; K.PROVINCES = PROV; K.PRESETS = P; K.EEA = EEA; K.BLACKLIST = BLACK;
  K.name = function (cc) { return NAMES[cc] || cc || ''; };
  K.currency = function (cc) { return CUR[cc] || 'EUR'; };
  K.isEEA = function (cc) { return !!EEA[cc]; };
  K.isEU = function (cc) { return !!EEA[cc] && cc !== 'IS' && cc !== 'LI' && cc !== 'NO'; };
  K.isBlacklist = function (cc) { return !!BLACK[cc]; };
  K.hasPreset = function (cc) { return !!P[cc] && cc !== 'IT'; };
  K.codes = function () { return ORDER.slice(); };
  /* Elenco ordinato per nome (Italia per prima) */
  K.list = function () {
    return ORDER.map(function (c) { return { code: c, name: NAMES[c], currency: CUR[c], preset: !!P[c] && c !== 'IT' }; })
      .sort(function (a, b) { return a.code === 'IT' ? -1 : b.code === 'IT' ? 1 : a.name.localeCompare(b.name, 'it'); });
  };
  /* Preset Paese unito alle personalizzazioni dell'utente (S.countryOverrides[cc]); restituisce sempre una copia */
  K.preset = function (cc, S) {
    var base = P[cc] || {}, ov = (S && S.countryOverrides && S.countryOverrides[cc]) || {}, out = {};
    Object.keys(base).forEach(function (k) { out[k] = Array.isArray(base[k]) ? base[k].slice() : base[k]; });
    Object.keys(ov).forEach(function (k) {
      var v = ov[k];
      if (v === null || v === undefined || v === '') return;
      if (typeof v === 'number' && !isFinite(v)) return;
      out[k] = Array.isArray(v) ? v.slice() : v;
    });
    return out;
  };
  /* Campi numerici modificabili dall'utente nelle impostazioni */
  K.FIELDS = [
    ['transfer', 'Imposte d\'acquisto (% prezzo)'], ['ptax', 'Imposta immobiliare annua (% valore)'],
    ['wealthPct', 'Patrimoniale annua (% valore)'], ['imputedPct', 'Imposta su reddito figurativo (% valore)'],
    ['rentTax', 'Imposta sui canoni (%)'], ['rentBasePct', 'Base imponibile canoni (% lordo, se base = pct)'],
    ['cgt', 'Imposta plusvalenza (% guadagno)'], ['cgtYears', 'Esenzione plusvalenza dopo anni'],
    ['cgtTaperFrom', 'Riduzione plusvalenza dall\'anno'], ['cgtLong', 'Aliquota plusvalenza lungo periodo (%)'],
    ['cgtLongYears', 'Lungo periodo dopo anni'], ['cgtGainPct', 'Quota plusvalenza tassata (%)'],
    ['cgtPrice', 'Imposta sul prezzo di vendita (%)'], ['cgtPriceShort', 'Imposta sul prezzo entro breve periodo (%)'],
    ['cgtShortYears', 'Breve periodo (anni)'], ['cgtAltPrice', 'Tetto imposta plusvalenza (% prezzo)']
  ];
  K.provinceName = function (code) { return PROV[String(code || '').toUpperCase()] || ''; };
  K.provinceRegion = function (code) { var r = PROV_REG[String(code || '').toUpperCase()]; return r ? REGIONS[r] : ''; };
  K.provinceList = function () {
    return Object.keys(PROV).map(function (c) { return { code: c, name: PROV[c], region: REGIONS[PROV_REG[c]] }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'it'); });
  };
  /* Trova la sigla di provincia da sigla o nome (es. "mi", "Milano") */
  K.findProvince = function (s) {
    var t = String(s || '').trim(); if (!t) return '';
    if (PROV[t.toUpperCase()]) return t.toUpperCase();
    var n = G.U && G.U.norm ? G.U.norm(t) : t.toLowerCase();
    var hit = Object.keys(PROV).filter(function (c) { return (G.U && G.U.norm ? G.U.norm(PROV[c]) : PROV[c].toLowerCase()) === n; });
    return hit[0] || '';
  };

  G.COUNTRIES = K;
})(window.GPI = window.GPI || {});
