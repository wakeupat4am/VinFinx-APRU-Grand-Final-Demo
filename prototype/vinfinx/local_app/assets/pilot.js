'use strict';
// Presentation only: service state is fetched from authenticated backend readiness.
(() => {
  const BRAND='VinFinx x Vietcombank';
  document.title=BRAND+(new URLSearchParams(location.search).get('demo')==='ios'?' — iPhone preview':' — Financial health');
  for(const node of document.querySelectorAll('.wordmark,.mobile-brand,.ios-studio-brand')){
    const icon=node.querySelector('.brand-icon');
    const fragment=document.createDocumentFragment();if(icon)fragment.appendChild(icon);
    const lockup=document.createElement('span');lockup.className='partner-lockup';lockup.innerHTML='VinFinx <small>x Vietcombank</small>';fragment.appendChild(lockup);
    node.replaceChildren(fragment);node.setAttribute('aria-label',BRAND);
  }
  const welcome=document.querySelector('.login-form h2');welcome.textContent='Welcome to '+BRAND;
  const footer=document.querySelector('footer');if(footer.firstChild?.nodeType===Node.TEXT_NODE)footer.firstChild.textContent=BRAND+' · Internal pilot ';
  const chip=document.createElement('button');chip.type='button';chip.className='runtime-chip';chip.textContent='Check services';chip.setAttribute('aria-label','Check service status');
  document.querySelector('.sidebar-bottom').prepend(chip);
  let modal;
  chip.addEventListener('click',async()=>{
    if(!modal){modal=document.createElement('dialog');modal.className='runtime-dialog';document.body.appendChild(modal);}
    modal.innerHTML='<div class="dialog-head"><h2>Connected services</h2><button type="button" class="icon" aria-label="Close service status">×</button></div><p class="muted">Checking authenticated backend…</p>';
    modal.querySelector('button').addEventListener('click',()=>modal.close());modal.showModal();
    try{
      const s=await api('/api/models');
      const rows=[['Live AVM',s.avm.ready?'Ready · CPU':'Unavailable'],['Research calibration',s.avm.methods?.find(m=>m.id==='hierarchical')?.ready?'Ready · Research':'Unavailable'],['Qwen evidence selection',s.qwen.online?'Connected':'Offline · Evidence mode'],['Synthetic image OCR (app host)',s.ocr.image_ready?s.ocr.image_engine:'Unavailable'],['Synthetic PDF extraction','App host · Human review required'],['Database',s.database_ready?'Ready · SQLite WAL':'Unavailable'],['Macro decisions','Separate research pipeline · Not live']];
      modal.querySelector('p').outerHTML='<div>'+rows.map(([name,value])=>`<div class="metric-pair"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('')+'</div><p class="notice">Synthetic-data pilot. A connected model does not constitute a formal appraisal or bank approval.</p>';
    }catch(error){modal.querySelector('p').textContent=error.message;}
  });
  function decorate(){
    const form=document.querySelector('#valuationForm');
    if(form&&!form.dataset.checkedMethods){
      form.dataset.checkedMethods='true';
      const option=form.querySelector('option[value="hierarchical"]');
      api('/api/models').then(s=>{
        if(form.isConnected&&option){
          option.disabled=!s.avm.methods?.some(m=>m.id==='hierarchical'&&m.ready);
          if(option.disabled&&form.elements.method.value==='hierarchical')form.elements.method.value='lightgbm';
        }
      }).catch(()=>{});
    }
    document.querySelectorAll('#content a[href^="/api/sample/"]').forEach(link=>{link.href=link.pathname+'?customer='+encodeURIComponent(S.cid);});
  }
  new MutationObserver(decorate).observe(document.querySelector('#content'),{childList:true});
})();
