# Barovia su Netlify e Supabase

**Per iniziare senza conoscenze tecniche:** estrai tutto il pacchetto e apri `INIZIA-QUI.html` con un doppio clic. La guida contiene passaggi numerati, il testo SQL da copiare, un modulo locale che prepara le variabili e le istruzioni per Windows e Mac. Questo documento è il riferimento tecnico aggiuntivo.

Questa versione conserva l’interfaccia e le funzioni della campagna: mappa, cronologia e percorsi, immagini, appunti, glossario, diario, tesoro, grafo, reputazione, provviste e strumenti DM. Le provviste richiedono soltanto razioni.

Netlify ospita il sito e le API. Supabase conserva i dati in PostgreSQL e le immagini in un bucket privato. I giocatori usano nome e chiave della campagna, senza email e senza account Supabase, Netlify o ChatGPT. Solo tu devi avere gli account amministrativi delle due piattaforme.

## Cosa è pronto

- Interfaccia React identica a quella del sito attuale, compilabile per Netlify.
- Funzione Netlify `/api/*` con login, cookie di sessione, whitelist e permessi.
- Adattatore PostgreSQL, migrazione SQL e collegamento a Supabase Storage.
- Esportazione delle pagine visibili con immagini e importazione su un progetto vuoto.
- Configurazione Netlify e modello delle variabili necessarie.

Il pacchetto non contiene i dati salvati nella campagna online né le immagini che avete caricato durante il gioco. Include la mappa originale. Il collegamento a un progetto Supabase e la pubblicazione su un account Netlify devono ancora essere eseguiti. I test locali usano PostgreSQL incorporato (PGlite); non sostituiscono la verifica finale sul tuo progetto Supabase.

## 1. Crea il progetto Supabase

1. Entra in [Supabase](https://supabase.com/dashboard) e crea un progetto dedicato alla campagna. Scegli una regione vicina ai giocatori e conserva la password del database nel tuo gestore di password.
2. Apri **SQL Editor**, crea una query e incolla il contenuto di `supabase/migrations/0001_barovia.sql`. Eseguila una volta.
3. In **Storage**, verifica che `barovia-media` sia presente e **privato**. Non abilitare la lettura pubblica e non aggiungere policy aperte.
4. In **Connect**, copia la connessione **Transaction pooler**, normalmente sulla porta **6543**. Sostituisci il segnaposto della password; se contiene caratteri speciali, codificali per un URL. Copia l’host esatto mostrato dal tuo progetto.
5. Recupera il **Project URL** e la chiave server **secret** oppure la precedente **service_role**. La chiave pubblicabile/anon non è adatta a questo server.

Il database usa lo schema `barovia`, separato da `public`. Non aggiungerlo agli schemi esposti dalla Data API. Le tabelle hanno RLS attiva senza policy per il browser: solo il server accede ai dati e applica i permessi della campagna. L’account del database utilizzato dalla connessione deve poter accedere allo schema, per esempio il ruolo amministrativo indicato da Supabase nella connessione iniziale.

La connessione usa TLS con verifica del certificato. Se Supabase richiede il certificato CA del database, scaricalo dalle impostazioni del database e inserisci il PEM in `DATABASE_CA_CERT`; il codice accetta anche le righe separate da `\n`. Non disattivare la verifica TLS per aggirare un errore di certificato.

Riferimenti: [connessioni PostgreSQL e pooling](https://supabase.com/docs/guides/database/connecting-to-postgres), [chiavi server](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa), [controlli di accesso alle immagini](https://supabase.com/docs/guides/storage/security/access-control).

## 2. Scegli se ripartire o trasferire la campagna

**Campagna nuova:** passa al punto 3. Il primo accesso inizializza i sette account e i sei luoghi di partenza. Le chiavi sono quelle iniziali fornite per questa campagna, conservate nel codice server come hash con salt, mai in chiaro o nel JavaScript del browser.

**Campagna esistente:** effettua l’importazione descritta più avanti **prima di aprire il sito su Netlify**. Il primo accesso alle API inizializza il database: lo strumento di importazione rifiuta database già popolati, per evitare sovrascritture.

## 3. Metti il codice in un repository privato

Il pacchetto esportato usa Vite e non richiede il runtime Next.js di Netlify. Estrai il pacchetto e carica i file in un repository GitHub privato. `netlify.toml` e `package.json` devono essere nella cartella principale del repository. Non caricare archivi di backup, chiavi amministrative o file con i valori reali delle variabili.

Il pacchetto è un progetto con codice server. Trascinare soltanto la cartella del sito compilato nell’upload statico di Netlify non pubblica le API: usa l’importazione da Git per compilare anche le funzioni.

Per aggiornare il sito in seguito, aggiorna il codice nello stesso repository. Netlify potrà pubblicare automaticamente le modifiche. I dati restano in Supabase e non vengono azzerati dalle nuove pubblicazioni.

## 4. Collega Netlify

1. Entra in [Netlify](https://app.netlify.com/), scegli di aggiungere un progetto importando un repository esistente e seleziona il repository privato.
2. Usa questi valori se non vengono letti automaticamente da `netlify.toml`:

| Impostazione | Valore |
| --- | --- |
| Base directory | cartella principale, campo vuoto |
| Build command | `npm run build:netlify` |
| Publish directory | `dist-netlify` |
| Functions directory | `netlify/functions` |
| Node | 22 |

3. Nelle variabili del progetto configura i valori seguenti. Devono essere disponibili alle **Functions**, nel contesto di **Production**. Se il piano non distingue gli ambiti, usa le variabili del progetto; il frontend non le include nella compilazione perché non hanno prefissi pubblici.

| Variabile | Contenuto |
| --- | --- |
| `DATABASE_URL` | connessione Supabase Transaction pooler completa |
| `SUPABASE_URL` | URL del progetto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave server secret oppure service_role |
| `SUPABASE_STORAGE_BUCKET` | `barovia-media` |
| `DATABASE_CA_CERT` | solo se necessario, certificato CA del database in PEM |

Non usare prefissi `VITE_` o `NEXT_PUBLIC_` per questi valori. Non inserirli in questa chat o nel repository. Le variabili di produzione non devono essere condivise con anteprime di codice non fidato.

4. Pubblica il progetto. Otterrai un indirizzo HTTPS del tipo `nome-campagna.netlify.app` scelto/assegnato da Netlify. Il nome è un esempio, non un sito già creato.
5. Apri l’indirizzo, accedi come DM, prova una nota con immagine, poi verifica con un account giocatore che una pagina esclusa non sia visibile. Verifica anche cambio chiave, riproduzione della storia e consumo di razioni.

Il codice frontend non dipende dal dominio: tutte le API e le immagini usano percorsi sullo stesso sito. Netlify fornisce il server delle API tramite una funzione che riceve richieste web standard. [Riferimento Netlify Functions](https://docs.netlify.com/build/functions/api/).

## 5. Collega un dominio, se vuoi

Puoi già giocare con l’indirizzo `netlify.app`. Per un dominio personale, acquista o usa un dominio che possiedi, poi vai in **Domain management → Add a domain → Add a domain you already own** e aggiungilo.

Segui i record DNS mostrati da Netlify per quel dominio: il valore corretto dipende dal nome scelto e dal provider DNS. Attendi la verifica e il certificato HTTPS. Dopo il cambio di dominio i giocatori dovranno accedere di nuovo, perché i cookie appartengono al dominio precedente.

[Riferimento per aggiungere un dominio](https://docs.netlify.com/manage/domains/get-started-with-domains/) e [configurazione DNS esterna](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/).

## Trasferire i dati già presenti

### Raccolta dei file

Nel sito attuale, ogni partecipante apre **Impostazioni → Il tuo account → Esporta contenuti e immagini**. Il download contiene solo le pagine visibili a quell’account e le immagini autorizzate. L’esportazione del DM comprende anche impostazioni, calendario corrente, razioni e incontri.

Raccogli le esportazioni di tutti gli autori durante una pausa nelle modifiche. Il solo file del DM non include pagine che gli sono nascoste. Il trasferimento conserva gli identificatori delle pagine e delle immagini, così i riferimenti continuano a funzionare. In caso di copie della stessa pagina, viene scelta quella con la versione più recente; a parità di versione viene preferita l’esportazione dell’autore. Una sola copia con riferimenti oscurati non può ricostruire informazioni che l’esportatore non poteva vedere.

I file contengono appunti e immagini leggibili: passarli a chi gestisce l’importazione gli permette di leggerli. Un giocatore che non vuole condividere il proprio archivio può non fornirlo, ma quei contenuti non saranno trasferiti. La visibilità nell’app non è cifratura end-to-end, come nel sito attuale.

### Importazione (una volta)

Il pacchetto contiene anche un percorso guidato: su Windows apri `IMPORTA-WINDOWS.cmd` dopo avere installato Node; su Mac esegui `npm ci` e poi `npm run transfer:guided` nella cartella del sito. Metti i JSON nella cartella `backups` e la configurazione `.env.netlify.local` accanto a `package.json`. Il programma mostra un riepilogo e chiede di scrivere `IMPORTA` prima di applicarlo. La modalità manuale equivalente è riportata sotto.

Questa fase usa Node sul computer di chi gestisce il trasferimento. Se preferisci, possiamo eseguirla insieme dopo il collegamento degli account.

1. Installa Node 22 aggiornato. Apri un terminale nella cartella estratta ed esegui `npm ci`.
2. Copia `.env.netlify.example` in `.env.netlify.local` e inserisci i valori reali. Il file locale è escluso da Git.
3. Crea una cartella `backups` e mettici le esportazioni. Non aggiungerla al repository.
4. Verifica prima i file, elencandoli tutti nel comando, per esempio:

```bash
node scripts/import-backups.mjs backups/barovia-dm.json backups/barovia-lyria.json
```

Questo comando controlla i file senza collegarsi al database né modificarlo. Usa i nomi effettivi dei tuoi file e aggiungi quelli di tutti gli altri utenti.

5. Quando il riepilogo è corretto, importa nel progetto Supabase vuoto:

```bash
npm run transfer:import -- backups/barovia-dm.json backups/barovia-lyria.json --apply
```

Sono ancora esempi di nomi: elenca tutti i file raccolti. Se vuoi consapevolmente trasferire soltanto gli archivi disponibili, aggiungi `--allow-partial`. Lo script altrimenti segnala gli utenti mancanti e interrompe l’importazione.

Lo script rifiuta database già popolati. Carica le immagini nel bucket privato e inserisce i dati in una transazione. Se un caricamento si interrompe, puoi ripetere l’operazione: riutilizza solo immagini già presenti con byte identici. Un errore prima della transazione può lasciare oggetti privati senza metadati; non vengono resi visibili nell’app.

**Chiavi e sessioni:** l’esportazione non contiene verificatori delle password o sessioni. Sul nuovo sito i sette account iniziali usano nuovamente le chiavi iniziali della campagna; eventuali chiavi cambiate sul vecchio sito non vengono trasferite. Cambiale dal nuovo sito dopo l’accesso. Gli account aggiuntivi vengono importati disattivati con chiavi casuali non distribuite: il DM assegna una nuova chiave e li attiva. Il vecchio sito conserva le proprie chiavi e i propri dati.

Dopo avere verificato il trasferimento, comunica ai giocatori quale indirizzo usare. I due siti non si sincronizzano automaticamente: continuare a scrivere su entrambi crea due copie separate della campagna.

## Sviluppo e verifiche

```bash
npm ci
npm run build:netlify
npm run test:postgres
```

Per lavorare in locale con API, usa `npx netlify dev` dopo aver collegato il progetto e le sue variabili, oppure configura le variabili locali secondo Netlify. Apri l’indirizzo locale restituito da Netlify. Il solo Vite mostra l’interfaccia ma non esegue le funzioni del server.

Le richieste simultanee usano controlli di versione; gruppi di scritture sensibili usano transazioni. Il limite dei tentativi di login usa l’indirizzo fornito da Netlify, non un’intestazione scelta dal visitatore. Cookie HttpOnly, SameSite e controlli sull’origine rimangono attivi. Le immagini sono servite soltanto dopo il controllo della sessione e della visibilità.

Le API interrogano PostgreSQL tramite il pooler, con prepared statement disattivati e nomi di schema espliciti. Non viene esposta un’API per eseguire SQL dal browser. D1/R2 rimangono usati esclusivamente dalla pubblicazione Sites originale.
