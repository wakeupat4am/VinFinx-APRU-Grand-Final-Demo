'use strict';
const workspace = (() => {
  const drafts = new Map(), files = new Map(), chats = new Map(), jobs = [];
  let tabs = [], serial = 0, generation = 0;
  const forms = ['valuationForm', 'profileForm'];
  const key = (view = S.view, cid = S.cid) => `${S.user?.email}|${S.user?.role}|${cid}|${view}`;
  function remember() {
    if (!S.user) return;
    loadDrafts();
    const form = document.querySelector('#content form');
    if (form && forms.includes(form.id)) {
      drafts.set(key(), { id: form.id, fields: Object.fromEntries(new FormData(form)) });
    }
    const file = document.querySelector('#documentFile')?.files[0];
    if (file) files.set(key(), file);
    const search = document.querySelector('#streetSearch');
    if (search) drafts.set(key(), { search: search.value });
    const notes = [...document.querySelectorAll('#content textarea[id^="note-"]')];
    if (notes.length) drafts.set(key(), { notes: Object.fromEntries(notes.map(node => [node.id, node.value])) });
    try { sessionStorage.setItem('vinfinx.drafts', JSON.stringify([...drafts])); } catch (_) {}
  }
  function loadDrafts(){
    if (!drafts.size) {
      try { for (const [k, value] of JSON.parse(sessionStorage.getItem('vinfinx.drafts') || '[]')) {
        if (k.startsWith(`${S.user.email}|${S.user.role}|`)) drafts.set(k, value);
      } } catch (_) {}
    }
  }
  function propertyDraft(){loadDrafts();return drafts.get(key('property'))?.fields;}
  function loanAmount(value){
    loadDrafts();
    const slot=key('loan');
    if(value===undefined)return drafts.get(slot)?.amount??null;
    drafts.set(slot,{amount:value});
    try { sessionStorage.setItem('vinfinx.drafts', JSON.stringify([...drafts])); } catch (_) {}
  }
  function restore() {
    if (!S.user) return;
    loadDrafts();
    const draft = drafts.get(key());
    for (const [id, value] of Object.entries(draft?.notes || {})) {
      const textarea = document.getElementById(id); if (textarea) textarea.value = value;
    }
    if (draft?.id) {
      const form = document.getElementById(draft.id);
      if (form) {
        const {district, ward, street, ...otherFields}=draft.fields;
        if (draft.id === 'valuationForm') restoreAddress(district, ward, street);
        for (const [name, value] of Object.entries(otherFields)) {
          if (form.elements[name]) form.elements[name].value = value;
        }
      }
    }
    if (draft?.search !== undefined && document.querySelector('#streetSearch')) {
      document.querySelector('#streetSearch').value = draft.search;
      filterStreets(draft.search);
    }
    const input = document.querySelector('#documentFile');
    if (input && files.has(key())) {
      const transfer = new DataTransfer(); transfer.items.add(files.get(key())); input.files = transfer.files;
    }
    const active = key();
    if (!tabs.some(tab => tab.key === active)) tabs.push({ key: active, view: S.view, cid: S.cid,
      label: NAV[S.user.role].find(item => item[0] === S.view)[2],
      customer: S.user.role === 'advisor' ? S.summary?.profile.name : '' });
    if (draft?.id === 'valuationForm') polishOptions();
    drawTabs(); syncChat(); drawJobs();
  }
  function drawTabs() {
    const target = document.querySelector('#workspaceTabs'); if (!target) return;
    target.innerHTML = tabs.map(tab => `<button class="workspace-tab ${tab.key === key() ? 'active' : ''}" data-workspace-key="${esc(tab.key)}" aria-current="${tab.key === key() ? 'page' : 'false'}">${esc(tab.label)}${tab.customer ? `<small>${esc(tab.customer)}</small>` : ''}</button>`).join('');
  }
  function syncChat() {
    const cid = S.cid;
    if (!S.user || S.user.role === 'authenticator') { document.querySelector('#chatDialog').close(); return; }
    const transcript = chats.get(cid) || [];
    document.querySelector('#messages').replaceChildren();
    transcript.forEach(item => appendMessage(item.text, item.user, item.meta, item.action));
    document.querySelector('#chatContext').textContent = `${S.summary?.profile.name || 'Customer'} · Synthetic evidence from the selected profile`;
    document.querySelector('#chatInput').value = drafts.get(key('chat'))?.text || '';
    document.querySelector('#chatForm [type=submit]').disabled = jobs.some(j => j.cid === cid && j.kind === 'chat' && j.state === 'running');
  }
  function message(cid, text, user = false, meta = '', action = null) {
    if (!chats.has(cid)) chats.set(cid, []);
    const transcript=chats.get(cid);
    transcript.push({ text, user, meta, action });
    if(transcript.length>40)transcript.shift();
    if (S.user && cid === S.cid) appendMessage(text, user, meta, action);
  }
  function clearDraft(view, cid) { drafts.delete(key(view, cid)); files.delete(key(view, cid));
    try { sessionStorage.setItem('vinfinx.drafts', JSON.stringify([...drafts])); } catch (_) {}
  }
  function reset() {
    generation++; drafts.clear(); files.clear(); chats.clear(); jobs.length = 0; tabs = [];
    try { sessionStorage.removeItem('vinfinx.drafts'); } catch (_) {}
    document.querySelector('#workspaceTabs').replaceChildren();
    document.querySelector('#messages').replaceChildren();
    document.querySelector('#chatInput').value = '';
    document.querySelector('#appointmentForm').reset();
    drawJobs();
  }
  function drawJobs() {
    const target = document.querySelector('#activityList'); if (!target) return;
    const running = jobs.filter(job => job.state === 'running').length;
    document.querySelector('#activityCount').textContent = running ? `${running} running` : 'Activity';
    target.innerHTML = jobs.length ? jobs.slice(-8).reverse().map(job => `<li><span class="job-dot ${job.state}"></span><div><b>${esc(job.label)}</b><small>${esc(job.customer)} · ${job.state === 'running' ? 'Running' : job.state === 'done' ? 'Done' : 'Needs attention'}</small>${job.error ? `<small>${esc(job.error)}</small>` : ''}</div></li>`).join('') : '<li class="muted">No activity yet. Tasks can run while you browse other pages.</li>';
    syncBusy();
  }
  function syncBusy() {
    if (typeof S === 'undefined' || !S.user) return;
    for (const [id, kind] of Object.entries({ valuationForm:'valuation', profileForm:'profile', uploadForm:'upload', chatForm:'chat', appointmentForm:'appointment' })) {
      const busy = jobs.some(job => job.cid === S.cid && job.kind === kind && job.state === 'running');
      document.querySelectorAll(`#${id} [type=submit]`).forEach(button=>button.disabled=busy);
    }
  }
  async function run(label, kind, fn) {
    const job = { id: ++serial, label, kind, cid: S.cid, customer: S.summary?.profile.name || 'Workspace', state: 'running' };
    const epoch = generation;
    jobs.push(job); drawJobs();
    try { const result = await fn(); if (epoch !== generation) return { stale: true }; job.state = 'done'; return { result }; }
    catch (error) { if (epoch !== generation) return { stale: true }; job.state = 'error'; job.error = error.message; throw error; }
    finally { if (epoch === generation) drawJobs(); }
  }
  document.addEventListener('input', event => {
    if (event.target.closest('#content')) remember();
    if (event.target.id === 'chatInput' && S.user) drafts.set(key('chat'), { text: event.target.value });
  });
  document.addEventListener('change', event => { if (event.target.closest('#content')) remember(); });
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-workspace-key]'); if (!button) return;
    const tab = tabs.find(item => item.key === button.dataset.workspaceKey); if (!tab) return;
    await navigate(tab.view, tab.cid);
  });
  window.addEventListener('pagehide', remember);
  const themeControls = () => `<div class="appearance-control" role="group" aria-label="Appearance"><button type="button" data-theme-choice="light" aria-label="Light mode">☀ <span>Light</span></button><button type="button" data-theme-choice="dark" aria-label="Dark mode">☾ <span>Dark</span></button><button type="button" data-theme-choice="system" aria-label="Match system">◐ <span>System</span></button></div>`;
  document.querySelector('.login-form').insertAdjacentHTML('afterbegin', themeControls());
  document.querySelector('.header-right').insertAdjacentHTML('afterbegin', themeControls());
  document.querySelector('.demo-banner').insertAdjacentHTML('afterend', '<div class="workspace-bar"><div class="workspace-tabs" id="workspaceTabs" aria-label="Open pages"></div><details class="activity"><summary id="activityCount">Activity</summary><div class="activity-panel"><h3>Session activity</h3><p class="tiny">Tasks continue when you switch pages. Keep this tab open.</p><ul id="activityList"></ul></div></details></div><div class="draft-note">Drafts stay in this tab until you sign out.</div>');
  document.querySelector('#chatDialog').setAttribute('aria-label', 'Finx assistant');
  document.querySelector('#chatDialog').insertAdjacentHTML('beforeend', '<p class="tiny assistant-note">Close the chat and reopen it during this session to see your conversation.</p>');
  document.querySelector('#chatDialog [data-close]').setAttribute('aria-label', 'Close Ask Finx');
  document.querySelector('.workspace-bar').insertAdjacentHTML('beforeend', '<button class="assistant-launcher" type="button" data-action="chat" aria-label="Open Ask Finx">✦ <span>Ask Finx</span></button>');
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { if(document.querySelector('#chatDialog').open)document.querySelector('#chatDialog').close();document.querySelector('.activity').open=false; } });
  document.addEventListener('click', event => { if(!event.target.closest('.activity'))document.querySelector('.activity').open=false; });
  appearance.apply();
  return { propertyDraft, loanAmount, remember, restore, reset, run, message, clearDraft, syncChat, syncBusy };
})();
