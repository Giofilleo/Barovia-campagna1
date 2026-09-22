# Barovia V5 — guida per provare l’aggiornamento

Questa versione parte dalla `main` di Barovia V4 del 9 settembre 2026. Il branch di prova è **`codex/cronache-e-combat-log`**. La campagna online non è stata modificata durante lo sviluppo.

## Da dove cominciare

Il modo più semplice per provare anche i salvataggi senza toccare la campagna è la **demo locale**. Contiene una piccola campagna inventata, funziona sul tuo computer e dimentica tutto quando la chiudi. Non richiede un account Supabase, password del sito o file di configurazione.

1. Apri [il branch su GitHub](https://github.com/Giofilleo/Barovia-campagna1/tree/codex/cronache-e-combat-log).
2. Premi **Code → Download ZIP** ed estrai l’archivio in una nuova cartella. Non sovrascrivere la tua copia precedente.
3. Serve Node.js 22.13 o superiore. Se hai già usato i comandi del progetto, probabilmente è già presente; `node --version` mostra la versione installata.
4. Apri un terminale **dentro la cartella estratta**, quella che contiene `package.json`. Su Windows puoi aprire la cartella in Esplora file, scrivere `powershell` nella barra dell’indirizzo e premere Invio. Su Mac apri Terminale, scrivi `cd ` con lo spazio finale, trascina la cartella nella finestra e premi Invio.
5. Esegui questi due comandi, uno alla volta. Il primo scarica le dipendenze e può richiedere qualche minuto:

   ```sh
   npm ci
   npm run preview:demo
   ```

6. Lascia aperto il terminale e visita **http://127.0.0.1:5173/** nel browser.
7. Entra come **DM**, con chiave **`Barovia-preview-only`**. Per vedere cosa può leggere un giocatore, esci e rientra come **Lyria**, con la stessa chiave.
8. Per terminare, premi **Ctrl+C** nel terminale. Al prossimo avvio i dati dimostrativi ripartono da zero: questa demo non va usata per prendere appunti reali.

Se compare “port 5173 is already in use”, chiudi l’altra demo già in esecuzione. Non aggiungere le credenziali Supabase alla demo: non le usa.

### Provare la versione compilata

Per controllare la stessa versione che viene pubblicata online, esegui nella cartella del progetto:

```sh
npm run build:netlify
npm run preview:demo -- --production
```

Apri **http://127.0.0.1:5174/** e usa gli stessi account di prova. Anche questa modalità usa soltanto dati temporanei. Dopo modifiche al codice, ripeti la compilazione e ricarica la pagina.

## Cosa cambia

### Una memoria della campagna tra le sessioni

L’apertura del sito porta alle Novità. Riassunti e collegamenti sono più leggibili, le pagine narrative hanno più spazio e le sezioni rimangono quelle della campagna: diario, storia, glossario, mappe, appunti e collegamenti. Il diario di una sessione raccoglie anche i combattimenti nella sua finestra temporale; puoi collegarli esplicitamente a sessioni, eventi, luoghi e personaggi.

Le nuove funzioni richieste sono il Combat Log e i flussi di preparazione delle sessioni. Gli altri interventi rifiniscono gli strumenti esistenti.

### Tracker e Combat Log

Nello **Schermo DM → Iniziativa e incontri**, quando modifichi punti ferita o condizioni si apre la registrazione dell’azione. Puoi indicare:

- chi agisce: uno dei combattenti, l’ambiente o un’altra fonte con nome;
- tipo e nome dell’azione, attacco o magia, esito, tiro e tipo di danno;
- uno o più bersagli, danni o cure, condizioni e descrizione delle conseguenze;
- azioni senza danni, attacchi mancati, reazioni e altre attività da ricordare.

Il registro conserva round, turno, fonte, bersagli ed effetti. Registra sia il danno dichiarato sia i PF effettivamente persi: 10 danni a un avversario con 3 PF risultano in 10 danni dichiarati e 3 PF persi. Le azioni già salvate non cambiano se rinomini o rimuovi un combattente.

Il DM deve registrare le azioni: il sito non può ricostruire ciò che accade al tavolo senza essere inserito. Un incontro già aperto in V4 viene mantenuto, ma le azioni antecedenti all’aggiornamento non sono ricostruibili.

Con **Concludi incontro** dai un titolo e scegli i collegamenti. Il sito crea una pagina **privata del DM** nella sezione **Combat Log** e libera il tracker solo se l’archiviazione riesce. Se qualcosa va storto, combattenti e registro restano disponibili; ripetere l’operazione non crea due copie dello stesso incontro.

Apri la pagina archiviata e premi **Modifica** per aggiungere il racconto, le immagini con didascalie, le etichette, la data di campagna e altri collegamenti. Nello stesso editor scegli i giocatori che possono leggerla, oppure tutti. I giocatori la consultano nella finestra dei dettagli come le altre voci del sito.

Le note tattiche dei combattenti, la CA e i loro totali di PF non vengono copiate nella pagina pubblicabile. **Nomi, descrizioni delle azioni ed effetti registrati saranno invece leggibili dai destinatari scelti**: controllali prima di condividere. Lo storico delle azioni è conservato senza modifiche; puoi correggere o spiegare eventuali errori nel testo del resoconto.

Per evitare salvataggi troppo pesanti, un registro ha un limite di 2.000 eventi e un limite di dimensione. Se li raggiungi, il sito blocca la nuova azione con un messaggio e chiede di archiviare quella parte: non taglia gli eventi già registrati. Dopo l’archiviazione prepara i combattenti per la parte successiva.

### Flussi di preparazione delle sessioni

Apri **Schermo DM → Flussi di sessione → Nuovo flusso**. Dai un titolo alla sessione e scegli uno schema con diramazioni oppure una sola scena. Il flusso si apre in un’area di lavoro a schermo intero: aggiunta delle schede, note generali e salvataggio restano sempre in alto. **Torna ai flussi** riporta all’elenco; le modifiche non salvate restano come bozza locale.

- Aggiungi **Scene, Scelte, Note ed Esiti**. Seleziona una scheda per scriverne titolo e note, fino a 6.000 caratteri, e collegare le pagine originali della campagna: luoghi, personaggi, diario, appunti e Combat Log.
- La mappa non ha bordi predefiniti e si estende in tutte le direzioni, anche a coordinate negative. Trascina lo **sfondo**, oppure usa rotella o trackpad, per spostare la visuale. Con **Ctrl/⌘ + rotella** cambi lo zoom attorno al puntatore. Trascina una **scheda**, anche dal titolo o dal testo, per cambiarne la posizione; la maniglia resta utilizzabile anche con i tasti freccia. I comandi di zoom mantengono il centro della visuale e **Mostra tutto il flusso** centra l’intero diagramma. Trascinando una scheda verso il bordo dello schermo, la visuale continua a scorrere. I dettagli hanno il proprio pannello: **Torna alla mappa** lo chiude. La vista **Scaletta** permette di leggere e modificare anche dal telefono. Lo spostamento della visuale non richiede un salvataggio; quello delle schede sì.
- Premi **Collega / Crea diramazione** su una scheda e scrivi la condizione **Se…**. Con **Nuova scheda → Crea scheda e diramazione** aggiungi insieme il nodo di destinazione e la freccia: puoi lasciare il titolo provvisorio e compilare subito il nuovo nodo. Con **Scheda esistente** scegli invece una destinazione già presente. Puoi creare più possibilità e percorsi che ritornano a una scena precedente. Per un passaggio incondizionato scrivi “Sempre”.
- Seleziona una freccia per cambiarne condizione o destinazione. Rimuovere una scheda rimuove anche le sue frecce, senza eliminare le pagine della campagna richiamate.
- Premi **Salva flusso** per conservarlo nella campagna. Le modifiche non salvate hanno una bozza locale separata per account, recuperabile esplicitamente. Se il piano è cambiato su un altro dispositivo puoi conservare la bozza come copia e confrontarla con l’originale.

I flussi sono **sempre riservati al DM**, compresi testi, collegamenti, revisioni ed esportazioni. I collegamenti alle pagine sono navigabili in entrambe le direzioni per il DM; non rivelano il piano ai giocatori. Un collegamento rimosso da una singola scheda può restare fra i collegamenti generali della pagina, gestibili dal normale editor.

Lo spazio della mappa non impone un limite al numero di righe o colonne. Ogni flusso può contenere fino a **1.000 schede e 3.000 frecce**; questi limiti non restringono il campo navigabile. Il contenuto complessivo di un flusso può occupare fino a 2 MB: se li supera, un messaggio chiede di ridurre il contenuto o dividerlo in più flussi. Nessun dato viene troncato. Vengono disegnate solo le schede vicine alla visuale per mantenere reattiva la mappa. Non esegue automaticamente gli eventi della storia: serve a preparare possibilità. Dopo la sessione, registra nel diario ciò che è realmente accaduto. I flussi salvati rientrano nelle copie di sicurezza esistenti e non richiedono nuove tabelle.

### Rifiniture e protezione dei contenuti

- Bozze recuperabili dopo una chiusura accidentale o un conflitto di versione, separate per account nello stesso browser. Il recupero è esplicito: controlla il testo prima di salvarlo se la pagina è cambiata nel frattempo.
- Stesure precedenti riservate all’autore, per evitare che una vecchia versione riveli informazioni ora private.
- Salvataggio della pagina e della sua revisione nello stesso passaggio atomico: un errore non lascia una modifica a metà.
- Le mappe che contengono altri luoghi o mappe non possono essere eliminate finché non li hai spostati o rimossi esplicitamente.
- Esportazione e trasferimento mantengono anche mappe, tabelle, Combat Log e bestiario. I vecchi backup restano riconosciuti.
- Righello corretto per le proporzioni delle mappe secondarie e apertura del luogo sulla sua mappa effettiva.
- Testi dell’interfaccia più neutrali in accesso, Novità, Combat Log, incontri e flussi DM, senza riscrivere i contenuti della campagna.
- Nuova presentazione delle Novità con l’ultima sessione, l’ultimo scontro e un riepilogo leggibile degli aggiornamenti. Archivio dei combattimenti con copertine, protagonisti, ricerca, etichette e filtri di condivisione.
- Incontri con schede dei combattenti, ordine di iniziativa, anteprima degli effetti e selezione dei bersagli. Lettore dei Combat Log diviso per round, con riepilogo, ricerca, filtro per fonte e caricamento progressivo.
- Grafica con toni borgogna e pergamena, spaziatura e tipografia più leggibili, finestre narrative più ampie, controlli adatti al tocco e rispetto della preferenza di movimento ridotto.
- Caricamento delle sezioni pesanti solo quando servono, immagini differite e meno ricalcoli del grafo. L’archivio si aggiorna ogni minuto e quando torni alla finestra; lo schermo DM conserva l’intervallo di 15 secondi. Il controllo periodico si ferma nelle schede nascoste.

## Piccolo percorso di prova

Nella demo locale trovi già un incontro archiviato con copertina, tre azioni e una prima mappa di preparazione privata del DM. Il tracker ha anche due combattenti pronti per le prove.


1. Apri diario, glossario, storia e mappa; segui un collegamento dal testo e poi prova il grafo e una ricerca.
2. Nel tracker, fai infliggere a Lyria 5 danni al Lupo, indicando “Spada lunga”, “Colpito” e “tagliente”. Controlla che i PF del Lupo passino da 11 a 6 e che fonte ed effetto compaiano nel registro.
3. Registra un attacco mancato. Il registro deve mostrarlo senza cambiare i PF. Aggiungi poi una condizione con fonte e prova una magia con più bersagli.
4. Passa il turno e archivia l’incontro collegandolo al diario di prova. Completa il testo, aggiungi un’immagine e condividi con Lyria.
5. Esci e rientra come Lyria: il registro condiviso deve essere leggibile e non modificabile. Esci, torna DM e restringi la visibilità: Lyria non deve più vederlo dopo l’aggiornamento.
6. Scrivi una bozza, chiudi l’editor e riaprilo. Prova anche due schede del browser: una modifica concorrente deve segnalare il conflitto e conservare il testo da recuperare.
7. Apri **Flussi di sessione**, crea un piano, aggiungi una nota collegata al diario e una freccia condizionale. Salva, cambia scheda e riapri il piano. Prova anche una modifica non salvata: al ritorno deve comparire “Recupera bozza”.
8. Controlla la presentazione sul tuo telefono: menu, editor, immagini, registro, scaletta dei flussi e scorrimento delle finestre.

## Supabase: nessuna modifica richiesta per aggiornare V4

**Se il tuo sito V4 funziona già, questo aggiornamento non richiede nuove tabelle, colonne o istruzioni SQL.** Registri e flussi usano le strutture già esistenti. Non rieseguire gli script di inizializzazione e non usare l’importazione dei backup sul database online per installare questa versione.

Il database e lo storage online non sono stati aperti o modificati durante lo sviluppo. Le prove automatiche usano database temporanei; la verifica con il tuo Supabase reale rimane da fare nell’ambiente che sceglierai per il collaudo.

Prima del passaggio definitivo, salva un’esportazione dal sito con l’account DM. Le pagine private di altri autori richiedono anche le loro esportazioni. Queste esportazioni conservano contenuti e immagini visibili, ma non sostituiscono un backup completo di database e storage per un ripristino amministrativo.

## Anteprima su Netlify

Puoi usare l’anteprima della pull request se Netlify la genera già, oppure abilitare un **branch deploy** per `codex/cronache-e-combat-log` nelle impostazioni di build e distribuzione del progetto. Mantieni `main` come branch di produzione. [Guida ufficiale ai branch deploy](https://docs.netlify.com/deploy/deploy-types/branch-deploys/).

In questa versione le anteprime Netlify sono **in sola lettura per i contenuti**, anche se ereditano le credenziali del sito vero. Puoi accedere e uscire; salvataggi, caricamenti di immagini e cambi di credenziali sono bloccati. Il controllo usa il contesto della distribuzione fornito da Netlify alla funzione. [API ufficiale: `context.deploy`](https://docs.netlify.com/build/functions/api/#deploy).

Per provare i salvataggi online serve un ambiente Supabase **separato** con database e bucket di prova. Solo in quell’ambiente imposta le credenziali di prova e `BAROVIA_ALLOW_PREVIEW_WRITES=true`, limitandole al contesto di anteprima. Non abilitare questa variabile su un’anteprima collegata al database della campagna. La demo locale evita completamente questa configurazione. [Variabili Netlify per contesto](https://docs.netlify.com/build/environment-variables/overview/).

Se l’anteprima non si collega a Supabase, controlla che le variabili del contesto scelto siano disponibili alle Functions. Non copiare le chiavi nel codice, su GitHub o in variabili con prefisso `VITE_`.

## Quando vuoi metterla online

Dopo il collaudo e le esportazioni, l’aggiornamento può essere integrato in `main` dalla pull request e distribuito con il normale processo Netlify. Questa operazione è lasciata a te: il branch è stato preparato per la prova.

Dopo la distribuzione fai ricaricare completamente la pagina a tutti, soprattutto al DM. Una vecchia scheda aperta potrebbe non conoscere il nuovo registro: il server V5 respinge aggiornamenti del tracker provenienti da quella vecchia versione quando rischiano di perdere lo storico.

**Dopo aver iniziato a registrare combattimenti o creare flussi in V5, non tornare semplicemente al codice V4.** V4 non conosce i nuovi dati dei flussi, il tipo di pagina dei combattimenti o lo storico del tracker: una vecchia versione potrebbe non mostrarli correttamente o sovrascriverli. In caso di problema, conserva V5 e i dati, ed esegui una correzione compatibile. Non eliminare i registri per risolvere un problema di visualizzazione.

## Verifiche e limiti della consegna

Risultati: compilazione TypeScript e build Vite riuscite; **79 test automatici superati** (55 test delle API su PostgreSQL temporaneo con PGlite e 24 test su combattimenti, percorsi, trasferimenti e anteprime). Sono compresi permessi, modifiche concorrenti, vecchi editor, flussi non validi e salvataggi atomici con errori di scrittura simulati. Anche i dati della demo sono verificati da una procedura separata, senza avviare il server.

Rispetto alla build della V4, il JavaScript iniziale scende da 617.531 a 484.800 byte (**−21,5%**); compresso con lo stesso metodo gzip, da 183.233 a 146.589 byte (**−20,0%**). Il codice JavaScript complessivo è di 732.522 byte. Il CSS iniziale è di 273.723 byte (48.410 con gzip); il CSS completo è di 360.095 byte. Flussi, strumenti DM e lettore dei combattimenti caricano codice e stili specifici quando vengono aperti. Queste sono misure dei file prodotti, non tempi di caricamento su una connessione reale.

La demo locale è stata ispezionata nel browser su desktop e a 390 pixel di larghezza. Sono stati provati creazione, note, rimandi a pagine, diramazioni, salvataggio e riapertura dei flussi, recupero di una bozza, aggiornamento dei PF nel tracker, lettura dei resoconti, filtri e navigazione mobile. La vista giocatore è controllata anche dalle prove automatiche: riceve i resoconti condivisi e non riceve i flussi del DM. La campagna reale e il suo Supabase non sono stati modificati; prima del passaggio definitivo resta il tuo collaudo dei contenuti reali nell’ambiente scelto.

### Verifica della navigazione dei flussi

Provati nella demo locale il trascinamento dello sfondo senza modifiche ai dati, lo spostamento dal testo di una scheda a due livelli di zoom, le frecce, il pulsante Collega, il movimento da tastiera e la conservazione della posizione dopo salvataggio e riapertura. Controllati anche il layout a 390 px e l’assenza di scorrimento orizzontale della pagina. Il trascinamento è verificato con il mouse; i gesti su un dispositivo touch fisico restano da provare.

### Verifica dell’area di lavoro a schermo intero

Verificati l’aggiunta consecutiva di dieci note senza scorrere la pagina, la creazione di un nuovo nodo direttamente dalla diramazione, il recupero della bozza e i salvataggi oltre i precedenti bordi. Verificati anche il recupero delle modifiche dopo un primo salvataggio, lo zoom graduale su schede lontane e il collegamento a una scheda esistente. A 390 px i comandi restano visibili e il pannello dei dettagli scorre separatamente; spostamento delle schede e navigazione non aprono il pannello. I test API includono 1.000 schede e 3.000 frecce, coordinate negative o lontane, revisioni e backup, il salvataggio al limite di 2 MB e il rifiuto senza perdita di dati oltre il limite.

### Verifica della finestra nella versione compilata

Riprodotto il difetto che spostava il flow-chart di metà schermo verso l’alto e a sinistra: nella build ottimizzata rimaneva attiva la traslazione della finestra centrata. L’editor ora usa una variante a schermo intero senza le classi di centratura. Verificata la build di produzione: finestra a coordinate (0, 0), larga e alta quanto lo schermo a 1440 × 900 e 390 × 844; posizione invariata dopo selezione delle schede e chiusura/riapertura. La finestra «Nuovo flusso» rimane correttamente centrata.
