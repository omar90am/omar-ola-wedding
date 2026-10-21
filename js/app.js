(() => {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDmnzzsD2rOVj57PAv5sehmDR-xWHn8YK8',
    authDomain: 'omar-ola-wedding.firebaseapp.com',
    projectId: 'omar-ola-wedding',
    storageBucket: 'omar-ola-wedding.firebasestorage.app',
    messagingSenderId: '329727762097',
    appId: '1:329727762097:web:e7ced21cda37f64548cc90'
  };

  const EVENT_AT = new Date('2026-12-26T19:00:00+03:00').getTime();
  const MUSIC_VOLUME = 0.28;
  const COUNTRY_LIST = [
    ['IQ','964'],['DE','49'],['GB','44'],['FR','33'],['NL','31'],['SE','46'],['CH','41'],['AT','43'],['DK','45'],['NO','47'],
    ['US','1'],['CA','1'],['AE','971'],['SA','966'],['KW','965'],['QA','974'],['BH','973'],['OM','968'],['JO','962'],['LB','961'],['SY','963'],['EG','20'],['TR','90']
  ].map(([iso,dial]) => ({iso,dial}));

  const $ = id => document.getElementById(id);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const userAgent = navigator.userAgent || '';
  const inAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|Messenger|WhatsApp/i.test(userAgent);
  const appleMobile = /iPad|iPhone|iPod/i.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const edgeBrowser = /EdgA?|EdgiOS|Edge\//i.test(userAgent);
  const androidMobile = /Android/i.test(userAgent);
  const VENUE_WAZE_QUERY = '6XJV+PXM, Erbil';
  const VENUE_WAZE_WEB_URL = `https://www.waze.com/ul?q=${encodeURIComponent(VENUE_WAZE_QUERY)}&navigate=yes`;
  const VENUE_WAZE_APP_URL = `waze://?q=${encodeURIComponent(VENUE_WAZE_QUERY)}&navigate=yes`;
  const VENUE_MAP_URL = "https://www.google.com/maps/search/?api=1&query=O%27Reve+Hall+Ankawa+Erbil";
  const scrollBehavior = () => (reducedMotion || inAppBrowser ? 'auto' : 'smooth');

  const state = {
    side: null,
    status: '',
    editingPhone: null,
    wizardIndex: 0,
    countdownTimer: 0,
    db: null,
    audioPlaying: false,
    audioFade: 0,
    currentGuest: null,
    qrInviteId: '',
    passExportInviteId: '',
    passExportBlob: null,
    passExportDataUrl: ''
  };

  function toLatinDigits(value) {
    return String(value ?? '')
      .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  }
  function countryByIso(iso='IQ') { return COUNTRY_LIST.find(c => c.iso === String(iso).toUpperCase()) || COUNTRY_LIST[0]; }
  function inferCountry(digits, preferredIso='IQ') {
    const preferred = countryByIso(preferredIso);
    if (digits.startsWith(preferred.dial)) return preferred;
    return COUNTRY_LIST.filter(c => digits.startsWith(c.dial)).sort((a,b) => b.dial.length-a.dial.length)[0] || preferred;
  }
  function normalizePhone(value, countryIso='IQ') {
    let raw = toLatinDigits(value).trim();
    if (!raw) return null;
    raw = raw.replace(/[\s\-().]/g,'');
    if (raw.startsWith('00')) raw = '+' + raw.slice(2);
    raw = raw.replace(/(?!^)[+]/g,'');
    const selected = countryByIso(countryIso);
    let digits = '', country = selected;
    if (raw.startsWith('+')) {
      digits = raw.slice(1).replace(/\D/g,'');
      country = inferCountry(digits, selected.iso);
    } else {
      const local = raw.replace(/\D/g,'');
      if (!local) return null;
      if (local.startsWith(selected.dial) && local.length >= selected.dial.length + 7) digits = local;
      else digits = selected.dial + local.replace(/^0+/, '');
    }
    digits = digits.replace(/^0+/, '');
    if (!/^\d{7,15}$/.test(digits)) return null;
    country = inferCountry(digits, country.iso);
    return {digits, e164:'+'+digits, iso:country.iso, dial:country.dial};
  }
  function phoneCandidateIds(value, countryIso='IQ') {
    const info = normalizePhone(value, countryIso);
    if (!info) return {info:null, ids:[]};
    const c = countryByIso(info.iso);
    const national = info.digits.startsWith(c.dial) ? info.digits.slice(c.dial.length) : '';
    const raw = toLatinDigits(value).trim().replace(/[\s\-()]/g,'');
    const ids = [info.digits, info.e164, '00'+info.digits, national, national ? '0'+national : '', raw].filter(Boolean);
    return {info, ids:[...new Set(ids)]};
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function createInviteId() {
    if (crypto?.getRandomValues) {
      const bytes = new Uint8Array(8); crypto.getRandomValues(bytes);
      return 'RSVP-' + [...bytes].map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
    }
    return 'RSVP-' + Math.random().toString(36).slice(2,14).toUpperCase();
  }
  function normalizeSide(value) {
    return value === 'Groom' || value === 'العريس' ? 'العريس' : value === 'Bride' || value === 'العروس' ? 'العروس' : value || '';
  }
  function isAttending(guest) { return guest?.status === 'يحضر' || guest?.status === 'yes'; }
  function hasWishes(guest) { return !!(guest?.wishes && !['None','لا يوجد'].includes(String(guest.wishes).trim())); }
  function hasOptionalMessage(guest) { return hasWishes(guest) || !!String(guest?.specialRequest || '').trim(); }

  function getDb() {
    if (state.db) return state.db;
    if (!window.firebase?.initializeApp || !window.firebase?.firestore) throw Object.assign(new Error('Firebase unavailable'), {code:'firebase-unavailable'});
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    state.db = firebase.firestore();
    return state.db;
  }
  async function getDbReady(timeout=5000) {
    if (state.db) return state.db;
    const started=Date.now();
    while ((!window.firebase?.initializeApp || !window.firebase?.firestore) && Date.now()-started<timeout) await new Promise(r=>setTimeout(r,120));
    return getDb();
  }
  function serverTimestamp() { return firebase.firestore.FieldValue.serverTimestamp(); }
  async function findGuestByPhone(phone, countryIso='IQ') {
    const {info, ids} = phoneCandidateIds(phone, countryIso);
    if (!info) return {info:null,guest:null,matches:[]};
    const db = await getDbReady();
    const matches = [];
    await Promise.all(ids.map(async id => {
      const snap = await db.collection('guests').doc(id).get();
      if (snap.exists) matches.push({id:snap.id, ...snap.data()});
    }));
    const guest = matches.find(g => g.id === info.digits) || matches[0] || null;
    return {info, guest, matches};
  }

  /* Viewport hardening for Safari and in-app browsers. */
  let viewportFrame = 0;
  function syncViewportHeight(){
    cancelAnimationFrame(viewportFrame);
    viewportFrame=requestAnimationFrame(()=>{
      const height=Math.round(window.visualViewport?.height||window.innerHeight||0);
      if(height>200)document.documentElement.style.setProperty('--app-height',`${height}px`);
    });
  }
  function installViewportGuards(){
    if(inAppBrowser)document.body.classList.add('in-app-browser');
    syncViewportHeight();
    addEventListener('resize',syncViewportHeight,{passive:true});
    addEventListener('orientationchange',()=>setTimeout(syncViewportHeight,80),{passive:true});
    window.visualViewport?.addEventListener('resize',syncViewportHeight,{passive:true});
    window.visualViewport?.addEventListener('scroll',syncViewportHeight,{passive:true});
    document.addEventListener('focusin',event=>{
      const target=event.target;
      if(!target?.matches?.('input,textarea,select'))return;
      if(innerWidth>760&&!inAppBrowser)return;
      setTimeout(()=>target.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'}),260);
    });
  }

  function openInvitation() {
    const splash = $('entry-splash'), main = $('main-ui');
    if (!splash || splash.dataset.opened === '1') return;
    splash.dataset.opened = '1';
    splash.classList.add('opening');
    document.body.classList.add('invitation-open');
    main.hidden = false;
    requestAnimationFrame(() => document.querySelector('.hero')?.classList.add('active'));
    startCountdown();
    setupRevealObserver();
    tryStartAudio();
    setTimeout(() => { splash.remove(); main.focus?.({preventScroll:true}); syncViewportHeight(); }, reducedMotion ? 20 : inAppBrowser ? 360 : 600);
  }
  function setupRevealObserver() {
    const items = [...document.querySelectorAll('.reveal')];
    if (reducedMotion || !('IntersectionObserver' in window)) { items.forEach(x => x.classList.add('active')); return; }
    const obs = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('active'); obs.unobserve(entry.target); }
    }), {threshold:.1, rootMargin:'0px 0px -4%'});
    items.forEach(x => obs.observe(x));
  }
  function startCountdown() {
    clearInterval(state.countdownTimer);
    const update = () => {
      const d = Math.max(0, EVENT_AT - Date.now());
      const values = [Math.floor(d/86400000), Math.floor(d%86400000/3600000), Math.floor(d%3600000/60000), Math.floor(d%60000/1000)];
      ['cd-d','cd-h','cd-m','cd-s'].forEach((id,i) => { if ($(id)) $(id).textContent = String(values[i]).padStart(2,'0'); });
    };
    update(); state.countdownTimer = setInterval(update,1000);
  }

  /* Audio */
  function setAudioUI(message='') {
    const btn=$('audio-btn'), text=$('audio-text'), waves=$('sound-waves'); if(!btn)return;
    btn.setAttribute('aria-pressed',String(state.audioPlaying));
    text.textContent=message||(state.audioPlaying?'إيقاف الموسيقى':'تشغيل الموسيقى');
    waves.classList.toggle('playing',state.audioPlaying);
  }
  function fadeAudio(to,duration=1000,done) {
    cancelAnimationFrame(state.audioFade); const audio=$('core-audio'); if(!audio)return;
    const from=Number.isFinite(audio.volume)?audio.volume:0,started=performance.now();
    const step=now=>{const p=Math.min(1,(now-started)/Math.max(1,duration));audio.volume=Math.max(0,Math.min(1,from+(to-from)*(1-Math.pow(1-p,3))));if(p<1)state.audioFade=requestAnimationFrame(step);else done?.();};
    state.audioFade=requestAnimationFrame(step);
  }
  function tryStartAudio(){const audio=$('core-audio');if(!audio)return;audio.volume=0;audio.play().then(()=>{state.audioPlaying=true;setAudioUI();fadeAudio(MUSIC_VOLUME,1800);}).catch(()=>{state.audioPlaying=false;setAudioUI();});}
  function toggleAudio(){const audio=$('core-audio');if(!audio)return;if(state.audioPlaying){state.audioPlaying=false;setAudioUI();fadeAudio(0,550,()=>audio.pause());}else{audio.volume=0;audio.play().then(()=>{state.audioPlaying=true;setAudioUI();fadeAudio(MUSIC_VOLUME,1200);}).catch(()=>{state.audioPlaying=false;setAudioUI('الموسيقى غير متاحة');});}}


  function pauseAudioForBackground(){
    cancelAnimationFrame(state.audioFade);
    const audio=$('core-audio');if(!audio)return;
    try{audio.pause();}catch{}
    state.audioPlaying=false;setAudioUI();
  }

  /* Invite side stays internal. */
  function initSide(){const p=new URLSearchParams(location.search),from=String(p.get('from')||'').toLowerCase();state.side=from==='groom'?'العريس':from==='bride'?'العروس':null;}
  function fillCountrySelects(){const html=COUNTRY_LIST.map(c=>`<option value="${c.iso}">${c.iso} +${c.dial}</option>`).join('');['lookup-country','f_country'].forEach(id=>{const el=$(id);if(el){el.innerHTML=html;el.value='IQ';}});}

  function wizardSteps(){return state.status==='yes'?['identity','guests']:['identity'];}
  function showWizardStep(index){
    const steps=wizardSteps();state.wizardIndex=Math.max(0,Math.min(index,steps.length-1));
    document.querySelectorAll('#wizard-area .form-step').forEach(el=>{el.hidden=el.dataset.step!==steps[state.wizardIndex];});
    const n=state.wizardIndex+1,total=steps.length;
    $('wizard-progress-text').textContent=`الخطوة ${n} من ${total}`;$('wizard-progress-bar').style.width=`${n/total*100}%`;
    $('wizard-back').hidden=state.wizardIndex===0;const last=state.wizardIndex===total-1;$('wizard-next').hidden=last;$('rsvp-submit').hidden=!last;$('rsvp-submit').textContent=state.status==='yes'?'تأكيد الحضور':'إرسال الاعتذار';$('save-error').textContent='';
  }
  function chooseStatus(status,button){
    state.status=status;document.querySelectorAll('.choice-btn').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});$('status-error').textContent='';$('wizard-area').hidden=false;showWizardStep(0);setTimeout(()=>$('wizard-area').scrollIntoView({behavior:scrollBehavior(),block:'nearest'}),30);
  }
  function validateWizardStep(){
    const step=wizardSteps()[state.wizardIndex];$('identity-error').textContent='';$('f_name').removeAttribute('aria-invalid');$('f_phone').removeAttribute('aria-invalid');if(step!=='identity')return true;
    if($('f_name').value.trim().length<2){$('identity-error').textContent='يرجى كتابة الاسم الكامل.';$('f_name').setAttribute('aria-invalid','true');$('f_name').focus();return false;}
    if(!normalizePhone($('f_phone').value,$('f_country').value)){$('identity-error').textContent='يرجى إدخال رقم هاتف صحيح.';$('f_phone').setAttribute('aria-invalid','true');$('f_phone').focus();return false;}
    return true;
  }

  function openConfirmModal(guest){
    return new Promise(resolve=>{
      const modal=$('update-confirm-modal'),card=modal.querySelector('.modal-card'),yes=$('update-confirm-yes'),no=$('update-confirm-no'),previous=document.activeElement;
      $('update-confirm-message').innerHTML=`وجدنا تسجيلًا سابقًا باسم <strong>${escapeHtml(guest?.name||'هذا الضيف')}</strong>. إذا تابعت فسيتم تحديث التسجيل نفسه ولن يُنشأ تسجيل مكرر.`;
      modal.hidden=false;document.body.style.overflow='hidden';card.focus();
      const finish=value=>{modal.hidden=true;document.body.style.overflow='';yes.onclick=null;no.onclick=null;document.removeEventListener('keydown',key);previous?.focus?.();resolve(value);};
      const key=e=>{if(e.key==='Escape')finish(false);if(e.key==='Tab'){const focusable=[no,yes],i=focusable.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();yes.focus();}else if(!e.shiftKey&&i===1){e.preventDefault();no.focus();}}};
      yes.onclick=()=>finish(true);no.onclick=()=>finish(false);document.addEventListener('keydown',key);setTimeout(()=>yes.focus(),0);
    });
  }
  function hideSuccessAreas(){$('vip-pass-container').hidden=true;$('decline-success').hidden=true;$('post-message-panel').hidden=true;$('post-message-form').hidden=true;$('post-message-toggle').setAttribute('aria-expanded','false');}
  function fillFormFromGuest(guest){
    state.currentGuest=guest;state.editingPhone=guest.id;if(normalizeSide(guest.side))state.side=normalizeSide(guest.side);hideSuccessAreas();$('rsvp-access-area').hidden=false;$('rsvp-form').hidden=false;state.status=isAttending(guest)?'yes':'no';const btn=document.querySelector(`.choice-btn[data-status="${state.status}"]`);if(btn)chooseStatus(state.status,btn);$('f_name').value=guest.name||'';const digits=String(guest.phoneCanonical||guest.phoneE164||guest.phone||'').replace(/\D/g,''),iso=guest.phoneCountry||inferCountry(digits,'IQ').iso;$('f_country').value=iso;$('f_country').disabled=true;$('f_phone').value=guest.phoneE164||guest.phone||('+'+digits);$('f_phone').readOnly=true;if(state.status==='yes'){const n=Math.min(6,Math.max(1,parseInt(guest.guestsCount||1,10))),r=document.querySelector(`input[name="guests"][value="${n}"]`);if(r)r.checked=true;}$('lookup-panel').hidden=true;$('lookup-toggle').setAttribute('aria-expanded','false');$('rsvp-form').scrollIntoView({behavior:scrollBehavior(),block:'start'});
  }
  async function lookupRSVP(){
    const phone=$('lookup-phone').value,country=$('lookup-country').value,err=$('lookup-phone-error'),box=$('lookup-result');err.textContent='';box.innerHTML='';if(!normalizePhone(phone,country)){err.textContent='يرجى إدخال رقم هاتف صحيح.';return;}const btn=$('lookup-submit'),old=btn.textContent;btn.disabled=true;btn.textContent='جاري البحث...';
    try{const {guest}=await findGuestByPhone(phone,country);if(!guest){box.textContent='لم نجد ردًا سابقًا بهذا الرقم.';return;}if(state.side&&normalizeSide(guest.side)&&normalizeSide(guest.side)!==state.side){box.textContent='وجدنا ردًا سابقًا بهذا الرقم لكن ضمن جهة دعوة أخرى.';return;}if(!state.side&&normalizeSide(guest.side))state.side=normalizeSide(guest.side);state.currentGuest=guest;const attending=isAttending(guest),count=Math.max(1,parseInt(guest.guestsCount||1,10));box.innerHTML=`<div class="lookup-card"><strong>${escapeHtml(guest.name||'')}</strong><br><span class="status-pill">${attending?'مؤكد الحضور':'معتذر عن الحضور'}</span>${attending?`<p>عدد الحاضرين: ${count}</p>`:''}<div class="lookup-actions"><button type="button" class="btn secondary" id="lookup-edit">تعديل الرد</button>${attending&&guest.inviteId?'<button type="button" class="btn primary" id="lookup-pass">عرض بطاقة الحضور</button>':''}<button type="button" class="btn secondary" id="lookup-message">${hasOptionalMessage(guest)?'تعديل الرسالة':'إضافة رسالة'}</button></div></div>`;$('lookup-edit').onclick=()=>fillFormFromGuest(guest);if($('lookup-pass'))$('lookup-pass').onclick=()=>showStoredPass(guest);$('lookup-message').onclick=()=>showPostMessagePanel(guest,true);}
    catch(e){console.error(e);box.textContent=friendlyDbError(e,'تعذر البحث حاليًا. حاول مرة أخرى.');}finally{btn.disabled=false;btn.textContent=old;}
  }

  function friendlyDbError(err,fallback){const c=err?.code||'';if(c==='firebase-unavailable')return'تعذر تحميل الاتصال بقاعدة البيانات. تحقق من الإنترنت ثم أعد المحاولة.';if(c.includes('permission-denied'))return'تعذر الحفظ بسبب إعدادات قاعدة البيانات. يرجى التواصل مع عمر أو علا.';if(c.includes('unavailable')||c.includes('deadline-exceeded'))return'الاتصال ضعيف حاليًا. لم يتم حفظ التغيير بعد؛ يرجى المحاولة مرة أخرى.';return fallback;}
  async function saveGuestWithRetry(ref,payload){try{await ref.set(payload,{merge:true});}catch(e){if(String(e?.code||'').includes('unavailable')||String(e?.code||'').includes('deadline-exceeded')){await new Promise(r=>setTimeout(r,800));await ref.set(payload,{merge:true});}else throw e;}}
  async function submitRSVP(event){
    event.preventDefault();if(!state.status){$('status-error').textContent='يرجى اختيار حالة الحضور.';return;}if(!validateWizardStep())return;const name=$('f_name').value.trim(),phone=$('f_phone').value,country=$('f_country').value,normalized=normalizePhone(phone,country);if(!normalized){$('identity-error').textContent='يرجى إدخال رقم هاتف صحيح.';return;}const submit=$('rsvp-submit'),old=submit.textContent;submit.disabled=true;submit.textContent='جاري الحفظ...';$('save-error').textContent='';
    try{const found=await findGuestByPhone(phone,country),oldGuest=found.guest,info=found.info||normalized;if(!state.side&&normalizeSide(oldGuest?.side))state.side=normalizeSide(oldGuest.side);if(!state.side){$('save-error').textContent='يرجى فتح رابط الدعوة الذي وصلكم مباشرة لإرسال الرد.';return;}if(oldGuest&&!state.editingPhone){if(!await openConfirmModal(oldGuest))return;}const inviteId=oldGuest?.inviteId||createInviteId();const guests=state.status==='yes'?(document.querySelector('input[name="guests"]:checked')?.value||'1'):'0';const payload={name,phone:info.e164,phoneE164:info.e164,phoneCanonical:info.digits,phoneCountry:info.iso,phoneDialCode:'+'+info.dial,side:state.side,status:state.status==='yes'?'يحضر':'يعتذر',guestsCount:state.status==='yes'?String(Math.min(6,Math.max(1,parseInt(guests,10)))):'0',wishes:oldGuest?.wishes||'لا يوجد',specialRequestType:oldGuest?.specialRequestType||'',specialRequest:oldGuest?.specialRequest||'',inviteId,updatedAt:serverTimestamp(),timestamp:oldGuest?.timestamp||serverTimestamp()};const db=getDb();await saveGuestWithRetry(db.collection('guests').doc(info.digits),payload);const legacy=new Set(found.matches.map(g=>g.id));if(state.editingPhone)legacy.add(state.editingPhone);legacy.delete(info.digits);Promise.all([...legacy].map(id=>db.collection('guests').doc(id).delete().catch(()=>null))).catch(()=>{});const guest={id:info.digits,...(oldGuest||{}),...payload};state.editingPhone=info.digits;state.currentGuest=guest;if(state.status==='yes')showSuccessPass(guest);else showDeclineSuccess(guest);}
    catch(e){console.error(e);$('save-error').textContent=friendlyDbError(e,'تعذر حفظ الرد حاليًا. لم يتم تسجيل أي تغيير، يرجى المحاولة مرة أخرى.');}finally{submit.disabled=false;submit.textContent=old;}
  }
  function showDeclineSuccess(guest){state.currentGuest=guest;$('rsvp-access-area').hidden=true;$('decline-success').hidden=false;$('vip-pass-container').hidden=true;showPostMessagePanel(guest,false);$('decline-success').scrollIntoView({behavior:scrollBehavior(),block:'center'});playSuccessGlow();}
  function resetToEdit(){hideSuccessAreas();$('rsvp-access-area').hidden=false;$('rsvp-form').hidden=false;showWizardStep(0);$('rsvp-form').scrollIntoView({behavior:scrollBehavior(),block:'start'});}

  function formatGuestCount(n){n=Math.max(1,parseInt(n,10)||1);return n===1?'صالحة لضيف واحد':n===2?'صالحة لضيفين':`صالحة لـ ${n} ضيوف`;}
  function countSummary(n){n=Math.max(1,parseInt(n,10)||1);return n===1?'ضيف واحد':n===2?'ضيفان':`${n} ضيوف`;}

  /* Keep long guest names inside a fixed two-line safe box. */
  let passNameFitFrame=0;
  function fitPassName(){
    cancelAnimationFrame(passNameFitFrame);
    passNameFitFrame=requestAnimationFrame(()=>{
      const text=$('pass-guest-name');
      const box=text?.closest('.pass-name');
      if(!text||!box||box.clientWidth<20||box.clientHeight<20)return;
      text.style.fontSize='';
      const base=parseFloat(getComputedStyle(box).fontSize)||32;
      let size=base,min=Math.max(12,base*.42),guard=0;
      text.style.fontSize=`${size}px`;
      while(guard++<50&&(text.scrollWidth>box.clientWidth+1||text.scrollHeight>box.clientHeight+1)&&size>min){
        size-=.75;text.style.fontSize=`${size}px`;
      }
    });
  }

  function splitLongToken(ctx,token,maxWidth){
    const out=[];let part='';
    for(const ch of [...token]){
      const next=part+ch;
      if(part&&ctx.measureText(next).width>maxWidth){out.push(part);part=ch;}else part=next;
    }
    if(part)out.push(part);
    return out;
  }
  function wrapCanvasText(ctx,text,maxWidth){
    const words=String(text||'').trim().split(/\s+/).filter(Boolean),lines=[];let line='';
    for(const raw of words){
      const chunks=ctx.measureText(raw).width>maxWidth?splitLongToken(ctx,raw,maxWidth):[raw];
      for(const word of chunks){
        const test=line?`${line} ${word}`:word;
        if(line&&ctx.measureText(test).width>maxWidth){lines.push(line);line=word;}else line=test;
      }
    }
    if(line)lines.push(line);
    return lines.length?lines:['ضيفنا الكريم'];
  }
  function fitCanvasName(ctx,text,{maxWidth=610,maxLines=3,maxSize=72,minSize=20}={}){
    const dir=/[\u0600-\u06ff]/.test(text||'')?'rtl':'ltr';
    for(let size=maxSize;size>=minSize;size-=2){
      ctx.font=`700 ${size}px 'Amiri', serif`;
      const lines=wrapCanvasText(ctx,text||'ضيفنا الكريم',maxWidth);
      if(lines.length<=maxLines)return{size,lines,dir};
    }
    ctx.font=`700 ${minSize}px 'Amiri', serif`;
    let lines=wrapCanvasText(ctx,text||'ضيفنا الكريم',maxWidth);
    if(lines.length>maxLines){
      const merged=[lines[0],lines.slice(1).join(' ')];
      while(ctx.measureText(merged[1]).width>maxWidth&&merged[1].length>1)merged[1]=merged[1].slice(0,-1);
      lines=merged;
    }
    return{size:minSize,lines:lines.slice(0,maxLines),dir};
  }
  function waitForQrLibrary(timeout=2200){return new Promise(resolve=>{if(window.QRCode?.toCanvas)return resolve(true);const started=Date.now(),timer=setInterval(()=>{if(window.QRCode?.toCanvas){clearInterval(timer);resolve(true);}else if(Date.now()-started>=timeout){clearInterval(timer);resolve(false);}},80);});}
  async function renderQrForGuest(guest){
    const canvas=$('pass-qr-canvas'),fallback=$('pass-qr-fallback'),warning=$('rsvp-save-warning');if(!canvas||!guest?.inviteId)return false;canvas.hidden=false;fallback.hidden=true;warning.hidden=true;const ok=await waitForQrLibrary();if(!ok){canvas.hidden=true;fallback.hidden=false;warning.hidden=false;warning.textContent=`بطاقة الحضور محفوظة، لكن تعذر توليد QR في هذا المتصفح. استخدم رمز البطاقة: ${guest.inviteId}`;return false;}try{await QRCode.toCanvas(canvas,`omar-ola-wedding:${guest.inviteId}`,{errorCorrectionLevel:'M',width:248,margin:4,color:{dark:'#263025',light:'#FFFFFF'}});state.qrInviteId=guest.inviteId;return true;}catch(e){console.warn('QR generation unavailable',e);canvas.hidden=true;fallback.hidden=false;warning.hidden=false;warning.textContent=`بطاقة الحضور محفوظة، لكن تعذر توليد QR. استخدم رمز البطاقة: ${guest.inviteId}`;return false;}
  }
  function renderPass(guest){
    if(state.passExportInviteId!==guest?.inviteId){state.passExportInviteId='';state.passExportBlob=null;state.passExportDataUrl='';}
    state.currentGuest=guest;
    $('pass-guest-name').textContent=guest.name||'ضيفنا الكريم';
    $('pass-guest-count').textContent=formatGuestCount(guest.guestsCount||1);
    $('pass-invite-id').textContent=guest.inviteId||'';
    const n=Math.max(1,parseInt(guest.guestsCount||1,10));
    $('pass-summary').textContent=`${guest.name||''} · ${countSummary(n)} · السبت 26 ديسمبر 2026 · قاعة أوريف`;
    $('pass-qr-canvas').hidden=false;$('pass-qr-fallback').hidden=true;$('rsvp-save-warning').hidden=true;
    fitPassName();if(document.fonts?.ready)document.fonts.ready.then(fitPassName).catch(()=>{});
    renderQrForGuest(guest);
  }
  function showSuccessPass(guest){state.currentGuest=guest;$('rsvp-access-area').hidden=true;$('decline-success').hidden=true;$('vip-pass-container').hidden=false;renderPass(guest);showPostMessagePanel(guest,false);playSuccessGlow();$('vip-pass-container').scrollIntoView({behavior:scrollBehavior(),block:'start'});}
  function showStoredPass(guest){state.currentGuest=guest;state.editingPhone=guest.id;if(!state.side&&normalizeSide(guest.side))state.side=normalizeSide(guest.side);$('rsvp-access-area').hidden=true;$('decline-success').hidden=true;$('vip-pass-container').hidden=false;renderPass(guest);showPostMessagePanel(guest,false);$('vip-pass-container').scrollIntoView({behavior:scrollBehavior(),block:'start'});}

  async function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
  function dataUrlToBlob(dataUrl){
    const comma=dataUrl.indexOf(',');
    if(comma<0)throw new Error('invalid-data-url');
    const meta=dataUrl.slice(0,comma),body=dataUrl.slice(comma+1),mime=(meta.match(/^data:([^;]+)/)||[])[1]||'image/png';
    const binary=atob(body),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new Blob([bytes],{type:mime});
  }
  async function canvasToBlobSafe(canvas){
    if(typeof canvas.toBlob==='function'){
      try{
        const blob=await new Promise(resolve=>{
          let done=false,timer=0;
          const finish=value=>{if(done)return;done=true;if(timer)clearTimeout(timer);resolve(value||null);};
          timer=setTimeout(()=>finish(null),3500);
          try{canvas.toBlob(finish,'image/png',1);}catch(error){console.warn('canvas.toBlob failed',error);finish(null);}
        });
        if(blob&&blob.size)return blob;
      }catch(error){console.warn('Blob export unavailable, using data URL fallback',error);}
    }
    const dataUrl=canvas.toDataURL('image/png',1);
    return dataUrlToBlob(dataUrl);
  }
  function drawMirrored(ctx,img,x,y,w,h,mirrorX=false){ctx.save();if(mirrorX){ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(img,0,0,w,h);}else ctx.drawImage(img,x,y,w,h);ctx.restore();}
  async function downloadBlob(blob,filename){
    if(typeof navigator.msSaveOrOpenBlob==='function'){
      navigator.msSaveOrOpenBlob(blob,filename);
      return 'download';
    }
    const url=URL.createObjectURL(blob);
    try{
      const a=document.createElement('a');
      a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';
      document.body.appendChild(a);a.click();a.remove();
      await new Promise(r=>setTimeout(r,180));
      return 'download';
    }catch(error){
      console.warn('Anchor download failed; opening generated image instead',error);
      const opened=window.open(url,'_blank','noopener,noreferrer');
      if(!opened)location.assign(url);
      return 'opened';
    }finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
  }
  async function deliverPassBlob(blob,filename){
    /* Edge/Chromium: the native save picker is the most reliable route when user activation is still available. */
    if(edgeBrowser&&typeof window.showSaveFilePicker==='function'){
      try{
        const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'PNG image',accept:{'image/png':['.png']}}]});
        const writable=await handle.createWritable();await writable.write(blob);await writable.close();return 'file-picker';
      }catch(error){
        if(error?.name==='AbortError')return 'cancelled';
        console.warn('Edge save picker unavailable, using browser download fallback',error);
      }
    }
    if(typeof File!=='undefined'&&navigator.share&&navigator.canShare){
      try{
        const file=new File([blob],filename,{type:'image/png'});
        if((appleMobile||inAppBrowser)&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'بطاقة حضور زفاف عمر وعلا'});return 'shared';}
      }catch(error){if(error?.name==='AbortError')return 'cancelled';console.warn('Native share unavailable, falling back to download',error);}
    }
    return downloadBlob(blob,filename);
  }
  function drawImageContain(ctx,img,x,y,w,h){
    const scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;
    ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  }
  function drawCanvasRule(ctx,y,width=320){
    const cx=540,gap=38,left=cx-gap,right=cx+gap,half=width/2;
    ctx.strokeStyle='rgba(200,148,69,.72)';ctx.lineWidth=1.2;ctx.beginPath();
    ctx.moveTo(cx-half,y);ctx.lineTo(left,y);ctx.moveTo(right,y);ctx.lineTo(cx+half,y);ctx.stroke();
    ctx.save();ctx.translate(cx,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#C89445';ctx.fillRect(-5,-5,10,10);ctx.restore();
  }
  function drawCenteredCanvasLines(ctx,text,y,{size=28,maxWidth=650,lineHeight=1.45,color='#584438',weight='400',maxLines=3}={}){
    ctx.save();ctx.direction='rtl';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.font=`${weight} ${size}px 'Amiri', serif`;
    let lines=wrapCanvasText(ctx,text,maxWidth);
    if(lines.length>maxLines)lines=lines.slice(0,maxLines);
    const lh=size*lineHeight,start=y-((lines.length-1)*lh/2);
    lines.forEach((line,i)=>ctx.fillText(line,540,start+i*lh));ctx.restore();
    return {lines,height:Math.max(size,lines.length*lh)};
  }
  async function buildPassAsset(force=false){
    const guest=state.currentGuest;if(!guest?.inviteId)throw new Error('missing-guest');
    if(!force&&state.passExportInviteId===guest.inviteId&&state.passExportBlob&&state.passExportDataUrl){
      return{blob:state.passExportBlob,dataUrl:state.passExportDataUrl,filename:'Omar_Ola_Attendance_Pass.png'};
    }
    if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1200))]);
    if(state.qrInviteId!==guest.inviteId)await renderQrForGuest(guest);

    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1600;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('canvas-unavailable');
    ctx.fillStyle='#FCF9F2';ctx.fillRect(0,0,1080,1600);
    ctx.strokeStyle='#C89445';ctx.lineWidth=3;ctx.strokeRect(30,30,1020,1540);
    ctx.lineWidth=1.5;ctx.strokeStyle='rgba(200,148,69,.62)';ctx.strokeRect(48,48,984,1504);
    ctx.lineWidth=1;ctx.strokeStyle='rgba(200,148,69,.22)';ctx.strokeRect(64,64,952,1472);

    try{
      const[top,bottom,logo,omar,ola,waw]=await Promise.all([
        loadImage('img/floral-top.webp'),loadImage('img/floral-bottom.webp'),loadImage('img/monogram.webp'),
        loadImage('img/name-omar.webp'),loadImage('img/name-ola.webp'),loadImage('img/name-wa.webp')
      ]);
      ctx.globalAlpha=.93;
      drawMirrored(ctx,top,47,47,210,367,false);drawMirrored(ctx,top,823,47,210,367,true);
      drawMirrored(ctx,bottom,47,1186,210,367,false);drawMirrored(ctx,bottom,823,1186,210,367,true);
      ctx.globalAlpha=1;

      drawCenteredCanvasLines(ctx,'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',116,{size:25,maxWidth:560,lineHeight:1.3,color:'#5F5147',weight:'400',maxLines:1});
      drawCenteredCanvasLines(ctx,'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً',180,{size:24,maxWidth:590,lineHeight:1.45,color:'#55463C',weight:'700',maxLines:3});
      ctx.drawImage(logo,492,248,96,96);

      drawImageContain(ctx,ola,286,360,210,145);
      drawImageContain(ctx,waw,511,405,52,42);
      drawImageContain(ctx,omar,578,360,210,145);
    }catch(e){console.warn('Pass decorative assets unavailable',e);}

    drawCanvasRule(ctx,535,330);
    drawCenteredCanvasLines(ctx,'تتشرف عائلتانا بدعوتكم لمشاركتنا فرحتنا',578,{size:25,maxWidth:650,lineHeight:1.25,color:'#46513E',weight:'400',maxLines:1});
    drawCenteredCanvasLines(ctx,'وحضور مناسبتنا السعيدة',612,{size:25,maxWidth:650,lineHeight:1.25,color:'#46513E',weight:'400',maxLines:1});
    drawCenteredCanvasLines(ctx,'بطاقة حضور',675,{size:39,maxWidth:600,lineHeight:1.2,color:'#C89445',weight:'700',maxLines:1});

    const fitted=fitCanvasName(ctx,guest.name||'ضيفنا الكريم',{maxWidth:620,maxLines:2,maxSize:62,minSize:25});
    ctx.save();ctx.direction=fitted.dir;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#46513E';ctx.font=`700 ${fitted.size}px 'Amiri', serif`;
    const nameLineHeight=fitted.size*1.08,nameCenterY=790,startY=nameCenterY-((fitted.lines.length-1)*nameLineHeight/2);
    fitted.lines.forEach((line,i)=>ctx.fillText(line,540,startY+i*nameLineHeight));ctx.restore();

    drawCenteredCanvasLines(ctx,formatGuestCount(guest.guestsCount||1),900,{size:29,maxWidth:600,lineHeight:1.2});
    drawCanvasRule(ctx,960,300);
    drawCenteredCanvasLines(ctx,'السبت  ·  26 ديسمبر 2026',1012,{size:29,maxWidth:650,lineHeight:1.2});
    drawCenteredCanvasLines(ctx,'قاعة أوريف',1060,{size:40,maxWidth:600,lineHeight:1.2,color:'#46513E',weight:'700',maxLines:1});
    drawCenteredCanvasLines(ctx,'عنكاوا  ·  أربيل',1098,{size:24,maxWidth:600,lineHeight:1.2,color:'#806D61',maxLines:1});

    ctx.fillStyle='#fff';ctx.fillRect(390,1150,300,300);ctx.strokeStyle='rgba(200,148,69,.7)';ctx.lineWidth=1.4;ctx.strokeRect(390,1150,300,300);
    const qr=$('pass-qr-canvas');if(qr&&!qr.hidden)ctx.drawImage(qr,420,1180,240,240);
    ctx.save();ctx.direction='ltr';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#584438';ctx.font="700 23px 'Tajawal', sans-serif";ctx.fillText(guest.inviteId,540,1492);ctx.restore();
    drawCenteredCanvasLines(ctx,'يرجى إبراز البطاقة عند الاستقبال',1530,{size:22,maxWidth:600,lineHeight:1.2,color:'#806D61',maxLines:1});

    const blob=await canvasToBlobSafe(canvas);
    const dataUrl=canvas.toDataURL('image/png',1);
    state.passExportInviteId=guest.inviteId;state.passExportBlob=blob;state.passExportDataUrl=dataUrl;
    return{blob,dataUrl,filename:'Omar_Ola_Attendance_Pass.png'};
  }
  function showPassPreview(dataUrl,note='يمكنك الضغط مطولًا على الصورة واختيار حفظ الصورة.'){
    const modal=$('pass-image-modal'),img=$('pass-preview-image');if(!modal||!img)return;
    img.src=dataUrl;$('pass-preview-note').textContent=note;modal.hidden=false;document.body.style.overflow='hidden';
    modal.querySelector('.modal-card')?.focus();
  }
  function closePassPreview(){const modal=$('pass-image-modal');if(!modal)return;modal.hidden=true;document.body.style.overflow='';}
  async function exportPass(){
    const btn=$('download-pass');if(!state.currentGuest?.inviteId)return;const old=btn.textContent;btn.disabled=true;btn.textContent='جاري تجهيز الصورة…';
    try{
      const asset=await buildPassAsset();
      const delivery=await deliverPassBlob(asset.blob,asset.filename);
      if(delivery==='opened')showPassPreview(asset.dataUrl,'تم تجهيز الصورة. يمكنك حفظها من قائمة الصورة أو الضغط المطول عليها.');
    }catch(e){console.error(e);$('rsvp-save-warning').hidden=false;$('rsvp-save-warning').textContent='تعذر حفظ الصورة تلقائيًا. جرّب فتح الصورة ثم حفظها من المتصفح.';}
    finally{btn.disabled=false;btn.textContent=old;}
  }
  async function openPassImage(){
    const btn=$('open-pass-image');if(!state.currentGuest?.inviteId)return;const old=btn.textContent;btn.disabled=true;btn.textContent='جاري التجهيز…';
    try{const asset=await buildPassAsset();showPassPreview(asset.dataUrl,'يمكنك الضغط مطولًا على الصورة ثم اختيار حفظ الصورة.');}
    catch(e){console.error(e);$('rsvp-save-warning').hidden=false;$('rsvp-save-warning').textContent='تعذر تجهيز معاينة الصورة على هذا المتصفح.';}
    finally{btn.disabled=false;btn.textContent=old;}
  }
  async function sharePassImage(){
    const btn=$('share-pass-image');if(!state.currentGuest?.inviteId)return;const old=btn.textContent;btn.disabled=true;btn.textContent='جاري التجهيز…';
    try{
      const asset=await buildPassAsset();
      if(typeof File!=='undefined'&&navigator.share&&navigator.canShare){
        const file=new File([asset.blob],asset.filename,{type:'image/png'});
        if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'بطاقة حضور زفاف عمر وعلا'});return;}
      }
      if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
        await navigator.clipboard.write([new ClipboardItem({'image/png':asset.blob})]);
        $('rsvp-save-warning').hidden=false;$('rsvp-save-warning').textContent='تم نسخ صورة البطاقة إلى الحافظة.';
        return;
      }
      showPassPreview(asset.dataUrl,'المشاركة المباشرة غير متاحة هنا. افتح الصورة واحفظها أو شاركها من المتصفح.');
    }catch(e){if(e?.name!=='AbortError'){console.error(e);const asset=await buildPassAsset().catch(()=>null);if(asset)showPassPreview(asset.dataUrl,'المشاركة المباشرة غير متاحة هنا. يمكنك حفظ الصورة ثم مشاركتها.');}}
    finally{btn.disabled=false;btn.textContent=old;}
  }

  function showPostMessagePanel(guest,expand=false){
    if(!guest?.id)return;state.currentGuest=guest;const panel=$('post-message-panel'),form=$('post-message-form'),toggle=$('post-message-toggle');panel.hidden=false;$('post-wishes').value=hasWishes(guest)?guest.wishes:'';const sp=String(guest.specialRequest||'').trim();$('post-special-toggle').checked=!!sp;$('post-special-wrap').hidden=!sp;$('post-special').value=sp;$('post-message-status').textContent='';$('post-message-status').className='post-message-status';toggle.textContent=hasOptionalMessage(guest)?'تعديل الرسالة أو الملاحظة':'إضافة رسالة أو ملاحظة';form.hidden=!expand;toggle.setAttribute('aria-expanded',String(expand));if(expand)setTimeout(()=>panel.scrollIntoView({behavior:scrollBehavior(),block:'center'}),20);
  }
  async function savePostMessage(){
    const guest=state.currentGuest,status=$('post-message-status'),btn=$('post-message-save');if(!guest?.id){status.textContent='تعذر تحديد سجل الرد.';status.classList.add('error');return;}const wishes=$('post-wishes').value.trim()||'لا يوجد',special=$('post-special-toggle').checked?$('post-special').value.trim():'';const old=btn.textContent;btn.disabled=true;btn.textContent='جاري الحفظ...';status.textContent='';status.className='post-message-status';
    try{const db=await getDbReady();await saveGuestWithRetry(db.collection('guests').doc(guest.id),{wishes,specialRequest:special,updatedAt:serverTimestamp()});state.currentGuest={...guest,wishes,specialRequest:special};status.textContent='تم حفظ الرسالة بنجاح.';$('post-message-toggle').textContent='تعديل الرسالة أو الملاحظة';}catch(e){console.error(e);status.textContent=friendlyDbError(e,'تعذر حفظ الرسالة حاليًا. حاول مرة أخرى.');status.classList.add('error');}finally{btn.disabled=false;btn.textContent=old;}
  }
  function playSuccessGlow(){const g=$('success-glow');g.classList.remove('play');void g.offsetWidth;g.classList.add('play');}

  function installPhotoProtection(){
    const isProtectedTarget=target=>target instanceof Element&&!!target.closest('[data-protected-photo]');
    document.addEventListener('contextmenu',event=>{if(isProtectedTarget(event.target)){event.preventDefault();event.stopPropagation();}},{capture:true});
    document.addEventListener('dragstart',event=>{if(isProtectedTarget(event.target)){event.preventDefault();event.stopPropagation();}},{capture:true});
    document.addEventListener('selectstart',event=>{if(isProtectedTarget(event.target)){event.preventDefault();}},{capture:true});
    document.querySelectorAll('[data-protected-photo] img').forEach(img=>{img.draggable=false;img.setAttribute('draggable','false');});
  }


  function openLocationModal(){
    const modal=$('location-modal');if(!modal)return;modal.hidden=false;document.body.style.overflow='hidden';
    modal.querySelector('.modal-card')?.focus();
  }
  function closeLocationModal(){
    const modal=$('location-modal');if(!modal)return;modal.hidden=true;document.body.style.overflow='';
  }
  function openWazeDirect(){
    if(androidMobile){
      const fallback=encodeURIComponent(VENUE_WAZE_WEB_URL);
      location.href=`intent://?q=${encodeURIComponent(VENUE_WAZE_QUERY)}&navigate=yes#Intent;scheme=waze;package=com.waze;S.browser_fallback_url=${fallback};end`;
      return;
    }
    if(appleMobile){
      let hidden=false;const mark=()=>{if(document.hidden)hidden=true;};document.addEventListener('visibilitychange',mark,{once:true});
      location.href=VENUE_WAZE_APP_URL;
      setTimeout(()=>{if(!hidden&&!document.hidden)location.href=VENUE_WAZE_WEB_URL;},1350);
      return;
    }
    window.open(VENUE_WAZE_WEB_URL,'_blank','noopener,noreferrer');
  }
  async function shareVenueLocation(){
    try{
      if(navigator.share){await navigator.share({title:'قاعة أوريف',text:'موقع قاعة أوريف - عنكاوا، أربيل',url:VENUE_MAP_URL});return;}
      await navigator.clipboard?.writeText?.(VENUE_MAP_URL);
      const btn=$('share-location');if(btn){const old=btn.textContent;btn.textContent='تم نسخ الرابط ✓';setTimeout(()=>btn.textContent=old,1400);}
    }catch(e){if(e?.name!=='AbortError')window.open(VENUE_MAP_URL,'_blank','noopener,noreferrer');}
  }

  function init(){
    installViewportGuards();
    installPhotoProtection();
    if('ResizeObserver'in window){const ro=new ResizeObserver(()=>{if(!$('vip-pass-container')?.hidden)fitPassName();});if($('attendance-pass'))ro.observe($('attendance-pass'));}
    else addEventListener('resize',()=>{if(!$('vip-pass-container')?.hidden)fitPassName();},{passive:true});
    $('open-invitation')?.addEventListener('click',openInvitation);$('audio-btn')?.addEventListener('click',toggleAudio);fillCountrySelects();initSide();
    $('open-location-modal')?.addEventListener('click',openLocationModal);$('close-location-modal')?.addEventListener('click',closeLocationModal);$('open-waze')?.addEventListener('click',openWazeDirect);$('share-location')?.addEventListener('click',shareVenueLocation);$('location-modal')?.addEventListener('click',e=>{if(e.target===$('location-modal'))closeLocationModal();});
    document.querySelectorAll('.choice-btn').forEach(btn=>btn.addEventListener('click',()=>chooseStatus(btn.dataset.status,btn)));
    $('wizard-next')?.addEventListener('click',()=>{if(validateWizardStep())showWizardStep(state.wizardIndex+1);});$('wizard-back')?.addEventListener('click',()=>showWizardStep(state.wizardIndex-1));$('rsvp-form')?.addEventListener('submit',submitRSVP);
    $('lookup-toggle')?.addEventListener('click',()=>{const next=$('lookup-panel').hidden;$('lookup-panel').hidden=!next;$('lookup-toggle').setAttribute('aria-expanded',String(next));if(next)$('lookup-phone').focus();});$('lookup-submit')?.addEventListener('click',lookupRSVP);$('lookup-phone')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupRSVP();}});
    $('decline-edit')?.addEventListener('click',()=>state.currentGuest?fillFormFromGuest(state.currentGuest):resetToEdit());$('pass-edit')?.addEventListener('click',()=>state.currentGuest?fillFormFromGuest(state.currentGuest):resetToEdit());$('download-pass')?.addEventListener('click',exportPass);$('open-pass-image')?.addEventListener('click',openPassImage);$('share-pass-image')?.addEventListener('click',sharePassImage);$('pass-preview-close')?.addEventListener('click',closePassPreview);$('pass-image-modal')?.addEventListener('click',e=>{if(e.target===$('pass-image-modal'))closePassPreview();});
    $('post-message-toggle')?.addEventListener('click',()=>{const form=$('post-message-form'),next=form.hidden;form.hidden=!next;$('post-message-toggle').setAttribute('aria-expanded',String(next));if(next)$('post-wishes').focus();});$('post-special-toggle')?.addEventListener('change',e=>$('post-special-wrap').hidden=!e.target.checked);$('post-message-save')?.addEventListener('click',savePostMessage);
    $('core-audio')?.addEventListener('ended',()=>{if(state.audioPlaying){$('core-audio').currentTime=0;$('core-audio').volume=0;$('core-audio').play().then(()=>fadeAudio(MUSIC_VOLUME,1600)).catch(()=>{state.audioPlaying=false;setAudioUI();});}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearInterval(state.countdownTimer);state.countdownTimer=0;pauseAudioForBackground();}else if(document.body.classList.contains('invitation-open'))startCountdown();});
    addEventListener('pagehide',pauseAudioForBackground,{passive:true});document.addEventListener('freeze',pauseAudioForBackground,{passive:true});addEventListener('blur',()=>{if(document.hidden)pauseAudioForBackground();},{passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('location-modal')?.hidden)closeLocationModal();if(!$('pass-image-modal')?.hidden)closePassPreview();}});
    if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{}),{once:true});
  }
  init();
})();
