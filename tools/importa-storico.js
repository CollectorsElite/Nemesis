/* Uso: node tools/importa-storico.js esportazione.json directory-di-destinazione */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, mkdirSync, linkSync, rmSync, chmodSync } from 'node:fs';
import path from 'node:path';

const [input, dest] = process.argv.slice(2);
if (!input || !dest) throw new Error('Indicare il file JSON esportato e la directory di destinazione.');
const root = path.resolve(import.meta.dirname,'..');
const tables=['admin','users','challenges','game_sessions','session_challenges','session_players','team_solutions','hint_usage','flag_attempts','nemesis_state','nemesis_log'];
const snapshot=JSON.parse(readFileSync(input,'utf8'));
const catalog=JSON.parse(readFileSync(path.join(root,'db/catalogo.json'),'utf8'));
for(const table of tables) if(!Array.isArray(snapshot[table])) throw new Error('Tabella assente: '+table);
const output=path.resolve(dest);
mkdirSync(output,{recursive:true});
const temp=mkdtempSync(path.join(output,'.import-'));
const file=path.join(temp,'escalation-ctf.sqlite');
let db;
try {
  db=new DatabaseSync(file);
  chmodSync(file,0o600);
  db.exec('PRAGMA foreign_keys=ON; BEGIN;');
  db.exec(readFileSync(path.join(root,'db/schema.sql'),'utf8'));
  for(const table of tables){
    const columns=db.prepare('PRAGMA table_info('+table+')').all().map(row=>row.name);
    for(const source of snapshot[table]){
      if(!Number.isSafeInteger(source.id) || source.id<1)throw new Error('ID non valido in '+table);
      const unknown=Object.keys(source).filter(k=>!columns.includes(k));
      if(unknown.length) throw new Error('Schema aggiuntivo da mappare in '+table+': '+unknown.join(', '));
      const row={...source};
      if(table==='challenges'){
        const shipped=catalog.find(c=>c.code===row.code);
        if(shipped && row.flag_hash===shipped.flag_hash){
          // Mantiene gli ID referenziati e l'attivazione locale delle sfide.
          if(row.code.startsWith('WEB-')||['REV-04','FOR-06'].includes(row.code))
            for(const key of ['title','description','terminal_block','hint1_text','hint2_text','hint3_text']) row[key]=shipped[key];
          if(shipped.attachment_path) {
            row.attachment_path=shipped.attachment_path;
            row.attachment_name=shipped.attachment_name;
          }
        }
        if(row.attachment_path && (path.isAbsolute(row.attachment_path)||row.attachment_path.split(/[/\\]/).includes('..')))
          throw new Error('Percorso di allegato non valido per '+row.code);
      }
      const keys=Object.keys(row);
      const values=keys.map(k=>{
        if(row[k] && k.endsWith('_at')){
          const d=new Date(row[k]);if(Number.isNaN(d.getTime())) throw new Error('Data non valida in '+table+'.'+k);
          return d.toISOString();
        }
        return typeof row[k]==='boolean'?Number(row[k]):row[k];
      });
      db.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...values);
    }
    const count=db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;
    if(count!==snapshot[table].length)throw new Error('Conteggio incoerente in '+table);
    console.log(table+': '+count);
  }
  for(const ch of catalog){
    if(db.prepare('SELECT id FROM challenges WHERE code=?').get(ch.code))continue;
    const keys=Object.keys(ch);
    db.prepare('INSERT INTO challenges ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...Object.values(ch));
  }
  if(db.prepare('PRAGMA foreign_key_check').all().length || db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Verifica di integrità fallita.');
  db.exec('PRAGMA user_version=1; COMMIT'); db.close(); db=null;
  linkSync(file,path.join(output,'escalation-ctf.sqlite'));
  console.log('Importazione completata.');
} finally {
  if(db)db.close();
  rmSync(temp,{recursive:true,force:true});
}
