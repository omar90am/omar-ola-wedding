(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  function install() {
    // Keep the RSVP deadline aligned with the final guest-count handoff date.
    const deadline = document.querySelector('.rsvp-deadline');
    if (deadline) deadline.innerHTML = 'نرجو التكرم بإرسال الرد قبل <strong>24 ديسمبر 2026</strong>.';

    // Keep only the simple, reliable image-preview flow for attendance passes.
    ['download-pass', 'share-pass-image'].forEach(id => {
      const el = $(id);
      if (el) el.hidden = true;
    });

    const open = $('open-pass-image');
    if (open) open.textContent = 'عرض البطاقة كصورة';

    const note = $('pass-preview-note');
    if (note) note.textContent = 'لحفظ البطاقة، اضغط مطولًا على الصورة ثم اختر «حفظ الصورة». وإذا لم يظهر خيار الحفظ في متصفحك، يمكنك أخذ لقطة شاشة (Screenshot).';

    const preview = $('pass-preview-image');
    if (preview) {
      preview.style.webkitTouchCallout = 'default';
      preview.style.userSelect = 'auto';
      preview.style.webkitUserSelect = 'auto';
      preview.style.pointerEvents = 'auto';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
