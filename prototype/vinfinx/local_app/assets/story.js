'use strict';

const story = (() => {
  // Fixed editorial copy only: profile values continue to come from trusted renderers.
  const chapters = {
    goal: ['Your goal today', 'Choose one goal.', 'Tap a card below.'],
    property: ['Tell us about your property', 'Start with two details.', 'Enter the district and land area.'],
    valuation: ['Understand the price range', 'Read the range first.', 'An asking-price estimate, not a guaranteed sale price.'],
    documents: ['Add income evidence', 'Try a sample payslip.', 'Income stays unverified until a person approves it.'],
    health: ['Your financial picture', 'See your money left each month.', 'Open the breakdown to understand your demo score.'],
    loan: ['Try a borrowing scenario', 'Compare monthly payments.', 'These are hypothetical figures, not a loan offer.'],
    chat: ['Ask Finx a question', 'Tap a suggested question.', 'Or type your own question about this profile.'],
    advisor: ['Prepare for a consultation', 'Review before you share.', 'You choose whether to export your report.']
  };
  const goalIntro = {
    health: ['Property is optional.', 'You can skip ahead to your finances.'],
    loan: ['Property is optional.', 'You can skip ahead to a borrowing scenario.']
  };
  const assets = '/assets/finx/';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let previous = null, walk = null, deferredIntro = false, frame = 0, toastParent = null;
  const track = document.createElement('section');
  track.id = 'finxTrack';
  track.hidden = true;
  track.setAttribute('aria-label', "Finx's path");
  track.innerHTML = `<div class="finx-dock">
    <div class="finx-path">
      <div class="finx-ground" aria-hidden="true"></div>
      <div class="finx-waypoints" aria-hidden="true">${Array.from({length:8},(_,i)=>`<i data-waypoint="${i}"></i>`).join('')}</div>
      <div class="finx-walker" data-motion="idle" data-pose="idle">
      <button type="button" class="finx-character" data-action="chat" aria-haspopup="dialog" aria-label="Ask Finx AI" title="Ask Finx AI">
        <span class="finx-shadow" aria-hidden="true"></span>
        <span class="finx-sprites" aria-hidden="true">
          ${['idle','welcome','attentive','success','left-foot','right-foot','body'].map(name=>
            `<img class="finx-sprite finx-${name}" src="${assets}${name}.png" alt="" width="164" height="169" draggable="false">`).join('')}
        </span>
      </button>
      </div>
    </div>
    <button type="button" class="finx-help-link" data-action="chat" aria-haspopup="dialog">Ask Finx AI</button>
  </div>`;
  document.querySelector('main').appendChild(track);
  const walker = track.querySelector('.finx-walker');
  const path = track.querySelector('.finx-path');
  const waypoints = [...track.querySelectorAll('[data-waypoint]')];
  const stride = track.querySelector('.finx-sprites');
  const launcher = () => document.querySelector('.assistant-launcher');
  const position = step => Math.round((path.clientWidth - walker.offsetWidth) * step / 7);
  const translate = x => `translate3d(${x}px,0,0)`;

  function stop() {
    cancelAnimationFrame(frame);
    walk?.cancel();
    walk = null;
    stride.getAnimations().forEach(animation => animation.cancel());
    walker.dataset.motion = 'idle';
  }
  function scene(id, index, goal) {
    const [title, lead, detail] = chapters[id];
    const [cue, supporting] = id === 'property' && goalIntro[goal] ? goalIntro[goal] : [lead, detail];
    const label = `Step ${index+1}/8`;
    return `<section class="story-chapter" aria-labelledby="storyTitle">
      <div class="story-kicker"><span>${label}</span><progress value="${index+1}" max="8" aria-label="${label}"></progress></div>
      <h1 id="storyTitle" tabindex="-1">${title}</h1>
      <div class="story-dialogue"><span class="story-guide-label">Finx · Your next step</span><p><strong>${cue}</strong></p><p class="story-support">${supporting}</p></div>
    </section>`;
  }
  function setStep(step, completed) {
    if(track.hidden){
      const notice=document.querySelector('#toast');
      toastParent=notice.parentElement;
      track.before(notice);
    }
    track.hidden = false;
    track.closest('#shell').classList.add('story-shell');
    launcher()?.classList.add('story-launcher-hidden');
    waypoints.forEach((node,i)=>{
      node.classList.toggle('current',i===step);
      node.classList.toggle('visited',completed.includes(i));
    });
    if (previous === step) return;
    const from = previous;
    previous = step;
    const sampled = walker.getBoundingClientRect().left - path.getBoundingClientRect().left;
    stop();
    const end = position(step);
    const start = from === null ? end : Math.round(sampled);
    walker.style.transform = translate(end);
    walker.dataset.pose = step === 0 ? 'welcome' : 'idle';
    if (document.hidden || motion.matches || (from === null && step !== 0)) return;
    const first = from === null;
    if (first) walker.style.transform = translate(-36);
    const run = () => {
      if (previous !== step || track.hidden) return;
      const to = position(step);
      walker.style.transform = translate(to);
      walker.dataset.motion = !first && step<from ? 'walking_back' : 'walking_forward';
      const animation = walker.animate([{transform:translate(first?-36:start)},{transform:translate(to)}], {
        duration: 720, easing: 'cubic-bezier(.23,.56,.43,1)'
      });
      walk = animation;
      animation.onfinish = () => {
        if (walk !== animation) return;
        walk = null;
        walker.dataset.motion = 'idle';
      };
    };
    if (first) {
      deferredIntro = true;
      frame = requestAnimationFrame(() => { deferredIntro = false; run(); });
    } else run();
  }
  function hide() {
    if (track.hidden) return;
    stop();
    previous = null;
    deferredIntro = false;
    track.hidden = true;
    toastParent?.appendChild(document.querySelector('#toast'));
    toastParent=null;
    track.closest('#shell').classList.remove('story-shell');
    launcher()?.classList.remove('story-launcher-hidden');
  }
  function pose(value) {
    if (!track.hidden) walker.dataset.pose = value;
  }
  function resize() {
    if (previous === null || deferredIntro) return;
    const end = translate(position(previous));
    if (walker.style.transform === end) return;
    stop();
    walker.style.transform = end;
  }
  new ResizeObserver(resize).observe(path);
  function settle() {
    if (previous === null) return;
    deferredIntro = false;
    stop();
    walker.style.transform = translate(position(previous));
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)settle();});
  motion.addEventListener('change',()=>{if(motion.matches)settle();});
  return {scene, setStep, hide, pose};
})();
