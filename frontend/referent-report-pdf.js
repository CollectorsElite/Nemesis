/* Report del referente. La libreria PDF viene servita con l'applicazione. */
(() => {
  const states={dominant:'Dominante',vigilant:'Vigile',alarmed:'Allarmato',under_attack:'Sotto attacco',defeated:'Sconfitto'};
  const competitive=data=>data.session.mode==='competitive' && data.team_nemesis?.length>0;
  async function build(data) {
    const {PDFDocument,StandardFonts,rgb}=window.PDFLib;
    const doc=await PDFDocument.create();
    const regular=await doc.embedFont(StandardFonts.Helvetica);
    const bold=await doc.embedFont(StandardFonts.HelveticaBold);
    const safe=value=>[...String(value ?? '')].map(c=>{try{regular.encodeText(c); return c;}catch{return ' ';}}).join('');
    const ink=rgb(.07,.12,.21), muted=rgb(.31,.37,.45);
    let page,y;
    const write=(text,x,at,size=11,font=regular,color=ink)=>page.drawText(safe(text),{x,y:at,size,font,color});
    function newPage(){
      page=doc.addPage([595,842]); y=750;
      page.drawRectangle({x:0,y:774,width:595,height:68,color:ink});
      write('ESCALATION  /  CTF',38,802,19,bold,rgb(1,.70,.40));
      write('REPORT DI SESSIONE',397,804,10,bold,rgb(.97,.94,.87));
      write('ITS Rossellini  /  BespokeAIDA',38,23,9,regular,muted);
      write(String(doc.getPageCount()),548,23,9,regular,muted);
    }
    function lines(text,width,font,size){
      const result=[]; let current='';
      for(const char of safe(text)){
        if(char==='\n' || font.widthOfTextAtSize(current+char,size)>width){
          result.push(current);current='';
          if(char==='\n')continue;
        }
        current+=char;
      }
      result.push(current);return result;
    }
    function paragraph(value,size=11,font=regular){
      for(const line of lines(value,520,font,size)){
        if(y<68)newPage();
        write(line,38,y,size,font);y-=size+5;
      }
      y-=4;
    }
    function scoreboardHeader(){
      ['Squadra','Punti','Sfide','Errori','Aiuti'].forEach((text,i)=>write(text,[38,297,355,422,496][i],y,10,bold));
      y-=15;
    }
    doc.setTitle('Escalation CTF – '+data.session.name);
    newPage();paragraph(data.session.name,21,bold);
    paragraph((data.session.mode==='coop'?'Cooperativa':'Competitiva')+'   /   '+data.session.duration_mins+' minuti');
    if(data.session.ended_at)paragraph('Conclusa il '+new Date(data.session.ended_at).toLocaleString('it-IT'));
    y-=10;paragraph('Integrità di NEMESIS',15,bold);
    const rows=competitive(data)?data.team_nemesis:[{...data.nemesis,team_name:'Integrità condivisa'}];
    for(const row of rows)paragraph(row.team_name+'   /   '+(row.integrity_pct ?? 100)+'%   /   '+(states[row.emotional_state] || 'Dominante'));
    y-=12;if(y<120)newPage();paragraph('Classifica delle squadre',15,bold);scoreboardHeader();
    for(const [index,team] of data.scoreboard.entries()){
      const name=lines((index+1)+'. '+team.team_name,246,regular,10);
      if(y<66+name.length*13){newPage();scoreboardHeader();}
      [team.score,team.challenges_solved+' / '+data.total_challenges,team.failed_attempts,team.hints_used].forEach((v,i)=>write(v ?? 0,[297,355,422,496][i],y,10));
      for(const line of name){write(line,38,y,10);y-=13;}
      y-=9;page.drawLine({start:{x:38,y:y+4},end:{x:555,y:y+4},color:rgb(.83,.85,.87),thickness:.5});
    }
    return doc;
  }
  async function download(data){
    const doc=await build(data);
    const href=URL.createObjectURL(new Blob([await doc.save()],{type:'application/pdf'}));
    const a=document.createElement('a');a.href=href;a.download='Escalation-CTF-'+String(data.session.name).replace(/[^\p{L}\p{N}_-]+/gu,'-')+'.pdf';
    a.click();setTimeout(()=>URL.revokeObjectURL(href),60000);
  }
  window.ReferentReportPdf={build,download,isCompetitiveReport:competitive,nemStateLabel:s=>states[s] || s};
})();
