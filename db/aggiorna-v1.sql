-- Aggiorna solo i campi rimasti uguali alla versione distribuita in 1.0.

UPDATE challenges SET terminal_block = 'Sequenza da decodificare:
70  0x4C  01000001  G  :  65  83  01100011  i  i  0x23

Sistemi di numerazione:
  Decimale  → es. 65 = A
  Esadecimale → es. 0x41 = A  (prefisso 0x)
  Binario   → es. 01000001 = A  (8 cifre 0/1)
  Lettera   → già un carattere ASCII

La sequenza decodificata contiene un prefisso seguito da due punti. Invia la parte successiva ai due punti nel formato FLAG[risultato].'
WHERE code = 'ENC-01' AND flag_hash = 'd03380e736f71ce2740b7e2abdee092e77d671bb0ac0112b6481f8dea29a86e6' AND terminal_block = 'Sequenza da decodificare:
70  0x4C  01000001  G  :  65  83  01100011  i  i  0x23

Sistemi di numerazione:
  Decimale  → es. 65 = A
  Esadecimale → es. 0x41 = A  (prefisso 0x)
  Binario   → es. 01000001 = A  (8 cifre 0/1)
  Lettera   → già un carattere ASCII';

UPDATE challenges SET description = 'Un collega scrive «9 + 9 = 12». Trova la base in cui la somma si scrive 12. Poi, nella stessa base, somma il numero scritto «16» a sé stesso. Esprimi il risultato in esadecimale e invialo come FLAG[0xYY], usando lettere maiuscole per le cifre da A a F.'
WHERE code = 'ENC-02' AND flag_hash = 'acf707032a434d3fb4fe28d88fec90b8a57330b0e5512027516c2a42cea8332d' AND description = 'Scenario: un collega ti scrive: "9 + 9 = 12, fidati". Non è decimale: lì 9+9 = 18 e si scriverebbe "18", non "12". Intende che la **somma** (diciotto) ha **rappresentazione** con le due cifre 1 e 2 in una certa base. Obiettivo: individuare quella base; poi, nella **stessa base**, calcolare 16 + 16 — dove "16" è il numero con cifra **1** nelle sedici e cifra **6** nelle unità (non il numero decimale 16). Converti il risultato in esadecimale e invia FLAG[0xYY] (YY esadecimale, maiuscolo).';

UPDATE challenges SET terminal_block = 'In una base b, il numero scritto «12» vale 1 × b + 2. Usa questa relazione per trovare la base della prima somma. Nella seconda somma interpreta entrambe le cifre di «16» nella base che hai trovato.'
WHERE code = 'ENC-02' AND flag_hash = 'acf707032a434d3fb4fe28d88fec90b8a57330b0e5512027516c2a42cea8332d' AND terminal_block = 'Quale base b ammette la cifra 9 e dà 9+9 = 18₁₀ scritto come "12" in base b?
  Prova b = 16 (esadecimale): 12₁₆ = 1×16 + 2 = 18₁₀ ✓

Ora "16" va letto **in quella base**: 16₁₆ = 1×16 + 6 = 22₁₀.
Somma: 22 + 22 = 44₁₀. In esadecimale: 44₁₀ = 0x2C → flag FLAG[0x2C].

Errore frequente: sommare 16+16 in decimale (32 = 0x20) — non è quanto chiede la sfida.';

UPDATE challenges SET hint3_text = 'Converti «16» dalla base trovata al decimale usando 1 × b + 6. Raddoppia il valore ottenuto e riconvertilo in esadecimale.'
WHERE code = 'ENC-02' AND flag_hash = 'acf707032a434d3fb4fe28d88fec90b8a57330b0e5512027516c2a42cea8332d' AND hint3_text = '16 nella stessa base è 0x16 = 22 decimale, non 16 decimale. 22+22 = 44 = 0x2C. Se ottieni 0x20 hai sommato 16+10 in decimale invece dei valori denotati da "16" in base 16.';

UPDATE challenges SET terminal_block = 'Espressione da calcolare:
  (A AND B) XOR (A OR B)

Valori:
  A = 01011010
  B = 00011001

Regole (bit per bit):
  AND → 1 solo se entrambi sono 1
  OR  → 1 se almeno uno è 1
  XOR → 1 solo se i due bit sono diversi

Flag: FLAG[xxxxxxxx] (risultato in binario, 8 cifre)'
WHERE code = 'ENC-03' AND flag_hash = 'e896b32a094e90a052b30c6b6461b55177315de012d83e6d9f2c175168ecb876' AND terminal_block = 'Espressione da calcolare:
  (A AND B) XOR (A OR B)

Valori:
  A = 01011010
  B = 00011001

Regole (bit per bit):
  AND → 1 solo se entrambi sono 1
  OR  → 1 se almeno uno è 1
  XOR → 1 solo se i due bit sono diversi

Flag: FLAG:xxxxxxxx (risultato in binario, 8 cifre)';

UPDATE challenges SET hint3_text = 'Il testo decodificato contiene un prefisso seguito da due punti. Copia la parte successiva ai due punti dentro FLAG[...], rispettando maiuscole e minuscole.'
WHERE code = 'ENC-04' AND flag_hash = '1b2b4d901fb2b50dcfad840545ed6b35336b9aaee54e58ec6be0962970d2f232' AND hint3_text = 'Il testo decodificato è già nel formato FLAG:... — copialo esattamente così com''è e inseriscilo come risposta.';

UPDATE challenges SET terminal_block = 'Stringa da decodificare:
RkxBRzpwYXJhbWV0cm9CQVNFNjQ=

Indizi sul formato:
  - usa solo lettere A-Z, a-z, cifre 0-9, "+", "/" e "="
  - il "=" finale è un carattere di padding tipico
  - non è crittografia: è solo una codifica reversibile senza chiave

Invia il valore successivo ai due punti nel formato FLAG[valore].'
WHERE code = 'ENC-04' AND flag_hash = '1b2b4d901fb2b50dcfad840545ed6b35336b9aaee54e58ec6be0962970d2f232' AND terminal_block = 'Stringa da decodificare:
RkxBRzpwYXJhbWV0cm9CQVNFNjQ=

Indizi sul formato:
  - usa solo lettere A-Z, a-z, cifre 0-9, "+", "/" e "="
  - il "=" finale è un carattere di padding tipico
  - non è crittografia: è solo una codifica reversibile senza chiave';

UPDATE challenges SET terminal_block = 'Sequenza da ordinare (eventi casuali):
  A) Il router invia la query DNS a Google
  B) Il PC invia la richiesta HTTP al router
  C) Il router risponde al PC con l''IP del sito
  D) L''utente digita l''URL nel browser
  E) Il provider risponde con la pagina web
  F) L''utente visualizza la pagina
  G) Il PC chiede al router chi è il sito (DNS)
  H) Il router riceve la risposta DNS
  I) Il router invia la pagina al PC
  J) Il router invia la richiesta HTTP al provider

Flag: FLAG[LETTERA1LETTERA2...] (tutte le lettere nell''ordine corretto)'
WHERE code = 'NET-04' AND flag_hash = '8df47edd346efeaebf509a811aeaf56e0cf5c3923760afb757f8166ada1f0a81' AND terminal_block = 'Sequenza da ordinare (eventi casuali):
  A) Il router invia la query DNS a Google
  B) Il PC invia la richiesta HTTP al router
  C) Il router risponde al PC con l''IP del sito
  D) L''utente digita l''URL nel browser
  E) Il provider risponde con la pagina web
  F) L''utente visualizza la pagina
  G) Il PC chiede al router chi è il sito (DNS)
  H) Il router riceve la risposta DNS
  I) Il router invia la pagina al PC
  J) Il router invia la richiesta HTTP al provider

Flag: FLAG:LETTERA1LETTERA2... (tutte le lettere nell''ordine corretto)';
