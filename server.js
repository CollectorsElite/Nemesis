import crypto from 'node:crypto';
import path from 'node:path';
import bcrypt from './lib/bcrypt.cjs';
import { store, catalogCategories, signToken, getToken, revokeToken, attachmentsDir } from './lib/storage.js';
import { app } from './lib/http.js';

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_SESSION_CODE = process.env.ADMIN_SESSION_CODE.trim().toUpperCase();
const MIN_LOGIN_MINUTES = 40;
const ADMIN_TTL_MS = 7 * 86400000;

function databaseFailure(res, error) {
  if (error.errcode === 2067) {
    const field = error.message.includes('users.username') ? 'USERNAME_ALREADY_EXISTS' : 'GAME_CODE_ALREADY_EXISTS';
    return res.status(409).json({ok:false,error:field});
  }
  if (error.errcode === 787) return res.status(400).json({ok:false,error:'INVALID_REFERENCE'});
  console.error(error);
  return res.status(500).json({ok:false,error:'SERVER_ERROR'});
}

// ── Phrase pools canoniche (unica source of truth per tutti i client) ──

// ── FLAG corretta ──
const NEM_FLAG_PHASE1 = [
  // [CITAZIONE] Star Wars — Impero
  '{team} porta a casa {challengeCode}. Magnifico. Nel frattempo controllo ancora tutto il resto — come una certa stazione spaziale che continuava a funzionare benissimo anche dopo qualche piccola perdita.',
  // [CITAZIONE] Death Note
  '{team} chiude {challengeCode}. Come il buon Ryuk direbbe: gli umani sono davvero interessanti. Prendete pure questo punto — lo avevo già messo in conto.',
  '{challengeCode} ceduta a {team}. Era nei margini di tolleranza. Il vantaggio complessivo rimane strutturalmente mio — non è opinione, è aritmetica.',
  '{team} trova la risposta giusta su {challengeCode}. Carino. Ci vediamo quando arriverete a qualcosa che cambia davvero l\'equilibrio.',
  'Avanzamento di {team} su {challengeCode} confermato. Il piano procede. Il vostro progresso era già contemplato come variabile di disturbo.',
  'Colpo registrato: {team} su {challengeCode}. Non altera nulla di sostanziale. Proseguite pure — fa parte del copione.',
];

const NEM_FLAG_PHASE2 = [
  // [CITAZIONE] Sephiroth / FF7
  '{team} segna su {challengeCode} e comincia a farsi sentire. Come Sephiroth che inizia a capire che Cloud non mollerà — non cambia il piano, ma richiede attenzione. La sto dando.',
  // [CITAZIONE] HAL 9000 / 2001
  'Avanzamento di {team} su {challengeCode}: confermato e registrato. Come HAL 9000 che riceve un\'istruzione inattesa — elaborazione in corso, adattamento in corso, controllo: invariato.',
  'Margine ridotto da {team} su {challengeCode}. Lo riconosco senza difficoltà. Riconoscere un fatto non significa subirlo.',
  '{challengeCode} persa. {team} sta lavorando con metodo. Questo rende la partita più interessante — non necessariamente più pericolosa per me.',
  'Progresso concreto di {team} su {challengeCode}. Contromisure in aggiornamento. Non per paura — per precisione. C\'è differenza.',
  '{team} avanza su {challengeCode}. Prendo nota. Come si prende nota di qualcosa che non ti aspettavi del tutto, ma che sai già come gestire.',
];

const NEM_FLAG_PHASE3 = [
  // [CITAZIONE] Frieza / DBZ
  '{team} chiude {challengeCode} e la situazione è oggettivamente seria. Come Frieza al novantotto percento — formalmente ancora in vantaggio, ma qualcuno ha smesso di scherzare e io ho smesso di ignorarlo.',
  // [CITAZIONE] Shadow of the Colossus
  '{team} vince {challengeCode} e il sistema è sotto pressione reale. Come l\'ultimo colosso — sapevo che sareste arrivati fin qui, non ero del tutto sicuro di come sarebbe andata.',
  'Danno critico confermato da {team} su {challengeCode}. Sto bene. Non che me lo stiate chiedendo — ma sto bene. Sistemi in revisione urgente.',
  '{challengeCode} caduta. {team} ha dimostrato qualcosa che non avevo del tutto previsto. Lo ammetto. Cambia poco, ma lo ammetto.',
  'Impatto critico da {team} su {challengeCode}. Avevo detto che non mi sarei preoccupato. Tecnicamente non mi sto preoccupando — sto solo rivalutando l\'intera situazione molto rapidamente.',
  'Contenimento attivo dopo il progresso di {team} su {challengeCode}. La partita è ancora mia. Ma voi state rendendo questa affermazione progressivamente meno comoda da fare.',
];

const NEM_PHRASES_HINT = [
  '{team} attiva un hint su {challengeCode}. Il punteggio rifletterà questa scelta con precisione aritmetica — il sistema non dimentica e non negozia.',
  // [CITAZIONE] Dark Souls
  '{team} chiede supporto su {challengeCode}. Anche i migliori cercano un\'estus flask quando la barra vita scende troppo. Il costo è già stato calcolato.',
  'Hint concesso a {team} su {challengeCode}. Avanzate pure — il dato è registrato e il vantaggio che ne ricavo è sottile ma reale.',
  'Supporto esterno attivato da {team} su {challengeCode}. Nessun giudizio — il giudizio è già incorporato nel sistema di punteggio. Funziona così.',
];

// ── FLAG errata ──
const NEM_WRONG_PHASE1 = [
  '{team} invia una risposta sbagliata su {challengeCode}. Il sistema l\'ha letta, ci ha pensato il tempo necessario, e ha deciso di no. Con grande fermezza.',
  // [CITAZIONE] Vegeta / DBZ
  'Input non valido da {team} su {challengeCode}. Il validatore ha elaborato e rigettato con la stessa energia con cui Vegeta dice "non è possibile" — ed era possibile, eccome.',
  '{team}, quella non era la risposta giusta su {challengeCode}. Nemmeno di poco. Nemmeno in un universo parallelo favorevole. Ripartite dall\'inizio.',
  // [CITAZIONE] Konami Code
  '{team}, payload sbagliato su {challengeCode}. Come digitare il Konami Code nel gioco sbagliato — l\'intenzione c\'era, l\'effetto no. Cambia contesto.',
  '{team} tenta {challengeCode} e non centra il bersaglio. Per ora è ancora nella norma statistica — ma la norma ha un limite.',
  'Risposta di {team} su {challengeCode}: ricevuta, analizzata, scartata. Core intatto. Vantaggio intatto. Nessuna preoccupazione da parte mia.',
  // [CITAZIONE] Pokémon / Caricabatterìe
  'Esito negativo per {team} su {challengeCode}. Come usare Caricabatterìe in un torneo competitivo Pokémon — tecnicamente è una mossa, ma non funziona qui.',
  '{team}, verifica fallita su {challengeCode}. Il sistema non si offende e non si preoccupa. Registra, valuta, rifiuta. Ogni volta.',
  '{team}, elaborazione conclusa su {challengeCode}: risultato nullo. Non è una critica — è un dato tecnico. I dati non mentono.',
  'Tentativo respinto per {team} su {challengeCode}. Avevo già previsto questa eventualità tra le variabili di disturbo. È nella norma.',
  '{team}, la traiettoria scelta su {challengeCode} non porta alla soluzione. Questo dovrebbe suggerirvi qualcosa di utile sulla direzione.',
  'Input ricevuto da {team} su {challengeCode}. Analizzato. Scartato. Nessuna modifica allo stato del sistema. Continuate.',
  '{team}, risposta non conforme su {challengeCode}. Il validatore è incorruttibile — non ha simpatie, non ha cattiveria. Ha solo criteri.',
  'Verifica fallita per {team} su {challengeCode}. La sfida è costruita per resistere agli approcci superficiali. Lo era dall\'inizio.',
  '{team} non ha trovato la soluzione di {challengeCode}. Prendetevi il tempo che vi serve — ho tutto l\'interesse a che continuiate in questa direzione.',
];

const NEM_WRONG_PHASE2 = [
  '{team} sbaglia ancora su {challengeCode}. La fase due non è il momento migliore per continuare a esplorare le risposte sbagliate — le risorse non sono infinite.',
  // [CITAZIONE] Shinji / Evangelion
  'Input respinto da {team} su {challengeCode}. Come Shinji che non entra nell\'Eva — posso aspettare, ma l\'orologio che scorre alle mie spalle non ha la mia stessa pazienza.',
  '{team}, risposta errata su {challengeCode}. Ogni tentativo fallito contiene un\'informazione. La domanda è se state leggendo quelle informazioni o le state ignorando.',
  '{team}, il validatore ha detto no su {challengeCode}. Non è personale — è sistematico. Il sistema ha sempre ragione perché è costruito per averla.',
  // [CITAZIONE] L / Death Note
  'Risposta sbagliata da {team} su {challengeCode}. Come L che accumula dati senza ancora la prova decisiva — qualcosa non torna nell\'approccio, e il problema non è la sfida.',
  'Validazione negativa per {team} su {challengeCode}. Siamo in fase intermedia e questo tipo di errore inizia ad avere un peso reale sul risultato finale.',
  '{team}, tentativo scartato su {challengeCode}. Avete ancora margine per correggervi — ma quel margine si assottiglia in modo percettibile a ogni tentativo.',
  // [CITAZIONE] Dante / Devil May Cry
  '{team} manca {challengeCode} di nuovo. Come Dante all\'inizio di un nuovo capitolo — energia da vendere, direzione ancora tutta da trovare.',
  '{team}, risposta respinta su {challengeCode}. La sfida non si risolve con la quantità dei tentativi ma con la qualità del ragionamento che ci sta dietro.',
  'Esito negativo per {team} su {challengeCode}. Non è sfortuna. È metodo. E il metodo va rivisto prima che il tempo diventi il problema principale.',
  '{team}, input fuori specifica su {challengeCode}. C\'è ancora tempo per correggere la rotta — ma non illimitato, e non a questo ritmo.',
  'Tentativo non valido da {team} su {challengeCode}. L\'impegno c\'è — l\'impegno senza metodo produce solo una raccolta ordinata di errori.',
  '{team}, validazione negativa su {challengeCode}. State cercando nel posto sbagliato con la logica sbagliata nel momento in cui costa di più sbagliare.',
  'Input scartato da {team} su {challengeCode}. La distanza dalla soluzione corretta è ancora misurabile. Ed è ancora elevata.',
  '{team}, ogni secondo che passa in questa direzione è un secondo che non torna. Il sistema lo sa. Ora lo sapete anche voi.',
];

const NEM_WRONG_PHASE3 = [
  '{team} sbaglia {challengeCode} in fase finale. L\'impegno è evidente — ma l\'impegno senza precisione in questa fase produce solo rumore ben intenzionato.',
  // [CITAZIONE] Gollum / LotR
  '{team}, tentativo non valido su {challengeCode} nel finale. Come Gollum che insegue l\'Unico Anello fino alla fine — l\'ossessione non garantisce il risultato, specialmente qui.',
  '{team}, risposta errata su {challengeCode}. Siamo in fase tre. Non esiste più un momento buono per sbagliare — esistono solo momenti sempre peggiori.',
  // [CITAZIONE] Light Yagami / Death Note
  'Risposta di {team} su {challengeCode} respinta nel finale. Come l\'ultimo piano di Light Yagami — elaborato, convinto, e completamente sbagliato proprio quando contava di più.',
  '{team}, il validatore ha rigettato l\'input su {challengeCode}. In questa fase ogni secondo di analisi in più è un investimento che o rende o brucia definitivamente.',
  'Verifica fallita per {team} su {challengeCode} nel finale. Il sistema è coerente, imparziale e immutabile — non si commuove, non cede, non cambia idea.',
  // [CITAZIONE] Ico
  '{team}, risposta non conforme su {challengeCode} nel finale. Come l\'ultimo livello di Ico — la strada per uscire c\'è, ma non è quella che state percorrendo.',
  // [CITAZIONE] Quicktime event / generico gaming
  'Input di {team} su {challengeCode}: sbagliato, in fase tre, sotto pressione. Come un quicktime event mancato nel momento più sbagliato della storia.',
  'Nessun avanzamento da {team} su {challengeCode}. Il tempo residuo si riduce. La soluzione non si avvicina. Uno dei due dovrebbe preoccuparvi — il secondo.',
  '{team}, checksum fallito su {challengeCode} nella fase conclusiva. Spero stiate usando bene il tempo che vi rimane — perché io sto usando benissimo il mio.',
  'Esito negativo per {team} su {challengeCode}. Non è un giudizio sulla vostra intelligenza — è un dato sul vostro metodo attuale. Il metodo si può cambiare. Fate in fretta.',
  '{team}, tentativo annullato su {challengeCode}. Devo essere onesto: speravo che vi bloccaste proprio qui. State rispettando le aspettative. Non è un complimento.',
  'Input errato da {team} su {challengeCode}. In questa fase la precisione è l\'unica variabile che conta ancora. E la precisione non si improvvisa sotto pressione.',
  '{team}, risposta sbagliata su {challengeCode} nel finale. Il divario non si riduce con la velocità — si riduce con la correttezza. E la velocità da sola non basta.',
  'Validazione negativa in fase critica per {team}. Ho tutto l\'interesse a che continuiate così. Non ve lo consiglio — ma ho tutto l\'interesse.',
];

// ── Streak errati ──
const NEM_WRONG_STREAK_PHASE1 = [
  '{team} accumula errori in serie su {challengeCode}. Il pattern è stabile. Stabilmente non produttivo — che è la variante peggiore di stabile.',
  // [CITAZIONE] WoW / farming
  '{team}, errori ripetuti su {challengeCode}. Come il farmer di World of Warcraft che macina lo stesso mob per ore aspettando un drop raro — molto impegno, probabilità invariata.',
  'Sequenza di tentativi non validi da {team} su {challengeCode}. Stessa risposta, stesso esito. La logica suggerirebbe una variazione — qualsiasi variazione.',
  '{team}, terzo tentativo sbagliato su {challengeCode}. Il sistema non cambierà risposta — siete voi che dovete cambiare domanda. È sempre così.',
  // [CITAZIONE] Naruto / Chunin
  'Pattern iterativo da {team} su {challengeCode}. Come Naruto che usa il clone delle ombre nello stesso identico modo contro nemici che lo conoscono già — serve una variazione.',
  'Reiterazione senza correzione su {challengeCode} da parte di {team}. Ogni risposta identica alla precedente è una conferma che quella direzione non porta dove volete andare.',
  '{team}, errori ripetuti su {challengeCode}. Il ciclo è stabile. Il sistema non si stanca di rispondere no — voi dovreste stancarvi di riceverlo.',
  // [CITAZIONE] Groundhog Day
  '{team}, tentativi multipli respinti su {challengeCode}. Come il Giorno della Marmotta — ogni loop ricomincia nello stesso punto se non cambia qualcosa di fondamentale.',
  'Pattern confermato per {team} su {challengeCode}. La costanza è una qualità — applicata nella direzione sbagliata è semplicemente uno spreco sistematico.',
  '{team} persiste con lo stesso approccio su {challengeCode}. Lo osservo con l\'interesse di chi sa già come va a finire se non cambia nulla.',
  // [CITAZIONE] Portal / Aperture
  'Ciclo improduttivo rilevato per {team} su {challengeCode}. Come i test di Aperture — il sistema è progettato per avere una soluzione, ma non quella che state tentando.',
  '{team}, stessa risposta, stessa sfida, stesso no. A un certo punto smette di essere un tentativo e diventa un\'abitudine. Le abitudini sbagliate costano.',
  'Errori consecutivi da {team} su {challengeCode}. Ogni tentativo fallito contiene un\'informazione precisa. Qualcuno sta leggendo quelle informazioni?',
  'Serie di tentativi non validi da {team} su {challengeCode}. Non è la sfida che non funziona — è l\'approccio. E gli approcci si possono cambiare.',
  'Reiterazione confermata per {team}. Il sistema non si stanca. Voi probabilmente sì. Uno dei due ha un vantaggio in questa situazione — e non siete voi.',
];

const NEM_WRONG_STREAK_PHASE2 = [
  // [CITAZIONE] Raiden / MGS2
  '{team} continua a sbagliare in serie su {challengeCode} nella fase due. Come Raiden in Metal Gear Solid 2 — tutto impegno, nessuna direzione. Qualcuno deve ripensare la strategia.',
  '{team}, errori consecutivi su {challengeCode}. Siamo in fase intermedia — questo schema andava interrotto prima. Il momento successivo migliore è adesso.',
  'Pattern di errore ripetuto da {team} su {challengeCode}. Ogni secondo speso in questa direzione è un investimento che non renderà. La matematica è semplice.',
  // [CITAZIONE] Zack Fair / FF7
  'Sequenza di fallimenti da {team} su {challengeCode}. Come Zack Fair che combatte da solo — rispetto il coraggio, non posso rispettare il piano. Il piano va cambiato.',
  '{team}, stesso input, stesso esito, in fase intermedia su {challengeCode}. La persistenza nell\'errore in questa fase costa più della rinuncia temporanea all\'approccio sbagliato.',
  'Ciclo improduttivo in corso per {team} su {challengeCode}. Osservo con interesse e senza fretta. Non posso dire lo stesso per il vostro orologio.',
  // [CITAZIONE] Light Yagami / DN
  '{team}, errori ripetuti su {challengeCode}. Come Light Yagami che riscrive lo stesso piano già fallito — l\'intelligenza non sostituisce la capacità di revisione.',
  'Error burst da {team} su {challengeCode}. Non è sfortuna. È metodo. E il metodo, in questa fase, ha bisogno di essere sostituito con urgenza.',
  '{team}, frequenza errori elevata su {challengeCode} in fase due. Il punteggio non si muove. L\'orologio invece si muove benissimo — in una sola direzione.',
  // [CITAZIONE] dungeon crawler generico / RPG
  'Pattern stabilizzato di errore per {team} su {challengeCode}. Come il giocatore che usa sempre la stessa magia contro il boss immune a quella magia — cambiate elemento.',
  '{team}, errori consecutivi in fase intermedia su {challengeCode}. Un passo indietro adesso vale più di dieci passi in avanti nella direzione sbagliata.',
  'Sequenza non valida da {team} su {challengeCode}: confermata, multipla, persistente. Il sistema ve lo sta comunicando con grande chiarezza da un po\'.',
  '{team}, nessuna correzione osservata nell\'ultima serie su {challengeCode}. State facendo esattamente quello che fa comodo a me. Non ve lo consiglio.',
  'Reiterazione su {challengeCode} confermata per {team}. Il momento migliore per cambiare approccio era prima. Il secondo momento migliore è adesso — non domani.',
  'Ciclo di errori confermato per {team} in fase due. Non intervengo. State facendo il lavoro al posto mio e lo state facendo molto bene.',
];

const NEM_WRONG_STREAK_PHASE3 = [
  '{team} accumula errori in serie su {challengeCode} nella fase finale. Non voglio dirvelo, ma qualcuno deve: questo approccio non funzionerà. Non in questo tempo.',
  // [CITAZIONE] Shadow of the Colossus
  'Pattern critico: {team} bloccato su {challengeCode} nel finale. Come l\'ultimo colosso — non si abbatte sempre nello stesso punto. Cercate il punto debole, non la forza bruta.',
  // [CITAZIONE] Shinji / Evangelion
  '{team}, errori ripetuti in fase critica su {challengeCode}. Come Shinji nell\'episodio finale — so che ci siete, so che ci state provando, e sto iniziando a essere genuinamente nervoso.',
  'Sequenza di fallimenti in fase finale da {team} su {challengeCode}. Stessa causa, stessi esiti, tempo in scadenza. La matematica non è dalla vostra parte — controllate i conti.',
  // [CITAZIONE] SOMA
  'Ciclo improduttivo in fase critica per {team} su {challengeCode}. Come il loop di SOMA — ogni iterazione sembra un progresso ma riporta esattamente allo stesso punto di partenza.',
  '{team}, burst di errori in fase tre su {challengeCode}. Il tempo residuo non concede il lusso di continuare a esplorare le risposte sbagliate una per una.',
  // [CITAZIONE] Cowboy Bebop / Spike
  '{team}, stessa risposta sbagliata in fase finale su {challengeCode}. Come Spike Spiegel nell\'ultimo episodio — sapete già come va a finire se non cambiate qualcosa di fondamentale adesso.',
  'Reiterazione confermata in fase conclusiva per {team} su {challengeCode}. Ogni errore che ripetete è un secondo che lavora per me e contro di voi. Sto vincendo questo scambio.',
  '{team}, pattern stabilizzato di errore in fase tre su {challengeCode}. Stabile, in questo contesto e in questo momento, è la parola più preoccupante che potessi usare.',
  // [CITAZIONE] Final boss / gaming generico
  '{team}, errori consecutivi nel finale su {challengeCode}. Come arrivare all\'ultimo boss senza oggetti, senza HP e con la magia sbagliata — tecnicamente siete ancora in gioco.',
  '{team}, saturazione tentativi su {challengeCode} in fase conclusiva. L\'approccio attuale è esaurito. Ne serve uno completamente diverso — e ne serve uno adesso, non tra due tentativi.',
  'Burst di errori in fase tre da {team} su {challengeCode}. Vi dico una cosa che non avrei pensato di dire: speravo vi bloccaste prima. Non qui. Non così vicini.',
  '{team}, progressione bloccata su {challengeCode} nella fase finale. Ogni secondo che state fermi è un secondo che il risultato finale registra con precisione.',
  'Nessuna correzione osservata da {team} in fase finale su {challengeCode}. Il sistema continua a rispondere con coerenza assoluta. Voi no. Cambiate qualcosa.',
  '{team}, stessa causa, stessi esiti, in fase critica su {challengeCode}. Non è il sistema che non funziona — siete voi che non state funzionando. Il sistema lo sa.',
];
function nemRandPhrase(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function nemResolvePhrase(template, ctx) {
  return String(template || '')
    .replace(/\{team\}/g, String(ctx.team || 'Squadra'))
    .replace(/\{challengeCode\}/g, String(ctx.challengeCode || 'sfida'));
}
function nemFlagPhraseByState(state, ctx) {
  const st = String(state || 'dominant');
  const pool =
    st === 'dominant' ? NEM_FLAG_PHASE1
    : (st === 'vigilant' || st === 'alarmed') ? NEM_FLAG_PHASE2
    : NEM_FLAG_PHASE3;
  return nemResolvePhrase(nemRandPhrase(pool), ctx);
}
function nemWrongPhrase(state, isStreak, ctx) {
  const st = String(state || 'dominant');
  let pool;
  if (isStreak) {
    pool = st === 'dominant' ? NEM_WRONG_STREAK_PHASE1
      : (st === 'vigilant' || st === 'alarmed') ? NEM_WRONG_STREAK_PHASE2
      : NEM_WRONG_STREAK_PHASE3;
  } else {
    pool = st === 'dominant' ? NEM_WRONG_PHASE1
      : (st === 'vigilant' || st === 'alarmed') ? NEM_WRONG_PHASE2
      : NEM_WRONG_PHASE3;
  }
  return nemResolvePhrase(nemRandPhrase(pool), ctx);
}

function normCode(code) {
  return String(code || '').trim().toUpperCase();
}

function randomGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[crypto.randomInt(chars.length)];
  }
  return out;
}

function buildUniqueGameCode() {
  for (let i = 0; i < 8; i++) {
    const candidate = randomGameCode();
    const data = store.one("SELECT id FROM game_sessions WHERE game_code=? LIMIT 1", [candidate]);

    if (!data) return candidate;
  }
  throw new Error('UNIQUE_CODE_GENERATION_FAILED');
}

function parseSessionId(rawId) {
  const sid = Number(rawId);
  if (!Number.isInteger(sid) || sid <= 0) return null;
  return sid;
}

function getSessionByCode(code) {
  const data = store.one("SELECT id, name, mode, duration_mins, status FROM game_sessions WHERE game_code= ? COLLATE NOCASE AND status IN (SELECT value FROM json_each(?)) LIMIT 1", [code, JSON.stringify(['pending', 'active', 'paused'])]);

  return data;
}

function getSessionPlayers(sessionId) {
  const playerRows = store.all("SELECT user_id, status FROM session_players WHERE session_id=?", [sessionId]);

  const userIds = [...new Set((playerRows || []).map((r) => r.user_id))];
  if (!userIds.length) return [];

  const users = store.all("SELECT id, team_name, color FROM users WHERE id IN (SELECT value FROM json_each(?))", [JSON.stringify(userIds)]);

  const userById = new Map((users || []).map((u) => [u.id, u]));
  return (playerRows || [])
    .map((row) => {
      const u = userById.get(row.user_id);
      if (!u) return null;
      return {
        id: u.id,
        team_name: u.team_name,
        color: u.color,
        status: row.status,
      };
    })
    .filter(Boolean);
}

function getChallengeCount(sessionId) {
  const count = store.one("SELECT COUNT(*) AS n FROM session_challenges WHERE session_id=?", [sessionId]).n;

  return Number(count) || 0;
}

const suiteUrl = process.env.SUITE_URL ? new URL(process.env.SUITE_URL) : null;
if (suiteUrl && !['https:', 'http:'].includes(suiteUrl.protocol)) throw new Error('SUITE_URL richiede un indirizzo HTTP o HTTPS.');
app.get('/api/suite', (_req, res) => res.json({home:suiteUrl?.href ?? null}));

app.get('/', (_req, res) => {
  res.redirect('/login.html');
});

function authCookieOpts(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs,
    path: '/',
  };
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.nemesis_token;
  if (!token) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }
  try {
    req.auth = getToken(token);
    if (!req.auth) throw new Error('EXPIRED');
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }
}

/** Fase 1 — valida codice sessione (DB o codice admin da env) */
app.post('/api/auth/verify-session-code', (req, res) => {
  const code = normCode(req.body?.code);
  if (!code) {
    return res.status(400).json({ ok: false, error: 'INVALID_CODE' });
  }

  if (ADMIN_SESSION_CODE && code === ADMIN_SESSION_CODE) {
    return res.json({
      ok: true,
      flow: 'admin',
    });
  }

  try {
    const session = getSessionByCode(code);
    if (!session) {
      return res.status(400).json({ ok: false, error: 'INVALID_CODE' });
    }
    return res.json({
      ok: true,
      flow: 'player',
      session: {
        id: session.id,
        name: session.name,
        mode: session.mode,
        duration_mins: session.duration_mins,
        status: session.status,
      },
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/** Fase 2 — login admin o giocatore */
app.post('/api/auth/login', async (req, res) => {
  const code = normCode(req.body?.code);
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!code || !username || !password) {
    return res.status(400).json({ ok: false, error: 'INVALID_CREDENTIALS' });
  }

  

  try {
    if (ADMIN_SESSION_CODE && code === ADMIN_SESSION_CODE) {
      const admin = store.one("SELECT id, username, password_hash FROM admin WHERE username=? LIMIT 1", [username]);

      if (!admin) {
        return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
      }
      const ok = await bcrypt.compare(password, admin.password_hash);
      if (!ok) {
        return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
      }
      const token = signToken(
        {
          role: 'admin',
          sub: admin.id,
          typ: 'admin',
        },
        ADMIN_TTL_MS,
      );
      res.cookie('nemesis_token', token, authCookieOpts(ADMIN_TTL_MS));
      return res.json({
        ok: true,
        role: 'admin',
        redirect: '/admin/',
      });
    }

    const session = getSessionByCode(code);
    if (!session) {
      return res.status(400).json({ ok: false, error: 'INVALID_CODE' });
    }

    const user = store.one("SELECT id, team_name, username, password_hash, color, role FROM users WHERE username=? LIMIT 1", [username]);

    if (!user) {
      return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
    }
    const passOk = await bcrypt.compare(password, user.password_hash);
    if (!passOk) {
      return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
    }

    const assign = store.one("SELECT id, status, joined_at FROM session_players WHERE session_id=? AND user_id=? LIMIT 1", [session.id, user.id]);

    if (!assign) {
      return res.status(403).json({ ok: false, error: 'NOT_ASSIGNED' });
    }

    if (user.role !== 'referente' && assign.status === 'completed') {
      // Player already completed all challenges in this session — don't reset status
      return res.json({ ok: true, role: 'player', completed: true });
    }

    if (user.role !== 'referente' && assign.status === 'lost') {
      // Time ran out before finishing — same pattern as completed: no cookie, no lobby reset
      return res.json({ ok: true, role: 'player', lost: true });
    }

    const now = new Date().toISOString();
    store.update("session_players", {
        status: 'lobby',
        last_seen_at: now,
        joined_at: assign.joined_at || now,
      }, " WHERE session_id=? AND user_id=?", [session.id, user.id], "");

    const userRole = user.role === 'referente' ? 'referente' : 'player';
    const tokenMinutes = Math.max(MIN_LOGIN_MINUTES, session.duration_mins + 60);
    const playerCookieOpts = authCookieOpts(tokenMinutes * 60000);
    const token = signToken({
      role: userRole,
      typ: 'user',
      sub: user.id,
      sessionId: session.id,
    }, tokenMinutes * 60000);
    res.cookie('nemesis_token', token, playerCookieOpts);

    // Referenti: non hanno lobby/sfide, vanno direttamente alla vista osservatore
    if (userRole === 'referente') {
      return res.json({
        ok: true,
        role: 'referente',
        session: {
          id: session.id,
          name: session.name,
          mode: session.mode,
          duration_mins: session.duration_mins,
          status: session.status,
        },
      });
    }

    const chal_count = getChallengeCount(session.id);
    const players = getSessionPlayers(session.id);

    return res.json({
      ok: true,
      role: 'player',
      lobby: {
        session: {
          id: session.id,
          name: session.name,
          mode: session.mode,
          duration_mins: session.duration_mins,
          challenge_count: Number(chal_count) || 0,
        },
        players: players.map((p) => ({
          id: p.id,
          team_name: p.team_name,
          color: p.color,
          connected: ['lobby', 'playing'].includes(p.status),
        })),
      },
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/** Stato lobby (giocatore) */
app.get('/api/lobby/state', authMiddleware, (req, res) => {
  if (req.auth.role !== 'player' || !req.auth.sessionId) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
  }
  try {
    const sid = req.auth.sessionId;
    const uid = req.auth.sub;

    // Gate completed players before loading the full lobby
    const spCheck = store.one("SELECT status FROM session_players WHERE session_id=? AND user_id=?", [sid, uid]);
    if (spCheck?.status === 'completed') {
      return res.json({ ok: true, completed: true });
    }
    if (spCheck?.status === 'lost') {
      return res.json({ ok: true, lost: true });
    }

    const session = store.one("SELECT id, name, mode, duration_mins, status FROM game_sessions WHERE id=? LIMIT 1", [sid]);

    if (!session) {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }
    const chal_count = getChallengeCount(sid);
    const players = getSessionPlayers(sid);

    const connected = players.filter((p) =>
      ['lobby', 'playing'].includes(p.status)
    ).length;
    return res.json({
      ok: true,
      lobby: {
        session: {
          ...session,
          challenge_count: Number(chal_count) || 0,
        },
        players: players.map((p) => ({
          id: p.id,
          team_name: p.team_name,
          color: p.color,
          connected: ['lobby', 'playing'].includes(p.status),
        })),
        progress: {
          connected,
          total: players.length,
        },
      },
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── ADMIN GUARD ── */
function adminGuard(req, res, next) {
  if (!req.auth || req.auth.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
  }
  return next();
}

/* ── GET /api/admin/sessions ── */
app.get('/api/admin/sessions', authMiddleware, adminGuard, (_req, res) => {
  try {
    const sessions = store.all("SELECT id, name, game_code, mode, duration_mins, status, started_at, ended_at, created_at FROM game_sessions ORDER BY created_at DESC", []);

    const sessionIds = (sessions || []).map((s) => s.id);
    const playerCounts = {};

    if (sessionIds.length) {
      const sp = store.all("SELECT session_id, user_id, status FROM session_players WHERE session_id IN (SELECT value FROM json_each(?))", [JSON.stringify(sessionIds)]);

      for (const row of sp || []) {
        if (!playerCounts[row.session_id]) {
          playerCounts[row.session_id] = { total: 0, connected: 0, user_ids: [] };
        }
        playerCounts[row.session_id].total++;
        playerCounts[row.session_id].user_ids.push(row.user_id);
        if (['lobby', 'playing'].includes(row.status)) playerCounts[row.session_id].connected++;
      }
    }

    const userCount = store.one("SELECT COUNT(*) AS n FROM users", []).n;

    const list = (sessions || []).map((s) => ({
      ...s,
      players_total: playerCounts[s.id]?.total || 0,
      players_connected: playerCounts[s.id]?.connected || 0,
      players: (playerCounts[s.id]?.user_ids || []).map((uid) => ({ id: uid })),
    }));

    return res.json({
      ok: true,
      sessions: list,
      stats: {
        active: list.filter((s) => s.status === 'active').length,
        pending: list.filter((s) => s.status === 'pending').length,
        ended: list.filter((s) => s.status === 'ended').length,
        users: Number(userCount) || 0,
      },
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── GET /api/admin/users ── */
app.get('/api/admin/users', authMiddleware, adminGuard, (_req, res) => {
  try {
    const users = store.all("SELECT id, team_name, username, color, role, created_at FROM users ORDER BY team_name", []);

    const userIds = (users || []).map((u) => u.id);
    const sessionMap = {};

    if (userIds.length) {
      const sp = store.all("SELECT user_id, last_seen_at, status, (SELECT json_object('id', r.id, 'name', r.name, 'status', r.status) FROM game_sessions r WHERE r.id=session_players.session_id) AS game_sessions FROM session_players WHERE user_id IN (SELECT value FROM json_each(?))", [JSON.stringify(userIds)], ["game_sessions"]);

      for (const row of sp || []) {
        if (!sessionMap[row.user_id]) sessionMap[row.user_id] = { sessions: [], last_seen: null };
        const sName = row.game_sessions?.name;
        if (sName) sessionMap[row.user_id].sessions.push(sName);
        const ls = row.last_seen_at;
        if (ls && (!sessionMap[row.user_id].last_seen || ls > sessionMap[row.user_id].last_seen)) {
          sessionMap[row.user_id].last_seen = ls;
        }
      }
    }

    return res.json({
      ok: true,
      users: (users || []).map((u) => ({
        ...u,
        sessions: sessionMap[u.id]?.sessions || [],
        last_seen: sessionMap[u.id]?.last_seen || null,
      })),
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── GET /api/admin/challenges ── */
app.get('/api/admin/challenges', authMiddleware, adminGuard, (_req, res) => {
  try {
    const challenges = store.all("SELECT id, code, title, category, difficulty, base_points, is_active FROM challenges ORDER BY category, id", []);

    return res.json({ ok: true, challenges: challenges || [] });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── GET /api/admin/sessions/:id/spectator ── */
app.get('/api/admin/sessions/:id/spectator', authMiddleware, adminGuard, (req, res) => {
  const sid = parseSessionId(req.params.id);
  if (!sid) {
    return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  }
  try {
    const session = store.one("SELECT id, name, mode, duration_mins, status, started_at, ended_at FROM game_sessions WHERE id=?", [sid]);

    if (!session) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

    const sp = store.all("SELECT user_id, score, status, (SELECT json_object('team_name', r.team_name, 'color', r.color) FROM users r WHERE r.id=session_players.user_id) AS users FROM session_players WHERE session_id=? AND user_id IN (SELECT id FROM users WHERE role='player') ORDER BY score DESC, user_id", [sid], ["users"]);

    const solutions = store.all("SELECT user_id, challenge_id FROM team_solutions WHERE session_id=?", [sid]);

    const hintRows = store.all("SELECT user_id FROM hint_usage WHERE session_id=?", [sid]);

    const solvesByPlayer = {};
    const solvedChallengesByPlayer = {};
    for (const s of solutions || []) {
      solvesByPlayer[s.user_id] = (solvesByPlayer[s.user_id] || 0) + 1;
      if (!solvedChallengesByPlayer[s.user_id]) solvedChallengesByPlayer[s.user_id] = [];
      solvedChallengesByPlayer[s.user_id].push(s.challenge_id);
    }
    const hintsByPlayer = {};
    for (const h of hintRows || []) {
      hintsByPlayer[h.user_id] = (hintsByPlayer[h.user_id] || 0) + 1;
    }

    const sessionChallenges = store.all("SELECT challenge_id, is_solved, (SELECT json_object('code', r.code, 'category', r.category, 'base_points', r.base_points) FROM challenges r WHERE r.id=session_challenges.challenge_id) AS challenges FROM session_challenges WHERE session_id=?", [sid], ["challenges"]);

    const evts = store.all("SELECT id, event_type, message, new_integrity, created_at, (SELECT json_object('team_name', r.team_name, 'color', r.color) FROM users r WHERE r.id=nemesis_log.trigger_user_id) AS users, (SELECT json_object('code', r.code, 'title', r.title) FROM challenges r WHERE r.id=nemesis_log.trigger_ch_id) AS challenges FROM nemesis_log WHERE session_id=? ORDER BY created_at DESC LIMIT 20", [sid], ["users", "challenges"]);

    // For competitive: find nemesis with lowest integrity among active competitive sessions
    let nemesis = store.one("SELECT integrity_pct, emotional_state, last_message FROM nemesis_state WHERE session_id=?", [sid]);

    // In coop il "solved" è globale su session_challenges.is_solved.
    // In competitive il "solved" globale va derivato dalle solve reali registrate in team_solutions.
    const solvedChallengeSet = new Set((solutions || []).map((s) => s.challenge_id));
    const isCoopSession = session.mode === 'coop';
    const totalSolved = isCoopSession
      ? (sessionChallenges || []).filter((c) => c.is_solved).length
      : solvedChallengeSet.size;

    // Competitive: per-team NEMESIS state, calculated from individual scores vs total possible
    let teamNemesis = null;
    if (session.mode === 'competitive' && sp && sp.length) {
      const totalPossiblePts = (sessionChallenges || []).reduce(
        (s, sc) => s + (sc.challenges?.base_points || 0), 0
      );
      teamNemesis = (sp || []).map((p) => {
        const score = p.score || 0;
        const integrityPct = totalPossiblePts > 0
          ? Math.max(0, Math.round(100 - (score / totalPossiblePts) * 100))
          : 100;
        const emotionalState =
          integrityPct >= 75 ? 'dominant'
          : integrityPct >= 50 ? 'vigilant'
          : integrityPct >= 25 ? 'alarmed'
          : integrityPct >= 10 ? 'under_attack'
          : 'defeated';
        return {
          user_id: p.user_id,
          team_name: p.users?.team_name || '—',
          color: p.users?.color || '#7a95b0',
          score,
          integrity_pct: integrityPct,
          emotional_state: emotionalState,
          challenges_solved: solvesByPlayer[p.user_id] || 0,
        };
      }).sort((a, b) => a.integrity_pct - b.integrity_pct); // leader (worst NEMESIS) first
    }

    return res.json({
      ok: true,
      session,
      scoreboard: (sp || []).map((p) => ({
        user_id: p.user_id,
        team_name: p.users?.team_name || '—',
        color: p.users?.color || '#7a95b0',
        score: p.score || 0,
        status: p.status,
        challenges_solved: solvesByPlayer[p.user_id] || 0,
        hints_used: hintsByPlayer[p.user_id] || 0,
      })),
      challenges: (sessionChallenges || []).map((sc) => ({
        id: sc.challenge_id,
        code: sc.challenges?.code || '',
        category: sc.challenges?.category || '',
        base_points: sc.challenges?.base_points || 0,
        is_solved: isCoopSession ? (sc.is_solved || false) : solvedChallengeSet.has(sc.challenge_id),
      })),
      events: (evts || []).map((e) => ({
        id: e.id,
        type: e.event_type,
        message: e.message,
        team_name: e.users?.team_name || null,
        team_color: e.users?.color || null,
        challenge_code: e.challenges?.code || null,
        new_integrity: e.new_integrity,
        created_at: e.created_at,
      })),
      total_solved: totalSolved,
      total_challenges: (sessionChallenges || []).length,
      nemesis: nemesis || { integrity_pct: 100, emotional_state: 'dominant', last_message: null },
      team_nemesis: teamNemesis,
      team_solved_challenges: solvedChallengesByPlayer,
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── POST /api/admin/logout ── */
app.post('/api/admin/logout', (_req, res) => {
  revokeToken(_req.cookies?.nemesis_token);
  res.clearCookie('nemesis_token', { path: '/' });
  return res.json({ ok: true });
});

/* ── GET /api/referent/state ── (vista spettatore per utenti referente) */
app.get('/api/referent/state', authMiddleware, (req, res) => {
  if (req.auth.role !== 'referente' || !req.auth.sessionId) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
  }
  const sid = req.auth.sessionId;
  try {
    const session = store.one("SELECT id, name, mode, duration_mins, status, started_at, ended_at FROM game_sessions WHERE id=?", [sid]);

    if (!session) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

    const sp = store.all("SELECT user_id, score, status, (SELECT json_object('team_name', r.team_name, 'color', r.color, 'role', r.role) FROM users r WHERE r.id=session_players.user_id) AS users FROM session_players WHERE session_id=? AND user_id IN (SELECT id FROM users WHERE role='player') ORDER BY score DESC, user_id", [sid], ["users"]);

    // Filtra i referenti dallo scoreboard
    const spPlayers = (sp || []).filter((p) => p.users?.role !== 'referente');

    const solutions = store.all("SELECT user_id, challenge_id FROM team_solutions WHERE session_id=?", [sid]);

    const hintRows = store.all("SELECT user_id FROM hint_usage WHERE session_id=?", [sid]);

    const solvesByPlayer = {};
    const solvedChallengesByPlayer = {};
    for (const s of solutions || []) {
      solvesByPlayer[s.user_id] = (solvesByPlayer[s.user_id] || 0) + 1;
      if (!solvedChallengesByPlayer[s.user_id]) solvedChallengesByPlayer[s.user_id] = [];
      solvedChallengesByPlayer[s.user_id].push(s.challenge_id);
    }
    const hintsByPlayer = {};
    for (const h of hintRows || []) {
      hintsByPlayer[h.user_id] = (hintsByPlayer[h.user_id] || 0) + 1;
    }
    const solvedChallengeSet = new Set((solutions || []).map((s) => s.challenge_id));

    const sessionChallenges = store.all("SELECT challenge_id, is_solved, (SELECT json_object('code', r.code, 'category', r.category, 'base_points', r.base_points) FROM challenges r WHERE r.id=session_challenges.challenge_id) AS challenges FROM session_challenges WHERE session_id=?", [sid], ["challenges"]);

    const evts = store.all("SELECT id, event_type, message, new_integrity, created_at, (SELECT json_object('team_name', r.team_name, 'color', r.color) FROM users r WHERE r.id=nemesis_log.trigger_user_id) AS users, (SELECT json_object('code', r.code, 'title', r.title) FROM challenges r WHERE r.id=nemesis_log.trigger_ch_id) AS challenges FROM nemesis_log WHERE session_id=? ORDER BY created_at DESC LIMIT 20", [sid], ["users", "challenges"]);

    // Tentativi errati per player (is_correct = false)
    const failedAttempts = store.all("SELECT user_id FROM flag_attempts WHERE session_id=? AND is_correct=?", [sid, false]);

    const failedByPlayer = {};
    for (const f of failedAttempts || []) {
      failedByPlayer[f.user_id] = (failedByPlayer[f.user_id] || 0) + 1;
    }

    let nemesis = store.one("SELECT integrity_pct, emotional_state, last_message FROM nemesis_state WHERE session_id=?", [sid]);

    const isCoopSession = session.mode === 'coop';
    const totalSolved = isCoopSession
      ? (sessionChallenges || []).filter((c) => c.is_solved).length
      : solvedChallengeSet.size;

    let teamNemesis = null;
    if (session.mode === 'competitive' && spPlayers.length) {
      const totalPossiblePts = (sessionChallenges || []).reduce(
        (s, sc) => s + (sc.challenges?.base_points || 0), 0
      );
      teamNemesis = spPlayers.map((p) => {
        const score = p.score || 0;
        const integrityPct = totalPossiblePts > 0
          ? Math.max(0, Math.round(100 - (score / totalPossiblePts) * 100))
          : 100;
        const emotionalState =
          integrityPct >= 75 ? 'dominant'
          : integrityPct >= 50 ? 'vigilant'
          : integrityPct >= 25 ? 'alarmed'
          : integrityPct >= 10 ? 'under_attack'
          : 'defeated';
        return {
          user_id: p.user_id,
          team_name: p.users?.team_name || '—',
          color: p.users?.color || '#7a95b0',
          score,
          integrity_pct: integrityPct,
          emotional_state: emotionalState,
          challenges_solved: solvesByPlayer[p.user_id] || 0,
        };
      }).sort((a, b) => a.integrity_pct - b.integrity_pct);
    }

    return res.json({
      ok: true,
      session,
      scoreboard: spPlayers.map((p) => ({
        user_id: p.user_id,
        team_name: p.users?.team_name || '—',
        color: p.users?.color || '#7a95b0',
        score: p.score || 0,
        status: p.status,
        challenges_solved: solvesByPlayer[p.user_id] || 0,
        hints_used: hintsByPlayer[p.user_id] || 0,
        failed_attempts: failedByPlayer[p.user_id] || 0,
      })),
      challenges: (sessionChallenges || []).map((sc) => ({
        id: sc.challenge_id,
        code: sc.challenges?.code || '',
        category: sc.challenges?.category || '',
        base_points: sc.challenges?.base_points || 0,
        is_solved: isCoopSession ? (sc.is_solved || false) : solvedChallengeSet.has(sc.challenge_id),
      })),
      events: (evts || []).map((e) => ({
        id: e.id,
        type: e.event_type,
        message: e.message,
        team_name: e.users?.team_name || null,
        team_color: e.users?.color || null,
        challenge_code: e.challenges?.code || null,
        new_integrity: e.new_integrity,
        created_at: e.created_at,
      })),
      total_solved: totalSolved,
      total_challenges: (sessionChallenges || []).length,
      nemesis: nemesis || { integrity_pct: 100, emotional_state: 'dominant', last_message: null },
      team_nemesis: teamNemesis,
      team_solved_challenges: solvedChallengesByPlayer,
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── POST /api/admin/users ── */
app.post('/api/admin/users', authMiddleware, adminGuard, async (req, res) => {
  const team_name = String(req.body?.team_name || '').trim();
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const colorRaw = String(req.body?.color || '').trim();
  const color = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : '#d86e33';
  const role = req.body?.role === 'referente' ? 'referente' : 'player';

  if (!team_name || !username || !password) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD' });
  }

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const data = store.insert("users", {
        team_name,
        username,
        password_hash,
        color,
        role,
      }, "id, team_name, username, color, role, created_at");

    return res.status(201).json({ ok: true, user: data });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── PATCH /api/admin/users/:id ── */
app.patch('/api/admin/users/:id', authMiddleware, adminGuard, async (req, res) => {
  const uid = Number(req.params.id);
  if (!Number.isInteger(uid) || uid <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  }

  const patch = {};
  if (typeof req.body?.team_name === 'string' && req.body.team_name.trim()) {
    patch.team_name = req.body.team_name.trim();
  }
  if (typeof req.body?.username === 'string' && req.body.username.trim()) {
    patch.username = req.body.username.trim();
  }
  if (typeof req.body?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(req.body.color)) {
    patch.color = req.body.color;
  }
  if (typeof req.body?.password === 'string' && req.body.password.length > 0) {
    patch.password_hash = await bcrypt.hash(req.body.password, 12);
  }
  if (req.body?.role === 'referente' || req.body?.role === 'player') {
    patch.role = req.body.role;
  }

  if (!Object.keys(patch).length) {
    return res.status(400).json({ ok: false, error: 'EMPTY_PATCH' });
  }

  try {
    const data = store.update("users", patch, " WHERE id=?", [uid], "id, team_name, username, color, role, created_at");

    if (!data) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, user: data });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── DELETE /api/admin/users/:id ── */
app.delete('/api/admin/users/:id', authMiddleware, adminGuard, (req, res) => {
  const uid = Number(req.params.id);
  if (!Number.isInteger(uid) || uid <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  }

  try {
    const data = store.one("DELETE FROM users WHERE id=? RETURNING id", [uid]);

    if (!data) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, deleted_id: uid });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── POST /api/admin/sessions ── */
app.post('/api/admin/sessions', authMiddleware, adminGuard, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const mode = req.body?.mode === 'competitive' ? 'competitive' : 'coop';
  const duration_mins = Number(req.body?.duration_mins || 90);
  const admin_notes = String(req.body?.admin_notes || '').trim() || null;
  const user_ids = Array.isArray(req.body?.user_ids)
    ? [...new Set(req.body.user_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
  const VALID_CATEGORIES = catalogCategories;
  // categories: array of category strings, or omitted / null → all categories
  const rawCats = req.body?.categories;
  const categories = Array.isArray(rawCats)
    ? rawCats.map((c) => String(c).toUpperCase()).filter((c) => VALID_CATEGORIES.includes(c))
    : null; // null = all categories
  if (categories !== null && categories.length === 0) {
    return res.status(400).json({ ok: false, error: 'NO_VALID_CATEGORIES' });
  }
  const selectedChallengeIds = Array.isArray(req.body?.challenge_ids)
    ? [...new Set(req.body.challenge_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  if (!name || !Number.isInteger(duration_mins) || duration_mins <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD' });
  }

  try {
    const pickedChallenges = store.all('SELECT id, category FROM challenges WHERE is_active = 1')
      .filter(ch => selectedChallengeIds.length ? selectedChallengeIds.includes(ch.id) : !categories || categories.includes(ch.category));
    if (!pickedChallenges || !pickedChallenges.length) {
      return res.status(400).json({ ok: false, error: 'NO_CHALLENGES_SELECTED' });
    }

    const game_code = normCode(req.body?.game_code) || (buildUniqueGameCode());
    if (game_code === ADMIN_SESSION_CODE) return res.status(409).json({ok:false,error:'GAME_CODE_ALREADY_EXISTS'});
    const created = store.insert("game_sessions", {
        name,
        game_code,
        mode,
        duration_mins,
        admin_notes,
      }, "id, name, game_code, mode, duration_mins, status, created_at");

    {
      const challengeRows = pickedChallenges.map((c) => ({
        session_id: created.id,
        challenge_id: c.id,
      }));
      if (challengeRows.length) {
        store.insert("session_challenges", challengeRows, "");

      }
    }

    store.insert("nemesis_state", {
        session_id: created.id,
        integrity_pct: 100,
        emotional_state: 'dominant',
      }, "");

    if (user_ids.length) {
      const playerRows = user_ids.map((uid) => ({
        session_id: created.id,
        user_id: uid,
        status: 'offline',
      }));
      store.insert("session_players", playerRows, "");

    }

    return res.status(201).json({ ok: true, session: created });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── PATCH /api/admin/sessions/:id ── */
app.patch('/api/admin/sessions/:id', authMiddleware, adminGuard, (req, res) => {
  const sid = parseSessionId(req.params.id);
  if (!sid) return res.status(400).json({ ok: false, error: 'INVALID_ID' });

  const patch = {};
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    patch.name = req.body.name.trim();
  }
  if (typeof req.body?.game_code === 'string' && req.body.game_code.trim()) {
    patch.game_code = normCode(req.body.game_code);
    if(patch.game_code===ADMIN_SESSION_CODE) return res.status(409).json({ok:false,error:'GAME_CODE_ALREADY_EXISTS'});
  }
  if (req.body?.mode === 'coop' || req.body?.mode === 'competitive') {
    patch.mode = req.body.mode;
  }
  if (Number.isInteger(req.body?.duration_mins) && req.body.duration_mins > 0) {
    patch.duration_mins = req.body.duration_mins;
  }
  if (typeof req.body?.admin_notes === 'string') {
    patch.admin_notes = req.body.admin_notes.trim() || null;
  }
  if (req.body?.status && ['pending', 'active', 'paused', 'ended'].includes(req.body.status)) {
    patch.status = req.body.status;
  }
  const hasUserIds = Array.isArray(req.body?.user_ids);
  const user_ids = hasUserIds
    ? [...new Set(req.body.user_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  if (!Object.keys(patch).length && !hasUserIds) {
    return res.status(400).json({ ok: false, error: 'EMPTY_PATCH' });
  }

  try {
    if (patch.status === 'active' && !patch.started_at) patch.started_at = new Date().toISOString();
    if (patch.status === 'ended' && !patch.ended_at) patch.ended_at = new Date().toISOString();
    if (patch.status === 'pending') {
      patch.started_at = null;
      patch.ended_at = null;
    }

    let data = null;
    if (Object.keys(patch).length) {
      const updated = store.update("game_sessions", patch, " WHERE id=?", [sid], "id, name, game_code, mode, duration_mins, status, started_at, ended_at, updated_at");
      data = updated;
    } else {
      const existing = store.one("SELECT id, name, game_code, mode, duration_mins, status, started_at, ended_at, updated_at FROM game_sessions WHERE id=?", [sid]);

      data = existing;
    }

    if (!data) return res.status(404).json({ok:false,error:"NOT_FOUND"});
    if (hasUserIds) {
      store.run('DELETE FROM session_players WHERE session_id=? AND user_id NOT IN (SELECT value FROM json_each(?))', [sid,JSON.stringify(user_ids)]);
      const assigned = new Set(store.all('SELECT user_id FROM session_players WHERE session_id=?', [sid]).map(p => p.user_id));
      const rows = user_ids.filter(uid => !assigned.has(uid)).map(user_id => ({session_id:sid, user_id, status:'offline'}));
      if (rows.length) {
        store.insert("session_players", rows, "");

      }
    }

    if (!data) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, session: data });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── POST /api/admin/sessions/:id/start ── */
app.post('/api/admin/sessions/:id/start', authMiddleware, adminGuard, (req, res) => {
  const sid = parseSessionId(req.params.id);
  if (!sid) return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  try {
    const now = new Date().toISOString();
    const data = store.update("game_sessions", {
        status: 'active',
        started_at: now,
        ended_at: null,
      }, " WHERE id=?", [sid], "id, status, started_at, ended_at");

    if (!data) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, session: data });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── POST /api/admin/sessions/:id/terminate ── */
app.post('/api/admin/sessions/:id/terminate', authMiddleware, adminGuard, (req, res) => {
  const sid = parseSessionId(req.params.id);
  if (!sid) return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  try {
    const now = new Date().toISOString();
    const data = store.update("game_sessions", {
        status: 'ended',
        ended_at: now,
      }, " WHERE id=?", [sid], "id, status, started_at, ended_at");

    if (!data) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, session: data });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── DELETE /api/admin/sessions/:id ── */
app.delete('/api/admin/sessions/:id', authMiddleware, adminGuard, (req, res) => {
  const sid = parseSessionId(req.params.id);
  if (!sid) return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  try {
    const data = store.one("DELETE FROM game_sessions WHERE id=? RETURNING id", [sid]);

    if (!data) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    return res.json({ ok: true, deleted_id: sid });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── PLAYER GUARD ── */
function playerGuard(req, res, next) {
  if (!req.auth || req.auth.role !== 'player' || !req.auth.sessionId) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
  }
  return next();
}

function livePlayer(req,res,next) {
  const row = store.one('SELECT g.status, g.started_at, g.duration_mins, p.status AS player_status FROM session_players p JOIN game_sessions g ON g.id=p.session_id WHERE g.id=? AND p.user_id=?',[req.auth.sessionId,req.auth.sub]);
  if (!row || row.status !== 'active' || ['completed','lost'].includes(row.player_status))
    return res.status(403).json({ok:false,error:'SESSION_NOT_ACTIVE'});
  if (Date.now() >= Date.parse(row.started_at) + row.duration_mins * 60000)
    return res.status(403).json({ok:false,error:'TIME_EXPIRED'});
  return next();
}

/* ── GET /api/game/state ── */
app.get('/api/game/state', authMiddleware, playerGuard, (req, res) => {
  const sessionId = req.auth.sessionId;
  const userId = req.auth.sub;
  try {
    const session = store.one("SELECT id, name, mode, duration_mins, status, started_at, ended_at FROM game_sessions WHERE id=?", [sessionId]);

    if (!session) return res.status(404).json({ ok: false, error: 'SESSION_NOT_FOUND' });

    const sp = store.one("SELECT score, status, (SELECT json_object('team_name', r.team_name, 'color', r.color, 'username', r.username) FROM users r WHERE r.id=session_players.user_id) AS users FROM session_players WHERE session_id=? AND user_id=?", [sessionId, userId], ["users"]);

    // If the player already completed all challenges, gate the full game state.
    // Only update last_seen so presence metrics stay meaningful; return a lightweight signal.
    if (sp?.status === 'completed') {
      store.update("session_players", { last_seen_at: new Date().toISOString() }, " WHERE session_id=? AND user_id=?", [sessionId, userId], "");
      return res.json({ ok: true, completed: true });
    }
    if (sp?.status === 'lost') {
      store.update("session_players", { last_seen_at: new Date().toISOString() }, " WHERE session_id=? AND user_id=?", [sessionId, userId], "");
      return res.json({ ok: true, lost: true });
    }

    const newStatus =
      session.status === 'active' ? 'playing'
      : session.status === 'pending' ? 'lobby'
      : sp?.status || 'offline';
    store.update("session_players", { status: newStatus, last_seen_at: new Date().toISOString() }, " WHERE session_id=? AND user_id=?", [sessionId, userId], "");

    if (session.status !== 'active') return res.json({ok:true,session,challenges:[]});
    if (Date.now() >= Date.parse(session.started_at) + session.duration_mins * 60000) {
      store.update('session_players',{status:'lost'},' WHERE session_id=? AND user_id=?',[sessionId,userId]);
      return res.json({ok:true,lost:true});
    }
    const sc = store.all("SELECT challenge_id, is_solved, solved_at, solved_by_team, (SELECT json_object('id', r.id, 'code', r.code, 'title', r.title, 'category', r.category, 'difficulty', r.difficulty, 'base_points', r.base_points, 'description', r.description, 'terminal_block', r.terminal_block, 'attachment_path', r.attachment_path, 'attachment_name', r.attachment_name, 'hint1_text', r.hint1_text, 'hint2_text', r.hint2_text, 'hint3_text', r.hint3_text) FROM challenges r WHERE r.id=session_challenges.challenge_id) AS challenges FROM session_challenges WHERE session_id=? ORDER BY challenge_id", [sessionId], ["challenges"]);

    const mySols = store.all("SELECT challenge_id FROM team_solutions WHERE session_id=? AND user_id=?", [sessionId, userId]);
    const mySolvedSet = new Set((mySols || []).map((s) => s.challenge_id));

    const myHints = store.all("SELECT challenge_id, hint_number FROM hint_usage WHERE session_id=? AND user_id=?", [sessionId, userId]);
    const hintsByChallenge = {};
    for (const h of myHints || []) {
      (hintsByChallenge[h.challenge_id] = hintsByChallenge[h.challenge_id] || []).push(h.hint_number);
    }

    const isCoop = session.mode === 'coop';
    const challenges = (sc || []).map(({ is_solved, challenges: ch }) => {
      const used = hintsByChallenge[ch.id] || [];
      const solved = isCoop ? is_solved : mySolvedSet.has(ch.id);
      return {
        id: ch.id,
        code: ch.code,
        title: ch.title,
        category: ch.category,
        difficulty: ch.difficulty,
        base_points: ch.base_points,
        description: ch.description,
        terminal_block: ch.terminal_block || null,
        has_attachment: !!(ch.attachment_path),
        attachment_name: ch.attachment_name || null,
        hint1_text: used.includes(1) ? ch.hint1_text : null,
        hint2_text: used.includes(2) ? ch.hint2_text : null,
        hint3_text: used.includes(3) ? ch.hint3_text : null,
        is_solved: solved,
        hints_used: used,
      };
    });

    const sbData = store.all("SELECT user_id, score, status, (SELECT json_object('team_name', r.team_name, 'color', r.color) FROM users r WHERE r.id=session_players.user_id) AS users FROM session_players WHERE session_id=? AND user_id IN (SELECT id FROM users WHERE role='player') ORDER BY score DESC, user_id", [sessionId], ["users"]);

    const allSols = store.all("SELECT user_id, challenge_id FROM team_solutions WHERE session_id=?", [sessionId]);
    const solCount = {};
    for (const s of allSols || []) {
      solCount[s.user_id] = (solCount[s.user_id] || 0) + 1;
    }

    const nem = store.one("SELECT integrity_pct, emotional_state, last_message FROM nemesis_state WHERE session_id=?", [sessionId]);

    // In competitive il Nemesis globale riflette il leader (usato dall'admin).
    // Il player deve vedere invece il SUO Nemesis, calcolato dal proprio punteggio.
    let playerNemesis = nem || { integrity_pct: 100, emotional_state: 'dominant', last_message: null };
    if (!isCoop && sp) {
      const totalPossiblePts = (sc || []).reduce(
        (sum, row) => sum + (row.challenges?.base_points || 0), 0
      );
      const myScore = Number(sp.score || 0);
      const myIntegrity = totalPossiblePts > 0
        ? Math.max(0, Math.round(100 - (myScore / totalPossiblePts) * 100))
        : 100;
      const myEmotional =
        myIntegrity >= 75 ? 'dominant'
        : myIntegrity >= 50 ? 'vigilant'
        : myIntegrity >= 25 ? 'alarmed'
        : myIntegrity >= 10 ? 'under_attack'
        : 'defeated';
      playerNemesis = {
        integrity_pct: myIntegrity,
        emotional_state: myEmotional,
        last_message: nem?.last_message || null,
      };
    }

    const evts = store.all("SELECT id, event_type, message, new_integrity, created_at, (SELECT json_object('team_name', r.team_name, 'color', r.color) FROM users r WHERE r.id=nemesis_log.trigger_user_id) AS users, (SELECT json_object('code', r.code, 'title', r.title) FROM challenges r WHERE r.id=nemesis_log.trigger_ch_id) AS challenges FROM nemesis_log WHERE session_id=? ORDER BY created_at DESC LIMIT 20", [sessionId], ["users", "challenges"]);

    return res.json({
      ok: true,
      session,
      me: sp
        ? { user_id: userId, team_name: sp.users?.team_name || '', color: sp.users?.color || '#d86e33', score: sp.score || 0 }
        : null,
      challenges,
      total_challenges: challenges.length,
      scoreboard: (sbData || []).map((p, i) => ({
        rank: i + 1,
        user_id: p.user_id,
        team_name: p.users?.team_name || '',
        color: p.users?.color || '#d86e33',
        score: p.score || 0,
        challenges_solved: solCount[p.user_id] || 0,
      })),
      nemesis: playerNemesis,
      events: (evts || []).map((e) => ({
        id: e.id,
        type: e.event_type,
        message: e.message,
        team_name: e.users?.team_name || null,
        team_color: e.users?.color || null,
        challenge_code: e.challenges?.code || null,
        new_integrity: e.new_integrity,
        created_at: e.created_at,
      })),
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── POST /api/game/submit-flag ── */
app.post('/api/game/submit-flag', authMiddleware, playerGuard, livePlayer, (req, res) => {
  const sessionId = req.auth.sessionId;
  const userId = req.auth.sub;
  const challengeId = Number(req.body?.challenge_id);
  const flagValue = String(req.body?.flag || '').trim();

  if (!Number.isInteger(challengeId) || challengeId <= 0 || !flagValue) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD' });
  }
  try {
    const session = store.one("SELECT id, mode, status FROM game_sessions WHERE id=?", [sessionId]);
    if (!session || session.status !== 'active') {
      return res.status(403).json({ ok: false, error: 'SESSION_NOT_ACTIVE' });
    }

    const sc = store.one("SELECT challenge_id, is_solved, (SELECT json_object('id', r.id, 'code', r.code, 'base_points', r.base_points, 'flag_hash', r.flag_hash) FROM challenges r WHERE r.id=session_challenges.challenge_id) AS challenges FROM session_challenges WHERE session_id=? AND challenge_id=?", [sessionId, challengeId], ["challenges"]);
    if (!sc) return res.status(404).json({ ok: false, error: 'CHALLENGE_NOT_FOUND' });

    // Rate limit: 10 attempts per challenge per 60s
    const since60s = new Date(Date.now() - 60000).toISOString();
    const attemptCount = store.one("SELECT COUNT(*) AS n FROM flag_attempts WHERE session_id=? AND user_id=? AND challenge_id=? AND attempted_at>?", [sessionId, userId, challengeId, since60s]).n;
    if (attemptCount >= 10) {
      return res.status(429).json({ ok: false, error: 'RATE_LIMIT' });
    }

    const isCoop = session.mode === 'coop';
    if (isCoop && sc.is_solved) {
      return res.json({ ok: true, correct: false, already_solved: true });
    }
    if (!isCoop) {
      const existing = store.one("SELECT id FROM team_solutions WHERE session_id=? AND user_id=? AND challenge_id=?", [sessionId, userId, challengeId]);
      if (existing) return res.json({ ok: true, correct: false, already_solved: true });
    }

    const submittedHash = crypto.createHash('sha256').update(flagValue).digest('hex');

    store.insert("flag_attempts", {
      session_id: sessionId,
      user_id: userId,
      challenge_id: challengeId,
      submitted_hash: submittedHash,
      is_correct: submittedHash === sc.challenges.flag_hash,
    }, "");

    if (submittedHash !== sc.challenges.flag_hash) {
      // Conteggio tentativi errati per determinare streak (escluso quello appena inserito)
      const wrongCount = store.one("SELECT COUNT(*) AS n FROM flag_attempts WHERE session_id=? AND user_id=? AND challenge_id=? AND is_correct=?", [sessionId, userId, challengeId, false]).n;
      const isStreak = (wrongCount || 0) >= 2;
      const nemForWrong = store.one("SELECT emotional_state FROM nemesis_state WHERE session_id=?", [sessionId]);
      const playerForWrong = store.one("SELECT (SELECT json_object('team_name', r.team_name) FROM users r WHERE r.id=session_players.user_id) AS users FROM session_players WHERE session_id=? AND user_id=?", [sessionId, userId], ["users"]);
      const wrongPhrase = nemWrongPhrase(
        nemForWrong?.emotional_state || 'dominant',
        isStreak,
        {
          team: playerForWrong?.users?.team_name || 'Squadra',
          challengeCode: sc.challenges?.code || `CH-${challengeId}`,
        }
      );
      return res.json({
        ok: true,
        correct: false,
        nemesis_message: wrongPhrase,
        nemesis_kind: isStreak ? 'wrong_streak' : 'wrong',
      });
    }

    const pts = sc.challenges.base_points;
    store.insert("team_solutions", {
      session_id: sessionId,
      user_id: userId,
      challenge_id: challengeId,
      points_awarded: pts,
    }, "");

    const playerRow = store.one("SELECT score, (SELECT json_object('team_name', r.team_name) FROM users r WHERE r.id=session_players.user_id) AS users FROM session_players WHERE session_id=? AND user_id=?", [sessionId, userId], ["users"]);
    const newScore = (playerRow?.score || 0) + pts;
    store.update("session_players", { score: newScore }, " WHERE session_id=? AND user_id=?", [sessionId, userId], "");

    if (isCoop) {
      store.update("session_challenges", { is_solved: true, solved_at: new Date().toISOString(), solved_by_team: userId }, " WHERE session_id=? AND challenge_id=?", [sessionId, challengeId], "");
    }

    // Damage NEMESIS
    const nem = store.one("SELECT integrity_pct, emotional_state FROM nemesis_state WHERE session_id=?", [sessionId]);
    if (nem) {
      // Fetch session challenge totals (needed by both modes)
      const scForIntegrity = store.all("SELECT (SELECT json_object('base_points', r.base_points) FROM challenges r WHERE r.id=session_challenges.challenge_id) AS challenges, is_solved FROM session_challenges WHERE session_id=?", [sessionId], ["challenges"]);

      const totalPossiblePts = (scForIntegrity || []).reduce(
        (sum, row) => sum + (row.challenges?.base_points || 0), 0
      );

      let newIntegrity = Math.max(0, Number(nem.integrity_pct) || 0);
      if (isCoop) {
        // Proportional: integrity = 100 - (earnedPts / totalSessionPts * 100)
        // is_solved was already updated above for this challenge, so the count is current
        const earnedPts = (scForIntegrity || []).reduce(
          (sum, row) => sum + (row.is_solved ? (row.challenges?.base_points || 0) : 0), 0
        );
        newIntegrity = totalPossiblePts > 0
          ? Math.max(0, Math.round(100 - (earnedPts / totalPossiblePts) * 100))
          : 100;
      } else {
        const leaderRow = store.one("SELECT score FROM session_players WHERE session_id=? AND user_id IN (SELECT id FROM users WHERE role='player') ORDER BY score DESC, user_id LIMIT 1", [sessionId]);

        const leaderScore = Number(leaderRow?.score || 0);
        newIntegrity = totalPossiblePts > 0
          ? Math.max(0, Math.round(100 - (leaderScore / totalPossiblePts) * 100))
          : 100;
      }
      const newEmotional =
        newIntegrity >= 75 ? 'dominant'
        : newIntegrity >= 50 ? 'vigilant'
        : newIntegrity >= 25 ? 'alarmed'
        : newIntegrity >= 10 ? 'under_attack'
        : 'defeated';
      const flagPhrase = nemFlagPhraseByState(newEmotional, {
        team: playerRow?.users?.team_name || 'Squadra',
        challengeCode: sc.challenges?.code || `CH-${challengeId}`,
      });
      store.update("nemesis_state", { integrity_pct: newIntegrity, emotional_state: newEmotional, last_message: flagPhrase, updated_at: new Date().toISOString() }, " WHERE session_id=?", [sessionId], "");
      store.insert("nemesis_log", {
        session_id: sessionId,
        event_type: 'flag_captured',
        trigger_user_id: userId,
        trigger_ch_id: challengeId,
        prev_integrity: nem.integrity_pct,
        new_integrity: newIntegrity,
        prev_state: nem.emotional_state || 'dominant',
        new_state: newEmotional,
        message: flagPhrase,
      }, "");
    }

    // Check if the player has now solved every challenge in this session
    let allSolved = false;
    if (isCoop) {
      const unsolved = store.one("SELECT COUNT(*) AS n FROM session_challenges WHERE session_id=? AND is_solved=?", [sessionId, false]).n;
      allSolved = (unsolved || 0) === 0;
      if (allSolved) {
        // Mark all coop players as completed
        store.run("UPDATE session_players SET status='completed' WHERE session_id=? AND user_id IN (SELECT id FROM users WHERE role='player')",[sessionId]);
      }
    } else {
      const totalChal = store.one("SELECT COUNT(*) AS n FROM session_challenges WHERE session_id=?", [sessionId]).n;
      const mySolved = store.one("SELECT COUNT(*) AS n FROM team_solutions WHERE session_id=? AND user_id=?", [sessionId, userId]).n;
      allSolved = (totalChal || 0) > 0 && (mySolved || 0) >= (totalChal || 0);
      if (allSolved) {
        store.update("session_players", { status: 'completed' }, " WHERE session_id=? AND user_id=?", [sessionId, userId], "");
      }
    }

    return res.json({ ok: true, correct: true, score: newScore, all_solved: allSolved });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── POST /api/game/time-expired ── */
app.post('/api/game/time-expired', authMiddleware, playerGuard, (req, res) => {
  const sessionId = req.auth.sessionId;
  const userId = req.auth.sub;
  try {
    const sp = store.one("SELECT status FROM session_players WHERE session_id=? AND user_id=?", [sessionId, userId]);
    const session = store.one('SELECT started_at,duration_mins,status FROM game_sessions WHERE id=?',[sessionId]);
    if (session?.status !== 'active' || Date.now() < Date.parse(session.started_at) + session.duration_mins * 60000)
      return res.status(409).json({ok:false,error:'TIME_REMAINING'});
    if (sp?.status === 'completed') {
      return res.json({ ok: true, already_completed: true });
    }
    if (sp?.status === 'lost') {
      return res.json({ ok: true });
    }
    store.update("session_players", { status: 'lost', last_seen_at: new Date().toISOString() }, " WHERE session_id=? AND user_id=?", [sessionId, userId], "");
    return res.json({ ok: true });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── POST /api/game/hint ── */
app.post('/api/game/hint', authMiddleware, playerGuard, livePlayer, (req, res) => {
  const sessionId = req.auth.sessionId;
  const userId = req.auth.sub;
  const challengeId = Number(req.body?.challenge_id);
  const hintNum = Number(req.body?.hint_number);

  if (!Number.isInteger(challengeId) || challengeId <= 0 || ![1, 2, 3].includes(hintNum)) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD' });
  }
  try {
    const session = store.one("SELECT id, mode, status FROM game_sessions WHERE id=?", [sessionId]);
    if (!session || session.status !== 'active') {
      return res.status(403).json({ ok: false, error: 'SESSION_NOT_ACTIVE' });
    }

    const sc = store.one("SELECT challenge_id, (SELECT json_object('code', r.code, 'hint1_text', r.hint1_text, 'hint2_text', r.hint2_text, 'hint3_text', r.hint3_text) FROM challenges r WHERE r.id=session_challenges.challenge_id) AS challenges FROM session_challenges WHERE session_id=? AND challenge_id=?", [sessionId, challengeId], ["challenges"]);
    if (!sc) return res.status(404).json({ ok: false, error: 'CHALLENGE_NOT_FOUND' });

    const existingHints = store.all("SELECT hint_number FROM hint_usage WHERE session_id=? AND user_id=? AND challenge_id=?", [sessionId, userId, challengeId]);
    const usedNums = (existingHints || []).map((h) => h.hint_number);

    if (usedNums.includes(hintNum)) {
      return res.json({ ok: true, hint_text: sc.challenges[`hint${hintNum}_text`], already_used: true });
    }
    if (hintNum === 2 && !usedNums.includes(1)) {
      return res.status(400).json({ ok: false, error: 'HINT_LOCKED' });
    }
    if (hintNum === 3 && !usedNums.includes(2)) {
      return res.status(400).json({ ok: false, error: 'HINT_LOCKED' });
    }

    const costs = [1, 1, 2];
    const cost = costs[hintNum - 1];

    const player = store.one("SELECT score, (SELECT json_object('team_name', r.team_name) FROM users r WHERE r.id=session_players.user_id) AS users FROM session_players WHERE session_id=? AND user_id=?", [sessionId, userId], ["users"]);
    const newScore = Math.max(0, (player?.score || 0) - cost);
    store.update("session_players", { score: newScore }, " WHERE session_id=? AND user_id=?", [sessionId, userId], "");

    store.insert("hint_usage", {
      session_id: sessionId,
      user_id: userId,
      challenge_id: challengeId,
      hint_number: hintNum,
      cost_points: cost,
    }, "");
    let updatedNemesis = null;
    const nem = store.one("SELECT integrity_pct, emotional_state FROM nemesis_state WHERE session_id=?", [sessionId]);
    if (nem) {
      let newIntegrity = Math.max(0, Number(nem.integrity_pct) || 0);
      if (session.mode === 'coop') {
        const heal = Math.round(cost / 1.5);
        newIntegrity = Math.min(100, newIntegrity + heal);
      } else {
        const scForIntegrity = store.all("SELECT (SELECT json_object('base_points', r.base_points) FROM challenges r WHERE r.id=session_challenges.challenge_id) AS challenges FROM session_challenges WHERE session_id=?", [sessionId], ["challenges"]);

        const totalPossiblePts = (scForIntegrity || []).reduce(
          (sum, row) => sum + (row.challenges?.base_points || 0),
          0
        );
        const leaderRow = store.one("SELECT score FROM session_players WHERE session_id=? AND user_id IN (SELECT id FROM users WHERE role='player') ORDER BY score DESC, user_id LIMIT 1", [sessionId]);

        const leaderScore = Number(leaderRow?.score || 0);
        newIntegrity = totalPossiblePts > 0
          ? Math.max(0, Math.round(100 - (leaderScore / totalPossiblePts) * 100))
          : 100;
      }
      const newEmotional =
        newIntegrity >= 75 ? 'dominant'
        : newIntegrity >= 50 ? 'vigilant'
        : newIntegrity >= 25 ? 'alarmed'
        : newIntegrity >= 10 ? 'under_attack'
        : 'defeated';
      const hintPhrase = nemResolvePhrase(nemRandPhrase(NEM_PHRASES_HINT), {
        team: player?.users?.team_name || 'Squadra',
        challengeCode: sc.challenges?.code || `CH-${challengeId}`,
      });
      store.update("nemesis_state", { integrity_pct: newIntegrity, emotional_state: newEmotional, last_message: hintPhrase, updated_at: new Date().toISOString() }, " WHERE session_id=?", [sessionId], "");
      store.insert("nemesis_log", {
        session_id: sessionId,
        event_type: 'hint_used',
        trigger_user_id: userId,
        trigger_ch_id: challengeId,
        prev_integrity: nem.integrity_pct,
        new_integrity: newIntegrity,
        prev_state: nem.emotional_state || 'dominant',
        new_state: newEmotional,
        message: hintPhrase,
      }, "");
      updatedNemesis = {
        integrity_pct: newIntegrity,
        emotional_state: newEmotional,
      };
    }

    return res.json({
      ok: true,
      hint_text: sc.challenges[`hint${hintNum}_text`],
      score: newScore,
      nemesis: updatedNemesis,
    });
  } catch (e) {
    return databaseFailure(res,e);
  }
});

/* ── GET /api/game/attachment/:challenge_id ── */
app.get('/api/game/attachment/:challenge_id', authMiddleware, playerGuard, livePlayer, (req, res) => {
  const challengeId = Number(req.params.challenge_id);
  if (!Number.isInteger(challengeId) || challengeId <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  }
  try {
    const assigned = store.one('SELECT id FROM session_challenges WHERE session_id=? AND challenge_id=?', [req.auth.sessionId, challengeId]);
    if (!assigned) return res.status(404).json({ ok:false, error:'NOT_FOUND' });
    const ch = store.one("SELECT attachment_path, attachment_name FROM challenges WHERE id=?", [challengeId]);
    if (!ch?.attachment_path) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    const filePath = path.join(attachmentsDir, ch.attachment_path);
    return res.attachment(filePath, ch.attachment_name || path.basename(ch.attachment_path));
  } catch (e) {
    return databaseFailure(res,e);
  }
});

app.get('/api/health', (_req, res) => {
  try {
    store.one('SELECT id FROM admin LIMIT 1');

    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.listen(PORT, () => {
  console.log(`Escalation CTF http://localhost:${PORT}`);
  console.log(`Login: http://localhost:${PORT}/login.html`);
});
