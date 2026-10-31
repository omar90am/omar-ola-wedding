(() => {
  'use strict';

  function simplifyPassActions() {
    const download = document.getElementById('download-pass');
    const share = document.getElementById('share-pass-image');
    const open = document.getElementById('open-pass-image');
    const note = document.getElementById('pass-preview-note');
    const actions = document.querySelector('.pass-actions');

    download?.remove();
    share?.remove();

    if (open) {
      open.textContent = 'عرض البطاقة كصورة';
      open.classList.remove('secondary');
      open.classList.add('primary');
    }

    if (actions && !actions.querySelector('.pass-save-help')) {
      const help = document.createElement('p');
      help.className = 'pass-save-help';
      help.setAttribute('role', 'note');
      help.textContent = 'لحفظ البطاقة: افتحها كصورة، ثم اضغط مطولًا على الصورة واختر «حفظ الصورة». ويمكنك أيضًا أخذ لقطة شاشة (Screenshot).';
      actions.insertAdjacentElement('afterend', help);
    }

    if (note) {
      note.textContent = 'لحفظ البطاقة، اضغط مطولًا على الصورة ثم اختر «حفظ الصورة». وإذا لم يظهر خيار الحفظ في متصفحك، يمكنك أخذ لقطة شاشة (Screenshot).';
    }
  }

  function addStyles() {
    if (document.getElementById('pass-simple-save-style')) return;
    const style = document.createElement('style');
    style.id = 'pass-simple-save-style';
    style.textContent = `
      .pass-save-help{max-width:520px;margin:12px auto 4px;text-align:center;color:var(--muted,#806D61);font-size:.88rem;line-height:1.9}
      .pass-actions:empty{display:none!important}
      #pass-preview-image{-webkit-touch-callout:default!important;-webkit-user-select:auto!important;user-select:auto!important;pointer-events:auto!important}
    `;
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    simplifyPassActions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();