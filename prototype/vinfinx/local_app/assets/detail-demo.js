'use strict';
// Three actual preview requests. No fabricated prices, saved profile changes or auto-approval.
const detailDemo=(()=>{
 const runs=new Map();
 const example={district:'quận đống đa',ward:'phường quang trung',street:'đường thái hà',area:52.3,subtype:'normal_house',method:'detail_aware'};
 const steps=[['Basic details',{}],['Building and access',{floors:4,frontage:4,road:4}],['Room details',{floors:4,frontage:4,road:4,bedrooms:3,bathrooms:3}]];
 const key=()=>S.user.id+'/'+S.cid;
 function panel(){
  const run=runs.get(key())||{results:[]};
  const n=run.results.length;
  const width=r=>r.high-r.low;
  const first=run.results[0],last=run.results.at(-1);
  const change=n>1?100*(1-width(last)/width(first)):null;
  const max=run.results.length?Math.max(...run.results.map(r=>r.high)):1;
  return `<details class="card detail-demo" ${run.open?'open':''}><summary><strong>See how more details help</strong> · Live example</summary>
   <p><strong>One synthetic property, three levels of detail.</strong> Each step runs the actual model.</p>
   <p class="tiny">52.3 m² · Street Thái Hà, Ward Quang Trung, District Đống Đa. These previews do not change your saved profile.</p>
   <ol class="detail-comparison">${run.results.map((r,i)=>`<li><strong>${i+1}. ${steps[i][0]}</strong><span>${vndAmount(r.low)} – ${vndAmount(r.high)}</span>
     <div class="detail-range" aria-hidden="true"><i style="left:${100*r.low/max}%;width:${100*width(r)/max}%"></i></div>
     <small>Range width: ${vndAmount(width(r))} · ${r.detail_interval?.applied?'Research interval':'Conservative fallback'}</small></li>`).join('')}</ol>
   ${change!==null?`<p class="detail-takeaway"><strong>${change>=0?change.toFixed(1)+'% narrower range':'The range widened'}</strong><br>Compared with basic details for this example.</p>`:''}
   <p class="tiny">A narrower range is not proof of a more accurate price for one home. On a separate 429-listing test, median asking-price error fell from 30.37% to 23.65% with structural details. This research is not sale-price validation.</p>
   <p class="story-state" role="status">${run.error?esc(run.error):run.busy?'Running live inference…':''}</p>
   <div class="row"><button type="button" class="button primary" data-detail-next ${run.busy||n===3?'disabled':''}>${n===0?'1. Start with basic details':n===1?'2. Add building and access':n===2?'3. Add room details':'Comparison complete'}</button>
   ${n?'<button type="button" class="button" data-detail-reset>Start again</button>':''}</div></details>`;
 }
 function refresh(){const node=document.querySelector('.detail-demo');if(node)node.outerHTML=panel();}
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-detail-next],[data-detail-reset]');
  if(!button||!S.user||!['customer','advisor'].includes(S.user.role))return;
  const identity=key(),user=S.user,cid=S.cid;
  if(button.hasAttribute('data-detail-reset')){runs.set(identity,{results:[],open:true});refresh();return;}
  const run=runs.get(identity)||{results:[]};
  if(run.busy||run.results.length>=3)return;
  Object.assign(run,{busy:true,open:true,error:null});runs.set(identity,run);refresh();
  try{
   const raw={...example,...steps[run.results.length][1]};
   const response=await api('/api/inference',{customer_id:cid,property:raw});
   if(S.user!==user||runs.get(identity)!==run)return;
   run.results.push(response.result);
  }catch(error){if(S.user===user)run.error=error.message;}
  finally{
   run.busy=false;
   if(S.user===user&&S.cid===cid&&runs.get(identity)===run)refresh();
  }
 });
 return {panel,reset:()=>runs.clear()};
})();
