// Injected by the Android app before the page's own scripts. Mirrors the page's player into the
// native media notification (OCMNative.state) and lets native buttons call the page's
// navigator.mediaSession handlers (window.__ocm). web/ itself is unchanged.
(() => {
  const N = window.OCMNative;
  if (!N || window.__ocm) return;
  const H = {};
  let ms = navigator.mediaSession;
  if (!ms) {
    ms = { metadata: null, playbackState: 'none', setActionHandler() {}, setPositionState() {} };
    try { Object.defineProperty(navigator, 'mediaSession', { value: ms }); } catch (e) {}
  }
  if (!window.MediaMetadata) window.MediaMetadata = class { constructor(o) { Object.assign(this, { title: '', artist: '', album: '', artwork: [] }, o); } };
  const set = ms.setActionHandler.bind(ms);
  ms.setActionHandler = (a, f) => { H[a] = f; try { set(a, f); } catch (e) {} };

  const audio = () => document.getElementById('audio');
  window.__ocm = (a, arg) => {
    const au = audio();
    if (H[a]) return H[a](a === 'seekto' ? { action: a, seekTime: arg } : { action: a });
    if (!au) return;
    if (a === 'play') au.play(); else if (a === 'pause') au.pause(); else if (a === 'seekto') au.currentTime = arg;
  };

  let last = '';
  const send = () => {
    const au = audio();
    if (!au) return;
    const m = ms.metadata || {};
    const art = (m.artwork || []).slice(-1)[0];
    const s = JSON.stringify({
      title: m.title || '', artist: m.artist || '', album: m.album || '',
      art: art ? new URL(art.src, location.href).href : '',
      playing: !au.paused && !au.ended,
      pos: Math.floor(au.currentTime * 1000) || 0,
      dur: isFinite(au.duration) ? Math.floor(au.duration * 1000) : 0,
    });
    if (s !== last) { last = s; N.state(s); }
  };
  // Media events don't bubble, but a capturing listener on document still sees them.
  for (const e of ['play', 'playing', 'pause', 'ended', 'loadedmetadata', 'durationchange', 'seeked', 'emptied'])
    document.addEventListener(e, (ev) => { if (ev.target && ev.target.id === 'audio') setTimeout(send, 60); }, true);

  const theme = () => { const t = document.querySelector('meta[name="theme-color"]'); if (t) N.theme(t.content); };
  const watch = () => { theme(); new MutationObserver(theme).observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ['content'] }); };
  if (document.head) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();
