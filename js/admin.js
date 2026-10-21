(() => {
  'use strict';
  const FIREBASE_CONFIG={apiKey:'AIzaSyDmnzzsD2rOVj57PAv5sehmDR-xWHn8YK8',authDomain:'omar-ola-wedding.firebaseapp.com',projectId:'omar-ola-wedding',storageBucket:'omar-ola-wedding.firebasestorage.app',messagingSenderId:'329727762097',appId:'1:329727762097:web:e7ced21cda37f64548cc90'};
  const SESSION=6*60*60*1000;
  const $=id=>document.getElementById(id);
  let db=null,auth=null,guests=[],unsubscribe=null,lockTimer=0,stream=null,raf=0,lastCode='',lastCodeAt=0,detector=null,scanCanvas=null,firebaseRetryTimer=0,firebaseRetries=0,authObserverStarted=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const latin=v=>String(v??'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const side=v=>(v==='العريس'||v==='Groom')?'العريس':(v==='العروس'||v==='Bride')?'العروس':(v||'-');
  const attending=g=>g.status==='يحضر'||g.status==='yes';
  const isIn=g=>!!(g.checkedInAt||g.checkedIn);
  const seats=g=>attending(g)?Math.min(6,Math.max(1,parseInt(g.guestsCount||1,10))):0;
  function pkey(g){if(g.phoneCanonical)return String(g.phoneCanonical).replace(/\D/g,'');let r=latin(g.phoneE164||g.phone||g.id||'').trim().replace(/[\s\-().]/g,'');if(r.startsWith('+'))return r.slice(1).replace(/\D/g,'');if(r.startsWith('00'))return r.slice(2).replace(/\D/g,'');const d=r.replace(/\D/g,'');if(d.startsWith('964'))return d;if(d.startsWith('0'))return'964'+d.replace(/^0+/,'');if(d.startsWith('7'))return'964'+d;return d;}
  const phone=g=>g.phoneE164||g.phone||(pkey(g)?'+'+pkey(g):'');
  const tms=g=>{const t=g.updatedAt||g.timestamp;return t?.toMillis?t.toMillis():t?.toDate?t.toDate().getTime():0;};
  function dedupe(list){const m=new Map();list.forEach(g=>{const k=pkey(g)||g.id,p=m.get(k);if(!p||tms(g)>=tms(p))m.set(k,g);});return[...m.values()];}
  const tIn=g=>{const t=g.checkedInAt;return t?.toDate?t.toDate().toLocaleTimeString('ar-IQ-u-nu-latn',{hour:'2-digit',minute:'2-digit'}):'';};
  const match=(g,q)=>{q=String(q||'').trim().toLowerCase();if(!q)return true;const d=latin(q).replace(/\D/g,'');return String(g.name||'').toLowerCase().includes(q)||String(g.inviteId||'').toLowerCase().includes(q)||(d.length>=3&&pkey(g).includes(d.replace(/^0+/,'')));};
  const debounce=(fn,ms=150)=>{let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms);};};

  function ensureFirebase(){if(!window.firebase?.initializeApp||!window.firebase?.firestore||!window.firebase?.auth)throw new Error('firebase-unavailable');if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);}
  function getDb(){if(db)return db;ensureFirebase();db=firebase.firestore();return db;}
  function getAuth(){if(auth)return auth;ensureFirebase();auth=firebase.auth();return auth;}
  const serverTimestamp=()=>firebase.firestore.FieldValue.serverTimestamp();

  function stopAdminData(){unsubscribe?.();unsubscribe=null;stopScan();clearTimeout(lockTimer);clearTimeout(firebaseRetryTimer);firebaseRetries=0;guests=[];}
  function showLogin(message=''){$('app').hidden=true;$('login').hidden=false;$('login-err').textContent=message;$('pw').value='';setTimeout(()=>$('email')?.focus(),0);}
  async function isAuthorizedAdmin(user){if(!user)return false;const snap=await getDb().collection('admins').doc(user.uid).get();return snap.exists;}
  function openSession(user){$('login').hidden=true;$('app').hidden=false;$('login-err').textContent='';const until=Date.now()+SESSION;sessionStorage.setItem('omarOlaAdminUntil',String(until));clearTimeout(lockTimer);lockTimer=setTimeout(()=>lock(),SESSION);if($('admin-user'))$('admin-user').textContent=user.email||'حساب الإدارة';listen();}
  async function lock(){sessionStorage.removeItem('omarOlaAdminUntil');stopAdminData();try{await getAuth().signOut();}catch(err){console.error(err);}showLogin();}
  async function login(e){e.preventDefault();const btn=e.submitter||e.target.querySelector('button');btn.disabled=true;$('login-err').textContent='';try{const a=getAuth();await a.setPersistence(firebase.auth.Auth.Persistence.SESSION);await a.signInWithEmailAndPassword($('email').value.trim(),$('pw').value);}catch(err){console.error(err);const c=String(err?.code||'');$('login-err').textContent=(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')||c.includes('invalid-login-credentials'))?'البريد الإلكتروني أو كلمة المرور غير صحيحة.':c.includes('too-many-requests')?'تم إيقاف المحاولات مؤقتًا لكثرة المحاولات. حاول لاحقًا.':'تعذر تسجيل الدخول. تحقق من الاتصال وإعداد Firebase Authentication.';}finally{btn.disabled=false;}}
  async function handleAuthState(user){stopAdminData();if(!user){showLogin();return;}try{if(!await isAuthorizedAdmin(user)){await getAuth().signOut();showLogin('هذا الحساب مسجل في Firebase لكنه غير مضاف إلى قائمة المدراء.');return;}const oldUntil=Number(sessionStorage.getItem('omarOlaAdminUntil')||0);if(oldUntil&&oldUntil<=Date.now()){await getAuth().signOut();showLogin('انتهت جلسة الإدارة. سجّل الدخول من جديد.');return;}openSession(user);}catch(err){console.error(err);showLogin('تعذر التحقق من صلاحية حساب الإدارة. تأكد من نشر Firestore Rules وإنشاء مستند admin.');}}
  function listen(){
    unsubscribe?.();
    try{
      const d=getDb();
      unsubscribe=d.collection('guests').orderBy('timestamp','desc').onSnapshot(snap=>{
        const a=[];snap.forEach(x=>a.push({id:x.id,...x.data()}));guests=dedupe(a);$('conn').textContent='متصل مباشرة';$('conn').className='connection on';renderAll();
      },err=>{console.error(err);$('conn').textContent='انقطع الاتصال';$('conn').className='connection';});
    }catch(err){
      console.error(err);
      $('conn').textContent=window.firebase?'تعذر الاتصال بقاعدة البيانات':'جاري تحميل Firebase…';$('conn').className='connection';renderAll();
      if(!window.firebase&&firebaseRetries<20){firebaseRetries++;clearTimeout(firebaseRetryTimer);firebaseRetryTimer=setTimeout(listen,500);}
    }
  }

  function badges(g){return `<span class="badge ${attending(g)?'yes':'no'}">${attending(g)?'يحضر':'يعتذر'}</span>${attending(g)?`<span class="badge ${isIn(g)?'in':'out'}">${isIn(g)?'دخل '+esc(tIn(g)):'لم يدخل'}</span><span class="badge">${seats(g)} أشخاص</span>`:''}${(g.specialRequest||'').trim()?'<span class="badge sp">طلب خاص</span>':''}${g.tableNumber?`<span class="badge">طاولة ${esc(g.tableNumber)}</span>`:''}`;}
  const cls=g=>!attending(g)?'no':isIn(g)?'in':(g.specialRequest||'').trim()?'sp':'';
  function card(g,extra=''){const sp=String(g.specialRequest||'').trim(),w=g.wishes&&!['None','لا يوجد'].includes(g.wishes)?g.wishes:'';return `<article class="guest-card ${cls(g)}"><h3>${esc(g.name||'بدون اسم')}</h3><div class="meta">${badges(g)}<span class="badge">${esc(side(g.side))}</span></div><div class="phone">${esc(phone(g))}${g.inviteId?` · ${esc(g.inviteId)}`:''}</div>${sp?`<div class="note">${esc(sp)}</div>`:''}${w?`<div class="wish">${esc(w)}</div>`:''}${extra}</article>`;}
  const empty=t=>`<p class="empty">${t}</p>`;

  function renderStats(){let total=0,groom=0,bride=0,no=0,sp=0,inSeats=0;guests.forEach(g=>{if(attending(g)){const n=seats(g);total+=n;if(side(g.side)==='العريس')groom+=n;if(side(g.side)==='العروس')bride+=n;if(isIn(g))inSeats+=n;}else no++;if(String(g.specialRequest||'').trim())sp++;});$('s-in').textContent=`${inSeats}/${total}`;$('s-seats').textContent=total;$('s-resp').textContent=guests.length;$('s-no').textContent=no;$('s-groom').textContent=groom;$('s-bride').textContent=bride;$('s-sp').textContent=sp;}
  function renderGuests(){const q=$('q').value,st=$('f-status').value,sd=$('f-side').value;const list=guests.filter(g=>match(g,q)&&(sd==='all'||side(g.side)===sd)&&(st==='all'||(st==='yes'&&attending(g))||(st==='no'&&!attending(g))||(st==='in'&&isIn(g))||(st==='out'&&attending(g)&&!isIn(g))||(st==='sp'&&String(g.specialRequest||'').trim())));$('g-list').innerHTML=list.map(g=>card(g,`<button class="btn ghost" data-delete="${esc(g.id)}" style="margin-top:.65rem;width:100%;border-color:#8A3C34;color:#8A3C34">حذف الرد</button>`)).join('')||empty('لا توجد نتائج مطابقة.');}
  function renderTables(){const list=guests.filter(g=>attending(g)&&match(g,$('tq').value));$('t-list').innerHTML=list.map(g=>card(g,`<div class="row"><input type="text" id="tb-${esc(g.id)}" value="${esc(g.tableNumber||'')}" placeholder="رقم الطاولة مثل A12" aria-label="طاولة ${esc(g.name||'')}"><button class="btn secondary" data-save="${esc(g.id)}">حفظ</button></div>`)).join('')||empty('لا توجد ردود حضور.');}
  function renderNotes(){const list=guests.filter(g=>String(g.specialRequest||'').trim()||(g.wishes&&!['None','لا يوجد'].includes(String(g.wishes).trim())));$('n-list').innerHTML=list.map(g=>card(g)).join('')||empty('لا توجد رسائل أو طلبات أو ملاحظات.');}
  function renderCheckin(){const q=$('ci-q').value;const list=q.trim()?guests.filter(g=>attending(g)&&match(g,q)).slice(0,12):[];$('ci-list').innerHTML=list.map(g=>card(g,isIn(g)?`<button class="btn ghost" data-undo="${esc(g.id)}" style="margin-top:.65rem;width:100%">إلغاء الدخول — إذا كان تسجيلًا خاطئًا</button>`:`<button class="btn go" data-in="${esc(g.id)}">تسجيل دخول · ${seats(g)} أشخاص</button>`)).join('')||(q.trim()?empty('لا يوجد ضيف مطابق.'):'');const recent=guests.filter(isIn).sort((a,b)=>(b.checkedInAt?.toMillis?.()||0)-(a.checkedInAt?.toMillis?.()||0)).slice(0,8);$('ci-recent').innerHTML=recent.map(g=>card(g)).join('')||empty('لم يدخل أي ضيف بعد.');}
  function renderAll(){renderStats();renderGuests();renderTables();renderNotes();renderCheckin();}

  function showResult(kind,html){const r=$('result');r.className='result show '+kind;r.innerHTML=html;r.scrollIntoView({block:'nearest',behavior:'smooth'});}
  async function checkIn(id){
    try{
      const d=getDb();
      const res=await d.runTransaction(async tx=>{
        const ref=d.collection('guests').doc(id),snap=await tx.get(ref);if(!snap.exists)throw new Error('not-found');const data=snap.data()||{};if(data.checkedInAt||data.checkedIn)return{duplicate:true,data};tx.set(ref,{checkedIn:true,checkedInAt:serverTimestamp()},{merge:true});return{duplicate:false,data};
      });
      const g={...guests.find(x=>x.id===id),...res.data};const info=`<div class="info">${esc(g.name||'')}<br>${seats(g)} أشخاص${g.tableNumber?` · طاولة ${esc(g.tableNumber)}`:' · بدون طاولة'}</div>`;
      if(res.duplicate)showResult('warn',`<div class="big">دخل سابقًا ${esc(tIn(g))}</div>${info}`);else{showResult('ok',`<div class="big">تم تسجيل الدخول</div>${info}`);navigator.vibrate?.(120);}
    }catch(err){console.error(err);showResult('bad','<div class="big">تعذر التسجيل</div><div class="info">تحقق من الاتصال وأعد المحاولة.</div>');}
  }
  const inviteId=raw=>{const s=String(raw||'').trim(),m=s.match(/RSVP-[A-Z0-9-]+/i);return(m?m[0]:s).toUpperCase();};
  function byCode(raw){const code=inviteId(raw),g=guests.find(x=>String(x.inviteId||'').toUpperCase()===code);if(!g)return showResult('bad','<div class="big">الرمز غير موجود</div>');if(!attending(g))return showResult('bad',`<div class="big">${esc(g.name||'')}</div><div class="info">مسجّل كمعتذر عن الحضور</div>`);checkIn(g.id);}

  async function loadJsQR(){if(window.jsQR)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  function stopScan(){cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').style.display='none';$('scan-btn').textContent='فتح الكاميرا';}
  async function toggleScan(){
    if(stream){stopScan();return;}
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('camera-unavailable');
      if('BarcodeDetector'in window)detector=new BarcodeDetector({formats:['qr_code']});else await loadJsQR();
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});const v=$('video');v.srcObject=stream;v.style.display='block';await v.play();$('scan-btn').textContent='إغلاق الكاميرا';scanCanvas=scanCanvas||document.createElement('canvas');let busy=false;
      const tick=async()=>{raf=requestAnimationFrame(tick);if(busy||v.readyState<2)return;busy=true;try{let raw='';if(detector){raw=(await detector.detect(v))[0]?.rawValue||'';}else{const w=Math.min(640,v.videoWidth||640),h=Math.round(w*(v.videoHeight||480)/(v.videoWidth||640));scanCanvas.width=w;scanCanvas.height=h;const x=scanCanvas.getContext('2d',{willReadFrequently:true});x.drawImage(v,0,0,w,h);raw=window.jsQR(x.getImageData(0,0,w,h).data,w,h)?.data||'';}if(raw&&(raw!==lastCode||Date.now()-lastCodeAt>4000)){lastCode=raw;lastCodeAt=Date.now();byCode(raw);}}catch{}finally{busy=false;}};tick();
    }catch(err){console.error(err);showResult('warn','<div class="big">تعذر فتح الكاميرا</div><div class="info">اسمح بالوصول للكاميرا، أو ابحث بالاسم أو الهاتف أو RSVP ID.</div>');stopScan();}
  }

  function exportCsv(){const clean=v=>`"${String(v??'').replace(/"/g,'""').replace(/\n/g,' ')}"`;let text='\uFEFFالاسم,رقم الهاتف,الجهة,الحالة,عدد الحاضرين,رسالة لعمر وعلا,الطلب أو الملاحظة,الطاولة,تسجيل الدخول,رمز البطاقة\n';guests.forEach(g=>{text+=[g.name,phone(g),side(g.side),attending(g)?'يحضر':'يعتذر',seats(g),g.wishes||'',g.specialRequest||'',g.tableNumber||'',isIn(g)?'تم':'',g.inviteId||''].map(clean).join(',')+'\n';});const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='Omar_Ola_GuestList.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

  async function deleteGuest(id,button){
    const g=guests.find(x=>x.id===id);
    const name=g?.name||'هذا الضيف';
    const ok=confirm(`هل أنت متأكد من حذف رد «${name}»؟\n\nسيتم حذف بيانات الرد نهائيًا من Firestore ولا يمكن التراجع عن هذه العملية.`);
    if(!ok)return;
    const old=button?.textContent||'حذف الرد';
    if(button){button.disabled=true;button.textContent='جاري الحذف…';}
    try{
      await getDb().collection('guests').doc(id).delete();
    }catch(err){
      console.error(err);
      alert('تعذر حذف الرد. تحقق من الاتصال وصلاحيات حساب الإدارة ثم حاول مرة أخرى.');
      if(button){button.disabled=false;button.textContent=old;}
    }
  }


  function init(){
    $('login-form').addEventListener('submit',login);$('lock-btn').addEventListener('click',lock);$('csv').addEventListener('click',exportCsv);$('scan-btn').addEventListener('click',toggleScan);
    ['q','tq','ci-q'].forEach(id=>$(id).addEventListener('input',debounce(renderAll)));['f-status','f-side'].forEach(id=>$(id).addEventListener('change',renderGuests));
    document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-selected',String(on));});document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='p-'+b.dataset.t));if(b.dataset.t!=='checkin')stopScan();scrollTo({top:0,behavior:'smooth'});}));
    $('g-list').addEventListener('click',async e=>{const b=e.target.closest('[data-delete]');if(!b)return;await deleteGuest(b.dataset.delete,b);});
    $('ci-list').addEventListener('click',async e=>{const inBtn=e.target.closest('[data-in]'),undo=e.target.closest('[data-undo]');if(inBtn){inBtn.disabled=true;await checkIn(inBtn.dataset.in);}if(undo&&confirm('إلغاء تسجيل الدخول لهذا الضيف؟')){try{await getDb().collection('guests').doc(undo.dataset.undo).set({checkedIn:false,checkedInAt:null},{merge:true});$('result').className='result';}catch(err){console.error(err);showResult('bad','تعذر إلغاء تسجيل الدخول.');}}});
    $('ci-q').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const q=$('ci-q').value;if(/RSVP-/i.test(q))byCode(q);}});
    $('t-list').addEventListener('click',async e=>{const b=e.target.closest('[data-save]');if(!b)return;const id=b.dataset.save;b.disabled=true;const old=b.textContent;try{await getDb().collection('guests').doc(id).set({tableNumber:$('tb-'+id).value.trim(),adminUpdatedAt:serverTimestamp()},{merge:true});b.textContent='تم الحفظ';}catch(err){console.error(err);b.textContent='فشل الحفظ';}setTimeout(()=>{b.textContent=old;b.disabled=false;},1200);});
    try{const a=getAuth();if(!authObserverStarted){authObserverStarted=true;a.onAuthStateChanged(handleAuthState);}}catch(err){console.error(err);showLogin('تعذر تحميل Firebase Authentication. أعد تحميل الصفحة وتحقق من الإنترنت.');}
  }
  init();
})();
