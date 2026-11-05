'use strict';
// Run against an isolated, provisioned synthetic pilot, never a shared customer database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require(process.env.VINFINX_PLAYWRIGHT || 'playwright');
const base = process.env.VINFINX_TEST_URL;
const state = process.env.VINFINX_TEST_STATE;
const out = process.env.VINFINX_TEST_OUTPUT || path.join(__dirname,'../qa-results');
assert(base && new URL(base).hostname==='127.0.0.1' && state && process.env.VINFINX_TEST_ISOLATED==='1');
const accounts = JSON.parse(fs.readFileSync(path.join(state,'pilot_accounts.json'),'utf8'));
fs.mkdirSync(out,{recursive:true});
const sizes = [[320,568],[360,640],[375,667],[390,844],[393,852],[430,932],[768,1024],[1024,768],[1280,800],[1440,900]];
const chapters = ['Your goal today','Tell us about your property','Understand the price range','Add income evidence',
  'Your financial picture','Try a borrowing scenario','Ask Finx a question','Prepare for a consultation'];
const inferenceTimes = [];
const settle = async page => page.locator('#finxTrack .finx-walker[data-motion=idle]').waitFor();
const stage = async (page,index) => {
  await page.locator('#storyTitle').filter({hasText:chapters[index]}).waitFor();
  await page.locator(`#finxTrack [data-waypoint="${index}"].current`).waitFor();
};
async function login(page,index=0,ios=true){
  await page.goto(base+(ios?'/?demo=ios':'/'));
  const a=accounts.find(item=>item.id===`customer0${index+1}`);
  await page.locator('#email').fill(a.email);
  await page.locator('#password').fill(a.password);
  await page.locator('#loginForm [type=submit]').click();
  await stage(page,0);
}
async function checkFont(page){
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert(await page.evaluate(()=>[...document.fonts].some(f=>f.family.includes('VinFinx Nunito')&&f.status==='loaded')), 'Bundled font must load');
  assert((await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily)).includes('VinFinx Nunito'));
  const text=await page.locator('body').innerText();
  assert(!/Hỏi Finx|Hồ sơ|Khách hàng|Tiếp tục|Giả định|Chờ duyệt|Tải báo cáo/u.test(text),'English UI contains untranslated copy');
}
async function bounds(page, chat=false){
  const errors=await page.evaluate(chat=>{
    const issues=[], content=document.querySelector('#content'), dock=document.querySelector('#finxTrack');
    const bounds=el=>el.getBoundingClientRect();
    const visible=el=>el.checkVisibility?el.checkVisibility():Boolean(el.getClientRects().length);
    const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    if(document.documentElement.scrollWidth>innerWidth+1)issues.push('page horizontal overflow');
    if(content.scrollWidth>content.clientWidth+2)issues.push('story horizontal overflow');
    if(visible(dock)){
      if(intersects(bounds(content),bounds(dock)))issues.push('dock overlaps content');
      const bird=dock.querySelector('.finx-character'), help=dock.querySelector('.finx-help-link');
      if(intersects(bounds(bird),bounds(help)))issues.push('bird overlaps help');
      const current=dock.querySelector('.finx-waypoints .current');
      if(current&&dock.querySelector('.finx-walker').dataset.motion==='idle'){
        const [foot,marker]=[bounds(bird),bounds(current)];
        if(Math.abs((foot.left+foot.right-marker.left-marker.right)/2)>2)issues.push('bird is off its current waypoint');
      }
      if(bounds(bird).width<44||bounds(bird).height<44)issues.push('bird tap target too small');
      if(!chat&&bounds(dock).bottom>innerHeight+1 && document.querySelector('.ios-device')?.offsetHeight<=innerHeight)issues.push('dock below viewport');
      if([...bird.querySelectorAll('img')].some(img=>!img.complete||!img.naturalWidth))issues.push('missing mascot assets');
    }
    for(const el of content.querySelectorAll('.story-dialogue, .goal-card, .button, .avm-range, .notice')){
      if(visible(el)&&el.clientWidth>0&&el.scrollWidth>el.clientWidth+2)issues.push('clipped '+el.textContent.slice(0,36));
    }
    const screen=document.querySelector('.ios-screen');
    if(screen){
      const r=bounds(screen);
      for(const selector of ['#iosViewport','#iosTabbar','.ios-home-area']){
        const el=document.querySelector(selector);
        if(el&&visible(el)){
          const b=bounds(el);
          if(b.left<r.left-1||b.right>r.right+1||b.bottom>r.bottom+1)issues.push('outside phone screen: '+selector);
        }
      }
      const tabs=document.querySelector('#iosTabbar'), home=document.querySelector('.ios-home-area');
      if(visible(tabs)&&visible(home)&&Math.abs(bounds(tabs).bottom-bounds(home).top)>2)issues.push('gap below phone navigation');
    }
    if(chat){
      const dialog=document.querySelector('#chatDialog'), r=bounds(dialog);
      if(r.left<-1||r.right>innerWidth+1||r.top<-1||r.bottom>innerHeight+1)issues.push('chat bounds '+JSON.stringify({x:r.x,y:r.y,width:r.width,height:r.height,viewport:innerHeight}));
      const input=bounds(dialog.querySelector('input')), submit=bounds(dialog.querySelector('button[type=submit]'));
      if(intersects(input,submit)||submit.right>r.right||input.bottom>r.bottom)issues.push('chat controls overlap or clip');
    }
    return issues;
  },chat);
  assert.deepEqual(errors,[],JSON.stringify(page.viewportSize()));
}
async function capture(page,name,chat=false){
  await settle(page);
  await checkFont(page);
  await bounds(page,chat);
  await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});
}
async function movement(page,trigger,direction){
  const samples=page.evaluate(()=>new Promise(resolve=>{
    const bird=document.querySelector('.finx-character'), values=[], start=performance.now();
    const frame=()=>{values.push([performance.now(),bird.getBoundingClientRect().x]);
      if(performance.now()-start>1050)resolve(values);else requestAnimationFrame(frame);};
    requestAnimationFrame(frame);
  }));
  await trigger();
  const frames=await samples;
  const xs=frames.map(frame=>frame[1]);
  const intervals=frames.slice(1).map((frame,i)=>frame[0]-frames[i][0]);
  assert(new Set(xs.map(x=>Math.round(x))).size>=4,'Finx should move across successive frames');
  assert(direction*(xs.at(-1)-xs[0])>=8,'Finx should move in the expected direction');
  await settle(page);
  return {frames:frames.length,distance:Math.round(xs.at(-1)-xs[0]),maxFrameGapMs:Math.round(Math.max(...intervals))};
}
const next=page=>page.locator('#journeyProgress [data-walk=next]').click();
const back=page=>page.locator('#journeyProgress [data-walk=back]').click();
async function choose(page,goal='property'){await page.locator(`[data-goal=${goal}]`).click();await stage(page,1);}
async function predict(page,selector){
  const started=performance.now();
  const response=page.waitForResponse(r=>r.url().endsWith(selector==='[data-preview]'?'/api/inference':'/api/valuation')&&r.request().method()==='POST');
  await page.locator('#valuationForm '+selector).click();
  const r=await response;
  const elapsed=performance.now()-started;
  assert.equal(r.status(),200);
  await page.locator('#valuationStatus').filter({hasText:'The price range is ready'}).waitFor();
  if(selector==='[data-preview]')inferenceTimes.push(Math.round(elapsed));
  return r.json();
}
async function full(browser){
  const context=await browser.newContext({locale:'en-US',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light',viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    recordVideo:{dir:out,size:{width:390,height:844}}});
  const page=await context.newPage(), errors=[];
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  await login(page);
  await capture(page,'390-chapter-01');
  assert.equal(await page.locator('.goal-card').count(),3);
  // Force a browser persistence error. The stage and waypoint must stay put.
  await page.evaluate(()=>{
    const store=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key.startsWith('vinfinx.walkthrough.v1.'))throw new Error('QA storage unavailable');
      return store.call(this,key,value);
    };
    window.restoreQAStorage=()=>{Storage.prototype.setItem=store;};
  });
  await page.locator('[data-goal=property]').click();
  await page.locator('#toast').filter({hasText:'Progress could not be saved'}).waitFor();
  await stage(page,0);
  await page.evaluate(()=>window.restoreQAStorage());
  await page.locator('#toast').waitFor({state:'hidden'});
  const forward=await movement(page,()=>choose(page),1);
  const reverse=await movement(page,()=>back(page),-1);
  await stage(page,0);
  await choose(page);
  await capture(page,'390-chapter-02');
  assert(await page.locator('[data-walk=next]').isDisabled());
  const district=page.locator('#districtSelect');
  await district.selectOption({index:1});
  const area=page.locator('[name=area]');
  await area.fill('5');
  await page.locator('[data-preview]').click();
  assert.equal(await area.evaluate(el=>el.validity.rangeUnderflow),true);
  await capture(page,'390-validation');
  await area.fill('52.3');
  // Delay one real request only at the browser boundary to capture the loading UI.
  await page.route('**/api/inference',async route=>{await new Promise(r=>setTimeout(r,450));await route.continue();},{times:1});
  const preview=predict(page,'[data-preview]');
  await page.locator('#valuationStatus').filter({hasText:'Calculating a range'}).waitFor();
  await capture(page,'390-loading');
  const result=(await preview).result;
  assert(result.inference.live&&result.low<result.value&&result.value<result.high);
  await predict(page,'button[type=submit]:not([data-preview])');
  await page.locator('[data-walk=next]').evaluate(button=>{button.click();button.click();});
  await stage(page,2);
  const expected=await page.evaluate(v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(v),result.low);
  assert((await page.locator('.avm-range').textContent()).includes(expected));
  await page.locator('[data-explanation=valuation_numbers] summary').click();
  await capture(page,'390-chapter-03');
  await next(page);await stage(page,3);
  await page.locator('#uploadForm [type=submit]').click();
  await page.locator('.document-card').filter({hasText:'Pending review'}).waitFor();
  await capture(page,'390-chapter-04');
  await next(page);await stage(page,4);
  await page.reload();await stage(page,4);
  await capture(page,'390-chapter-05');
  for(const i of [3,2,1]){await back(page);await stage(page,i);}
  await area.fill('78');
  assert(await page.locator('[data-walk=next]').isDisabled());
  await page.route('**/api/inference',route=>route.fulfill({status:503,json:{error:'The valuation service is busy. Try again.'}}),{times:1});
  await page.locator('[data-preview]').click();
  await page.locator('#valuationStatus').filter({hasText:'is busy'}).waitFor();
  await capture(page,'390-model-error');
  await predict(page,'[data-preview]');
  await next(page);await stage(page,2);
  assert((await page.locator('#valuationResult').textContent()).includes('78 m²'));
  for(const i of [3,4,5]){await next(page);await stage(page,i);}
  await page.locator('.scenario-input [name=amount]').fill('1000000000');
  await page.locator('.scenario-input button').click();
  await page.locator('[data-explanation=loan_numbers] summary').click();
  assert.equal(await page.locator('.table-wrap tbody tr').count(),3);
  await capture(page,'390-chapter-06');
  await next(page);await stage(page,6);
  await capture(page,'390-chapter-07');
  const bird=page.getByRole('button',{name:'Ask Finx AI',exact:true}).filter({has:page.locator('.finx-sprites')});
  await bird.focus();await page.keyboard.press('Enter');
  await page.locator('#chatDialog:modal').waitFor();
  await page.locator('#chatInput').fill('Explain my financial health score');
  await page.locator('#chatForm button').click();
  await page.locator('.bubble small').filter({hasText:'Limited assistance'}).waitFor();
  await page.locator('#chatInput').fill('Draft question');
  await capture(page,'390-chat',true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement?.classList.contains('finx-character'));
  await bird.click();assert.equal(await page.locator('#chatInput').inputValue(),'Draft question');
  await page.locator('#chatDialog [data-close]').click();
  await stage(page,6);
  await next(page);await stage(page,7);
  await page.locator('#reportStage details summary').click();
  await page.locator('#reportConsentForm').waitFor();
  await page.getByRole('heading',{name:'VinFinx Financial Health Report'}).waitFor();
  await capture(page,'390-chapter-08-report');
  const denied=await page.request.post(base+'/api/report/export',{headers:{Origin:base},data:{consent:false}});
  assert(denied.status()>=400);
  await page.locator('#reportConsentForm input').check();
  const download=page.waitForEvent('download');
  await page.locator('#reportConsentForm button').click();
  assert.equal((await download).suggestedFilename(),'vinfinx-report.html');
  await next(page);
  await page.locator('.intent-hero').waitFor();
  assert.deepEqual(errors,[]);
  const recording=page.video();
  await context.close();
  await recording.saveAs(path.join(out,'390-walking-finx.webm'));
  return {forward,reverse};
}
async function matrix(browser){
  const context=await browser.newContext({locale:'en-US',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light',viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();
  await login(page,1);
  for(const [width,height] of sizes){
    await page.evaluate(()=>{
      for(const key of Object.keys(localStorage))if(key.startsWith('vinfinx.walkthrough.v1.'))localStorage.removeItem(key);
    });
    await page.setViewportSize({width,height});
    await page.goto(base+(width<800?'/?demo=ios':'/'));
    await stage(page,0);
    await capture(page,`${width}-opening`);
    await choose(page,'health');
    await page.locator('[data-walk=skip]').click();await stage(page,2);
    for(const i of [3,4]){await next(page);await stage(page,i);}
    await capture(page,`${width}-health`);
    await page.locator('.finx-character').click();
    await page.locator('#chatInput').focus();
    await capture(page,`${width}-chat`,true);
    await page.locator('#chatDialog [data-close]').click();
    for(const i of [5,6,7]){await next(page);await stage(page,i);}
    await page.locator('#reportStage details summary').click();
    await capture(page,`${width}-report`);
    if(width===390){
      await page.locator('#shell .ios-mobile-text').click();
      await page.locator('[aria-label="Dark mode"]').last().click();
      await capture(page,'390-report-large-dark');
    }
  }
  await context.close();
}
async function modes(browser,engine){
  const context=await browser.newContext({locale:'en-US',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light',viewport:{width:390,height:844},reducedMotion:'reduce',
    ...(engine==='firefox'?{}:{isMobile:true,hasTouch:true})});
  const page=await context.newPage();
  await login(page,2);
  await choose(page,'loan');
  await page.locator('[data-walk=skip]').click();await stage(page,2);
  assert.equal(await page.locator('.finx-walker').getAttribute('data-motion'),'idle');
  await page.locator('[data-walk=pause]').click();
  await page.locator('[data-mode=standard]').click();
  await page.locator('[data-goal=health]').click();
  await page.locator('#profileForm').waitFor();
  await page.locator('#iosTabbar [data-nav=overview]').click();
  await captureDirect(page,`${engine}-standard`);
  await page.locator('[data-mode=explore]').click();
  await page.locator('.journey-direct').waitFor();
  await captureDirect(page,`${engine}-explore`);
  await page.locator('[data-mode=guided]').click();
  await stage(page,2);
  await capture(page,`${engine}-guided-resumed`);
  await page.locator('.finx-character').click();
  await page.locator('#chatInput').focus();
  await page.setViewportSize({width:390,height:420});
  await page.waitForFunction(()=>document.querySelector('#chatDialog').classList.contains('compact-chat'));
  await capture(page,`${engine}-short-chat`,true);
  await page.locator('#chatDialog [data-close]').click();
  await context.close();
}
async function checkPhoneFit(browser,engine){
  const context=await browser.newContext({locale:'en-US',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light',viewport:{width:375,height:667},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  await login(page,3);
  const viewports=[[320,568],[375,667],[390,844],[430,932],[667,375],[390,480]];
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    await page.waitForFunction(({width,height})=>{
      const rect=document.querySelector('.ios-device').getBoundingClientRect();
      return Math.abs(rect.width-width)<2&&Math.abs(rect.height-height)<2;
    },{width,height});
    assert(await page.locator('.ios-status').isHidden());
    assert(await page.locator('#shell .ios-mobile-text').isVisible());
    await capture(page,`${engine}-fit-${width}x${height}`);
  }
  await page.locator('#shell .ios-mobile-text').click();
  assert.equal(await page.locator('#shell .ios-mobile-text').getAttribute('aria-pressed'),'true');
  await page.locator('.finx-character').click();
  await page.locator('#chatInput').focus();
  await capture(page,`${engine}-fit-short-chat-large`,true);
  await page.locator('#chatDialog [data-close]').click();
  await page.setViewportSize({width:390,height:844});
  await choose(page);
  await page.locator('#valuationForm [name=area]').focus();
  // Mobile Safari can shrink only the visual viewport when the keyboard opens.
  await page.evaluate(()=>{
    Object.defineProperty(window.visualViewport,'height',{value:520,configurable:true});
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(()=>document.querySelector('.ios-device').dataset.keyboard==='open');
  assert.equal(Math.round((await page.locator('.ios-device').boundingBox()).height),520);
  assert(await page.locator('#iosTabbar').isHidden());
  await page.evaluate(()=>{
    delete window.visualViewport.height;
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(()=>!document.querySelector('.ios-device').dataset.keyboard);
  assert(await page.locator('#iosTabbar').isVisible());
  await context.close();
  return viewports;
}
async function roleLayout(browser,engine){
  for(const width of [320,390,1440]){
    const page=await browser.newPage({locale:'en-US',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light',viewport:{width,height:width===1440?900:844}});
    await page.goto(base+'/?demo=ios');
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    await page.getByRole('heading',{name:'Welcome to VinFinx x Vietcombank'}).waitFor();
    const account=accounts.find(item=>item.id==='advisor01');
    await page.locator('#email').fill(account.email);
    await page.locator('#password').fill(account.password);
    await page.locator('#loginForm [type=submit]').click();
    await page.getByRole('heading',{name:'Advisor workspace'}).waitFor();
    assert.equal(await page.locator('.advisor-customer').count(),3);
    await page.locator('.advisor-customer button').nth(1).click();
    await page.locator('.advisor-customer button[aria-current=true]').filter({hasText:'Pilot Customer 02'}).waitFor();
    const layout=await page.evaluate(()=>{
      const node=selector=>document.querySelector(selector);
      const rect=selector=>node(selector).getBoundingClientRect();
      const scroll=node('#iosViewport');
      const errors=[];
      if(rect('header').bottom>rect('#content h1').top)errors.push('header covers the title');
      if(rect('.assistant-launcher').bottom>rect('.advisor-customers').top)errors.push('launcher covers customer cards');
      if(node('.advisor-customers').scrollWidth>node('.advisor-customers').clientWidth+1)errors.push('customer list overflows');
      if(scroll.scrollWidth>scroll.clientWidth+1)errors.push('phone viewport overflows');
      const tabs=node('.workspace-tabs');
      if(tabs.scrollWidth>tabs.clientWidth+1)errors.push('workspace tabs clip their labels');
      const before=rect('header').top;
      scroll.scrollTop=200;
      if(rect('header').top>=before)errors.push('header did not scroll with the page');
      scroll.scrollTop=0;
      return errors;
    });
    assert.deepEqual(layout,[],width+' px');
    await page.locator('#content h1').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,`${engine}-advisor-${width}-en.png`)});
    await page.close();
  }
  const page=await browser.newPage({locale:'en-US',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light',viewport:{width:390,height:844}});
  await page.goto(base+'/?demo=ios');
  const verifier=accounts.find(item=>item.id==='authenticator01');
  await page.locator('#email').fill(verifier.email);
  await page.locator('#password').fill(verifier.password);
  await page.locator('#loginForm [type=submit]').click();
  await page.getByRole('heading',{name:'Review customer evidence'}).waitFor();
  await page.getByRole('heading',{name:'Income evidence'}).waitFor();
  await page.close();
}
async function captureDirect(page,name){
  await checkFont(page);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,name+'.png')});
}
async function customerParity(browser){
  let baseline;
  for(let index=0;index<6;index++){
    const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',
      timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light',reducedMotion:'reduce'});
    const page=await context.newPage();
    await login(page,index); await settle(page); await checkFont(page); await bounds(page);
    const signature=await page.evaluate(()=>({
      title:document.querySelector('#storyTitle').textContent,
      goals:[...document.querySelectorAll('.goal-card')].map(el=>({text:el.textContent,
        width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height)})),
      tabs:[...document.querySelectorAll('#iosTabbar button')].map(el=>el.textContent),
      theme:document.documentElement.dataset.theme,
      text:document.querySelector('.ios-device').dataset.text
    }));
    if(baseline)assert.deepEqual(signature,baseline,'Customer opening differs: '+index);
    else baseline=signature;
    await context.close();
  }
  return 6;
}
async function approvalHandoff(browser){
  const customerContext=await browser.newContext(), reviewerContext=await browser.newContext(), advisorContext=await browser.newContext();
  const contexts=[customerContext,advisorContext,reviewerContext], pages=[];
  for(const [index,id] of ['customer01','advisor01','authenticator01'].entries()){
    const page=await contexts[index].newPage();page.setDefaultTimeout(20000);pages.push(page);
    const account=accounts.find(a=>a.id===id);
    await page.goto(base+'/');
    await page.locator('#email').fill(account.email);await page.locator('#password').fill(account.password);
    await page.locator('#loginForm [type=submit]').click();await page.locator('#content h1').waitFor();
  }
  const [customer,advisor,reviewer]=pages;
  const summary=async page=>(await (await page.request.get(base+'/api/summary?customer=customer01')).json());
  const before=await summary(customer); assert.equal(Boolean(before.profile.verified),false);
  const documents=await (await customer.request.get(base+'/api/documents')).json();
  const pending=documents.find(d=>d.status==='pending');assert(pending,'Walkthrough must submit a pending payslip');
  const forbidden=await advisor.request.post(base+'/api/review',{headers:{Origin:base},data:{kind:'document',id:pending.id,action:'approve'}});
  assert.equal(forbidden.status(),403);
  reviewer.once('dialog',dialog=>dialog.accept());
  await reviewer.locator(`[data-action=review][data-kind=document][data-id="${pending.id}"][data-decision=approve]`).click();
  await reviewer.locator(`[data-action=review][data-id="${pending.id}"][data-decision=approve]`).waitFor({state:'detached'});
  const after=await summary(customer), advisorAfter=await summary(advisor);
  assert.equal(Boolean(after.profile.verified),true);assert.equal(after.profile.income,43000000);
  assert.equal(advisorAfter.health.score,after.health.score);
  assert.equal(after.evidence.profile.income,'HUMAN_VERIFIED');
  const report=await (await customer.request.get(base+'/api/report/preview')).json();
  assert(report.html.includes('HUMAN_VERIFIED'));
  assert(report.html.includes(after.health.rules_version));
  assert(report.html.includes(after.property.result.model_sha256));
  await reviewer.locator('#nav [data-nav=audit]').click();
  await reviewer.locator('#content').filter({hasText:'document'}).waitFor();
  await reviewer.screenshot({path:path.join(out,'authenticator-audit-after-review.png')});
  for(const context of contexts)await context.close();
  return {pendingToVerified:true,advisorCannotApprove:true,reportProvenance:true};
}
(async()=>{
  const engine=process.env.VINFINX_BROWSER||'chromium';
  const browser=await pw[engine].launch({headless:true});
  try{
    const results={engine};
    if(!process.env.VINFINX_MODES_ONLY){
      results.motion=await full(browser);
      await matrix(browser);
      results.viewportMatrix=sizes;
    }
    if(engine==='chromium'){
      const context=await browser.newContext({locale:'en-US',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light',viewport:{width:320,height:500},deviceScaleFactor:2,reducedMotion:'reduce'});
      const page=await context.newPage();
      await login(page,4,false);
      await capture(page,'desktop-200-percent-reflow-equivalent');
      await context.close();
    }
    await modes(browser,engine);
    if(engine!=='firefox')results.phoneFit=await checkPhoneFit(browser,engine);
    await roleLayout(browser,engine);
    results.customerParity=await customerParity(browser);
    results.approvalHandoff=await approvalHandoff(browser);
    results.previewBrowserMs=inferenceTimes;
    fs.writeFileSync(path.join(out,engine+'.json'),JSON.stringify(results,null,2)+'\n');
    console.log(JSON.stringify(results));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
