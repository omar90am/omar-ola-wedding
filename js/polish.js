(() => {
  'use strict';

  const STYLE_ID = 'wedding-polish-v101';
  const AUDIO_ID = 'core-audio';
  const AUDIO_BUTTON_ID = 'audio-btn';

  function installPolishStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Unified finishing pass for every stationery card. */
      .bottom-ornament-bridge{
        position:absolute;
        z-index:3;
        left:var(--bridge-inset,24%);
        right:var(--bridge-inset,24%);
        bottom:calc(var(--frame-1,9px) + var(--bridge-lift,1px));
        height:10px;
        pointer-events:none;
        user-select:none;
      }
      .bottom-ornament-bridge::before{
        content:"";
        position:absolute;
        left:0;right:0;top:50%;
        height:1px;
        transform:translateY(-50%);
        background:linear-gradient(90deg,
          rgba(200,148,69,0) 0%,
          rgba(200,148,69,.62) 10%,
          rgba(200,148,69,.76) 35%,
          rgba(200,148,69,.76) 65%,
          rgba(200,148,69,.62) 90%,
          rgba(200,148,69,0) 100%);
      }
      .bottom-ornament-bridge::after{
        content:"";
        position:absolute;
        left:50%;top:50%;
        width:5px;height:5px;
        border:1px solid rgba(200,148,69,.82);
        background:var(--paper,#F7F3EB);
        transform:translate(-50%,-50%) rotate(45deg);
      }
      .cover-card{--bridge-inset:29%;--bridge-lift:1px;container-type:inline-size}
      .ui-layer{--bridge-inset:17.5%;--bridge-lift:1px}
      .attendance-pass{--bridge-inset:22.5%;--bridge-lift:1px}
      .attendance-pass .bottom-ornament-bridge::after{background:var(--paper-soft,#FCF9F2)}

      /*
       * Cover-card typography and controls scale from the card itself (cqw),
       * not from the viewport. This keeps the composition intact when height,
       * browser zoom, split-screen or an in-app browser makes the card tiny.
       */
      @supports (font-size:1cqw){
        .cover-card{
          --frame-1:1.45cqw;
          --frame-2:2.7cqw;
          --bridge-lift:.2cqw;
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
        .cover-card .bottom-ornament-bridge{height:1.6cqw}
        .cover-card .bottom-ornament-bridge::after{width:.85cqw;height:.85cqw}
      }

      /* Very short screens: keep the complete card visible as a single artboard. */
      @media(max-height:430px){
        .entry-splash{padding-block:4px}
        .cover-card{width:min(96vw,calc((var(--app-height,100svh) - 8px)*.76699))}
      }
    `;
    document.head.appendChild(style);
  }

  function installBottomBridges() {
    document.querySelectorAll('.cover-card, .ui-layer, .attendance-pass').forEach(card => {
      if (card.querySelector(':scope > .bottom-ornament-bridge')) return;
      const bridge = document.createElement('span');
      bridge.className = 'bottom-ornament-bridge';
      bridge.setAttribute('aria-hidden', 'true');
      card.appendChild(bridge);
    });
  }

  function installAudioResume() {
    const audio = document.getElementById(AUDIO_ID);
    const button = document.getElementById(AUDIO_BUTTON_ID);
    if (!audio || !button || audio.dataset.resumeGuard === '1') return;
    audio.dataset.resumeGuard = '1';

    let userWantedMusic = !audio.paused;
    let pausedByBackground = false;
    let resumeInFlight = false;

    audio.addEventListener('play', () => {
      userWantedMusic = true;
      pausedByBackground = false;
    });

    audio.addEventListener('pause', () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        if (userWantedMusic && !audio.ended) pausedByBackground = true;
        return;
      }
      if (!resumeInFlight) userWantedMusic = false;
    });

    const resumeIfNeeded = () => {
      if (document.hidden || document.visibilityState === 'hidden') return;
      if (!document.body.classList.contains('invitation-open')) return;
      if (!pausedByBackground || !userWantedMusic || !audio.paused || audio.ended) return;

      pausedByBackground = false;
      resumeInFlight = true;
      /* Use the invitation's own button handler so its private state, UI and fade stay in sync. */
      button.click();
      queueMicrotask(() => { resumeInFlight = false; });
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
  installBottomBridges();
  installAudioResume();
})();
