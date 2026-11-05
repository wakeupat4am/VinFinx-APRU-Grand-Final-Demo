const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const repay=require('./assets/scenario.js');

function fixture(){
  const storage=new Map(), listeners={};
  const document={addEventListener:(name,fn)=>{listeners[name]=fn;},querySelector:()=>null};
  const ctx=vm.createContext({document,window:{addEventListener(){}},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    S:{user:{role:'customer'},cid:'c1',view:'overview'},navigate:async view=>{ctx.S.view=view;},toast:message=>{throw Error(message);}});
  vm.runInContext(readFileSync(__dirname+'/assets/journey.js','utf8'),ctx);
  const api=vm.runInContext('journey',ctx);
  const click=dataset=>listeners.click({target:{closest:()=>({dataset})}});
  const account={role:'customer',id:'c1'};
  api.load(account);
  return {api,click,storage,account};
}

test('Guided progress survives reload and remains separate per account',async()=>{
  const f=fixture();
  await f.click({mode:'guided'});
  await f.click({goal:'property'});
  assert.equal(f.api.step(),'property');
  f.api.completeTask('property','c1');
  await f.click({walk:'next'});
  assert.equal(f.api.step(),'valuation');
  await f.click({walk:'skip'});
  assert.equal(f.api.step(),'documents');
  await f.click({walk:'pause'});
  f.api.load(f.account);
  assert.equal(f.api.active(),false);
  await f.click({walk:'resume'});
  assert.equal(f.api.step(),'documents');
  await f.click({walk:'back'});
  assert.equal(f.api.step(),'valuation');
  f.api.load({role:'customer',id:'c2'});
  assert.equal(f.api.step(),'goal');
  const counts=JSON.parse(f.storage.get('vinfinx.walkthrough.counts.v1'));
  assert.equal(counts['step_completed.property'],1);
  assert.equal(counts['step_skipped.valuation'],1);
  assert.equal(counts['step_abandoned.documents'],1);
});

test('Standard goals permit independent completion and next actions respect missing valuation',async()=>{
  const f=fixture();
  await f.click({goal:'health'});
  f.api.completeTask('health','c1');
  const summary={profile:{verified:false},evidence:{valuation:{status:'STALE'}}};
  assert.equal(f.api.helpful(summary,'loan')[0],'property');
  assert.equal(f.api.helpful(summary,'health')[0],'documents');
  assert.equal(f.api.active(),false);
  assert.equal(JSON.parse(f.storage.get('vinfinx.walkthrough.counts.v1'))['task_completed.health'],1);
});

test('Loan sensitivity and payment schedule use fixed-rate assumptions',()=>{
  const base=repay(100000000,.10,240,20000000,3000000);
  assert.equal(base.schedule.length,240);
  assert.equal(base.schedule.at(-1).balance,0);
  assert.ok(Math.abs(base.schedule.reduce((total,row)=>total+row.capital,0)-100000000)<.01);
  assert.ok(repay(100000000,.12,240,20000000,3000000).burden>base.burden);
  assert.equal(repay(1200,0,12,0,0).payment,100);
  assert.equal(repay(1200,0,12,0,0).burden,null);
});

test('Guided property goal requires a successful matching estimate before advancing',async()=>{
  const f=fixture();
  await f.click({mode:'guided'});
  await f.click({goal:'property'});
  await f.click({walk:'skip'});
  await f.click({walk:'next'});
  assert.equal(f.api.step(),'property');
  f.api.completeTask('property','c1');
  f.api.invalidateProperty();
  await f.click({walk:'next'});
  assert.equal(f.api.step(),'property');
  f.api.completeTask('property','c1');
  await f.click({walk:'next'});
  assert.equal(f.api.step(),'valuation');
});

test('Health and loan goals may skip property input without marking it complete',async()=>{
  for(const goal of ['health','loan']){
    const f=fixture();
    await f.click({mode:'guided'});
    await f.click({goal});
    assert.equal(f.api.context().goal,goal);
    await f.click({walk:'skip'});
    const saved=JSON.parse(f.storage.get('vinfinx.walkthrough.v1.c1'));
    assert.equal(f.api.step(),'valuation');
    assert.deepEqual(saved.skipped,['property']);
    assert.deepEqual(saved.done,['goal']);
  }
});
