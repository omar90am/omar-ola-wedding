(() => {
  'use strict';

  const STYLE_ID = 'wedding-polish-v102';
  const AUDIO_ID = 'core-audio';
  const AUDIO_BUTTON_ID = 'audio-btn';

  function installPolishStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /*
       * Bottom ornaments are part of the stationery frame, not floating artwork.
       * The source WEBP contains transparent space below its ornamental baseline,
       * so we intentionally dock the image box below --frame-1 until the visible
       * gold baseline meets the innermost frame line.
       */
      .bottom-ornament-bridge{display:none!important}

      .cover-card{
        container-type:inline-size;
        --ornament-dock:clamp(8px,2.9cqw,18px);
      }
      .cover-card .floral-bl,
      .cover-card .floral-br{
        bottom:calc(var(--frame-1) - var(--ornament-dock))!important;
      }

      .ui-layer{
        --ornament-dock:clamp(7px,1.4vw,18px);
      }
      .ui-layer>.floral-bl,
      .ui-layer>.floral-br{
        bottom:calc(var(--frame-1) - var(--ornament-dock))!important;
      }

      .attendance-pass{
        --ornament-dock:clamp(6px,1.4vw,10px);
      }
      .attendance-pass .floral-bl,
      .attendance-pass .floral-br{
        bottom:calc(var(--frame-1) - var(--ornament-dock))!important;
      }

      /*
       * Cover-card typography and controls scale from the card itself (cqw),
       * not from the viewport. This keeps the composition intact when height,
       * browser zoom, split-screen or an in-app browser makes the card tiny.
       */
      @supports (font-size:1cqw){
        .cover-card{
          --frame-1:1.45cqw;
          --frame-2:2.7cqw;
          --ornament-dock:2.9cqw;
        }
        .cover-card .cover-content{
          inset:8.8% 18% 7.8%;
          row-gap:1.25cqw;
        }
        .cover-card .cover-basmala{font-size:2.75cqw;line-height:1.45}
        .cover-card .cover-verse{font-size:2.02cqw;line-height:1.58;width:96%;max-width:none}
        .cover-card .cover-monogram{width:11.3cqw;max-width:none}
        .cover-card .cover-names{width:96%;gap:1.25cqw}
        .cover-card .cover-names .name-art{width:41%!important;max-height:none!important}
        .cover-card .cover-names .names-connector{width:6.1cqw!important;max-height:none!important}
        .cover-card .cover-content .fine-rule{width:64%;height:1.9cqw}
        .cover-card .cover-content .fine-rule i{width:1cqw;height:1cqw;box-shadow:0 0 0 .7cqw var(--paper)}
        .cover-card .cover-hosting{font-size:2.24cqw;line-height:1.48;max-width:58cqw}
        .cover-card .cover-label{font-size:2.75cqw;line-height:1.3}
        .cover-card .cover-date{font-size:2.05cqw;letter-spacing:.14em}
        .cover-card .open-control{
          width:12.6cqw;height:12.6cqw;
          min-width:0;min-height:0;
          padding:1.25cqw;
          box-shadow:0 1.1cqw 2.8cqw rgba(90,61,22,.22),
                     inset 0 .2cqw .45cqw rgba(255,255,255,.6),
                     inset 0 -.5cqw 1.15cqw rgba(72,48,20,.26);
        }
        .cover-card .open-hint{font-size:2.02cqw;line-height:1.25}
      }

      /* Very short screens: keep the complete card visible as a single artboard. */
      @media(max-height:430px){
        .entry-splash{padding-block:4px}
        .cover-card{width:min(96vw,calc((var(--app-height,100svh) - 8px)*.76699))}
      }
    `;
    document.head.appendChild(style);
  }

  function removeLegacyBottomBridges() {
    document.querySelectorAll('.bottom-ornament-bridge').forEach(node => node.remove());
  }

  /*
   * The downloadable attendance pass is rendered by app.js on a 1080×1600 canvas,
   * independent of DOM/CSS. Shift only floral-bottom.webp on that export canvas so
   * the saved PNG uses the same docked geometry as the live card.
   */
  function installPassExportOrnamentDock() {
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    const proto = CanvasRenderingContext2D.prototype;
    if (proto.__omarOlaBottomDockV102) return;

    const nativeDrawImage = proto.drawImage;
    Object.defineProperty(proto, '__omarOlaBottomDockV102', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });

    proto.drawImage = function(image, ...args) {
      const src = String(image?.currentSrc || image?.src || '');
      const isAttendanceExport = this.canvas?.width === 1080 && this.canvas?.height === 1600;
      const isBottomFloral = /(?:^|\/)floral-bottom\.webp(?:[?#].*)?$/i.test(src);

      if (isAttendanceExport && isBottomFloral) {
        this.save();
        this.translate(0, 6);
        try {
          return nativeDrawImage.call(this, image, ...args);
        } finally {
          this.restore();
        }
      }

      return nativeDrawImage.call(this, image, ...args);
    };
  }

  function installAudioResume() {
    const audio = document.getElementById(AUDIO_ID);
    const button = document.getElementById(AUDIO_BUTTON_ID);
    if (!audio || !button || audio.dataset.resumeGuard === '1') return;
    audio.dataset.resumeGuard = '1';

    let userWantedMusic = !audio.paused;
    let pausedByBackground = false;
    let resumeInFlight = false;

    /* Capture the user's intent before app.js starts its fade/play/pause action. */
    button.addEventListener('click', () => {
      if (resumeInFlight || document.hidden) return;
      userWantedMusic = audio.paused;
      if (!userWantedMusic) pausedByBackground = false;
    }, {capture:true});

    audio.addEventListener('play', () => {
      userWantedMusic = true;
      pausedByBackground = false;
    });

    audio.addEventListener('pause', () => {
      if (pausedByBackground || document.hidden || document.visibilityState === 'hidden') {
        if (userWantedMusic && !audio.ended) pausedByBackground = true;
        return;
      }
      if (!resumeInFlight) userWantedMusic = false;
    });

    /* pagehide can arrive before visibility becomes hidden on some Safari/WebView builds. */
    window.addEventListener('pagehide', () => {
      if (userWantedMusic && !audio.paused && !audio.ended) pausedByBackground = true;
    }, {capture:true,passive:true});

    const resumeIfNeeded = () => {
      if (document.hidden || document.visibilityState === 'hidden') return;
      if (!document.body.classList.contains('invitation-open')) return;
      if (!pausedByBackground || !userWantedMusic || !audio.paused || audio.ended) return;

      resumeInFlight = true;
      /* Use the invitation's own button handler so its private state, UI and fade stay in sync. */
      button.click();
      setTimeout(() => {
        resumeInFlight = false;
        if (audio.paused && userWantedMusic && !audio.ended) pausedByBackground = true;
      }, 700);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') setTimeout(resumeIfNeeded, 60);
    });
    window.addEventListener('pageshow', () => setTimeout(resumeIfNeeded, 80), {passive:true});
    window.addEventListener('focus', () => {
      if (!document.hidden) setTimeout(resumeIfNeeded, 100);
    }, {passive:true});
  }

  installPolishStyles();
  removeLegacyBottomBridges();
  installPassExportOrnamentDock();
  installAudioResume();
})();
