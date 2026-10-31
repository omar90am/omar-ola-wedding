(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  let memories = [];
  let unsubscribeMemories = null;

  function escapeHtml(value) { const node=document.createElement('div'); node.textContent=String(value??''); return node.innerHTML; }
  function typeLabel(type) { if(type==='photo')return 'صورة'; if(type==='voice')return 'تسجيل صوتي'; return 'رسالة'; }
  function memoryDate(memory) { const date=memory.createdAt&&memory.createdAt.toDate?memory.createdAt.toDate():null; return date?date.toLocaleString('ar-IQ-u-nu-latn',{dateStyle:'medium',timeStyle:'short'}):''; }
  function mediaUrl(memory) { const value=String(memory.storagePath||'').trim(); return value.startsWith('https://res.cloudinary.com/')?value:''; }
  function extensionFor(memory, blob) { const mime=String(blob?.type||memory.mimeType||'').toLowerCase(); if(mime.includes('png'))return 'png'; if(mime.includes('webp'))return 'webp'; if(mime.includes('heic'))return 'heic'; if(mime.includes('jpeg')||mime.includes('jpg'))return 'jpg'; if(mime.includes('mp4')||mime.includes('m4a'))return 'm4a'; if(mime.includes('ogg'))return 'ogg'; if(mime.includes('mpeg'))return 'mp3'; if(mime.includes('wav'))return 'wav'; return memory.type==='photo'?'jpg':memory.type==='voice'?'webm':'txt'; }
  function safeBase(memory,index='') { const base=String(memory.guestName||'guest').normalize('NFKC').replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'')||'guest'; return `${String(index).padStart(3,'0')}-${memory.type}-${base}`; }
  function safeName(memory) { return `ola-omar-${safeBase(memory,'')}.${extensionFor(memory)}`; }
  function triggerBlob(blob,name) { const a=document.createElement('a'); const url=URL.createObjectURL(blob); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000); }

  function renderMemories() {
    const target=byId('memory-list'); if(!target)return;
    const query=String(byId('memory-q')?.value||'').trim().toLowerCase(); const selectedType=byId('memory-type')?.value||'all';
    const filtered=memories.filter(memory=>{const typeOk=selectedType==='all'||memory.type===selectedType;const haystack=[memory.guestName,memory.message,memory.caption].join(' ').toLowerCase();return typeOk&&(!query||haystack.includes(query));});
    if(byId('s-memories'))byId('s-memories').textContent=String(memories.length);
    const exportBtn=byId('export-memories'); if(exportBtn)exportBtn.disabled=!memories.length;
    if(!filtered.length){target.innerHTML='<p class="empty">لا توجد ذكريات مطابقة.</p>';return;}
    target.innerHTML=filtered.map(memory=>{const name=escapeHtml(memory.guestName||'ضيف بدون اسم'),message=escapeHtml(memory.message||''),caption=escapeHtml(memory.caption||''),url=mediaUrl(memory);let media='';if(memory.type==='photo'&&url)media=`<img class="memory-media" src="${escapeHtml(url)}" alt="صورة من ${name}" loading="lazy">`;if(memory.type==='voice'&&url)media=`<audio class="memory-media" controls preload="none" src="${escapeHtml(url)}"></audio>`;const download=url?`<button class="btn secondary" type="button" data-download="${escapeHtml(memory.id)}">تحميل الملف</button>`:'';return `<article class="memory-card"><div class="memory-card-head"><div><h3>${name}</h3><div class="memory-time">${escapeHtml(memoryDate(memory))}</div></div><span class="memory-type">${typeLabel(memory.type)}</span></div>${message?`<div class="memory-text">${message}</div>`:''}${media}${caption?`<p class="memory-caption">${caption}</p>`:''}<div class="memory-actions">${url?`<a class="btn secondary" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">فتح الملف</a>`:''}${download}<button class="btn memory-delete" type="button" data-delete-memory="${escapeHtml(memory.id)}">حذف الذكرى</button></div></article>`;}).join('');
  }

  async function downloadMemory(id) { const memory=memories.find(item=>item.id===id);if(!memory)return;const url=mediaUrl(memory);if(!url){if(memory.type==='text')triggerBlob(new Blob([memory.message||''],{type:'text/plain;charset=utf-8'}),safeName(memory));return;}try{const response=await fetch(url);if(!response.ok)throw new Error('download-failed');const blob=await response.blob();triggerBlob(blob,`ola-omar-${safeBase(memory,'')}.${extensionFor(memory,blob)}`);}catch(error){console.error(error);window.open(url,'_blank','noopener,noreferrer');} }

  async function exportAllMemories(button) {
    if(!memories.length){alert('لا توجد ذكريات لتصديرها بعد.');return;}
    const original=button.textContent;button.disabled=true;button.textContent='جاري تجهيز الأرشيف…';
    try {
      const stamp=new Date().toISOString().slice(0,10); const folder=`Omar-Ola-Memories-${stamp}`;
      const manifest=[]; const media=[];
      memories.forEach((m,i)=>{const n=i+1;manifest.push({number:n,id:m.id,type:m.type,guestName:m.guestName||'',date:memoryDate(m),message:m.message||'',caption:m.caption||'',mimeType:m.mimeType||'',size:m.size||0,durationSeconds:m.durationSeconds||0,mediaUrl:mediaUrl(m)});if(mediaUrl(m))media.push({memory:m,index:n});});
      const readme=['ذكريات زفاف عمر وعلا','====================','','تاريخ التصدير: '+new Date().toLocaleString('ar-IQ-u-nu-latn'),'إجمالي الذكريات: '+memories.length,'الرسائل: '+memories.filter(m=>m.type==='text').length,'الصور: '+memories.filter(m=>m.type==='photo').length,'التسجيلات الصوتية: '+memories.filter(m=>m.type==='voice').length,'','يحتوي ملف memories.json على فهرس كامل لكل الذكريات وروابط الوسائط.','ملفات الصور والصوت يتم تنزيلها بعد هذا الملف تلقائيًا. احتفظ بها معًا في مجلد واحد.'].join('\n');
      const text=memories.filter(m=>m.type==='text').map((m,i)=>`# ${i+1} — ${m.guestName||'ضيف بدون اسم'}\n${memoryDate(m)}\n\n${m.message||''}\n`).join('\n--------------------\n\n')||'لا توجد رسائل نصية.';
      triggerBlob(new Blob([readme],{type:'text/plain;charset=utf-8'}),`${folder}-README.txt`);
      triggerBlob(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json;charset=utf-8'}),`${folder}-memories.json`);
      triggerBlob(new Blob([text],{type:'text/plain;charset=utf-8'}),`${folder}-messages.txt`);
      let downloaded=0,failed=0;
      for(const item of media){button.textContent=`تحميل الوسائط ${downloaded+failed+1}/${media.length}…`;try{const r=await fetch(mediaUrl(item.memory));if(!r.ok)throw new Error('fetch');const blob=await r.blob();triggerBlob(blob,`${folder}-${safeBase(item.memory,item.index)}.${extensionFor(item.memory,blob)}`);downloaded++;await new Promise(resolve=>setTimeout(resolve,350));}catch(e){console.error(e);failed++;}}
      if(failed)alert(`اكتمل تصدير البيانات وتم تحميل ${downloaded} ملف وسائط. تعذر تحميل ${failed} ملف تلقائيًا؛ يمكنك تنزيلها منفردة من البطاقات.`);else alert(`اكتمل التصدير بنجاح.\nتم تجهيز ${memories.length} ذكرى وتحميل ${downloaded} ملف وسائط.`);
    } catch(error){console.error(error);alert('تعذر تجهيز التصدير. حاول مرة أخرى وتأكد من السماح بتنزيل ملفات متعددة من هذا الموقع.');}
    finally{button.disabled=!memories.length;button.textContent=original;}
  }

  async function deleteMemory(id,button){const memory=memories.find(item=>item.id===id);if(!memory)return;const label=memory.guestName?`ذكرى ${memory.guestName}`:'هذه الذكرى';if(!confirm(`هل تريد حذف ${label} نهائيًا من لوحة الذكريات؟\n\nلن يمكن التراجع عن الحذف.`))return;button.disabled=true;button.textContent='جاري الحذف…';try{await firebase.firestore().collection('phoneboothMemories').doc(id).delete();}catch(error){console.error(error);alert('تعذر حذف الذكرى. تحقق من الاتصال ثم حاول مرة أخرى.');button.disabled=false;button.textContent='حذف الذكرى';}}
  function listenForMemories(user){if(!user||!window.firebase?.firestore)return;if(unsubscribeMemories)unsubscribeMemories();unsubscribeMemories=firebase.firestore().collection('phoneboothMemories').orderBy('createdAt','desc').onSnapshot(snapshot=>{memories=[];snapshot.forEach(doc=>memories.push({id:doc.id,...doc.data()}));renderMemories();},error=>{console.error(error);const target=byId('memory-list');if(target)target.innerHTML='<p class="empty">تعذر تحميل الذكريات. تحقق من صلاحيات Firestore.</p>';});}
  function stopMemories(){if(unsubscribeMemories)unsubscribeMemories();unsubscribeMemories=null;memories=[];if(byId('s-memories'))byId('s-memories').textContent='0';const b=byId('export-memories');if(b)b.disabled=true;}
  byId('memory-q')?.addEventListener('input',renderMemories);byId('memory-type')?.addEventListener('change',renderMemories);byId('export-memories')?.addEventListener('click',event=>exportAllMemories(event.currentTarget));
  byId('memory-list')?.addEventListener('click',event=>{const download=event.target.closest('[data-download]');if(download){downloadMemory(download.dataset.download);return;}const remove=event.target.closest('[data-delete-memory]');if(remove)deleteMemory(remove.dataset.deleteMemory,remove);});
  document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>{const tab=button.dataset.t;if(!tab)return;document.querySelectorAll('.tab').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-selected',item===button?'true':'false');});document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',panel.id===`p-${tab}`));}));
  function boot(){if(!window.firebase?.auth){setTimeout(boot,250);return;}firebase.auth().onAuthStateChanged(user=>user?listenForMemories(user):stopMemories());}boot();
})();