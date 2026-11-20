import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

test('Due modalità, ruoli, punteggi, allegati, transazioni e riavvio', async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'escalation-ctf-'));
  const root=path.resolve(import.meta.dirname,'..');
  const available=net.createServer().listen(0,'127.0.0.1');
  await once(available,'listening');
  const port=available.address().port;
  await new Promise(resolve=>available.close(resolve));
  const secret=randomBytes(16).toString('hex');
  const origin='http://127.0.0.1:'+port;
  let proc,admin, player1,player2,referent, teams=[],challenges,firstSession, codes={};
  async function start(){
    proc=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:dir,RAILWAY_ENVIRONMENT_ID:'',RAILWAY_VOLUME_MOUNT_PATH:'',ADMIN_PASSWORD:secret,ADMIN_SESSION_CODE:'STAFF'},stdio:['ignore','pipe','inherit']});
    await Promise.race([once(proc.stdout,'data'),once(proc,'exit').then(()=>{throw Error('Avvio fallito');})]);
  }
  async function stop(){if(proc && proc.exitCode===null){const exited=once(proc,'exit');proc.kill('SIGTERM');await exited;} proc=null;}
  t.after(async()=>{await stop();fs.rmSync(dir,{recursive:true,force:true});});
  async function api(route,{method='GET',body,cookie,status=200}={}){
    const res=await fetch(origin+'/api/'+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await res.json();
    assert.equal(res.status,status,method+' '+route+' '+JSON.stringify(data));
    return {data,cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  const login=async(code,username)=> (await api('auth/login',{method:'POST',body:{code,username,password:secret}})).cookie;
  const adminReq=async(route,method,body,status)=> (await api('admin/'+route,{method,body,status,cookie:admin})).data;
  const play=async(route,cookie,body,status)=> (await api('game/'+route,{method:'POST',cookie,body,status})).data;
  await start();
  await t.test('Accesso, catalogo completo, risorse private e utenti',async()=>{
    assert((await api('health')).data.db);
    await api('admin/challenges',{status:401});
    assert.equal((await api('auth/verify-session-code',{method:'POST',body:{code:'staff'}})).data.flow,'admin');
    admin=await login('staff','admin');
    challenges=(await adminReq('challenges')).challenges;
    assert.equal(challenges.length,32);assert.equal(new Set(challenges.map(c=>c.category)).size,9);
    for(const c of challenges)codes[c.code]=c.id;
    for(const [username,role] of [['prima','player'],['seconda','player'],['docente','referente']]){
      teams.push((await adminReq('users','POST',{team_name:username,username,password:secret,role},201)).user.id);
    }
    await adminReq('users','POST',{team_name:'Altra',username:'prima',password:secret},409);
    assert.equal((await adminReq('users')).users.length,3);
    await adminReq('users/'+teams[0],'PATCH',{team_name:"L'Aquila"});
    for(const file of ['db/catalogo.json','docs/Soluzioni-staff.md','data/escalation-ctf.sqlite','allegati/FOR-01/access.log']){
      assert.equal((await fetch(origin+'/'+file)).status,404);
    }
  });
  await t.test('Creazione atomica e selezione delle nove categorie',async()=>{
    await adminReq('sessions','POST',{name:'Rollback',user_ids:[99999]},400);
    assert.equal((await adminReq('sessions')).sessions.length,0);
    for(const category of new Set(challenges.map(c=>c.category))){
      const {session}=await adminReq('sessions','POST',{name:'Filtro',categories:[category]},201);
      const spec=await adminReq('sessions/'+session.id+'/spectator');
      assert(spec.challenges.length>0 && spec.challenges.every(c=>c.category===category));
      await adminReq('sessions/'+session.id,'DELETE');
    }
    const {session}=await adminReq('sessions','POST',{name:"Prova d'aula",user_ids:teams,challenge_ids:[codes['ENC-01'],codes['FOR-01'],codes['WEB-01']]},201);
    firstSession=session;
    await adminReq('sessions/'+session.id,'PATCH',{name:"Prova d'aula 1",user_ids:teams});
    player1=await login(session.game_code,'prima');player2=await login(session.game_code,'seconda');referent=await login(session.game_code,'docente');
    assert((await api('lobby/state',{cookie:player1})).data.lobby);
    assert.equal((await api('game/state',{cookie:player1})).data.challenges.length,0);
    await api('admin/users',{cookie:referent,status:403});
    await api('game/state',{cookie:referent,status:403});
    await adminReq('sessions/'+session.id+'/start','POST');
  });
  await t.test('Co-op, aiuti progressivi, due invii simultanei e allegati',async()=>{
    const s=(await api('game/state',{cookie:player1})).data;
    assert.equal(s.challenges.length,3);assert.equal(s.scoreboard.length,2);
    assert(s.challenges.every(c=>!c.hint3_text && !('flag_hash' in c)));
    const wrong=await play('submit-flag',player1,{challenge_id:codes['ENC-01'],flag:'FLAG[prova]'});assert.equal(wrong.correct,false);
    const flag={challenge_id:codes['ENC-01'],flag:'FLAG[AScii#]'};
    const results=await Promise.all([play('submit-flag',player1,flag),play('submit-flag',player2,flag)]);
    assert.equal(results.filter(r=>r.correct).length,1);
    const winner=results[0].correct?player1:player2;
    await play('hint',winner,{challenge_id:codes['FOR-01'],hint_number:2},400);
    const hint={challenge_id:codes['FOR-01'],hint_number:1};
    const hints=await Promise.all([play('hint',winner,hint),play('hint',winner,hint)]);
    assert(hints.every(h=>h.hint_text));assert(hints.some(h=>h.already_used));
    const spec=await adminReq('sessions/'+firstSession.id+'/spectator');
    assert.equal(spec.scoreboard[0].score,4);assert.equal(spec.total_solved,1);
    const obs=(await api('referent/state',{cookie:referent})).data;
    assert.equal(obs.scoreboard.length,2);assert.equal(obs.scoreboard.reduce((sum,p)=>sum+p.failed_attempts,0),1);
    const attachment=await fetch(origin+'/api/game/attachment/'+codes['WEB-01'],{headers:{Cookie:player1}});
    assert.equal(attachment.status,200);assert((await attachment.text()).includes('Rilievo'));
    await api('game/attachment/'+codes['NET-03'],{cookie:player1,status:404});
    await play('time-expired',player1,{},409);
  });
  await t.test('Riavvio, punteggi, accessi e conclusione',async()=>{
    await stop();await start();
    assert.equal((await adminReq('sessions')).sessions.length,1);
    const state=(await api('game/state',{cookie:player1})).data;
    assert.equal(state.challenges.filter(c=>c.is_solved).length,1);
    assert.equal(state.scoreboard[0].score,4);
    await adminReq('sessions/'+firstSession.id+'/terminate','POST');
    assert((await api('referent/state',{cookie:referent})).data.session.ended_at);
    await play('submit-flag',player1,{challenge_id:codes['FOR-01'],flag:'test'},403);
  });
  await t.test('Competitiva, soluzioni individuali e tempo scaduto',async()=>{
    const {session}=await adminReq('sessions','POST',{name:'Competitiva',mode:'competitive',categories:['ENCODING'],challenge_ids:[codes['ENC-01']],user_ids:teams},201);
    await adminReq('sessions/'+session.id+'/start','POST');
    const p1=await login(session.game_code,'prima'),p2=await login(session.game_code,'seconda'),r=await login(session.game_code,'docente');
    const completion=await play('submit-flag',p1,{challenge_id:codes['ENC-01'],flag:'FLAG[AScii#]'});assert(completion.all_solved);
    assert((await api('game/state',{cookie:p1})).data.completed);
    assert.equal((await api('game/state',{cookie:p2})).data.challenges[0].is_solved,false);
    const db=new DatabaseSync(path.join(dir,'escalation-ctf.sqlite'));db.prepare('UPDATE game_sessions SET started_at=? WHERE id=?').run(new Date(Date.now()-86400000).toISOString(),session.id);db.close();
    await play('submit-flag',p2,{challenge_id:codes['ENC-01'],flag:'FLAG[AScii#]'},403);
    assert((await api('game/state',{cookie:p2})).data.lost);
    const report=(await api('referent/state',{cookie:r})).data;assert.equal(report.team_nemesis.length,2);
    await adminReq('sessions/'+session.id,'DELETE');
    await api('referent/state',{cookie:r,status:401});
    await adminReq('users/'+teams[2],'DELETE');
  });
  await t.test('Logout revoca immediata',async()=>{
    await api('admin/logout',{cookie:admin,method:'POST'});await api('admin/sessions',{cookie:admin,status:401});
  });
});
