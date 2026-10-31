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

  function typeLabel(type) {
    if (type === 'photo') return 'صورة';
    if (type === 'voice') return 'تسجيل صوتي';
    return 'رسالة';
  }

  function memoryDate(memory) {
    const date = memory.createdAt && memory.createdAt.toDate ? memory.createdAt.toDate() : null;
    return date ? date.toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }

  function mediaUrl(memory) {
    const value = String(memory.storagePath || '').trim();
    return value.startsWith('https://res.cloudinary.com/') ? value : '';
  }

  function renderMemories() {
    const target = byId('memory-list');
    if (!target) return;
    const query = String(byId('memory-q')?.value || '').trim().toLowerCase();
    const selectedType = byId('memory-type')?.value || 'all';
    const filtered = memories.filter(memory => {
      const typeOk = selectedType === 'all' || memory.type === selectedType;
      const haystack = [memory.guestName, memory.message, memory.caption].join(' ').toLowerCase();
      return typeOk && (!query || haystack.includes(query));
    });
    if (byId('s-memories')) byId('s-memories').textContent = String(memories.length);
    if (!filtered.length) {
      target.innerHTML = '<p class="empty">لا توجد ذكريات مطابقة.</p>';
      return;
    }
    target.innerHTML = filtered.map(memory => {
      const name = escapeHtml(memory.guestName || 'ضيف بدون اسم');
      const message = escapeHtml(memory.message || '');
      const caption = escapeHtml(memory.caption || '');
      const url = mediaUrl(memory);
      let media = '';
      if (memory.type === 'photo' && url) media = `<img class="memory-media" src="${escapeHtml(url)}" alt="صورة من ${name}" loading="lazy">`;
      if (memory.type === 'voice' && url) media = `<audio class="memory-media" controls preload="none" src="${escapeHtml(url)}"></audio>`;
      return `<article class="memory-card"><div class="memory-card-head"><div><h3>${name}</h3><div class="memory-time">${escapeHtml(memoryDate(memory))}</div></div><span class="memory-type">${typeLabel(memory.type)}</span></div>${message ? `<div class="memory-text">${message}</div>` : ''}${media}${caption ? `<p class="memory-caption">${caption}</p>` : ''}${url ? `<div class="memory-actions"><a class="btn secondary" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">فتح الملف</a></div>` : ''}</article>`;
    }).join('');
  }

  function listenForMemories(user) {
    if (!user || !window.firebase?.firestore) return;
    if (unsubscribeMemories) unsubscribeMemories();
    unsubscribeMemories = firebase.firestore().collection('phoneboothMemories').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
      memories = [];
      snapshot.forEach(doc => memories.push({ id: doc.id, ...doc.data() }));
      renderMemories();
    }, error => {
      console.error(error);
      const target = byId('memory-list');
      if (target) target.innerHTML = '<p class="empty">تعذر تحميل الذكريات. تحقق من صلاحيات Firestore.</p>';
    });
  }

  function stopMemories() {
    if (unsubscribeMemories) unsubscribeMemories();
    unsubscribeMemories = null;
    memories = [];
    if (byId('s-memories')) byId('s-memories').textContent = '0';
  }

  byId('memory-q')?.addEventListener('input', renderMemories);
  byId('memory-type')?.addEventListener('change', renderMemories);

  document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
    const tab = button.dataset.t;
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-selected', item === button ? 'true' : 'false');
    });
    document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === `p-${tab}`));
  }));

  function boot() {
    if (!window.firebase?.auth) {
      setTimeout(boot, 250);
      return;
    }
    firebase.auth().onAuthStateChanged(user => user ? listenForMemories(user) : stopMemories());
  }
  boot();
})();
