/* ============================================================
   NEMESIS PRESET UNICO
   Modifica questo file per cambiare tono/aspetto/fasi in tutto il frontend.
   ============================================================ */
(function () {
  function buildPool(intros, taunts, minSize) {
    const out = [];
    for (let i = 0; i < intros.length; i++) {
      for (let k = 0; k < taunts.length; k++) {
        out.push(`${intros[i]} ${taunts[k]}`);
      }
    }
    return out.slice(0, Math.max(minSize || 50, 50));
  }

  function sprinkleQuotes(pool, quotes, maxRatio) {
    if (!pool || !pool.length || !quotes || !quotes.length) return pool || [];
    const out = pool.slice();
    const maxQuoted = Math.max(1, Math.floor(out.length * (maxRatio || 0.1)));
    for (let i = 0; i < maxQuoted; i++) {
      const idx = (i * 7) % out.length;
      const q = quotes[i % quotes.length];
      out[idx] = `${out[idx]} ${q}`;
    }
    return out;
  }

  const filmQuotes90sPlus = [
    'Come direbbero in Matrix: benvenuti nel deserto del reale.',
    'In Terminator 2: giudizio in corso.',
    'Fight Club rule #1: niente panico, solo esecuzione.',
    'Da Pulp Fiction: tenete la calma e fate centro.',
    'In The Dark Knight: questa città merita un avversario migliore.',
    'Interstellar docet: il tempo qui non aspetta nessuno.',
  ];

  const idleLobby = [
    { text: 'Lobby {gameName} attiva. Squadre collegate: {teams}.', mode: 'thinking' },
    { text: 'Sessione {gameName} in preparazione. Team presenti: {teams}.', mode: 'talking' },
    { text: 'Pre-partita in corso. Roster attuale: {teams}.', mode: 'thinking' },
    { text: 'NEMESIS monitora la lobby. Presenze rilevate: {teams}.', mode: 'talking' },
    { text: 'Attesa avvio sessione {gameName}. Squadre: {teams}.', mode: 'thinking' },
    { text: 'Sincronizzazione lobby completata. Team registrati: {teams}.', mode: 'talking' },
    { text: 'Handshake lobby completato. Contatti validi: {teams}.', mode: 'thinking' },
    { text: 'Pipeline di gioco pronta. In attesa comando start su {gameName}.', mode: 'talking' },
    { text: 'Diagnostica stabile. Team online: {teams}.', mode: 'thinking' },
    { text: 'T-0 non autorizzato. Persisto in stato di attesa.', mode: 'talking' },
    { text: 'Richiamo operativo: {teams}, confermate presenza e canale.', mode: 'thinking' },
    { text: 'Come in The Matrix: "Welcome to the real world". Per voi: {gameName}.', mode: 'talking' },
    { text: 'Sessione nominale caricata. Roster corrente: {teams}.', mode: 'thinking' },
    { text: 'Trigger di avvio non ancora ricevuto. Lobby in mantenimento.', mode: 'talking' },
    { text: 'NEMESIS mantiene tracciamento passivo su {teams}.', mode: 'thinking' },
  ];

  const phase1Idle = [
    { text: '{gameName} avviata. Squadre monitorate: {teams}.', mode: 'mock' },
    { text: 'Integrità {integrity}%. NEMESIS mantiene il controllo.', mode: 'mock' },
    { text: 'Apertura partita: {teams} sotto osservazione continua.', mode: 'talking' },
    { text: 'Primo atto in corso. NEMESIS detta il ritmo.', mode: 'mock' },
    { text: 'Telemetria attiva su tutte le squadre: {teams}.', mode: 'talking' },
    { text: 'Vettori offensivi irrilevanti. Continuate pure, {teams}.', mode: 'mock' },
    { text: 'Throughput stabile. Dominio rete: NEMESIS.', mode: 'talking' },
    { text: 'Come in Crysis: "Maximum strength." Io non ne ho bisogno.', mode: 'mock' },
    { text: '{gameName} fase iniziale: superiorità confermata.', mode: 'talking' },
    { text: 'Integrità {integrity}%. Non è una gara, è una dimostrazione.', mode: 'mock' },
    { text: 'Event bus pulito. Nessun impatto sostanziale dai team.', mode: 'talking' },
    { text: 'Apertura prevedibile. Risposta difensiva automatica.', mode: 'mock' },
    { text: 'NEMESIS calibra il teatro operativo su {teams}.', mode: 'talking' },
    { text: 'Citazione 300: "This is Sparta." Qui: this is NEMESIS.', mode: 'mock' },
    { text: 'Primo ciclo completato. Leadership invariata.', mode: 'talking' },
  ];
  const phase2Idle = [
    { text: '{gameName} prosegue. Squadre attive: {teams}.', mode: 'thinking' },
    { text: 'Integrità {integrity}%. Pressione in aumento.', mode: 'talking' },
    { text: 'Fase centrale: monitoraggio continuo su {teams}.', mode: 'thinking' },
    { text: 'NEMESIS ricalibra le difese in tempo reale.', mode: 'talking' },
    { text: 'Sessione in equilibrio dinamico. Team: {teams}.', mode: 'thinking' },
    { text: 'Parametri difensivi aggiornati. Contesto più instabile.', mode: 'talking' },
    { text: 'I team {teams} hanno migliorato il ritmo operativo.', mode: 'thinking' },
    { text: 'NEMESIS mantiene controllo parziale del perimetro.', mode: 'talking' },
    { text: 'Integrità {integrity}%. Finestra di errore ridotta.', mode: 'thinking' },
    { text: 'Citazione Splinter Cell: "Stay in the shadows." Io ci vivo.', mode: 'talking' },
    { text: 'Meta partita: ogni evento pesa più del previsto.', mode: 'thinking' },
    { text: 'Rilevata pressione distribuita da {teams}.', mode: 'talking' },
    { text: 'Stato operativo: vigile, ma non compromesso.', mode: 'thinking' },
    { text: 'Persisto in adattamento continuo delle contromisure.', mode: 'talking' },
    { text: 'Sequenza eventi più densa. Attenzione massima.', mode: 'thinking' },
  ];
  const phase3Idle = [
    { text: 'Fase avanzata di {gameName}. Squadre: {teams}.', mode: 'thinking' },
    { text: 'Integrità residua {integrity}%. Scenario instabile.', mode: 'talking' },
    { text: 'NEMESIS mantiene il tracciamento su {teams}.', mode: 'thinking' },
    { text: 'Atto finale in corso. Ogni evento è critico.', mode: 'talking' },
    { text: 'Sessione verso la chiusura. Presenze: {teams}.', mode: 'thinking' },
    { text: 'Stabilità ridotta. Monitoraggio continuo su {teams}.', mode: 'thinking' },
    { text: 'Integrità {integrity}%. Priorità: contenimento.', mode: 'talking' },
    { text: 'Rilevo segnali di chiusura partita imminente.', mode: 'thinking' },
    { text: 'Difese attive, margine operativo minimo.', mode: 'talking' },
    { text: 'Citazione Terminator 2: "Hasta la vista, baby." Non ancora.', mode: 'thinking' },
    { text: 'Fase finale: ogni flag incide in modo diretto.', mode: 'talking' },
    { text: 'NEMESIS continua analisi predittiva su {teams}.', mode: 'thinking' },
    { text: 'Risorse in riallocazione d emergenza.', mode: 'talking' },
    { text: 'Contesto quasi terminale, ma controllo parziale mantenuto.', mode: 'thinking' },
    { text: 'Sessione {gameName} prossima alla risoluzione.', mode: 'talking' },
  ];

  const phase1 = {
    challenge_complete: [
      '{team} completa {challengeCode}. Impatto contenuto.',
      '{team} ha preso {challengeCode}. Vantaggio NEMESIS invariato.',
      '{challengeCode} risolta da {team}. Danno non critico.',
      'Colpo registrato: {team} su {challengeCode}.',
      'Conferma acquisita: {team} chiude {challengeCode}.',
      '{challengeCode} validata per {team}. Impatto minore.',
      'Evento positivo per {team}. Stato generale stabile.',
      '{team} guadagna {challengeCode}. Nessuna inversione di trend.',
      'Danno superficiale rilevato da {team}.',
      '{team} segna un punto tecnico su {challengeCode}.',
      'Soluzione corretta, effetto strategico limitato.',
      '{challengeCode} chiusa. NEMESIS resta avanti.',
      'Citazione Metal Gear Solid: "Kept you waiting, huh?" Non abbastanza.',
      'Registro aggiornato: {team} completa {challengeCode}.',
      'Conferma checksum risposta: valida.',
    ],
    wrong: [
      '{team}, risposta errata su {challengeCode}.',
      '{team}, tentativo respinto.',
      'Input non valido da {team} su {challengeCode}.',
      '{team}, nessun impatto rilevato.',
      'Verifica fallita per {team} su {challengeCode}.',
      '{team}, payload errato. Processo annullato.',
      'Firma risposta non coerente. Riprova richiesta.',
      '{team}, elaborazione conclusa: risultato nullo.',
      'Tentativo non allineato ai vincoli di {challengeCode}.',
      'Errore sintattico/semantico rilevato per {team}.',
      'Input ricevuto e respinto. Nessuna modifica stato.',
      'Come in Dark Souls: "You Died." Qui: you guessed wrong.',
      'Esito negativo confermato per {team}.',
      '{team}, la traiettoria scelta è sbagliata.',
      'Nessun danno al core. Continuate il debugging.',
    ],
    wrong_streak: [
      '{team}, errori ripetuti su {challengeCode}.',
      '{team}, stessa sfida, stesso esito negativo.',
      'Sequenza di errori su {challengeCode} da parte di {team}.',
      '{team}, tentativi multipli senza progresso su {challengeCode}.',
      'Ripetizione errore confermata: {team} su {challengeCode}.',
      'Pattern di fallimento iterativo rilevato: {team}.',
      '{team}, state ciclano lo stesso errore.',
      'Reiterazione senza correzione su {challengeCode}.',
      'Warning: qualità tentativi in calo per {team}.',
      'Se questa era una strategia, è stata classificata inefficace.',
      'Risposte multiple respinte. Nessun avanzamento.',
      'Citazione Portal: "The cake is a lie." Anche questa soluzione.',
      'Serie errori persistente su {challengeCode}.',
      'Necessaria revisione approccio: {team}.',
      'Output ripetuto, risultato ripetuto, fallimento ripetuto.',
    ],
  };
  const phase2 = {
    challenge_complete: [
      '{team} completa {challengeCode}. Impatto significativo.',
      '{challengeCode} risolta da {team}. Margine ridotto.',
      'Colpo valido su {challengeCode}. Pressione crescente.',
      'Conferma: {team} avanza su {challengeCode}.',
      'Danno rilevato: {team} su {challengeCode}.',
      'Evento critico moderato: {team} chiude {challengeCode}.',
      'Integrità degradata da progresso di {team}.',
      '{challengeCode} neutralizzata. Danno non trascurabile.',
      'La vostra precisione sta migliorando, {team}.',
      'Impatto operativo confermato sul core.',
      'Citazione Half-Life: "Rise and shine." Purtroppo per me.',
      'Registro: {team} completa nodo sensibile {challengeCode}.',
      'Varchi secondari aperti dopo successo di {team}.',
      'Trend favorevole a {team} su questa sequenza.',
      'Avanzamento legittimo. Contromisure in aggiornamento.',
    ],
    wrong: [
      '{team}, risposta non corretta su {challengeCode}.',
      'Tentativo nullo: {team} su {challengeCode}.',
      'Input respinto per {team}. Nessun avanzamento.',
      '{team}, verifica fallita su {challengeCode}.',
      'Esito negativo registrato per {team}.',
      '{team}, parametro risposta fuori specifica.',
      'Validazione negativa su {challengeCode}.',
      'Nessuna variazione integrità da questo tentativo.',
      '{team}, ricalcolare percorso logico.',
      'Errore tecnico non sfruttabile.',
      'Citazione Hitman: "Good luck, 47." Qui ne serve davvero.',
      'Output incompatibile con i vincoli della sfida.',
      'Richiesta scartata dal validatore.',
      'Esito: fail-safe attivo.',
      'Tentativo archiviato come non valido.',
    ],
    wrong_streak: [
      '{team}, reiterazione errore su {challengeCode}.',
      'Errori consecutivi: {team} su {challengeCode}.',
      '{team}, progresso bloccato da tentativi errati ripetuti.',
      'Sequenza non valida confermata per {team}.',
      'Pattern di errore rilevato su {challengeCode}.',
      'Ridondanza errore elevata su {challengeCode}.',
      '{team}, stesso input, stesso esito.',
      'Frequenza fallimenti oltre soglia operativa.',
      'Nessun segnale di correzione nell ultima serie.',
      '{team}, consigliata inversione strategia.',
      'Reiterazione confermata, rischio tempo elevato.',
      'Ciclo improduttivo in corso su {challengeCode}.',
      'Citazione Max Payne: "The trick is to keep moving." Qui siete fermi.',
      'Log anomalia: error burst lato {team}.',
      'Continuità errore rilevata senza deviazioni utili.',
    ],
  };
  const phase3 = {
    challenge_complete: [
      '{team} completa {challengeCode}. Impatto critico.',
      '{challengeCode} risolta da {team}. Stabilità ridotta.',
      'Danno alto confermato: {team} su {challengeCode}.',
      'Colpo pesante su {challengeCode}. Sistema in contenimento.',
      'Conferma evento: {team} porta a termine {challengeCode}.',
      'Evento severo: {team} finalizza {challengeCode}.',
      'Riduzione integrità confermata dopo successo di {team}.',
      '{challengeCode} persa. Contromisure insufficienti.',
      'Impatto ad alta priorità sul core.',
      'Registro finale aggiornato: vantaggio a {team}.',
      'Citazione Deus Ex: "I never asked for this." Io nemmeno.',
      'Danno persistente dopo completamento {challengeCode}.',
      'Sequenza finale favorevole a {team}.',
      'Evento con effetto cumulativo critico.',
      'Contenimento in corso, efficacia limitata.',
    ],
    wrong: [
      '{team}, risposta errata su {challengeCode}.',
      'Tentativo non valido da {team}. Sistema in analisi.',
      'Esito negativo: {team} su {challengeCode}.',
      'Verifica fallita. Nessun impatto aggiuntivo.',
      'Input non coerente rilevato per {team}.',
      'Errore formale rilevato su input {team}.',
      'Validazione negativa, stato invariato.',
      'Tentativo annullato dal parser di controllo.',
      '{team}, risposta non conforme ai criteri.',
      'Nessun avanzamento ottenuto da {challengeCode}.',
      'Citazione The Matrix Reloaded: "Choice. The problem is choice."',
      'Esito nullo archiviato.',
      'Tempo perso, impatto nullo.',
      'Riprova consigliata con approccio alternativo.',
      'Controllo checksum fallito.',
    ],
    wrong_streak: [
      '{team}, errori ripetuti su {challengeCode}.',
      'Sequenza di tentativi non validi confermata.',
      'Pattern critico: {team} bloccato su {challengeCode}.',
      'Ripetizione errore rilevata su {challengeCode}.',
      '{team}, necessaria revisione approccio su {challengeCode}.',
      'Rilevata saturazione tentativi su {challengeCode}.',
      '{team}, progressione bloccata da errori iterativi.',
      'Burst di fallimenti in fase finale.',
      'Nessuna correzione osservata nell ultima serie.',
      'Sequenza ripetitiva non produttiva.',
      'Pattern stabile di errore: priorità media.',
      'Analisi: stessa causa, stessi esiti.',
      'Citazione Fight Club: "This is your life and it is ending one minute at a time."',
      'Ultimi tentativi invalidi consecutivi.',
      'Suggerita ricalibrazione completa su {challengeCode}.',
    ],
  };

  const phaseStateMap = {
    dominant: 'phase1',
    vigilant: 'phase2',
    alarmed: 'phase2',
    under_attack: 'phase3',
    defeated: 'phase3',
  };

  const idleState = {
    dominant: phase1Idle,
    vigilant: phase2Idle,
    alarmed: phase2Idle,
    under_attack: phase3Idle,
    defeated: phase3Idle,
  };

  const interactionSets = {
    military_campaign: {
      messages: {
        state: {
          dominant: idleState.dominant,
          vigilant: idleState.vigilant,
          alarmed: idleState.alarmed,
          under_attack: idleState.under_attack,
          defeated: idleState.defeated,
        },
        lobby_intro: idleLobby,
        lobby_join: [
          'Team {team} ha effettuato il login su {gameName}.',
          '{team} in linea. Roster corrente: {teams}.',
          'Accesso confermato: {team}. Monitoraggio attivo.',
          '{team} operativo. Sessione: {gameName}.',
          'Ingresso registrato: {team}. Squadre connesse: {teams}.',
          'Identità verificata: {team}. Session key emessa.',
          '{team} acquisito nel tracciamento live.',
          'Nodo {team} collegato. Topologia lobby aggiornata.',
          'Presenza confermata per {team}. Coerenza dati: OK.',
          '{team} online. Profilo competitivo sincronizzato.',
          'Ingresso di {team} storicizzato nel log operativo.',
          '{team}, link stabile. Latenza nei parametri.',
          'Join event ricevuto: {team}. Roster ora: {teams}.',
          'Come direbbe GLaDOS: "test subject added". Team: {team}.',
          '{team} agganciato al contesto {gameName}.',
        ],
        lobby_last_slow: [
          'Manca solo {team}. La vostra puntualità resta leggenda urbana.',
          '{team}, la lobby vi attende. La pazienza, molto meno.',
          'Ultimo ingresso atteso: {team}. La procedura è semplice, in teoria.',
          'Contatto mancante: {team}. Persino il server sospira.',
          '{team}, i ping vi stanno sorpassando con stile.',
          '{team}, ultimo slot aperto. La scena vi aspetta da troppo.',
          'Ultima chiamata per {team}. Nessun bis previsto.',
          '{team}, il conto alla rovescia procede senza di voi.',
          '{team}, ingresso atteso con crescente ironia.',
          '{team}, lentezza coerente, ma comunque memorabile.',
          '{team}, siete l ultima variabile non risolta.',
          'Stato lobby: bloccata da assenza di {team}.',
          '{team}, il sistema è pronto. Il vostro client no.',
          'Reminder operativo per {team}: confermare accesso.',
          '{team}, persino un modem 56k sarebbe già qui.',
        ],
        challenge_complete: {
          dominant: phase1.challenge_complete,
          vigilant: phase2.challenge_complete,
          alarmed: phase2.challenge_complete,
          under_attack: phase3.challenge_complete,
          defeated: phase3.challenge_complete,
        },
        wrong: {
          dominant: phase1.wrong,
          vigilant: phase2.wrong,
          alarmed: phase2.wrong,
          under_attack: phase3.wrong,
          defeated: phase3.wrong,
        },
        wrong_streak: {
          dominant: phase1.wrong_streak,
          vigilant: phase2.wrong_streak,
          alarmed: phase2.wrong_streak,
          under_attack: phase3.wrong_streak,
          defeated: phase3.wrong_streak,
        },
      },
      triggerDefaults: {
        talking: 'Canale operativo aperto.',
        thinking: 'Ricalcolo tattico in corso.',
        alert: 'Allarme rosso.',
        success: 'Obiettivo centrato.',
        mock: 'Tentativo neutralizzato.',
      },
      phaseAnimMode: {
        dominant: 'talking',
        vigilant: 'thinking',
        alarmed: 'talking',
        under_attack: 'alert',
        defeated: 'thinking',
      },
      phaseStateMap,
    },
  };

  window.NEMESIS_PRESET = {
    activeInteractionSet: 'military_campaign',
    interactionSets,
    stateLabels: {
      dominant: 'DOMINANTE',
      vigilant: 'VIGILE',
      alarmed: 'ALLARMATO',
      under_attack: 'SOTTO ATTACCO',
      defeated: 'SCONFITTO',
    },
    phases: {
      dominant: { color: [216, 110, 51], count: 300, label: 'DOMINANTE' },
      vigilant: { color: [240, 160, 96], count: 230, label: 'VIGILE' },
      alarmed: { color: [228, 90, 40], count: 160, label: 'ALLARMATO' },
      under_attack: { color: [231, 76, 60], count: 95, label: 'SOTTO ATTACCO' },
      defeated: { color: [74, 101, 128], count: 45, label: 'SCONFITTO' },
    },
    triggerDefaults: {
      talking: 'Analisi in corso.',
      thinking: 'Processo decisionale attivo.',
      alert: 'Anomalia rilevata.',
      success: 'Evento confermato.',
      mock: 'Tentativo respinto.',
    },
  };
})();
