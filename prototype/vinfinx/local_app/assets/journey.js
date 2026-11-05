'use strict';
const journey = (() => {
  const steps = [
    ['goal','Choose a goal','overview'], ['property','Enter property details','property'],
    ['valuation','Understand the price range','property'], ['documents','Income evidence','documents'],
    ['health','Financial health','health'], ['loan','Loan scenario','loan'],
    ['chat','Ask Finx','chat'], ['advisor','Advisor and report','advisor']
  ];
  const goals = {
    property:['Explore my property value','See an estimated asking-price range.','⌂'],
    health:['Check my financial health','Review cash flow, debt and savings.','◎'],
    loan:['Explore a borrowing scenario','Compare estimated monthly payments.','▦']
  };
  const modes = {guided:'Guided',standard:'Standard',explore:'Explore'};
  const statuses = {
    USER_PROVIDED:'Self-reported', OCR_PENDING:'OCR pending review', HUMAN_VERIFIED:'Verified',
    MODEL_ESTIMATED:'Model estimate', SIMULATED:'Simulated', MISSING:'Missing data',
    STALE:'Needs updating', CONFLICTING:'Conflicting evidence'
  };
  const suggestions = {
    overview:['Explain my financial health score','How do I get a property price range?','Where can I find my report?'],
    property:['What is my saved property price range?','What details do I need for a property valuation?','Can market rumors change my property estimate?'],
    health:['Why did I get this financial health score?','What is an emergency fund?','Has my income been verified?'],
    documents:['Has my payslip been verified?','What income evidence am I missing?'],
    loan:['Explain this loan scenario','Where can I estimate monthly repayments?'],
    advisor:['Where can I view my report?','How do I contact an advisor?'],
    clients:['Explain the financial health score','Where is this profile report?'],
    appointments:['I want to review the report before my consultation']
  };
  const actions = {OPEN_PROPERTY:'property',OPEN_HEALTH:'health',OPEN_DOCUMENTS:'documents',OPEN_LOAN:'loan',OPEN_REPORT:'advisor'};
  const analyticsKey='vinfinx.walkthrough.counts.v1';
  const initial=()=>({mode:'standard',goal:null,step:0,active:false,finished:false,done:[],skipped:[]});
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
  };
  const write = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch (_) { return false; } };
  let state=initial(), account=null, sheet=null, transition=false;
  const stepId=()=>steps[state.step][0];
  const pageFor=([id,,view])=>['loan','chat','advisor'].includes(id)?'overview':view;
  const showing=(view=S.view)=>state.active && pageFor(steps[state.step])===view;
  const canSkip=()=>stepId()!=='goal' && (stepId()!=='property'||state.goal!=='property');
  const canNext=()=>stepId()!=='goal' && (stepId()!=='property'||state.done.includes('property'));
  const saveState=next=>{
    if(account && !write(storageKey(),next)) throw Error('Progress could not be saved on this device. Enable browser storage and try again.');
    state=next;
  };
  const storageKey=()=> 'vinfinx.walkthrough.v1.'+account;
  function load(user, showWelcome=false) {
    account=user.role==='customer'?user.id:null;
    const value=account?read(storageKey(),null):null;
    state=account&&showWelcome&&!value?{...initial(),mode:'guided',active:true}:initial();
    if(value && Object.hasOwn(modes,value.mode) && Number.isInteger(value.step) && steps[value.step]){
      state={...state,mode:value.mode,step:value.step,goal:Object.hasOwn(goals,value.goal)?value.goal:null,
        active:Boolean(value.active),finished:value.finished===true,done:Array.isArray(value.done)?value.done.filter(id=>steps.some(s=>s[0]===id)):[],
        skipped:Array.isArray(value.skipped)?value.skipped.filter(id=>steps.some(s=>s[0]===id)):[]};
    }
  }
  function save() { if(account) write(storageKey(),state); }
  function track(event,detail) {
    const allowed=['step_completed','step_skipped','step_abandoned','task_completed','feature_opened','explanation_opened','journey_finished','journey_resumed'];
    if (!allowed.includes(event) || !/^[a-z_]{1,32}$/.test(detail)) return;
    const totals=read(analyticsKey,{});
    const key=event+'.'+detail;
    totals[key]=(Number(totals[key])||0)+1;
    write(analyticsKey,totals);
  }
  function mark(id, skipped=false) {
    if(!state.active) return;
    const target=skipped?'skipped':'done';
    if(!state[target].includes(id)) {
      state[target].push(id);
      track(skipped?'step_skipped':'step_completed',id);
    }
    if(!skipped)state.skipped=state.skipped.filter(item=>item!==id);
    else state.done=state.done.filter(item=>item!==id);
    save();
  }
  function completeTask(id,cid) {
    if(cid!==S.cid) return;
    track('task_completed',id);
    if(showing() && stepId()===id && !state.done.includes(id)) mark(id);
    refresh();
  }
  function invalidateProperty() {
    state.done=state.done.filter(id=>!['property','valuation','loan'].includes(id));
    save();
    refresh();
  }
  function chip(status) {
    return `<span class="evidence-chip" data-evidence-status="${status}" title="${status}">${statuses[status]||statuses.MISSING}</span>`;
  }
  function detail(title,content,kind) {
    return `<details class="demo-details" data-explanation="${kind}"><summary>${title}</summary>${content}</details>`;
  }
  function effectiveScreen() {
    const chat=document.querySelector('#chatDialog');
    if(chat?.open && chat.dataset.screen)return chat.dataset.screen;
    if(sheet?.open)return sheet.dataset.screen;
    if(showing() && ['chat','advisor','loan'].includes(stepId()))return stepId();
    return S.view;
  }
  function questionsFor(screen) {
    return suggestions[screen] || (screen==='chat' && suggestions[state.goal]) || suggestions.overview;
  }
  function context() {
    const step=steps[state.step];
    const screen=effectiveScreen();
    return {screen,goal:state.goal,step:state.active && step[2]===screen?step[0]:null};
  }
  function helpful(summary,goal=state.goal) {
    const v=summary.evidence?.valuation?.status;
    if ((goal==='property'||goal==='loan') && v!=='MODEL_ESTIMATED')
      return ['property',v==='STALE'?'Update your saved valuation':'Enter property details to get a range'];
    if (goal==='loan') return ['loan','Review the loan scenario assumptions'];
    if (!summary.profile.verified)
      return ['documents',Object.values(summary.evidence?.documents||{}).includes('OCR_PENDING')?'Check the payslip review status':'See how income verification works'];
    return ['health','Review the financial health score breakdown'];
  }
  function home(summary) {
    const [target,label]=helpful(summary);
    const opening=showing() && stepId()==='goal';
    const modesMarkup=`<div class="mode-choice" role="group" aria-label="Experience mode">${Object.entries(modes).map(([id,name])=>
      `<button type="button" data-mode="${id}" aria-pressed="${state.mode===id}">${name}</button>`).join('')}</div>`;
    return `${opening?'':'<section class="intent-hero"><span class="eyebrow">VINFINX · SYNTHETIC DATA</span><h1 tabindex="-1">What would you like to do today?</h1><p>Explore your property value and financial health at your own pace.</p>'+modesMarkup+'</section>'}
      <div class="goal-list">${Object.entries(goals).map(([id,[name,info,icon]])=>
        `<button type="button" class="goal-card" data-goal="${id}"><span aria-hidden="true">${icon}</span><span><strong>${name}</strong><small>${info}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>
      ${opening?`<details class="demo-details story-opening-help"><summary>Not sure where to start?</summary>
        <p>Choose property value for a price range, financial health to understand your cash flow, or borrowing to explore monthly payments.</p></details>
        ${modesMarkup}`:
        `${state.mode==='explore'?'<div class="journey-direct"><button class="button" data-nav="map">Explore the area</button><button class="button" data-nav="documents">View documents</button><button class="button" data-action="chat">Ask Finx</button></div>':''}
        <article class="card helpful-card"><h2>A helpful next step</h2><button class="text-button" data-direct="${target}">${label} →</button></article>`}`;
  }
  function progress() {
    const id=stepId();
    if (!showing()) {
      return state.mode==='guided' && state.step>0
        ? '<button class="button primary" data-walk="resume">Resume walkthrough</button>' : '';
    }
    if(id==='goal')return '';
    return `<div class="journey-progress-actions">
      <button class="button" data-walk="back">Back</button>
      ${canSkip()&&id!=='advisor'?'<button class="button" data-walk="skip">Skip</button>':''}
      <button class="text-button" data-walk="pause">Pause</button>
      <button class="button primary" data-walk="next" ${canNext()?'':'disabled'}>${id==='advisor'?'Finish':'Next'}</button>
      </div>${canNext()?'':'<p class="story-state"><strong>Get a price range first.</strong> Then tap Next.</p>'}`;
  }
  function refresh() {
    const node=document.querySelector('#journeyProgress');
    if(node && S.user?.role==='customer') {
      const focused=node.contains(document.activeElement)?document.activeElement.dataset.walk:null;
      node.innerHTML=progress();
      node.hidden=!node.textContent.trim();
      if(focused)node.querySelector(`[data-walk="${focused}"]`)?.focus();
    }
  }
  function syncStory() {
    if(typeof story==='undefined')return;
    if(showing() && S.user?.role==='customer') {
      story.setStep(state.step,steps.flatMap(([id],index)=>state.done.includes(id)?[index]:[]));
    } else story.hide();
  }
  function decorate() {
    if(!S.user || typeof document==='undefined')return;
    const host=document.querySelector('#content');
    if(S.user.role==='customer') {
      if(showing()){
        host.insertAdjacentHTML('afterbegin',story.scene(stepId(),state.step,state.goal));
        if(stepId()==='goal'){
          host.querySelector('.story-chapter').insertAdjacentHTML('afterbegin',
            '<p class="story-edition"><strong>MyWealth · VinFinx × Vietcombank</strong> · Demo</p>');

        }
        if(stepId()==='loan')simulator(document.querySelector('#simulationStage'));
        if(stepId()==='advisor')void openReport(document.querySelector('#reportStage'));
      }
      host.insertAdjacentHTML(showing()?'beforeend':'afterbegin','<section class="journey-progress" id="journeyProgress" aria-label="Walkthrough navigation"></section>');
      syncStory();
      refresh();
    }
    if(S.user.role!=='authenticator' && !showing()) {
      const questions=suggestions[S.view]||[];
      host.insertAdjacentHTML('beforeend',`<section class="card finx-help"><h2>Need help?</h2>
        <button class="button" data-action="chat">Ask Finx</button>
        ${questions.map((q,i)=>`<button class="text-button" data-finx-question="${i}">${q}</button>`).join('')}</section>`);
    }
  }
  async function open(target, focus=false) {
    if(['loan','chat','advisor'].includes(target))track('feature_opened',target);
    if(target==='loan') simulator();
    else if(target==='chat')openChat();
    else if(target==='advisor')await openReport();
    else {
      await navigate(target);
      if(focus){
        const el=document.querySelector('#valuationResult');
        el?.setAttribute('tabindex','-1');el?.focus();
      }
    }
  }
  async function go() {
    document.querySelectorAll?.('dialog[open]').forEach(dialog=>dialog.close());
    await navigate(pageFor(steps[state.step]));
    refresh();
  }
  function updateStep(action) {
    const id=stepId();
    if(!state.active) return false;
    if(action==='back'){
      if(state.step===0)return false;
      saveState({...state,step:state.step-1});
      return true;
    }
    if(action!=='next'&&action!=='skip')return false;
    if(action==='skip'?!canSkip():!canNext())return false;
    const completed=action==='next'&&(id==='health'||state.done.includes(id));
    const alreadyRecorded=(completed?state.done:state.skipped).includes(id);
    const done=state.done.filter(value=>value!==id);
    const skipped=state.skipped.filter(value=>value!==id);
    (completed?done:skipped).push(id);
    const finished=state.step===steps.length-1;
    saveState({...state,done,skipped,finished,active:!finished,mode:finished?'standard':state.mode,step:finished?state.step:state.step+1});
    if(!alreadyRecorded)track(completed?'step_completed':'step_skipped',id);
    if(finished)track('journey_finished','advisor');
    return true;
  }
  function abandon() {
    if (state.active && !state.done.includes(steps[state.step][0])) track('step_abandoned',steps[state.step][0]);
  }
  function setSheet(node) { sheet=node; }
  function reset() {state=initial();account=null;sheet=null;transition=false;if(typeof story!=='undefined')story.hide();}
  function renderSuggestions() {
    const list=document.querySelector('#finxSuggestions');
    if(!list)return;
    const questions=questionsFor(effectiveScreen());
    list.innerHTML=questions.map((q,i)=>`<button type="button" class="text-button" data-finx-question="${i}">${q}</button>`).join('');
  }
  if(typeof document!=='undefined'){
    document.addEventListener('click',async event=>{
      const el=event.target.closest('[data-mode],[data-goal],[data-walk],[data-direct],[data-finx-question],[data-finx-action]');
      if(!el || !S.user)return;
      try{
        if((el.dataset.mode||el.dataset.goal||el.dataset.walk) && S.user.role==='customer'){
          if(transition)return;
          transition=true;
          const owner=S.user;
          try{
            if(Object.hasOwn(modes,el.dataset.mode)){
              if(state.active && el.dataset.mode!=='guided')abandon();
              const mode=el.dataset.mode;
              const base=state.finished?initial():state;
              saveState({...base,mode,active:mode==='guided'});
              if(state.active)await go();else await navigate('overview');
            } else if(Object.hasOwn(goals,el.dataset.goal)){
              const goal=el.dataset.goal;
              if(state.mode==='guided'){
                if(state.step>0 && state.goal===goal){
                  saveState({...state,active:true});await go();return;
                }
                if(state.step>0 && !confirm('Start with a new goal? The walkthrough will restart. Your saved profile will remain available.'))return;
                saveState({...initial(),mode:'guided',goal,active:true,done:['goal'],step:1});
                track('step_completed','goal');
                await go();
              }else{saveState({...state,goal});await open(goal);}
            } else if(el.dataset.walk==='pause' && showing()){
              abandon();saveState({...state,active:false});await navigate('overview');
            } else if(el.dataset.walk==='resume' && state.mode==='guided'){
              saveState({...state,active:true});track('journey_resumed',stepId());await go();
            } else if(el.dataset.walk && showing() && updateStep(el.dataset.walk)){
              if(state.active)await go();else await navigate('overview');
            }
          }finally{if(S.user===owner)transition=false;}
          return;
        }
        if(el.dataset.direct)await open(el.dataset.direct);
        if(el.dataset.finxAction){
          const target=actions[el.dataset.finxAction];
          if(target){document.querySelector('#chatDialog').close();await open(target);}
        }
        if(el.dataset.finxQuestion!==undefined){
          const question=questionsFor(effectiveScreen())[Number(el.dataset.finxQuestion)];
          if(question){openChat(effectiveScreen());document.querySelector('#chatInput').value=question;document.querySelector('#chatInput').focus();}
        }
      }catch(error){toast(error.message);}
    });
    document.addEventListener('toggle',event=>{
      if(S.user && event.target.open && event.target.dataset.explanation){
        const kind=event.target.dataset.explanation;
        track('explanation_opened',kind);
        if(kind==='valuation_numbers')completeTask('valuation',S.cid);
        if(kind==='health_numbers')completeTask('health',S.cid);
      }
    },true);
    window.addEventListener('pagehide',abandon);
  }
  return {load,reset,home,decorate,refresh,completeTask,chip,detail,context,renderSuggestions,setSheet,track,helpful,
          step:stepId,active:()=>state.active,abandon,showing,syncStory,go,invalidateProperty};
})();
if(typeof module!=='undefined')module.exports=journey;
