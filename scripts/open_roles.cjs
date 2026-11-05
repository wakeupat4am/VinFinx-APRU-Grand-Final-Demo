'use strict';
// Real logins in three isolated contexts: no shared cookies or bypass credentials.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name)+1] : fallback;
const state = path.resolve(option('--state', '.demo-state'));
const port = Number(option('--port', '4176'));
assert(Number.isInteger(port) && port >= 1024 && port <= 65535, 'Invalid local port');
const base = `http://127.0.0.1:${port}`;
const accounts = JSON.parse(fs.readFileSync(path.join(state,'pilot_accounts.json'),'utf8'));
const check = args.includes('--check');
(async () => {
  const browser = await chromium.launch({headless:check});
  let closing = false;
  async function close() { if(!closing){closing=true;await browser.close();} }
  process.on('SIGINT',close); process.on('SIGTERM',close);
  try {
    const pages=[];
    for (const id of ['customer01','advisor01','authenticator01']) {
      const context=await browser.newContext({viewport:{width:1440,height:1000},
        locale:'en-US',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:'light'});
      const page=await context.newPage(); page.setDefaultTimeout(30000);
      const account=accounts.find(a=>a.id===id);
      assert(account, 'Missing account '+id);
      await page.goto(base+(id==='customer01'?'/?demo=ios':'/'));
      await page.locator('#email').fill(account.email);
      await page.locator('#password').fill(account.password);
      await page.locator('#loginForm [type=submit]').click();
      await page.locator('#shell').waitFor({state:'visible'});
      await page.locator('#content h1').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      pages.push({page,id});
    }
    // Reload after all three logins: a shared session would fail this check.
    for (const {page,id} of pages) {
      await page.reload(); await page.locator('#content h1').waitFor();
      assert.equal((await (await page.request.get(base+'/api/me')).json()).user.id,id);
    }
    console.log('Customer, Advisor and Authenticator are signed in with independent sessions.');
    console.log('Fresh browser storage: Guided / step 1 / Light / Default text / English.');
    if(check) return;
    await pages[0].page.bringToFront();
    console.log('Switch between the three browser windows to record. Keep this terminal open; Ctrl+C closes them.');
    await new Promise(resolve=>browser.on('disconnected',resolve));
  } finally { await close(); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
