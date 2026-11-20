# Escalation CTF · Operazione NEMESIS

Modulo della Suite Escalation per eventi Capture the Flag in aula. La regia organizza le sessioni, le squadre risolvono le sfide e il referente segue la partita e scarica il report. L’applicazione comprende il catalogo di 32 sfide, 23 allegati, il motore NEMESIS e la guida riservata allo staff.

## 1. Pubblicazione su Railway

1. Estrai lo ZIP. Carica i file in un repository privato con `Dockerfile`, `railway.json` e `server.js` nella radice. Nel progetto Railway della Suite crea un nuovo servizio dal repository. Se usi un monorepo, imposta come **Root Directory** la cartella di Escalation CTF.
2. Collega al servizio un **volume** e imposta **Mount Path** su `/data`. Mantieni una sola istanza del servizio. Al primo avvio il programma crea sul volume `escalation-ctf.sqlite`. Su Railway l’avvio si interrompe se manca il volume.
3. Nelle **Variables** imposta i valori della tabella. Esegui il deploy, quindi apri **Settings → Networking → Generate Domain**. Il Dockerfile avvia il server sulla porta comunicata da Railway. Il controllo di avvio è `/api/health`.
4. Apri il dominio HTTPS e inserisci il codice amministrativo. Nella seconda schermata inserisci nome utente e password. Se la Suite dispone di una pagina iniziale, aggiungi nel suo menu la voce **Escalation CTF** con il dominio del nuovo servizio. Il marchio CTF rimanda alla pagina iniziale quando è configurata `SUITE_URL`.

| Variabile | Configurazione |
|---|---|
| `ADMIN_SESSION_CODE` | Obbligatoria. Scegli un codice per accedere al flusso docente, distinto dai codici partita. |
| `ADMIN_PASSWORD` | Al primo avvio scegli una password di almeno 12 caratteri. L’account iniziale viene creato una sola volta. Le modifiche successive alla variabile non aggiornano la password già registrata. |
| `ADMIN_USERNAME` | Facoltativa. Il nome iniziale è `admin`. |
| `SUITE_URL` | Facoltativa. Indirizzo HTTPS della pagina iniziale della tua Suite. |
| `PORT`, `RAILWAY_VOLUME_MOUNT_PATH` | Fornite da Railway. L’applicazione legge la posizione effettiva del volume al runtime. |

L’applicazione, gli allegati, il font, i marchi e la generazione dei PDF sono serviti dal progetto. Alcune tracce del catalogo originario prevedono la consultazione di strumenti didattici come VirusTotal. Il salvataggio dei dati di gioco è interamente locale al servizio. Per le copie di sicurezza dell’istanza pubblicata usa la sezione **Backups** del volume.

[Volumi Railway](https://docs.railway.com/volumes) · [Backup dei volumi](https://docs.railway.com/volumes/backups) · [Controllo di avvio](https://docs.railway.com/deployments/healthchecks)

## 2. Prima partita

Nel pannello docente apri **Utenti** e crea gli account. Assegna un account giocatore a ogni squadra e il ruolo **Referente** a chi osserva. In **Sessioni → Nuova sessione** scegli nome, durata, modalità, sfide e partecipanti. Con **Copia invito** ottieni un link con il codice partita precompilato. Le credenziali restano quelle assegnate alla singola squadra.

In modalità **cooperativa** la prima squadra che risolve una sfida la chiude per il gruppo. In modalità **competitiva** ciascuna squadra ha il proprio avanzamento. La ricerca nel catalogo accetta titolo, codice e categoria. Gli aiuti si sbloccano in sequenza. Il punteggio corrente diminuisce rispettivamente di 1, 1 e 2 punti, con un minimo di zero. Le regole di NEMESIS e la classifica si aggiornano a partire dai dati della sessione.

Dalla regia usa **Avvia** oppure **Avvia + NEMESIS**. Il referente accede con il codice della partita e le proprie credenziali. Il docente può **Terminare** la sessione per rendere disponibile il riepilogo finale al referente. Il report riporta squadra, punteggio, sfide risolte, tentativi errati e aiuti utilizzati.

## 3. Avvio locale

È richiesto Node.js 24. Le librerie applicative e i relativi avvisi di licenza sono inclusi. Nella cartella del progetto crea un file privato `.env` con `ADMIN_SESSION_CODE` e `ADMIN_PASSWORD`, una variabile per riga nel formato `NOME=valore`. Avvia da terminale con il comando seguente.

```sh
node --env-file=.env server.js
```

Apri [localhost sulla porta 3000](http://localhost:3000). I dati sono nella cartella `data`. Per scegliere una directory diversa usa `DATA_DIR`. Per eseguire le prove automatiche usa `npm test`. I test avviano un server su una porta libera e usano database temporanei.

## 4. Trasferimento dello storico Supabase

Lo ZIP sorgente comprendeva schema e catalogo. Gli account e i risultati del database di produzione richiedono un’esportazione separata. Il nuovo servizio può partire con un archivio vuoto oppure usare una copia migrata. Esegui il trasferimento tra due eventi, a partite concluse, in modo che lo storico rimanga coerente.

Nel vecchio PostgreSQL esegui la query di sola lettura **tools/esporta-storico.sql**. Con `psql` e la connessione già configurata nell’ambiente, questo comando produce esattamente il formato JSON richiesto.

```sh
psql -X -v ON_ERROR_STOP=1 -At -f tools/esporta-storico.sql -o storico.json
node tools/importa-storico.js storico.json dati-migrati
```

Il convertitore scrive **dati-migrati/escalation-ctf.sqlite** e riporta il conteggio di ciascuna tabella. Verifica gli ID, le relazioni e l’integrità del file. Conserva gli hash delle password pregresse, i codici sessione, le assegnazioni, le soluzioni, i tentativi, i punteggi, gli aiuti e i log NEMESIS. Aggiunge eventuali sfide di serie mancanti. Per le sfide di serie riconosciute aggiorna i riferimenti agli allegati inclusi. I materiali didattici personalizzati richiedono i relativi file in `docs/allegati`. Al cambio di piattaforma gli utenti eseguono di nuovo l’accesso.

Per verificare la copia in locale avvia il programma con `DATA_DIR` impostata sulla directory migrata. Per la pubblicazione usa il file prodotto dal convertitore **a servizio fermo**, prima dell’avvio che inizializza il nuovo volume. Il file va nella radice del volume con il nome esatto `escalation-ctf.sqlite`. Conserva l’export e il file migrato in un percorso privato. Entrambi contengono dati di accesso e di gioco. Il convertitore rifiuta una destinazione che contiene già un database. Per ottenere una nuova copia dopo i test ripeti la conversione in un’altra directory vuota.

## 5. Differenze rispetto al CTF originario

| Area | Modifica |
|---|---|
| Suite | Identità di Escalation, NEMESIS animato all’ingresso, accesso in due passaggi, trattamento grafico comune per regia, aula, osservatore e schermate finali. I crediti ITS Rossellini e BespokeAIDA sono conservati. |
| Regia e gioco | Invito con codice precompilato, ricerca delle sfide, selezione di tutte le nove categorie, aggiornamento delle assegnazioni che mantiene il punteggio delle squadre confermate. |
| Persistenza | SQLite in modalità WAL, chiavi esterne attive, operazioni di gioco atomiche, controlli server sul tempo, sessioni di accesso persistenti e revoca al logout. |
| Materiali | Quattro sfide WEB ora richiedono l’analisi di un verbale. REV-04 richiede la ricostruzione dell’impronta di un record. FOR-06 è allineata al contrassegno effettivamente presente nel file email. Per tutte le 32 sfide sono conservati codice, categoria, punteggio e flag attesa. |
| Allegati | La squadra apre il materiale della sfida attraverso un endpoint che verifica ruolo, partita e assegnazione. La guida **docs/Soluzioni-staff.md** è riservata all’organizzatore. |
| Report | Generazione PDF sul dispositivo del referente con libreria inclusa, impaginazione multipagina e integrità NEMESIS per squadra in competitiva. |

## 6. Collaudo della distribuzione

Sono state eseguite le prove in **tests/** su Node 24, con richieste HTTP al server e database SQLite su disco. Gli scenari coprono i tre ruoli, le nove categorie, creazione e modifica della sessione, rollback su assegnazione inesistente, confronto delle 32 flag con la guida, presenza dei 23 allegati, invii concorrenti, aiuti progressivi, scadenza, conclusione, logout, accesso ai materiali e riavvio del processo. Il PDF è stato generato e riaperto con 60 squadre in entrambe le modalità. La migrazione è stata verificata con dati di esempio anche nei casi di riferimento non valido e destinazione già occupata.

La verifica delle interfacce ha riguardato sintassi JavaScript e risoluzione delle risorse. Restano da verificare visivamente il rendering desktop e mobile e il flusso completo nel browser dell’aula. Il collaudo si è svolto in locale. Il progetto Railway di destinazione e il database di produzione richiedono accesso all’account del gestore.

### Verifica della versione 1.0.1

Il catalogo installato al primo avvio contiene 32 sfide attive in 9 categorie, per 218 punti base. Questa versione corregge le indicazioni di invio della flag in ENC-01, ENC-03, ENC-04 e NET-04. La traccia di ENC-02 lascia il calcolo alla squadra. Riattivare una categoria nella regia seleziona di nuovo le sue sfide e conserva le scelte nelle altre categorie.

Nel collaudo HTTP una squadra ha completato tutte le 32 sfide in cooperativa e una in competitiva. In entrambe le sessioni i 23 allegati restituiti dal server coincidono con i file del pacchetto. Dopo il riavvio a metà di ogni partita sono rimasti validi l’accesso, il punteggio e le 16 soluzioni già registrate. In competitiva una seconda squadra ha aperto i 96 indizi. Il collaudo è stato eseguito in locale, con Node 24, modalità produzione e directory persistente.

Al primo avvio su un volume della versione 1.0, l’app aggiorna i testi standard ancora identici a quelli distribuiti. Le personalizzazioni, gli ID delle sfide, le soluzioni attese e lo storico delle partite vengono conservati.
