import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const front=path.join(root,'frontend');
test('Pagine, JavaScript e risorse locali',()=>{
 const pages=fs.readdirSync(front).filter(f=>f.endsWith('.html'));
 assert.equal(pages.length,6);
 for(const name of pages){
   const html=fs.readFileSync(path.join(front,name),'utf8');
   for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
     const src=match[1].match(/src="([^"]+)"/);
     const code=src?fs.readFileSync(path.join(front,src[1]),'utf8'):match[2];
     new vm.Script(code,{filename:src?.[1]||name});
   }
   for(const match of html.matchAll(/<(?:img|link)\b[^>]*?\b(?:src|href)="([^"]+)"/gi)){
     const asset=match[1];if(asset.includes('${'))continue;
     assert.ok(!asset.startsWith('http')&&fs.existsSync(path.join(front,asset)),name+' '+asset);
   }
 }
});
test('32 flag e allegati del catalogo',()=>{
 const guide=fs.readFileSync(path.join(root,'docs/Soluzioni-staff.md'),'utf8');
 const flags=new Map([...guide.matchAll(/\| ([A-Z]+-\d\d) \| `(FLAG\[[^\]]+\])`/g)].map(m=>[m[1],m[2]]));
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'db/catalogo.json')));
 assert.equal(flags.size,32);assert.equal(catalog.length,32);
 for(const ch of catalog){
   assert.equal(createHash('sha256').update(flags.get(ch.code)).digest('hex'),ch.flag_hash,ch.code);
   if(ch.attachment_path) assert(fs.statSync(path.join(root,'docs/allegati',ch.attachment_path)).size>0,ch.code);
 }
});
test('Report PDF multipagina del referente generato con libreria locale',async()=>{
 const context=vm.createContext({setTimeout,clearTimeout,console});context.window=context;
 vm.runInContext(fs.readFileSync(path.join(front,'assets/pdf-lib.min.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(front,'referent-report-pdf.js'),'utf8'),context);
 for(const mode of ['coop','competitive']){
   const bytes=await vm.runInContext(`(async()=>{
    const teams=Array.from({length:60},(_,i)=>({team_name:'Squadra '+(i+1),score:i,challenges_solved:1,failed_attempts:0,hints_used:1,integrity_pct:60,emotional_state:'vigilant'}));
    const doc=await ReferentReportPdf.build({session:{name:"Prova d’aula",mode:'${mode}',duration_mins:90},scoreboard:teams,total_challenges:7,team_nemesis:teams,nemesis:{integrity_pct:65}});
    const file=await doc.save();const reopened=await PDFLib.PDFDocument.load(file);if(reopened.getPageCount()<2)throw Error('Paginazione');return file;
   })()`,context);
   assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
 }
});
