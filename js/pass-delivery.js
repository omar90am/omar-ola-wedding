(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInApp = /Instagram|FBAN|FBAV|FB_IAB|Messenger|WhatsApp/i.test(ua);
  let preparing = false;

  function dataUrlToFile(dataUrl, filename = 'Omar_Ola_Attendance_Pass.png') {
    const [head, body] = String(dataUrl).split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
    const binary = atob(body || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime, lastModified: Date.now() });
  }

  function setNote(text) {
    const note = $('pass-preview-note');
    if (note) note.textContent = text;
  }

  function ensureActionButton() {
    const modal = $('pass-image-modal');
    const img = $('pass-preview-image');
    if (!modal || !img) return null;
    let btn = $('pass-native-save');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'pass-native-save';
    btn.type = 'button';
    btn.className = 'primary-btn';
    btn.style.cssText = 'width:100%;margin-top:12px;min-height:48px';
    btn.textContent = 'حفظ أو مشاركة البطاقة';
    const note = $('pass-preview-note');
    (note?.parentNode || modal.querySelector('.modal-card') || modal).insertBefore(btn, note?.nextSibling || null);
    btn.addEventListener('click', nativeSaveFromPreview);
    return btn;
  }

  function directDownload(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function nativeSaveFromPreview() {
    const btn = ensureActionButton();
    const img = $('pass-preview-image');
    if (!img?.src || !img.src.startsWith('data:image/')) return;
    const old = btn.textContent;
    try {
      /* Keep file creation synchronous before share(): Safari requires the share call to remain tied to this tap. */
      const file = dataUrlToFile(img.src);
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        btn.textContent = 'اختر مكان الحفظ أو المشاركة…';
        await navigator.share({ files: [file] });
        return;
      }
      directDownload(file);
      setNote(isAppleMobile || isInApp
        ? 'إذا لم يبدأ الحفظ من هذا المتصفح، اضغط مطولًا على الصورة واختر «حفظ في الصور»، أو افتح الصفحة في Safari / Chrome.'
        : 'تم إرسال البطاقة إلى التنزيلات.');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('Native pass delivery failed', error);
        setNote('لم يسمح هذا المتصفح بالحفظ المباشر. اضغط مطولًا على الصورة واختر حفظ الصورة، أو افتح الصفحة في Safari / Chrome.');
      }
    } finally {
      btn.textContent = old;
    }
  }

  function waitForPreview(timeout = 7000) {
    return new Promise(resolve => {
      const started = Date.now();
      const check = () => {
        const modal = $('pass-image-modal');
        const img = $('pass-preview-image');
        if (modal && !modal.hidden && img?.src?.startsWith('data:image/')) return resolve(true);
        if (Date.now() - started >= timeout) return resolve(false);
        setTimeout(check, 80);
      };
      check();
    });
  }

  async function prepareReliableSave(event) {
    if (preparing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    preparing = true;
    const source = event.currentTarget;
    const old = source.textContent;
    source.disabled = true;
    source.textContent = 'جاري تجهيز البطاقة…';
    try {
      /* Reuse the existing renderer, but separate rendering from native sharing.
         This gives iOS a fresh, direct user tap for navigator.share(). */
      $('open-pass-image')?.click();
      const ready = await waitForPreview();
      if (!ready) throw new Error('preview-timeout');
      ensureActionButton();
      setNote(isAppleMobile
        ? 'اضغط «حفظ أو مشاركة البطاقة» ثم اختر «حفظ الصورة» أو «حفظ في الملفات». يمكنك أيضًا إرسالها مباشرة عبر واتساب أو الرسائل.'
        : isInApp
          ? 'اضغط «حفظ أو مشاركة البطاقة». إذا منع التطبيق الحفظ، افتح الصفحة في Safari أو Chrome ثم أعد المحاولة.'
          : 'اضغط «حفظ أو مشاركة البطاقة» لاختيار الحفظ أو المشاركة بالطريقة المناسبة لجهازك.');
    } catch (error) {
      console.warn('Pass preview preparation failed', error);
      const warning = $('rsvp-save-warning');
      if (warning) {
        warning.hidden = false;
        warning.textContent = 'تعذر تجهيز البطاقة في هذا المتصفح. افتح الصفحة في Safari أو Chrome ثم أعد المحاولة.';
      }
    } finally {
      source.disabled = false;
      source.textContent = old;
      preparing = false;
    }
  }

  function install() {
    ensureActionButton();
    ['download-pass', 'share-pass-image'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('click', prepareReliableSave, true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
