'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>{v=Number(v||0);return '₫'+(Math.abs(v)>=1e9?(v/1e9).toFixed(2)+'B':Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':v.toLocaleString('en-US',{maximumFractionDigits:0}));};
const fullMoney=v=>'VND '+Number(v||0).toLocaleString('en-US',{maximumFractionDigits:0});
const when=v=>new Date(Number(v)*1000).toLocaleString('en-US');
const sentence=v=>String(v??'').replaceAll('_',' ').replace(/^\p{L}/u,c=>c.toUpperCase());
const place=v=>String(v??'').normalize('NFC').replace(/\bquận\s+/giu,'District ').replace(/phường\s+/giu,'Ward ').replace(/đường\s+|phố\s+/giu,'Street ').replace(/(^|[\s-])\p{L}/gu,c=>c.toLocaleUpperCase('vi-VN'));
const factorLabel=v=>({'log area':'Land area (log scale)','log road':'Road width (log scale)','floors':'Number of floors','Province':'Province','District':'District'}[v]||sentence(v));
const vndAmount=v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(v)+' ₫';
const roles={customer:'Customer',advisor:'Advisor',authenticator:'Verifier'};
const statusLabel={pending:'Pending review',approved:'Approved',rejected:'Rejected',requested:'Recorded','live preview':'Preview'};
function polishOptions(){for(const option of $$('#districtSelect option,#wardSelect option,#streetSelect option'))if(option.value)option.textContent=place(option.value)+(option.textContent.includes('(saved;')?' (saved, outside the catalog)':'');}
function polishCopy(){
 for(const node of $$('.factor>span'))node.textContent=factorLabel(node.textContent);
 for(const node of $$('.component-label>span:first-child,.check,.metric-pair>span'))if(!node.children.length)node.textContent=sentence(node.textContent);
 for(const node of $$('.street-row b,#streetDetail h3'))node.textContent=place(node.textContent);
 for(const node of $$('.street-row span')){const [district,...rest]=node.textContent.split(' · ');node.textContent=[place(district),...rest].join(' · ');}
 const walker=document.createTreeWalker($('#content'),NodeFilter.SHOW_TEXT);let text;
 while((text=walker.nextNode())){if(text.parentElement.closest('.evidence,code,option,input,textarea'))continue;text.textContent=text.textContent.replace(/\bPhase1\b/g,'Phase 1').replace(/\bPhase3\b/g,'Phase 3');}
 for(const node of $$('.evidence'))node.setAttribute('tabindex','0');
}
let navigationVersion=0;
const S={user:null,view:'overview',summary:null,customers:[],cid:'minh',market:null,map:null,markers:[],status:null,previews:new Map()};
const NAV={customer:[['overview','◈','Home'],['property','⌂','Property valuation'],['health','◎','Finances'],['documents','▤','Documents'],['map','⌁','Area map']],
 advisor:[['clients','◈','Customer profiles'],['appointments','▦','Consultation'],['property','⌂','Property valuation'],['documents','▤','Customer documents']],
 authenticator:[['reviews','✓','Review queue'],['signals','⌁','Market signals'],['sources','▧','Data sources'],['audit','≡','Audit log']]};
const errorCopy={'Sign in to continue':'Please sign in again.','Email or password is incorrect':'The email or password is incorrect.',
 'Other customer records are not accessible':'You can only view your own profile.',
 'Customer is not assigned to you':'This profile is outside your assignment.',
 'This role cannot perform that action':'Your role cannot perform this action.',
 'Choose a supported Hanoi district.':'Choose a supported district in Hanoi.',
 'Area must be 10–2,000 m² and floors 1–30.':'Enter an area between 10 and 2,000 m² and between 1 and 30 floors.',
 'Choose a future appointment':'Choose a date and time in the future.'};
async function api(path,data,signal){
 const post=data!==undefined,headers=post?{'Content-Type':'application/json'}:{};
 if(post&&typeof crypto!=='undefined'&&crypto.randomUUID)headers['Idempotency-Key']=crypto.randomUUID();
 const body=post?JSON.stringify(data):undefined;
 const controller=typeof AbortController==='function'?new AbortController():null;
 const timer=controller?setTimeout(()=>controller.abort(),90000):null;
 const cancel=()=>controller?.abort();
 signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted)cancel();
 try{
  const r=await fetch(path,{method:post?'POST':'GET',credentials:'same-origin',headers,body,...(controller?{signal:controller.signal}:{})});
  const d=await r.json();if(!r.ok){if(r.status===401&&S.user)await signedOut();throw Error((errorCopy[d.error]||d.error||'Could not complete the request.')+(d.request_id?' · Reference '+d.request_id:''));}return d;
 }catch(error){if(error instanceof TypeError)throw Error('Could not connect to VinFinx. Your draft is still on this page.');if(error.name==='AbortError')throw Error('The connection timed out. Check your saved profile before retrying.');throw error;}
 finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
function button(label,action,cls='',extra=''){return `<button class="button ${cls}" data-action="${action}" ${extra}>${label}</button>`;}
function badge(status){return `<span class="pill ${status==='pending'?'warning':status==='rejected'?'danger':''}">${esc(statusLabel[status]||sentence(status))}</span>`;}
function head(title,sub,action=''){return `<div class="page-head"><div><span class="eyebrow">${esc(roles[S.user.role])}</span><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;}
function stat(label,value,note,icon='↗'){return `<article class="card hover"><div class="stat-label">${label}<span class="stat-icon">${icon}</span></div><div class="stat-number">${value}</div><div class="stat-footer">${note}</div></article>`;}
function appointmentButton(){return button('Request a consultation','appointment','primary');}
function reportButton(){return button('View report','report');}
async function signedOut(){navigationVersion++;chatRequest?.abort();chatRequest=null;$('#finxRequestStatus').hidden=true;workspace.reset();journey.abandon();journey.reset();S.previews.clear();S.user=null;S.summary=null;if(S.map){S.map.remove();S.map=null;}$('#content').replaceChildren();$('#shell').hidden=true;$('#login').hidden=false;$('#password').value='';for(const d of $$('dialog[open]'))d.close();}
async function signIn(user){S.user=user;journey.load(user,true);S.cid=user.customer_id||'minh';$('#login').hidden=true;$('#shell').hidden=false;$('#roleName').textContent=roles[user.role];$('#userName').textContent=sentence(user.email.split('@')[0]);$('#avatar').textContent=user.role.slice(0,2).toUpperCase();$('#workspaceTag').textContent=roles[user.role];$('.assistant-launcher').hidden=user.role==='authenticator';S.market=await api('/api/market').catch(()=>({districts:[],streets:[],ways:[],notice:'Could not load area data.'}));if(journey.active())await journey.go();else await navigate(NAV[user.role][0][0]);api('/api/status').then(x=>{if(S.user===user)S.status=x;}).catch(()=>{});}
async function navigate(view,cid=S.cid){if(!S.user||!NAV[S.user.role].some(x=>x[0]===view))return;workspace.remember();const version=++navigationVersion;S.cid=cid;S.view=view;if(typeof journey!=='undefined')journey.syncStory();if(S.map){S.map.remove();S.map=null;}$('#nav').innerHTML=NAV[S.user.role].map(([key,icon,label])=>`<button data-nav="${key}" class="${view===key?'active':''}" ${view===key?'aria-current="page"':''}><span>${icon}</span>${label}</button>`).join('');$('#pageLabel').textContent=NAV[S.user.role].find(x=>x[0]===view)[2];$('.sidebar').classList.remove('open');$('#content').innerHTML='<div class="loading"><div class="spinner"></div>Loading your workspace…</div>';
 try{if(S.user.role!=='authenticator'){if(S.user.role==='advisor'){const customers=await api('/api/customers');if(version!==navigationVersion)return;S.customers=customers;if(!S.customers.some(x=>x.profile.id===S.cid))S.cid=S.customers[0].profile.id;}const summary=await api('/api/summary?customer='+S.cid);if(version!==navigationVersion)return;S.summary=summary;}await render(version);if(version===navigationVersion&&S.user){workspace.restore();if(typeof journey!=='undefined'){journey.decorate();journey.track('feature_opened',view);const title=$('#content h1');title?.setAttribute('tabindex','-1');title?.focus({preventScroll:true});if(journey.showing?.())$('#content').scrollTop=0;}}}catch(e){if(version===navigationVersion)$('#content').innerHTML=`<div class="notice warning">${esc(e.message)} <button type="button" class="button" data-nav="${esc(view)}">Try again</button></div>`;}}
function healthHero(s){
 const h=s.health, labels={'Healthy':'Healthy','Building resilience':'Building resilience','Needs attention':'Needs attention'};
 return `<section class="health-hero"><div><span class="eyebrow">FINANCIAL HEALTH SCORE</span>
 <div class="score-row"><strong class="score-number">${h.score}</strong><span>/ 1,000</span></div>
 <p class="health-status"><strong>${labels[h.status]||'Illustrative score'}</strong> · Demo score</p><div class="health-takeaway"><span>Left each month</span><strong>${vndAmount(h.monthly_surplus)}</strong><small>After expenses and debt payments</small></div>
 <div class="row">${journey.chip('SIMULATED')}<span class="score-note">Higher than ${h.percentile}% of the ${h.peer_count} simulated profiles.</span></div></div></section>`;
}
function propertyCard(s){
 const p=s.property;
 if(!p||p.status==='rejected')return `<article class="card"><h2>${p?'Previous valuation was rejected':'No saved valuation'}</h2>
 ${journey.chip('MISSING')}<p>Enter the district and land area to see a price range.</p>${button('Enter property details','property','primary')}</article>`;
 const r=p.result, preview=p.status==='live preview', trace=r.inference;
 const v=s.evidence?.valuation||{status:trace?'MODEL_ESTIMATED':'MISSING',computed_at:trace?.computed_at};
 const geography=Object.entries(r.geography||{}).filter(([,state])=>state!=='seen');
 const numbers=`<p>Central estimate: <strong>${vndAmount(r.value)}</strong>.</p>
 <p>Positive and negative values show how each factor influences the model estimate.</p>
 <div>${factorList(r)}</div><p>If the range is wide, review the property details and talk to an advisor before relying on the estimate.</p>`;
 const provenance=`<dl class="trace-grid"><div><dt>Version</dt><dd>${esc(r.model_version)}</dd></div>
 <div><dt>Method</dt><dd>${r.method==='hierarchical'?'LightGBM + hierarchical calibration (research)':'LightGBM'}</dd></div>
 <div><dt>Calculated</dt><dd>${v.computed_at?when(v.computed_at):'Unavailable'}</dd></div>
 <div><dt>Training data cutoff</dt><dd>Unavailable in this record</dd></div>
 ${trace?`<div><dt>Inference ID</dt><dd>${esc(trace.id)}</dd></div><div><dt>SHA-256</dt><dd>${esc(r.model_sha256)}</dd></div>`:''}</dl>
 ${Number.isFinite(r.nominal_coverage)?`<p>Nominal prediction interval: ${Math.round(100*r.nominal_coverage)}%. Actual coverage can vary.</p>`:''}
 <p>A separate asking-price benchmark reported 33.35% median absolute percentage error and 83.5% coverage for a nominal 90% interval. These results describe the research test set.</p>
 <p>This estimate uses historical listings. Sale prices can differ from asking prices.</p>
 ${geography.length?`<p>Missing locations or locations outside the training data: ${geography.map(([key])=>esc(({district:'district',ward:'ward',street:'street'})[key]||key)).join(', ')}.</p>`:''}`;
 return `<article class="card valuation-card"><div class="card-head"><h2>Property price range</h2>${journey.chip(v.status)} ${badge(p.status)}</div>
 <p>${esc(p.input.ward?place(p.input.ward):'Ward unknown')}, ${esc(place(p.input.district))} · ${esc(p.input.area)} m²</p>
 <div class="avm-range"><span class="eyebrow">ESTIMATED ASKING PRICE</span><strong>${vndAmount(r.low)} <span>to</span> ${vndAmount(r.high)}</strong></div>
 <p><strong>Why a range?</strong> Historical asking prices vary. The sale price may differ.</p>
 ${v.status==='STALE'?'<p class="notice warning">This estimate is over 90 days old. Recalculate it before using the result.</p>':''}
 ${journey.detail('See the central estimate and key factors',numbers,'valuation_numbers')}
 ${journey.detail('See the data, model and limitations',provenance,'valuation_provenance')}
 ${preview?'<p>Save the valuation so Finx can explain this result.</p>':button('Ask Finx about this valuation','chat')}</article>`;
}
function opportunities(s){
 const [target,label]=journey.helpful(s);
 return `<article class="card"><h2>A helpful next step</h2><button class="button" data-direct="${target}">${label}</button></article>`;
}
function overview(){
 if(journey.showing()){
   if(journey.step()==='loan')return '<article class="card" id="simulationStage"></article>';
   if(journey.step()==='advisor')return '<article class="card" id="reportStage"></article>';
   if(journey.step()==='chat')return '<article class="card"><h2>What would you like to ask?</h2><p>Finx explains results using information saved in your profile.</p><button class="button primary" data-action="chat">Ask Finx AI</button></article>';
 }
 return journey.home(S.summary);
}
function propertyDraftDiff(draft,baseline){
 const defaults={subtype:'normal_house',method:'lightgbm'};
 return Object.keys(draft).some(key=>String(draft[key]??'')!==String(baseline[key]??defaults[key]??''));
}
function propertyResult(){
 const preview=S.previews.get(S.cid);
 const draft=workspace.propertyDraft();
 const saved=S.summary.property;
 const property=preview?.property||saved;
 if(property&&property.status!=='rejected'&&!matchesCatalog(property.input)){
   return '<article class="card"><h2>Check the saved address</h2><p class="notice warning">A saved location is outside the supported address path. Review the district, ward and street before calculating a new estimate.</p></article>';
 }
 if(draft && propertyDraftDiff(draft,(preview?.property||saved)?.input||{})){
   return '<article class="card"><h2>Recalculate the price range</h2><p class="notice warning">The property details have changed. Recalculate the estimate to match your draft.</p></article>';
 }
 return propertyCard(preview||S.summary);
}
function customerPicker(){return S.user.role==='advisor'?`<label>Assigned customer<select id="customerPicker">${S.customers.map(s=>`<option value="${esc(s.profile.id)}" ${s.profile.id===S.cid?'selected':''}>${esc(s.profile.name)}</option>`).join('')}</select></label>`:'';}
function propertyPage(){
 const guided=journey.showing('property');
 if(guided&&journey.step()==='valuation'){
   return `<div id="valuationResult">${propertyResult()}</div>
     <div class="row"><button class="button" data-walk="back">Edit property details</button></div>`;
 }
 const raw=S.previews.get(S.cid)?.property.input||S.summary.property?.input||{};
 const field=(name)=>esc(raw[name]??'');
 const fields=[['floors','Floors','1','30','1','3'],['frontage','Frontage (m)','0','100','.1','4'],
  ['road','Road or alley width (m)','0','100','.1','5'],['bedrooms','Bedrooms','0','100','1','3'],['bathrooms','Bathrooms','0','100','1','2']];
 const optional=fields.map(([name,label,min,max,step,example])=>`<label>${label}<input name="${name}" type="number" min="${min}" max="${max}" step="${step}" value="${field(name)}" placeholder="Example: ${example}"></label>`).join('');
 return head('Property valuation','Enter a district and land area. You can add other details later.',reportButton())+customerPicker()+
 `<div class="grid ${guided?'valuation-input-only':''}"><article class="card"><h2>Property details</h2>
 <form id="valuationForm"><div class="form-grid">
 <label>District <select name="district" id="districtSelect" required></select></label>
 ${!S.market.districts.length?'<p class="notice warning">Could not load the district list. <button class="text-button" data-action="retry-market" type="button">Reload the list</button></p>':''}
 <label>Land area (m²)<input name="area" type="number" min="10" max="2000" step=".1" value="${field('area')}" placeholder="Example: 52.3" required></label></div>
 ${journey.detail('Add optional details',`<p>Leave a field blank or choose “I do not know” if you are unsure.</p>
 <p class="tiny">Address options follow the historical listing catalog. Choose a district before choosing a ward or street.</p>
 <div class="form-grid"><label>Ward<select name="ward" id="wardSelect"></select></label><label>Street<select name="street" id="streetSelect"></select></label>${optional}
 <label>Property type<select name="subtype"><option value="normal_house">Landed house</option><option value="alley_frontage_house">Alley-front house</option><option value="frontage_house">Street-front house</option><option value="villa">Villa</option></select></label>
 <label>Method<select name="method"><option value="lightgbm">LightGBM</option><option value="hierarchical">Hierarchical calibration (research)</option></select></label></div>`,'property_optional')}
 <p class="tiny">This demo covers landed homes in Hanoi and uses historical asking prices.</p>
 <div class="form-footer"><button class="button primary" type="submit" data-preview>Get price range</button><button class="button" type="submit">Save and send for review</button></div><p class="story-state" id="valuationStatus" role="status"></p></form></article>
 <div id="valuationResult" aria-live="polite">${guided?'':propertyResult()}</div></div>`;
}
const factorNames={'Province':'Province or city','District':'District','Ward':'Ward','Street':'Street',
 'Property subtype':'Property type','log area':'Land area','log frontage':'Frontage','log road':'Road or alley width','floors':'Floors',
 'log bedrooms':'Bedroom count','log bathrooms':'Bathroom count','floors missing':'Floor count missing',
 'frontage missing':'Frontage missing','road missing':'Road width missing'};
function factorList(r){return r?.factors?.map(f=>`<div class="factor"><span>${esc(factorNames[f.factor]||f.factor)}</span><b class="${f.log_contribution>=0?'positive':'negative'}">${f.log_contribution>=0?'+':''}${f.log_contribution.toFixed(3)}</b></div>`).join('')||'<p class="tiny">Run a valuation to see the key factors.</p>';}
function districtEntry(label){return S.market.districts.find(district=>district.label===label);}
function wardEntry(district,ward){return districtEntry(district)?.wards.find(item=>item.label===ward);}
function matchesCatalog(address){
 const district=districtEntry(address.district);
 if(!district)return false;
 if(!address.ward)return !address.street;
 const ward=wardEntry(address.district,address.ward);
 return Boolean(ward&&(!address.street||ward.streets.includes(address.street)));
}
function restoreAddress(district,ward,street){
 $('#districtSelect').value=districtEntry(district)?district:'';
 populateWards(ward,street);
 if(district&&!matchesCatalog({district,ward,street})){
   $('#valuationStatus').textContent='Review the saved address. Unsupported address details were cleared from this form.';
   journey.invalidateProperty();
 }
}
function populateDistricts(){
 const raw=S.previews.get(S.cid)?.property.input||S.summary.property?.input||{};
 $('#districtSelect').innerHTML='<option value="">Select a district</option>'+S.market.districts.map(d=>`<option value="${esc(d.label)}">${esc(d.label)}</option>`).join('');
 restoreAddress(raw.district,raw.ward,raw.street);
 const form=$('#valuationForm');
 if(raw.method)form.elements.method.value=raw.method;
 if(raw.subtype)form.elements.subtype.value=raw.subtype;
}
function populateWards(ward,street){
 const options=districtEntry($('#districtSelect').value)?.wards||[];
 const select=$('#wardSelect');
 select.disabled=!options.length;
 select.innerHTML='<option value="">I do not know</option>'+options.map(w=>`<option value="${esc(w.label)}">${esc(w.label)}</option>`).join('');
 if(options.some(w=>w.label===ward))select.value=ward;
 populateStreets(street);
}
function populateStreets(street){
 const options=wardEntry($('#districtSelect').value,$('#wardSelect').value)?.streets||[];
 const select=$('#streetSelect');
 select.disabled=!options.length;
 select.innerHTML='<option value="">I do not know</option>'+options.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
 if(options.includes(street))select.value=street;
}
function scoreBreakdown(h){
 const labels=['Cash flow','Debt burden','Emergency savings','Income evidence'];
 const notes=[`After expenses and debt payments, you have ${vndAmount(h.monthly_surplus)} left each month. This component earns full points at 30% of income.`,
  `Debt payments are ${(100*h.dsr).toLocaleString('en-US',{maximumFractionDigits:1})}% of income. This component reaches zero at 60%.`,
  `Your emergency savings cover ${h.buffer_months.toLocaleString('en-US',{maximumFractionDigits:1})} months of expenses and debt payments. Six months earns full points.`,
  h.income_verified?'A verifier approved the sample payslip.':'Income is self-reported. This component can increase after evidence is approved.'];
 return `<ol class="score-breakdown">${h.breakdown.map((line,i)=>`<li><div><b>${labels[i]}</b><span>${line.points.toLocaleString('en-US',{maximumFractionDigits:1})} / ${line.max_points} points</span></div><p>${notes[i]}</p></li>`).join('')}</ol>`;
}
function healthPage(){
 const s=S.summary,p=s.profile,h=s.health;
 const fields=[['income','Monthly income','15,000,000'],['expenses','Monthly expenses','8,000,000'],['debt_payment','Monthly debt payments','2,000,000'],
  ['cash','Emergency savings','30,000,000'],['debt','Outstanding debt','100,000,000']];
 const missing=fields.filter(([key])=>s.evidence.profile[key]==='MISSING').map(([,label])=>label);
 const evidence=`<p>Income ${journey.chip(s.evidence.profile.income)}</p>
 ${s.evidence.income_disagreement?`<p>${journey.chip('CONFLICTING')} The pending payslip differs from the verified income.</p>`:''}
 <p>${missing.length?'Missing: '+missing.join(', '):'All five demo fields are available.'}</p>
 <p>Scoring version <code>${esc(h.rules_version)}</code>. The total is rounded after all components are added. This is an illustrative financial health score.</p>`;
 return head('Financial health','See what you have left after expenses, how much you have saved, and what you owe.',reportButton())+healthHero(s)+
 `<div class="grid section"><article class="card"><h2>Understand your score</h2>
 ${journey.detail('See the score breakdown',scoreBreakdown(h),'health_numbers')}
 ${journey.detail('See sources, verification and version',evidence,'health_provenance')}
 ${button('Review income evidence','documents')}</article>
 <article class="card">${journey.showing()?'<details class="demo-details"><summary>Update my figures</summary>':'<h2>Update self-reported figures</h2>'}<p><strong>Use figures you know.</strong> Income changes need another review.</p>
 <form id="profileForm"><div class="form-grid">${fields.map(([key,label,example])=>`<label>${label} (₫) ${journey.chip(s.evidence.profile[key])}
 <input type="number" name="${key}" min="0" max="1000000000000" value="${esc(p[key]??'')}" placeholder="Example: ${example}" required></label>`).join('')}</div><button class="button primary" type="submit">Save figures</button></form>${journey.showing()?'</details>':''}</article></div>`;
}
async function documentsPage(){const docs=await api('/api/documents?customer='+S.cid);return head('Documents and income','A verifier reviews the payslip before confirming income.')+`<div class="grid"><article class="card"><h3>Sample payslip</h3><p class="muted" style="margin:10px 0 17px">View this profile's synthetic payslip and track the review.</p><div class="row"><a class="button" href="/api/sample/payslip.pdf">Download PDF</a><a class="button" href="/api/sample/payslip.png">Download PNG</a></div><div class="upload-box section"><h3>Read a sample payslip</h3><p class="tiny">The demo processes samples on the app host.</p><form id="uploadForm"><label>Choose a sample format<select name="demo_sample"><option value="pdf">Text PDF</option><option value="png">Scanned PNG</option></select></label><button class="button primary" type="submit">Extract and send for review</button></form></div><p class="source-label"><strong>Human review required.</strong> Income stays unverified until approved.</p></article><article class="card"><h3>Document history</h3>${docs.length?docs.map(d=>`<div class="document-card"><div class="card-head"><b>${esc(d.name)}</b>${badge(d.status)} ${journey.chip(S.summary.evidence.documents[d.id])}</div>${journey.detail('View extracted amounts and checks',`<p class="tiny">${esc(d.extraction.engine)} · ${when(d.created)}<br>SHA256 ${esc(d.sha256.slice(0,20))}…</p>${extractionView(d.extraction)}`,'document_details')}${(d.extraction.warnings||[]).map(w=>`<p class="error">${esc(w)}</p>`).join('')}${d.note?`<p class="notice">Review note: ${esc(d.note)}</p>`:''}<a class="text-button" href="/api/documents/${d.id}/file">Download original</a></div>`).join(''):'<div class="empty">No documents yet. Try a sample payslip.</div>'}</article></div>`;}
function extractionView(ex){return `<div class="check-grid">${Object.entries(ex.checks||{}).map(([k,v])=>`<div class="check ${v?'':'fail'}">${v?'✓':'!'} ${esc(sentence(k))}</div>`).join('')}</div>${Object.keys(ex.fields||{}).length?`<div class="evidence">${Object.entries(ex.fields).map(([k,v])=>`${esc(sentence(k))}: ${fullMoney(v)}`).join('\n')}</div>`:''}${(ex.warnings||[]).map(w=>`<p class="error">${esc(w)}</p>`).join('')}<details style="margin:12px 0"><summary class="tiny">Source and position on the page</summary>${Object.entries(ex.evidence||{}).map(([k,v])=>`<p class="tiny"><b>${esc(sentence(k))}</b>: ${esc(v.text)}<br>${(v.spans||[]).map(s=>`Page ${s.page} · ${esc(s.box.map(n=>Number(n).toFixed(2)).join(', '))}`).join('<br>')||'See the original for comparison.'}</p>`).join('')}</details>`;}
function clientPage(){
 const customers=S.customers.map(s=>{
   const selected=s.profile.id===S.cid;
   const value=s.property?.status==='rejected'||s.property?.address_review_required?null:s.property?.result.value;
   return `<li class="advisor-customer ${selected?'selected-row':''}">
     <button type="button" class="text-button" data-customer="${esc(s.profile.id)}" ${selected?'aria-current="true"':''}>${esc(s.profile.name)}</button>
     <dl>
       <div><dt>Score</dt><dd>${s.health.score} <small>${esc(s.health.status)}</small></dd></div>
       <div><dt>Property estimate</dt><dd>${value==null?'Unavailable':money(value)}</dd></div>
       <div><dt>Income evidence</dt><dd>${journey.chip(s.evidence.profile.income)}</dd></div>
     </dl></li>`;
 }).join('');
 const s=S.summary;
 return head('Advisor workspace','Select an assigned synthetic profile to see its details.',appointmentButton())+
 `<div class="grid advisor-workspace">
  <article class="card"><div class="card-head"><h3>Customers</h3><span class="pill">${S.customers.length} ASSIGNED</span></div>
    <ul class="advisor-customers">${customers}</ul></article>
  <article class="card"><span class="eyebrow">SELECTED PROFILE</span><h2>${esc(s.profile.name)}</h2>
    <div class="metric-pair"><span>Financial health score</span><strong>${s.health.score}/1,000</strong></div>
    <div class="metric-pair"><span>Debt payment ratio</span><strong>${(100*s.health.dsr).toFixed(1)}%</strong></div>
    <div class="metric-pair"><span>Money left each month</span><strong>${money(s.health.monthly_surplus)}</strong></div>
    <details class="demo-details"><summary>See the score breakdown</summary>${scoreBreakdown(s.health)}</details>
    <p class="notice">${s.profile.verified?'A reviewed sample payslip supports the income figure.':'Income is self-reported.'}</p>
    <div class="row">${button('Property valuation','property')}${button('Ask Finx about this profile','chat')}${reportButton()}</div>
  </article></div><div class="section">${opportunities(s)}</div>`;
}
function appointmentsPage(){return head('Consultation requests','Requests are saved in this demo.',appointmentButton())+customerPicker()+`<article class="card"><h3>${esc(S.summary.profile.name)} · Consultation requests</h3>${S.summary.appointments.length?`<table><thead><tr><th>Date and time</th><th>Topic</th><th>Status</th></tr></thead><tbody>${S.summary.appointments.map(a=>`<tr><td>${esc(a.at.replace('T',' '))}</td><td>${esc(a.note)}</td><td>${badge(a.status)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No consultation requests yet.</div>'}</article>`;}
async function reviewPage(){const r=await api('/api/reviews');const pending=r.documents.filter(x=>x.status==='pending').length+r.properties.filter(x=>x.status==='pending').length;return head('Review customer evidence','Review payslips and valuations. Each decision is recorded in the audit log.',`<span class="pill warning">${pending} PENDING REVIEW</span>`)+`<div class="grid"><article class="card"><h3>Income evidence</h3>${r.documents.length?r.documents.map(d=>`<div class="review-item"><div class="card-head"><div><b>${esc(d.customer_name)}</b><p class="tiny">${esc(d.name)}</p></div>${badge(d.status)}</div><p class="tiny">${esc(d.extraction.engine)} · ${when(d.created)}</p>${extractionView(d.extraction)}<a class="text-button" href="/api/documents/${d.id}/file">View original</a>${reviewControls('document',d)}</div>`).join(''):'<div class="empty">No documents to review.</div>'}</article><article class="card"><h3>Property valuation</h3>${r.properties.map(p=>`<div class="review-item"><div class="card-head"><b>${esc(p.customer_name)}</b>${badge(p.status)}</div><p class="tiny">${p.input.area} m² · ${esc(place(p.input.ward))}</p><h2 style="margin:8px 0">${money(p.result.value)}</h2><p class="tiny">${money(p.result.low)} – ${money(p.result.high)} · nominal 90% prediction interval</p><p class="notice">Confirm that you reviewed the research estimate.</p><details><summary class="tiny">Model details</summary><div class="evidence">${esc(p.result.model_version)}\n${esc(p.result.model_sha256)}</div></details>${reviewControls('property',p)}</div>`).join('')}</article></div>`;}
function reviewControls(kind,item){return item.status==='pending'?`<textarea id="note-${item.id}" aria-label="Review note" maxlength="500" placeholder="Review reason (required for rejection)"></textarea><div class="row">${button('Reject','review','danger',`data-kind="${kind}" data-id="${item.id}" data-decision="reject"`)}${button(kind==='document'?'Verify sample income':'Confirm review','review','primary',`data-kind="${kind}" data-id="${item.id}" data-decision="approve" ${kind==='document'&&!item.extraction.valid_for_demo_review?'disabled':''}`)}</div>`:`<p class="tiny" style="margin-top:10px">Reviewed by ${esc(item.reviewer)}${item.note?' · '+esc(item.note):''}</p>`;}
async function auditPage(){const entries=await api('/api/audit');return head('An inspectable decision trail.','Versions, actions and hashes — no raw passwords or document text in the audit log.')+`<article class="card"><div class="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity / trace</th></tr></thead><tbody>${entries.map(a=>`<tr><td>${when(a.at)}</td><td>${esc(a.actor)}</td><td><b>${esc(a.action.replaceAll('_',' '))}</b></td><td>${esc(a.entity)}<br><small>${esc(a.detail)}</small></td></tr>`).join('')}</tbody></table></div></article>`;}
async function signalsPage(){const status=await api('/api/status');S.status=status;return head('A transparent service picture.','Local workflows stay usable when the research server is unavailable.')+`<div class="grid three">${stat('AVM engine','Local CPU','Frozen LightGBM artifact + model hash','⌂')}${stat('Qwen connection',status.qwen.online?'Online':'Evidence mode',status.qwen.online?'Private loopback evidence selection':'Deterministic explanations','✦')}${stat('Customer data','Local SQLite','No bank integration or real bank records','◈')}</div><div class="grid section"><article class="card"><h3>Macro research pipeline</h3><p class="muted" style="margin:13px 0">The research pipeline requires a separate API and approved corpus. It is not included in this recording package.</p><a class="button" href="/research/" target="_blank" rel="noopener">Research pipeline status ↗</a><p class="notice">This local release does not invent macro observations or silently adjust AVM prices. Research mappings and policy remain provisional.</p></article><article class="card"><h3>Online path</h3><div class="metric-pair"><span>Profile inputs</span><strong>Self-reported / synthetic</strong></div><div class="metric-pair"><span>Document extraction</span><strong>Synthetic samples · ${esc(status.ocr.image_engine)}</strong></div><div class="metric-pair"><span>Verification</span><strong>Deterministic + human</strong></div><div class="metric-pair"><span>Chat</span><strong>Authorized evidence only</strong></div><div class="metric-pair"><span>Financial decisions</span><strong>No automatic approval</strong></div></article></div>`;}
function sourcesPage(){return head('Know where every number comes from.','Separate simulated customer facts from observed listing data and model estimates.')+`<div class="grid"><article class="card"><h3>Local evidence registry</h3><table><thead><tr><th>Source</th><th>Nature</th><th>Use</th></tr></thead><tbody><tr><td>Customer profiles</td><td>Synthetic / self-reported</td><td>Demo financial-health rules</td></tr><tr><td>Sample payslip</td><td>Fictional employer, visibly watermarked</td><td>Extraction and review workflow</td></tr><tr><td>LightGBM Phase1</td><td>Research model of asking prices</td><td>Indicative home estimate</td></tr><tr><td>Area statistics</td><td>Historical Phase1 listing aggregates</td><td>Exploration, not appraisal</td></tr><tr><td>OpenStreetMap</td><td>Public map tiles only</td><td>Basemap, not price data</td></tr><tr><td>Peer comparison</td><td>100 seeded synthetic scores</td><td>Illustrative percentile</td></tr></tbody></table></article><article class="card"><h3>Research sources & mappings</h3><p class="muted" style="margin:15px 0">The separate source-list, corpus, gold-label and mapping services are not included in this recording package.</p><a class="button" href="/research/" target="_blank" rel="noopener">Research pipeline status ↗</a><p class="notice">A separate server API is needed for that console. This app's login is not production SSO for the legacy research services.</p><p class="tiny">Partner logo sourced from Vietcombank's official website; use authorized by the project owner. This demo is not a bank-issued application.</p></article></div>`;}
function mapPage(){return head('Explore the area','Explore historical asking prices by street. Find your own estimate under Property valuation.')+`<article class="card"><div class="row" style="justify-content:space-between;margin-bottom:20px"><h3>Hanoi area map</h3><input id="streetSearch" aria-label="Search by street or district" placeholder="Example: Ba Đình" style="max-width:300px;margin:0"></div><div class="map-layout"><div><div id="map"></div><p class="tiny" style="margin-top:10px">OpenStreetMap basemap. Markers show approximate district centers.</p></div><div><div id="streetDetail" class="notice">Select a street to see its historical asking-price range.</div><div id="streetList" class="street-list"></div></div></div><p class="source-label">${esc(S.market.source)}. ${esc(S.market.notice)}</p></article>`;}
function initMap(){if(window.L){S.map=L.map('map',{scrollWheelZoom:false}).setView([21.025,105.82],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(S.map);for(const way of S.market.ways||[]){const st=S.market.streets[way.street_index];L.polyline(way.coords,{color:'#087b46',weight:5}).addTo(S.map).bindTooltip(esc(st.name)+' · '+money(st.median)+'/m²').on('mouseover',()=>selectStreet(way.street_index)).on('click',()=>selectStreet(way.street_index));}if(S.market.ways?.length)$('#map').nextElementSibling.textContent='Highlighted roads: public OpenStreetMap geometry. Other pins: approximate district centers. Neither represents parcel boundaries.';}else $('#map').innerHTML='<div class="empty">Could not load the map. You can still use the street list.</div>';filterStreets('');}
function filterStreets(q){const rows=S.market.streets.filter(x=>(x.name+' '+x.district).toLowerCase().includes(q.toLowerCase())).slice(0,80);$('#streetList').innerHTML=rows.map(x=>`<div class="street-row" tabindex="0" data-street="${S.market.streets.indexOf(x)}"><b>${esc(place(x.name))}</b><span>${esc(place(x.district))} · ${x.n} observations</span><strong style="float:right">${money(x.median)}/m²</strong></div>`).join('')||'<div class="empty">No matching streets.</div>';if(S.map){S.markers.forEach(m=>m.remove());S.markers=rows.slice(0,12).map(x=>L.circleMarker(x.center,{radius:7,color:'#087b46',fillOpacity:.55}).addTo(S.map).bindTooltip(esc(place(x.name))+' · '+money(x.median)+'/m²').on('mouseover',()=>selectStreet(S.market.streets.indexOf(x))));}}
function selectStreet(i){const x=S.market.streets[i];if(!x)return;$('#streetDetail').innerHTML=`<span class="eyebrow">Asking-price statistics</span><h3>${esc(place(x.name))}</h3><div class="stat-number">${money(x.median)}/m²</div><p>Middle 50% of observations: ${money(x.low)} – ${money(x.high)}/m²</p><small>${x.n} historical observations · ${esc(place(x.district))}<br>Markers show district centers. Prices are indicative.</small>`;}
async function render(version=navigationVersion){let content='';switch(S.view){case'overview':content=overview();break;case'property':content=propertyPage();break;case'health':content=healthPage();break;case'documents':content=await documentsPage();break;case'clients':content=clientPage();break;case'appointments':content=appointmentsPage();break;case'reviews':content=await reviewPage();break;case'audit':content=await auditPage();break;case'signals':content=await signalsPage();break;case'sources':content=sourcesPage();break;case'map':content=mapPage();break;}if(version!==navigationVersion||!S.user)return;$('#content').innerHTML=content;polishCopy();if(S.view==='property'&&$('#valuationForm')){populateDistricts();polishOptions();}if(S.view==='map')initMap();}
// UI convenience only: the API independently enforces read-only Advisor access to evidence.
const renderContent=render;
render=async function(version){await renderContent(version);if(version!==navigationVersion||!S.user)return;if(S.user.role==='advisor'){
  $$('[data-action="documents"]').forEach(b=>b.textContent='Review customer evidence →');
  if(S.view==='documents'&&$('.upload-box'))$('.upload-box').innerHTML='<h3>Read-only documents</h3><p class="muted">Customers submit sample payslips. You can check their review status here.</p>';
}};
const mobileBrand=document.createElement('span');mobileBrand.className='mobile-brand';mobileBrand.textContent='VinFinx';$('header').insertBefore(mobileBrand,$('.header-right'));
let chatOpener=null, chatRequest=null;
function positionStoryChat(){
 const dialog=$('#chatDialog');
 if(!dialog.open || !dialog.classList.contains('story-chat'))return;
 const viewport=window.visualViewport;
 const visible={left:viewport?.offsetLeft||0,top:viewport?.offsetTop||0,
   width:viewport?.width||innerWidth,height:viewport?.height||innerHeight};
 const device=$('#iosViewport')?.getBoundingClientRect();
 const bottom=Math.min(visible.top+visible.height,innerHeight,device?.bottom??Infinity);
 const top=Math.max(visible.top,device?.top??0);
 const left=Math.max(visible.left,device?.left??0);
 const right=Math.min(visible.left+visible.width,innerWidth,device?.right??Infinity);
 const mobile=device||visible.width<680;
 const width=Math.max(0,Math.min(right-left-16,mobile?560:430));
 const height=Math.max(0,Math.min(bottom-top-16,mobile?600:760));
 dialog.classList.toggle('compact-chat',height<400);
 const bounds={top:bottom-height-8,left:mobile?left+(right-left-width)/2:right-width-8,right:'auto',width,height};
 for(const [key,value] of Object.entries(bounds))dialog.style.setProperty('--finx-chat-'+key,typeof value==='number'?value+'px':value);
}
let chatPositionFrame=0;
function queueChatPosition(){
 cancelAnimationFrame(chatPositionFrame);
 chatPositionFrame=requestAnimationFrame(positionStoryChat);
}
window.visualViewport?.addEventListener('resize',queueChatPosition);
window.visualViewport?.addEventListener('scroll',queueChatPosition);
window.addEventListener('resize',queueChatPosition);
$('#chatDialog').addEventListener('close',()=>{
 const dialog=$('#chatDialog');
 if(dialog.open)return;
 if(chatOpener?.isConnected)chatOpener.focus({preventScroll:true});
 chatOpener=null;
});
function openChat(screen){
 if(!S.user||S.user.role==='authenticator')return;
 const dialog=$('#chatDialog');
 const guided=S.user.role==='customer'&&journey.showing();
 if(guided&&dialog.open&&!dialog.classList.contains('story-chat'))dialog.close();
 if(!dialog.open){
   chatOpener=document.activeElement;
   dialog.classList.toggle('story-chat',guided);
   if(guided) dialog.dataset.screen=journey.context().screen;
 }
 if(screen==='loan'||screen==='advisor'){
   $$('dialog[open]').filter(d=>d!==dialog).forEach(d=>d.close());
   dialog.dataset.screen=screen;
 } else if(!dialog.open && !guided)delete dialog.dataset.screen;
 workspace.syncChat();
 if(!$('#messages').children.length)workspace.message(S.cid,'Ask about property prices, verified income or the financial health score. Finx uses information from the profile you are viewing.');
 if(!dialog.open){
   if(guided)dialog.showModal();else dialog.show();
 }
 positionStoryChat();
 journey.renderSuggestions();
 (guided?dialog.querySelector('[data-close]'):$('#chatInput')).focus({preventScroll:true});
}
function appendMessage(text,user=false,meta='',action=null){
 const div=document.createElement('div');div.className='bubble'+(user?' user':'');div.textContent=text;
 if(meta){const small=document.createElement('small');small.textContent=meta;div.appendChild(small);}
 const labels={OPEN_PROPERTY:'Open property valuation',OPEN_HEALTH:'Open finances',OPEN_DOCUMENTS:'View documents',OPEN_LOAN:'Open loan scenario',OPEN_REPORT:'View report'};
 if(labels[action]){
   const link=document.createElement('button');link.type='button';link.className='text-button';
   link.dataset.finxAction=action;link.textContent=labels[action];div.appendChild(link);
 }
 $('#messages').appendChild(div);$('#messages').scrollTop=999999;
}
function sheet(id, screen){
 let node=$('#'+id);
 if(!node){node=document.createElement('dialog');node.id=id;$('#iosViewport')?.appendChild(node);if(!node.isConnected)document.body.appendChild(node);}
 node.dataset.screen=screen;journey.setSheet(node);node.setAttribute('aria-labelledby',id+'Title');
 return node;
}
function simulator(host=null, amount=workspace.loanAmount()){
 const d=host||sheet('simulationDialog','loan');
 const s=S.summary,h=s.health,a=h.loan_assumptions,principal=amount??h.illustrative_borrowing_capacity;
 const rates=[Math.max(0,a.annual_rate-.02),a.annual_rate,a.annual_rate+.02];
 const terms=rates.map(rate=>repaymentScenario(principal,rate,a.term_months,s.profile.income,s.profile.debt_payment));
 const base=terms[1],pct=v=>(v*100).toLocaleString('en-US',{maximumFractionDigits:1})+'%';
 const shortSchedule=base.schedule.slice(0,3).map(row=>`<tr><th scope="row">${row.month}</th><td>${vndAmount(row.payment)}</td><td>${vndAmount(row.capital)}</td><td>${vndAmount(row.interest)}</td><td>${vndAmount(row.balance)}</td></tr>`).join('');
 const draft=workspace.propertyDraft();
 const savedInputs=s.property?.input;
 const currentProperty=s.evidence.valuation.status==='MODEL_ESTIMATED'&&savedInputs&&matchesCatalog(savedInputs)&&(!draft||!propertyDraftDiff(draft,savedInputs));
 const missing=amount===null&&!currentProperty;
 d.innerHTML=`<div class="dialog-head"><h2 id="simulationDialogTitle">Loan scenario</h2><button type="button" class="icon" data-close="simulationDialog" aria-label="Close loan scenario">×</button></div>
 ${journey.chip('SIMULATED')}
 <p>See how monthly payments change at different assumed rates. This is an illustrative scenario.</p>
 ${missing?`<p class="notice">${journey.chip(s.evidence.valuation.status)} Enter a hypothetical amount. A property-backed scenario requires a current saved estimate.</p>`:
 `<p>${amount===null?'Illustrative loan amount':'Your hypothetical amount'} <strong>${vndAmount(principal)}</strong>. Estimated payment: <strong>${vndAmount(base.payment)} per month</strong>.</p>
 ${journey.detail('Compare rates and repayment schedules',`<ul>${terms.map((item,i)=>`<li>Assumed annual rate ${pct(rates[i])}: ${vndAmount(item.payment)} per month. Total debt payments: ${item.burden===null?'unavailable because income is zero':pct(item.burden)+' of income'}.</li>`).join('')}</ul>
 <div class="table-wrap" tabindex="0" aria-label="First three payments"><table><caption>First three payments at the base rate</caption><thead><tr><th>Month</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead><tbody>${shortSchedule}</tbody></table></div>`,'loan_numbers')}`}
 ${journey.detail('See scenario assumptions',`<p>The scenario assumes equal monthly payments over ${a.term_months} months at a base annual rate of ${pct(a.annual_rate)}. Demo rules cap total debt payments at ${pct(a.max_dsr)} of income and use ${pct(a.ltv)} of the reference property value less existing debt. The calculation excludes fees and future rate changes. Bank terms are determined separately.</p>`,'loan_assumptions')}
 <form class="scenario-input"><label>Hypothetical loan amount (₫)<input name="amount" type="number" min="1" max="1000000000000" step="1" value="${amount??''}" placeholder="Example: 500,000,000" required></label><button class="button" type="submit">Calculate payments</button></form>
 <div class="row">${button('Ask Finx about this scenario','chat','','data-screen="loan"')}${host?'':button('Close','', '','data-close="simulationDialog"')}</div>`;
 d.querySelector('.scenario-input').addEventListener('submit',event=>{
   event.preventDefault();event.stopPropagation();
   const field=event.currentTarget.elements.amount;
   if(field.checkValidity()){
     workspace.loanAmount(field.valueAsNumber);
     simulator(host,field.valueAsNumber);
     d.querySelector('h2').setAttribute('tabindex','-1');d.querySelector('h2').focus();
   }
 });
 if(!host&&!d.open)d.showModal();
 if(!missing)journey.completeTask('loan',S.cid);
}
async function openReport(host=null){
 const cid=S.cid, user=S.user;
 const d=host||sheet('reportDialog','advisor');
 d.innerHTML='<div class="dialog-head"><h2 id="reportDialogTitle">Advisor and report</h2><button type="button" class="icon" data-close="reportDialog" aria-label="Close report">×</button></div><p role="status">Loading the report preview…</p>';
 if(!host&&!d.open)d.showModal();
 const visible=()=>d.isConnected&&(host||d.open)&&cid===S.cid&&user===S.user;
 let preview;
 try {preview=await api('/api/report/preview?customer='+encodeURIComponent(cid));}
 catch(error){
   if(visible()){
     const status=d.querySelector('[role=status]');
     status.textContent=error.message;
     const retry=document.createElement('button');retry.type='button';retry.className='button';retry.textContent='Reload report';
     retry.addEventListener('click',()=>openReport(host));status.after(retry);
   }
   return;
 }
 if(!visible())return;
 const parsed=new DOMParser().parseFromString(preview.html,'text/html');
 // The same-origin renderer returns only escaped, fixed-template markup.
 d.querySelector('[role=status]').outerHTML=`<p>Review your saved information before downloading a copy. The report includes saved records only.</p>
 ${journey.detail('Open full report preview',`<div class="report-preview">${parsed.body.innerHTML}</div>`,'report_provenance')}
 <form id="reportConsentForm"><label class="consent"><input type="checkbox" name="consent" required> I reviewed the report and agree to download a copy.</label>
 <button class="button primary" type="submit">Download HTML report</button></form>
 <div class="row">${appointmentButton()}${button('Ask Finx','chat','','data-screen="advisor"')}</div>`;
 const details=d.querySelector('details'), form=d.querySelector('form');
 form.hidden=true;
 details.addEventListener('toggle',()=>{if(details.open)form.hidden=false;});
 form.dataset.digest=preview.digest;form.dataset.customer=cid;
}
async function exportReport(form){
 const cid=form.dataset.customer,user=S.user;
 if(!form.elements.consent.checked||cid!==S.cid)return;
 const result=await api('/api/report/export',{customer_id:cid,digest:form.dataset.digest,consent:true});
 if(user!==S.user||cid!==S.cid)return;
 const url=URL.createObjectURL(new Blob([result.html],{type:'text/html;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='vinfinx-report.html';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 form.reset();journey.completeTask('advisor',cid);toast('Report ready to download.');
}
document.addEventListener('click',async e=>{const el=e.target.closest('button,a');if(!el)return;try{if(el.dataset.close){$('#'+el.dataset.close).close();return;}if(el.dataset.nav){await navigate(el.dataset.nav);return;}if(el.dataset.customer){await navigate(S.view,el.dataset.customer);return;}const a=el.dataset.action;if(!a)return;if(['property','documents'].includes(a)){if(!NAV[S.user.role].some(x=>x[0]===a)){toast('Verifiers handle document reviews.');return;}await navigate(a);}if(a==='retry-market'){S.market=await api('/api/market');await navigate(S.view);return;}if(a==='chat')openChat(el.dataset.screen);if(a==='report')await openReport();if(a==='simulate')simulator();if(a==='appointment'){for(const d of $$('dialog[open]'))d.close();$('#appointmentDialog').dataset.customer=S.cid;$('#appointmentDialog').showModal();}if(a==='review'){const note=$('#note-'+el.dataset.id).value.trim();if(el.dataset.decision==='approve'&&!confirm('Confirm you reviewed this synthetic profile?'))return;el.disabled=true;const outcome=await workspace.run('Save review decision','review',()=>api('/api/review',{kind:el.dataset.kind,id:el.dataset.id,action:el.dataset.decision,note}));if(outcome.stale)return;toast('Review decision saved.');if(S.view==='reviews')await navigate('reviews');}}catch(err){toast(err.message);el.disabled=false;}});
document.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target,submit=form.querySelector('[type=submit]'),submitButtons=[...form.querySelectorAll('[type=submit]')];
 const cid=S.cid,user=S.user,view=S.view;
 const current=()=>S.user===user&&S.cid===cid&&S.view===view;
 submitButtons.forEach(button=>button.disabled=true);
 try{
  if(form.id==='loginForm'){const r=await api('/api/login',{email:$('#email').value,password:$('#password').value});$('#loginError').textContent='';await signIn(r.user);}
  if(form.id==='valuationForm'){
   workspace.remember();const property=Object.fromEntries(new FormData(form));
   const status=$('#valuationStatus');story.pose('thinking');status.textContent='Calculating a range from the property details…';
   const renderEstimate=()=>{
     const matches=!propertyDraftDiff(Object.fromEntries(new FormData(form)),property);
     $('#valuationResult').innerHTML=journey.showing()?'':propertyResult();
     if(matches){journey.completeTask('property',cid);story.pose('success');}
     status.textContent=matches?'The price range is ready. You can continue.':'The property details changed during calculation. Run the estimate again.';
     polishCopy();
   };
   if(e.submitter?.dataset.preview!==undefined){
    const outcome=await workspace.run('Calculate price range','valuation',()=>api('/api/inference',{customer_id:cid,property}));
    if(outcome.stale)return;
    const preview={property:{input:property,result:outcome.result.result,status:'live preview'}};
    S.previews.set(cid,preview);
    if(current()&&form.isConnected)renderEstimate();
    toast('Price range calculated. This is an unsaved preview.');return;
   }
   const outcome=await workspace.run('Calculate valuation','valuation',async()=>{await api('/api/valuation',{customer_id:cid,property});return api('/api/summary?customer='+cid);});
   if(outcome.stale)return;S.previews.delete(cid);
   if(current()&&form.isConnected&&!propertyDraftDiff(Object.fromEntries(new FormData(form)),property))workspace.clearDraft('property',cid);
   if(current()&&form.isConnected) {S.summary=outcome.result;renderEstimate();}
   toast('Valuation saved and sent for review.');
  }
  if(form.id==='profileForm'){
   const outcome=await workspace.run('Save financial profile','profile',()=>api('/api/profile',Object.fromEntries(new FormData(form))));
   if(outcome.stale)return;journey.completeTask('health',cid);workspace.clearDraft('health',cid);toast('Profile saved. Income changes require another review.');if(current()){$('#content').replaceChildren();await navigate('health');}
  }
  if(form.id==='uploadForm'){
   const sample=new FormData(form).get('demo_sample');
   const outcome=await workspace.run('Read a sample payslip','upload',()=>api('/api/upload',{demo_sample:sample}));if(outcome.stale)return;journey.completeTask('documents',cid);workspace.clearDraft('documents',cid);toast(outcome.result.duplicate?'The sample payslip is already on file.':'Sample payslip extracted. Income is pending review.');if(current()){$('#content').replaceChildren();await navigate('documents');}
  }
  if(form.id==='chatForm'){
   const text=$('#chatInput').value.trim();if(!text)throw Error('Enter a question before sending.');
   const input=$('#chatInput'), status=$('#finxRequestStatus');
   input.value='';workspace.clearDraft('chat',cid);workspace.message(cid,text,true);
   const request=new AbortController();chatRequest=request;
   status.hidden=false;status.textContent='Finx is checking the information available to this profile. ';
   const cancel=document.createElement('button');cancel.type='button';cancel.className='text-button';cancel.textContent='Stop waiting';status.appendChild(cancel);
   cancel.addEventListener('click',()=>request.abort(),{once:true});
   story.pose('thinking');
   const context=journey.context();
   try {
     const outcome=await workspace.run('Explain the profile','chat',()=>api('/api/chat',{customer_id:cid,message:text,context},request.signal));
     if(outcome.stale)return;const r=outcome.result;
     const mode=r.mode==='Qwen evidence selection'?'Qwen · Based on saved evidence':'Limited assistance · Based on saved evidence';
     workspace.message(cid,r.message,false,mode+(r.evidence_ids.length?' · Sources: '+r.evidence_ids.join(', '):''),r.action_id);
     status.hidden=true;journey.completeTask('chat',cid);
   }catch(error){
     if(S.user===user&&S.cid===cid){
       status.textContent=request.signal.aborted?'Stopped waiting. You can send the question again.':error.message+' You can send it again.';
       if(!input.value){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));}
     }
   }finally{
     if(chatRequest===request){chatRequest=null;story.pose('idle');}
   }
  }
  if(form.id==='reportConsentForm'){await exportReport(form);}
  if(form.id==='appointmentForm'){
   const outcome=await workspace.run('Save consultation request','appointment',()=>api('/api/appointment',{customer_id:$('#appointmentDialog').dataset.customer,at:$('#appointmentAt').value,note:$('#appointmentNote').value}));
   if(outcome.stale)return;journey.completeTask('advisor',cid);$('#appointmentDialog').close();form.reset();toast('Consultation request saved in the demo.');if(current()&&S.view==='appointments')await navigate('appointments');
  }
 }catch(err){if(form.id==='loginForm')$('#loginError').textContent=err.message;else if(S.user===user){
   if(form.id==='valuationForm'&&form.isConnected){
     $('#valuationStatus').textContent=err.message+' Check the details and try again.';
     story.pose('error');
   }
   toast(err.message);
 }}
 finally{submitButtons.forEach(button=>button.disabled=false);workspace.syncBusy();}
});
document.addEventListener('change',async e=>{if(e.target.id==='districtSelect')populateWards();if(e.target.id==='wardSelect')populateStreets();if(['districtSelect','wardSelect'].includes(e.target.id)){polishOptions();workspace.remember();}if(e.target.id==='customerPicker')await navigate(S.view,e.target.value);});
document.addEventListener('invalid',e=>{
 if(e.target.form?.id!=='valuationForm')return;
 const notice=$('#valuationStatus');
 notice.textContent=e.target.name==='area'?'Enter a land area between 10 and 2,000 m².':'Check the district and property details.';
 story.pose('error');
},true);
document.addEventListener('input',e=>{
 if(e.target.id==='streetSearch')filterStreets(e.target.value);
 if(e.target.closest('#valuationForm')){
   journey.invalidateProperty();
   const status=$('#valuationStatus');
   if(status)status.textContent='Recalculate the estimate after editing the property details.';
   if(!journey.showing())$('#valuationResult').innerHTML=propertyResult();
 }
});
document.addEventListener('mouseover',e=>{const row=e.target.closest('[data-street]');if(row)selectStreet(Number(row.dataset.street));});
document.addEventListener('click',e=>{const row=e.target.closest('[data-street]');if(row)selectStreet(Number(row.dataset.street));});
document.addEventListener('focusin',e=>{const row=e.target.closest('[data-street]');if(row)selectStreet(Number(row.dataset.street));});
$('#togglePassword').addEventListener('click',()=>{const show=$('#password').type==='password';$('#password').type=show?'text':'password';$('#togglePassword').textContent=show?'Hide':'Show';$('#togglePassword').setAttribute('aria-pressed',String(show));});
$('#logout').addEventListener('click',async()=>{try{await api('/api/logout',{});}finally{await signedOut();}});
$('#menu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
api('/api/me').then(r=>{if(r.user)signIn(r.user).catch(e=>toast(e.message));}).catch(e=>{$('#loginError').textContent=e.message;});
