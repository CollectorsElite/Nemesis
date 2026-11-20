(async () => {
  const brand=document.querySelector('.suite-brand');
  if(!brand)return;
  try {
    const response=await fetch('/api/suite');
    if(!response.ok)return;
    const {home}=await response.json();
    if(!home)return;
    const link=document.createElement('a');
    link.href=home;
    link.className='suite-brand suite-home';
    link.setAttribute('aria-label','Torna alla Suite Escalation');
    link.title='Torna alla Suite Escalation';
    link.append(...brand.childNodes);
    brand.replaceWith(link);
  } catch { /* Il marchio è disponibile anche durante una riconnessione. */ }
})();
