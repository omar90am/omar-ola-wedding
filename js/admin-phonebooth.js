(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  let memories = [];
  let unsubscribeMemories = null;

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  }
  function typeLabel(type) { if (type === 'photo') return 'صورة'; if (type === 'voice') return 'تسجيل صوتي'; return 'رسالة'; }
  function memoryDate(memory) { const date = memory.createdAt && memory.createdAt.toDate ? memory.createdAt.toDate() : null; return date ? date.toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function mediaUrl(memory) { const value = String(memory.storagePath || '').trim(); return value.startsWith('https://res.cloudinary.com/') ? value : ''; }
  function safeName(memory) { const base = String(memory.guestName || 'guest').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'guest'; const ext = memory.type === 'photo' ? 'jpg' : memory.type === 'voice' ? 'webm' : 'txt'; return `ola-omar-${memory.type}-${base}.${ext}`; }

  function renderMemories() {
    const target = byId('memory-list'); if (!target) return;
    const query = String(byId('memory-q')?.value || '').trim().toLowerCase();
    const selectedType = byId('memory-type')?.value || 'all';
    const filtered = memories.filter(memory => { const typeOk = selectedType === 'all' || memory.type === selectedType; const haystack = [memory.guestName, memory.message, memory.caption].join(' ').toLowerCase(); return typeOk && (!query || haystack.includes(query)); });
    if (byId('s-memories')) byId('s-memories').textContent = String(memories.length);
    if (!filtered.length) { target.innerHTML = '<p class="empty">لا توجد ذكريات مطابقة.</p>'; return; }
    target.innerHTML = filtered.map(memory => {
      const name = escapeHtml(memory.guestName || 'ضيف بدون اسم'), message = escapeHtml(memory.message || ''), caption = escapeHtml(memory.caption || ''), url = mediaUrl(memory);
      let media = '';
      if (memory.type === 'photo' && url) media = `<img class="memory-media" src="${escapeHtml(url)}" alt="صورة من ${name}" loading="lazy">`;
      if (memory.type === 'voice' && url) media = `<audio class="memory-media" controls preload="none" src="${escapeHtml(url)}"></audio>`;
      const download = url ? `<button class="btn secondary" type="button" data-download="${escapeHtml(memory.id)}">تحميل الملف</button>` : '';
      return `<article class="memory-card"><div class="memory-card-head"><div><h3>${name}</h3><div class="memory-time">${escapeHtml(memoryDate(memory))}</div></div><span class="memory-type">${typeLabel(memory.type)}</span></div>${message ? `<div class="memory-text">${message}</div>` : ''}${media}${caption ? `<p class="memory-caption">${caption}</p>` : ''}<div class="memory-actions">${url ? `<a class="btn secondary" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">فتح الملف</a>` : ''}${download}<button class="btn memory-delete" type="button" data-delete-memory="${escapeHtml(memory.id)}">حذف الذكرى</button></div></article>`;
    }).join('');
  }

  async function downloadMemory(id) {
    const memory = memories.find(item => item.id === id); if (!memory) return;
    const url = mediaUrl(memory);
    if (!url) { if (memory.type === 'text') { const blob = new Blob([memory.message || ''], {type:'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=safeName(memory); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); } return; }
    try { const response = await fetch(url); if (!response.ok) throw new Error('download-failed'); const blob = await response.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = safeName(memory); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); }
    catch (error) { console.error(error); window.open(url, '_blank', 'noopener,noreferrer'); }
  }

  async function deleteMemory(id, button) {
    const memory = memories.find(item => item.id === id); if (!memory) return;
    const label = memory.guestName ? `ذكرى ${memory.guestName}` : 'هذه الذكرى';
    if (!confirm(`هل تريد حذف ${label} نهائيًا من لوحة الذكريات؟\n\nلن يمكن التراجع عن الحذف.`)) return;
    button.disabled = true; button.textContent = 'جاري الحذف…';
    try { await firebase.firestore().collection('phoneboothMemories').doc(id).delete(); }
    catch (error) { console.error(error); alert('تعذر حذف الذكرى. تحقق من الاتصال ثم حاول مرة أخرى.'); button.disabled = false; button.textContent = 'حذف الذكرى'; }
  }

  function listenForMemories(user) {
    if (!user || !window.firebase?.firestore) return;
    if (unsubscribeMemories) unsubscribeMemories();
    unsubscribeMemories = firebase.firestore().collection('phoneboothMemories').orderBy('createdAt', 'desc').onSnapshot(snapshot => { memories = []; snapshot.forEach(doc => memories.push({ id: doc.id, ...doc.data() })); renderMemories(); }, error => { console.error(error); const target = byId('memory-list'); if (target) target.innerHTML = '<p class="empty">تعذر تحميل الذكريات. تحقق من صلاحيات Firestore.</p>'; });
  }
  function stopMemories() { if (unsubscribeMemories) unsubscribeMemories(); unsubscribeMemories = null; memories = []; if (byId('s-memories')) byId('s-memories').textContent = '0'; }

  byId('memory-q')?.addEventListener('input', renderMemories);
  byId('memory-type')?.addEventListener('change', renderMemories);
  byId('memory-list')?.addEventListener('click', event => {
    const download = event.target.closest('[data-download]'); if (download) { downloadMemory(download.dataset.download); return; }
    const remove = event.target.closest('[data-delete-memory]'); if (remove) deleteMemory(remove.dataset.deleteMemory, remove);
  });
  document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => { const tab = button.dataset.t; if (!tab) return; document.querySelectorAll('.tab').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-selected', item === button ? 'true' : 'false'); }); document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === `p-${tab}`)); }));
  function boot() { if (!window.firebase?.auth) { setTimeout(boot, 250); return; } firebase.auth().onAuthStateChanged(user => user ? listenForMemories(user) : stopMemories()); }
  boot();
})();
