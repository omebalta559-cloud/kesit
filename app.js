/* =========================================================
   Kesit — tarayıcıda çalışan video editör
   Bağımlılık yok: Canvas + WebAudio + MediaRecorder
   ========================================================= */

const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- State ---------------- */
const S = {
  media: [],     // {id, kind, name, url, duration, w, h, thumb}
  clips: [],     // video: {id, mediaId, el, in, out, speed, volume, fit, filter, trans, start, dur}
  texts: [],     // {id, text, start, dur, x, y, size, color, bg, bgOn, font, weight, align}
  images: [],    // grafik: {id, src, el, start, dur, x, y, size, opacity, name}
  audios: [],    // {id, mediaId, el, start, dur, offset, volume, fadeIn, fadeOut}
  sel: null,     // {type:'clip'|'text'|'image'|'audio', id}
  time: 0,
  playing: false,
  pxPerSec: 80,
  W: 1280,
  H: 720,
  exporting: false,
  brand: loadBrand(),
  backdrop: { type: 'none', dur: 10 },
  decor: { frame: false, corners: false, bar: false, tab: false },
  palette: null,          // kullanıcının videosundan çıkarılan renkler
};

/* Marka logosu (intro ve zeminlerde kullanılır) */
let logoImg = null;
function refreshLogo() {
  if (!S.brand.logo) { logoImg = null; return; }
  const im = new Image();
  im.onload = () => { logoImg = im; draw(); };
  im.src = S.brand.logo;
}

/* Aktif renk rolleri: videodan çıkan palet varsa o, yoksa marka rengi */
function roles() {
  return paletteRoles(S.palette, S.brand.accent);
}

/* ---------------- Marka (localStorage) ---------------- */
function defBrand() {
  return {
    name: 'Site Adı',
    tagline: 'Kısa ve net bir slogan',
    url: 'www.siten.com',
    f1: 'Hızlı ve sade',
    f2: 'Her cihazda çalışır',
    f3: 'Dakikalar içinde hazır',
    cta: 'Hemen keşfet',
    accent: '#4f8cff',
    ink: '#ffffff',
    font: 'Segoe UI',
    logo: '',
  };
}
function loadBrand() {
  try {
    const raw = localStorage.getItem('kesit.brand');
    return raw ? { ...defBrand(), ...JSON.parse(raw) } : defBrand();
  } catch (e) { return defBrand(); }
}
function saveBrand() {
  try { localStorage.setItem('kesit.brand', JSON.stringify(S.brand)); } catch (e) {}
}

const defFilter = () => ({ brightness: 1, contrast: 1, saturate: 1, grayscale: 0, sepia: 0, blur: 0 });

/* ---------------- Audio graph ---------------- */
let actx = null, master = null, audioDest = null;
function audio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function wireAudio(el, obj) {
  try {
    audio();
    const src = actx.createMediaElementSource(el);
    const g = actx.createGain();
    src.connect(g).connect(master);
    obj.gain = g;
  } catch (e) { /* zaten bağlı */ }
}

/* ---------------- Canvas ---------------- */
const cv = $('#preview');
const ctx = cv.getContext('2d');

/* =========================================================
   Medya yükleme
   ========================================================= */
$('#fileVideo').addEventListener('change', (e) => loadFiles(e.target.files, 'video'));
$('#fileAudio').addEventListener('change', (e) => loadFiles(e.target.files, 'audio'));

/* Chrome'un MediaRecorder'i urettigi WebM'e sure bilgisi yazmiyor: dosya
   oynatilabiliyor ama duration = Infinity donuyor. Ekran kaydinda hep boyle.
   Cozum: kaynagi sonuna sarip gercek sureyi okumak. */
function resolveDuration(el, cb) {
  if (isFinite(el.duration) && el.duration > 0) { cb(el.duration); return; }

  let bitti = false;
  const tamam = (d) => {
    if (bitti) return;
    bitti = true;
    el.removeEventListener('timeupdate', onUpdate);
    try { el.currentTime = 0; } catch (e) {}
    cb(isFinite(d) && d > 0 ? d : 0);
  };
  const onUpdate = () => {
    const d = isFinite(el.duration) ? el.duration : el.currentTime;
    if (d > 0) tamam(d);
  };

  el.addEventListener('timeupdate', onUpdate);
  try { el.currentTime = 1e101; } catch (e) { tamam(0); }
  setTimeout(() => tamam(el.currentTime || 0), 3000);   // takilirsa birak
}

function loadFiles(files, kind) {
  [...files].forEach((f) => {
    const url = URL.createObjectURL(f);
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'auto';
    el.src = url;
    el.addEventListener('loadedmetadata', () => {
      resolveDuration(el, (dur) => {
        const m = {
          id: uid(), kind, name: f.name, url,
          duration: dur,
          w: el.videoWidth || 0, h: el.videoHeight || 0,
        };
        S.media.push(m);
        if (kind === 'video') makeThumb(m);
        renderMedia();
        // ilk medya otomatik timeline'a
        if (kind === 'video' && S.clips.length === 0) addClip(m.id);
      });
    }, { once: true });
  });
  // aynı dosyayı tekrar seçebilmek için
  setTimeout(() => { $('#fileVideo').value = ''; $('#fileAudio').value = ''; }, 0);
}

function makeThumb(m) {
  const v = document.createElement('video');
  v.src = m.url; v.muted = true;
  v.addEventListener('loadeddata', () => { v.currentTime = Math.min(0.5, v.duration / 2); }, { once: true });
  v.addEventListener('seeked', () => {
    const c = document.createElement('canvas');
    c.width = 104; c.height = 64;
    c.getContext('2d').drawImage(v, 0, 0, 104, 64);
    m.thumb = c.toDataURL('image/jpeg', 0.6);
    if (!S.palette) {
      const p = extractPalette(v);
      if (p) { S.palette = p; buildInspector(); draw(); }
    }
    renderMedia();
  }, { once: true });
}

function renderMedia() {
  const box = $('#mediaList');
  if (!S.media.length) {
    box.innerHTML = '<div class="empty">Henüz medya yok.<br><span>Üstten “Video ekle”ye bas.</span></div>';
    return;
  }
  box.innerHTML = '';
  S.media.forEach((m) => {
    const d = document.createElement('div');
    d.className = 'media-item';
    d.innerHTML = `
      ${m.thumb ? `<img class="media-thumb" src="${m.thumb}">` : `<div class="media-thumb">${m.kind === 'video' ? '▣' : '♪'}</div>`}
      <div class="media-meta">
        <div class="media-name" title="${esc(m.name)}">${esc(m.name)}</div>
        <div class="media-sub">${fmt(m.duration)}${m.w ? ` · ${m.w}×${m.h}` : ''}</div>
      </div>
      <button class="media-add" title="Timeline'a ekle">+</button>`;
    d.querySelector('.media-add').onclick = (e) => {
      e.stopPropagation();
      m.kind === 'video' ? addClip(m.id) : addAudio(m.id);
    };
    d.onclick = () => m.kind === 'video' ? addClip(m.id) : addAudio(m.id);
    box.appendChild(d);
  });
}

/* =========================================================
   Timeline öğeleri
   ========================================================= */
function addClip(mediaId) {
  const m = S.media.find((x) => x.id === mediaId);
  if (!m) return;
  const el = document.createElement('video');
  el.src = m.url; el.preload = 'auto'; el.playsInline = true;
  const c = {
    id: uid(), mediaId, el,
    in: 0, out: m.duration, speed: 1, volume: 1,
    fit: 'contain', filter: defFilter(),
    trans: { type: 'none', dur: 0.6 },
    start: 0, dur: m.duration,
  };
  wireAudio(el, c);
  S.clips.push(c);
  layout(); select('clip', c.id); draw();
}

function addAudio(mediaId) {
  const m = S.media.find((x) => x.id === mediaId);
  if (!m) return;
  const el = document.createElement('audio');
  el.src = m.url; el.preload = 'auto';
  const a = {
    id: uid(), mediaId, el,
    start: 0, dur: m.duration, offset: 0,
    volume: 0.7, fadeIn: 0.5, fadeOut: 1,
  };
  wireAudio(el, a);
  S.audios.push(a);
  layout(); select('audio', a.id); draw();
}

/* Açılış klibi — timeline'ın en başına, kullanıcının videosundan önce */
function addIntro(style = 'reveal', dur = 3.2) {
  const c = {
    id: uid(), kind: 'intro', style, dur,
    in: 0, out: dur, speed: 1, volume: 0,
    fit: 'contain', filter: defFilter(),
    trans: { type: 'fade', dur: 0.5 },
    start: 0,
  };
  S.clips.unshift(c);
  // arkasındaki ilk gerçek klip çapraz geçişle bağlansın
  if (S.clips[1] && S.clips[1].trans.type === 'none') {
    S.clips[1].trans = { type: 'cross', dur: 0.6 };
  }
  layout(); select('clip', c.id); draw();
  return c;
}

function addImage(src, name, opts = {}) {
  const el = new Image();
  el.src = src;
  const g = {
    id: uid(), src, el, name: name || 'Grafik',
    start: opts.start ?? 0, dur: opts.dur ?? 5,
    x: opts.x ?? 50, y: opts.y ?? 50,
    size: opts.size ?? 22, opacity: opts.opacity ?? 1,
  };
  el.onload = () => { renderTimeline(); draw(); };
  S.images.push(g);
  layout();
  if (!opts.silent) select('image', g.id);
  draw();
  return g;
}

$('#btnAddText').onclick = () => {
  const t = {
    id: uid(), text: 'Başlık yazısı',
    start: S.time, dur: 3,
    x: 50, y: 80, size: 6, color: '#ffffff',
    bg: '#000000', bgOn: true,
    font: 'Segoe UI', weight: 700, align: 'center',
  };
  S.texts.push(t);
  layout(); select('text', t.id); draw();
};

/* =========================================================
   Yerleşim (video klipleri ardışık, geçişte bindirmeli)
   ========================================================= */
const MAX_SURE = 4 * 3600;   // 4 saat: gecerli hicbir kurgu bunu asmaz

// Bozuk bir sure (Infinity / NaN) timeline'i sonsuz donguye sokabilir.
const guvenliSure = (v, varsayilan) =>
  (isFinite(v) && v > 0) ? Math.min(v, MAX_SURE) : varsayilan;

function layout() {
  let t = 0;
  S.clips.forEach((c, i) => {
    c.dur = c.kind === 'intro'
      ? guvenliSure(c.dur, 3.2)
      : guvenliSure((c.out - c.in) / c.speed, 5);
    let ov = 0;
    if (i > 0 && c.trans.type === 'cross') {
      ov = Math.min(c.trans.dur, c.dur / 2, S.clips[i - 1].dur / 2);
    }
    c.start = Math.max(0, t - ov);
    t = c.start + c.dur;
  });
  renderTimeline();
  updateTime();
}

function total() {
  let t = 0;
  S.clips.forEach((c) => t = Math.max(t, c.start + c.dur));
  S.texts.forEach((x) => t = Math.max(t, x.start + x.dur));
  S.images.forEach((g) => t = Math.max(t, g.start + g.dur));
  S.audios.forEach((a) => t = Math.max(t, a.start + a.dur));
  if (S.backdrop.type !== 'none') t = Math.max(t, S.backdrop.dur);
  return guvenliSure(t, 0);
}

/* =========================================================
   Çizim
   ========================================================= */
/* zoom: klip boyunca yavaş yakınlaşma (Ken Burns). Ekran kaydı gibi hareketsiz
   görüntüleri canlandırır. p = klipteki ilerleme (0..1) */
function drawFit(el, mode, zoom = 0, p = 0) {
  const sw = el.videoWidth, sh = el.videoHeight;
  if (!sw || !sh) return;
  const sr = sw / sh, dr = S.W / S.H;
  const k = 1 + (zoom || 0) * clamp(p, 0, 1);

  if (mode === 'cover') {
    let cw, ch;
    if (sr > dr) { ch = sh; cw = sh * dr; } else { cw = sw; ch = sw / dr; }
    cw /= k; ch /= k;
    ctx.drawImage(el, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, S.W, S.H);
  } else {
    let dw, dh;
    if (sr > dr) { dw = S.W; dh = S.W / sr; } else { dh = S.H; dw = S.H * sr; }
    dw *= k; dh *= k;
    ctx.drawImage(el, (S.W - dw) / 2, (S.H - dh) / 2, dw, dh);
  }
}

function filterStr(f) {
  return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturate}) ` +
         `grayscale(${f.grayscale}) sepia(${f.sepia}) blur(${f.blur}px)`;
}

function clipAlpha(c, i, t) {
  const local = t - c.start;
  let a = 1;
  const td = c.trans.dur;
  if (c.trans.type === 'fade' || (c.trans.type === 'cross' && i === 0)) {
    if (local < td) a = local / td;
  } else if (c.trans.type === 'cross' && i > 0) {
    const ov = Math.min(td, c.dur / 2, S.clips[i - 1].dur / 2);
    if (local < ov) a = local / ov;
  }
  // son klipte kapanış
  if (i === S.clips.length - 1 && c.trans.type !== 'none') {
    const r = c.dur - local;
    if (r < td) a = Math.min(a, Math.max(0, r / td));
  }
  return clamp(a, 0, 1);
}

function draw() {
  const t = S.time;
  ctx.save();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S.W, S.H);

  const R = roles();

  // Üstünü tamamen kapatan bir katman varsa zemini çizmenin anlamı yok.
  // Açılış klibi kendi zeminini çiziyor; "doldur" modundaki video da tam kaplıyor.
  const ustunuKapatan = S.clips.some((c, i) => {
    if (t < c.start || t >= c.start + c.dur) return false;
    if (clipAlpha(c, i, t) < 1) return false;
    return c.kind === 'intro' || (c.fit === 'cover' && c.el && c.el.videoWidth);
  });
  if (!ustunuKapatan) drawBackdrop(ctx, S.backdrop.type, t, S.W, S.H, R);

  S.clips.forEach((c, i) => {
    if (t < c.start || t >= c.start + c.dur) return;
    ctx.globalAlpha = clipAlpha(c, i, t);
    if (c.kind === 'intro') {
      ctx.filter = 'none';
      drawIntro(ctx, c.style, (t - c.start) / c.dur, S.W, S.H, S.brand, R, logoImg);
    } else {
      ctx.filter = filterStr(c.filter);
      drawFit(c.el, c.fit, c.zoom || 0, (t - c.start) / c.dur);
    }
  });

  // dekor: kliplerin üstünde, yazıların altında
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  drawDecor(ctx, S.decor, t, total(), S.W, S.H, R);

  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  S.images.forEach((g) => {
    if (t < g.start || t >= g.start + g.dur) return;
    drawImageLayer(g, t);
  });
  S.texts.forEach((x) => {
    if (t < x.start || t >= x.start + x.dur) return;
    drawText(x, t);
  });
  ctx.restore();
}

function drawImageLayer(g, t) {
  const el = g.el;
  if (!el || !el.naturalWidth) return;
  const local = t - g.start, f = 0.3;
  let a = g.opacity;
  if (local < f) a *= local / f;
  if (g.dur - local < f) a *= (g.dur - local) / f;
  ctx.globalAlpha = clamp(a, 0, 1);

  const w = (g.size / 100) * S.W;
  const h = w * (el.naturalHeight / el.naturalWidth);
  ctx.drawImage(el, (g.x / 100) * S.W - w / 2, (g.y / 100) * S.H - h / 2, w, h);
  ctx.globalAlpha = 1;
}

function drawText(x, t) {
  const lines = String(x.text).split('\n');
  let px = (x.size / 100) * S.H;
  const setF = () => { ctx.font = `${x.weight} ${px}px "${x.font}", sans-serif`; };
  setF();

  // Boyut yükseklige oranli; dikey formatta genislik sinirlayici oluyor.
  // Satirlar tuvale sigmiyorsa yaziyi kucult.
  const maxW = S.W * 0.9;
  let widest = 0;
  lines.forEach((l) => widest = Math.max(widest, ctx.measureText(l).width));
  if (widest > maxW) { px *= maxW / widest; setF(); }

  ctx.textAlign = x.align;
  ctx.textBaseline = 'middle';

  /* ---- giriş / çıkış hareketi ---- */
  const local = t - x.start;
  const girisSure = 0.5, cikisSure = 0.32;
  const e = ease(clamp(local / girisSure, 0, 1));           // yumuşayan giriş
  const cikis = clamp((x.dur - local) / cikisSure, 0, 1);

  const anim = x.anim || 'fade';
  let dx = 0, dy = 0, olcek = 1, perde = 1;
  if (anim === 'up') dy = (1 - e) * px * 1.1;
  else if (anim === 'down') dy = -(1 - e) * px * 1.1;
  else if (anim === 'left') dx = (1 - e) * S.W * 0.07;
  else if (anim === 'right') dx = -(1 - e) * S.W * 0.07;
  else if (anim === 'scale') olcek = 0.84 + e * 0.16;
  else if (anim === 'wipe') perde = e;

  // Kayan/ölçeklenen girişlerde opaklık daha hızlı dolsun, hareket görünür kalsın
  const a = clamp(Math.min(anim === 'fade' ? e : Math.min(1, e * 1.8), cikis), 0, 1);

  const lh = px * 1.25;
  const cx = (x.x / 100) * S.W;
  const cy = (x.y / 100) * S.H - ((lines.length - 1) * lh) / 2;

  let w = 0;
  lines.forEach((l) => w = Math.max(w, ctx.measureText(l).width));

  ctx.save();
  ctx.globalAlpha = a;
  if (olcek !== 1) {
    ctx.translate(cx, cy);
    ctx.scale(olcek, olcek);
    ctx.translate(-cx, -cy);
  }
  ctx.translate(dx, dy);

  if (x.band) {
    /* ---- tasarlanmış alt bant: koyu şerit + marka renginde dikey aksan ---- */
    const padX = px * 0.55, padY = px * 0.34;
    const bh = lines.length * lh + padY * 2 - (lh - px) * 0.5;
    const by = cy - lh / 2 - padY + (lh - px) * 0.25;
    let bx = cx - padX;
    if (x.align === 'center') bx = cx - (w + padX * 2) / 2;
    if (x.align === 'right') bx = cx - w - padX;
    const bw = (w + padX * 2) * perde;
    const aksan = px * 0.14;

    ctx.fillStyle = 'rgba(8,10,14,.72)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = x.bg;
    ctx.fillRect(bx, by, Math.min(aksan, bw), bh);
  } else if (x.bgOn) {
    const padX = px * 0.4, padY = px * 0.25;
    const bw = (w + padX * 2) * perde, bh = lines.length * lh + padY * 2 - (lh - px) * 0.6;
    let bx = cx - bw / 2;
    if (x.align === 'left') bx = cx - padX;
    if (x.align === 'right') bx = cx - bw + padX;
    ctx.fillStyle = x.bg;
    ctx.globalAlpha = a * 0.55;
    roundRect(bx, cy - lh / 2 - padY + (lh - px) * 0.3, bw, bh, px * 0.15);
    ctx.globalAlpha = a;
  }

  // perde animasyonunda yazı da soldan açılsın
  if (perde < 1) {
    const kw = S.W * perde;
    ctx.beginPath();
    ctx.rect(x.align === 'right' ? S.W - kw : (x.align === 'center' ? cx - kw / 2 : cx - px), 0, kw + px, S.H);
    ctx.clip();
  }

  ctx.fillStyle = x.color;
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = px * 0.14;
  ctx.shadowOffsetY = px * 0.03;
  lines.forEach((l, i) => ctx.fillText(l, cx, cy + i * lh));
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.restore();
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/* =========================================================
   Oynatma
   ========================================================= */
let raf = null, lastWall = 0;

function syncMedia(seeking) {
  const t = S.time;
  S.clips.forEach((c) => {
    if (c.kind === 'intro') return;   // prosedürel, oynatılacak medyası yok
    const on = t >= c.start && t < c.start + c.dur;
    const want = c.in + (t - c.start) * c.speed;
    if (on) {
      c.el.playbackRate = c.speed;
      if (c.gain) c.gain.gain.value = c.volume;
      if (seeking || Math.abs(c.el.currentTime - want) > 0.35) {
        try { c.el.currentTime = clamp(want, 0, c.el.duration || want); } catch (e) {}
      }
      if (S.playing && c.el.paused) c.el.play().catch(() => {});
      if (!S.playing && !c.el.paused) c.el.pause();
    } else {
      if (!c.el.paused) c.el.pause();
      if (c.gain) c.gain.gain.value = 0;
    }
  });

  S.audios.forEach((a) => {
    const on = t >= a.start && t < a.start + a.dur;
    const local = t - a.start;
    const want = a.offset + local;
    if (on) {
      let g = a.volume;
      if (a.fadeIn > 0 && local < a.fadeIn) g *= local / a.fadeIn;
      if (a.fadeOut > 0 && a.dur - local < a.fadeOut) g *= (a.dur - local) / a.fadeOut;
      if (a.gain) a.gain.gain.value = clamp(g, 0, 2);
      if (seeking || Math.abs(a.el.currentTime - want) > 0.35) {
        try { a.el.currentTime = clamp(want, 0, a.el.duration || want); } catch (e) {}
      }
      if (S.playing && a.el.paused) a.el.play().catch(() => {});
      if (!S.playing && !a.el.paused) a.el.pause();
    } else {
      if (!a.el.paused) a.el.pause();
      if (a.gain) a.gain.gain.value = 0;
    }
  });
}

function tick(now) {
  if (!S.playing) return;
  const dt = (now - lastWall) / 1000;
  lastWall = now;
  S.time += dt;
  const T = total();
  if (S.time >= T) {
    S.time = T;
    stop();
    if (S.exporting) finishExport();
    draw(); updateTime();
    return;
  }
  syncMedia(false);
  draw();
  updateTime();
  if (S.exporting) $('#expBar').style.width = (S.time / T * 100).toFixed(1) + '%';
  raf = requestAnimationFrame(tick);
}

function play() {
  if (total() <= 0) return;
  audio();
  if (S.time >= total() - 0.05) S.time = 0;
  S.playing = true;
  $('#btnPlay').textContent = '❚❚';
  syncMedia(true);
  lastWall = performance.now();
  raf = requestAnimationFrame(tick);
}

function stop() {
  S.playing = false;
  $('#btnPlay').textContent = '▶';
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  S.clips.forEach((c) => c.el?.pause());   // açılış klibinin medyası yok
  S.audios.forEach((a) => a.el.pause());
}

function seek(t) {
  S.time = clamp(t, 0, Math.max(0, total()));
  syncMedia(true);
  // seek sonrası kare gelsin diye kısa gecikme
  setTimeout(() => { draw(); }, 60);
  draw(); updateTime();
}

$('#btnPlay').onclick = () => S.playing ? stop() : play();
$('#btnStart').onclick = () => { stop(); seek(0); };
$('#btnEnd').onclick = () => { stop(); seek(total()); };
$('#scrub').addEventListener('input', (e) => {
  stop();
  seek(total() * (e.target.value / 1000));
});

function updateTime() {
  const T = total();
  $('#timeLabel').textContent = `${fmt(S.time, 1)} / ${fmt(T, 1)}`;
  $('#scrub').value = T > 0 ? (S.time / T) * 1000 : 0;
  $('#playhead').style.left = (S.time * S.pxPerSec) + 'px';
  const sc = $('#tlScroll');
  const px = S.time * S.pxPerSec;
  if (S.playing && (px < sc.scrollLeft || px > sc.scrollLeft + sc.clientWidth - 60)) {
    sc.scrollLeft = px - sc.clientWidth / 2;
  }
}

/* =========================================================
   Timeline render + etkileşim
   ========================================================= */
function renderTimeline() {
  const T = Math.min(Math.max(total(), 10), MAX_SURE);
  const w = T * S.pxPerSec + 200;
  $('#tlInner').style.width = w + 'px';

  // cetvel
  const step = S.pxPerSec > 160 ? 1 : S.pxPerSec > 70 ? 2 : S.pxPerSec > 35 ? 5 : 10;
  let r = '';
  for (let s = 0; s <= T + step; s += step) {
    r += `<div class="tick" style="left:${s * S.pxPerSec}px"><span>${fmt(s)}</span></div>`;
  }
  $('#tlRuler').innerHTML = r;

  // parçalar
  const tv = $('#trackVideo'), tt = $('#trackText'), tg = $('#trackImage'), ta = $('#trackAudio');
  tv.innerHTML = ''; tt.innerHTML = ''; tg.innerHTML = ''; ta.innerHTML = '';

  S.clips.forEach((c) => {
    if (c.kind === 'intro') {
      const st = INTROS.find((i) => i[0] === c.style);
      tv.appendChild(makeClipEl(c, 'clip', 'clip-intro', '✦ ' + (st ? st[1] : 'Açılış'), true));
      return;
    }
    const m = S.media.find((x) => x.id === c.mediaId) || { name: '?' };
    tv.appendChild(makeClipEl(c, 'clip', 'clip-video', m.name, true));
  });
  S.texts.forEach((x) => {
    tt.appendChild(makeClipEl(x, 'text', 'clip-text', x.text.split('\n')[0] || 'Metin', false));
  });
  S.images.forEach((g) => {
    tg.appendChild(makeClipEl(g, 'image', 'clip-image', '▣ ' + g.name, false));
  });
  S.audios.forEach((a) => {
    const m = S.media.find((x) => x.id === a.mediaId) || { name: '?' };
    ta.appendChild(makeClipEl(a, 'audio', 'clip-audio', '♪ ' + m.name, false));
  });
}

function makeClipEl(o, type, cls, label, isVideo) {
  const d = document.createElement('div');
  d.className = `clip ${cls}` + (S.sel && S.sel.type === type && S.sel.id === o.id ? ' sel' : '');
  d.style.left = (o.start * S.pxPerSec) + 'px';
  d.style.width = Math.max(18, o.dur * S.pxPerSec) + 'px';
  d.innerHTML = `<div class="handle handle-l"></div>
                 <div class="clip-label">${esc(label)}</div>
                 <div class="handle handle-r"></div>`;
  d.onmousedown = (e) => startDrag(e, o, type, isVideo);
  d.onclick = (e) => { e.stopPropagation(); select(type, o.id); };
  return d;
}

let drag = null;
function startDrag(e, o, type, isVideo) {
  e.preventDefault();
  select(type, o.id);
  const mode = e.target.classList.contains('handle-l') ? 'L'
             : e.target.classList.contains('handle-r') ? 'R' : 'M';
  drag = { o, type, isVideo, mode, x0: e.clientX, snap: { ...o } };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function onDrag(e) {
  if (!drag) return;
  const dx = (e.clientX - drag.x0) / S.pxPerSec;
  const { o, type, mode, snap } = drag;

  if (type === 'clip') {
    const m = S.media.find((x) => x.id === o.mediaId);
    const md = m ? m.duration : snap.out;
    if (o.kind === 'intro') {
      if (mode === 'L') o.dur = Math.max(0.5, snap.dur - dx);
      else if (mode === 'R') o.dur = Math.max(0.5, snap.dur + dx);
      else reorder();
    }
    else if (mode === 'L') o.in = clamp(snap.in + dx * o.speed, 0, snap.out - 0.2);
    else if (mode === 'R') o.out = clamp(snap.out + dx * o.speed, snap.in + 0.2, md);
    else reorder();

    // sürükleyerek sıralama
    function reorder() {
      const idx = S.clips.indexOf(o);
      const target = snap.start + dx;
      let ni = idx;
      if (dx > 0 && idx < S.clips.length - 1 && target > S.clips[idx + 1].start) ni = idx + 1;
      if (dx < 0 && idx > 0 && target < S.clips[idx - 1].start) ni = idx - 1;
      if (ni !== idx) {
        S.clips.splice(idx, 1);
        S.clips.splice(ni, 0, o);
        drag.x0 = e.clientX;
        drag.snap = { ...o };
      }
    }
  } else {
    if (mode === 'L') {
      const ns = clamp(snap.start + dx, 0, snap.start + snap.dur - 0.2);
      o.dur = snap.dur + (snap.start - ns);
      o.start = ns;
      if (type === 'audio') o.offset = clamp(snap.offset + (ns - snap.start), 0, 1e9);
    } else if (mode === 'R') {
      o.dur = Math.max(0.2, snap.dur + dx);
    } else {
      o.start = Math.max(0, snap.start + dx);
    }
  }
  layout();
  if (type !== 'clip') { renderTimeline(); }
  buildInspector();
  draw();
}

function endDrag() {
  drag = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  layout(); draw();
}

// cetvelden seek
$('#tlRuler').addEventListener('mousedown', (e) => {
  const r = $('#tlRuler').getBoundingClientRect();
  const t = (e.clientX - r.left) / S.pxPerSec;
  stop(); seek(t);
  const mv = (ev) => seek((ev.clientX - r.left) / S.pxPerSec);
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
});

$('#zoom').addEventListener('input', (e) => {
  S.pxPerSec = +e.target.value;
  renderTimeline(); updateTime();
});

/* =========================================================
   Inspector
   ========================================================= */
function select(type, id) {
  S.sel = { type, id };
  renderTimeline();
  buildInspector();
}

function selected() {
  if (!S.sel) return null;
  const arr = S.sel.type === 'clip' ? S.clips
            : S.sel.type === 'text' ? S.texts
            : S.sel.type === 'image' ? S.images
            : S.audios;
  return arr.find((x) => x.id === S.sel.id) || null;
}

function buildInspector() {
  const box = $('#inspector');
  const o = selected();
  if (!o) { buildScenePanel(); return; }

  const H = [];

  if (S.sel.type === 'clip' && o.kind === 'intro') {
    H.push(`<h4 class="insp-title">Açılış klibi</h4>
            <p class="insp-sub">Marka bilgilerinden üretilir — dosya değil, çizim.</p>`);
    H.push(group('Kurgu', [
      sel('style', 'Stil', o.style, INTROS.map((i) => [i[0], i[1]])),
      `<p class="mini">${esc(INTROS.find((i) => i[0] === o.style)?.[2] || '')}</p>`,
      rng('dur', 'Süre', o.dur, 1, 10, 0.1, 'sn'),
    ]));
    H.push(group('Geçiş', [
      sel('trans.type', 'Tip', o.trans.type, [['none', 'Yok'], ['fade', 'Karartma'], ['cross', 'Çapraz geçiş']]),
      rng('trans.dur', 'Süre', o.trans.dur, 0.1, 3, 0.1, 'sn'),
    ]));
    H.push(paletteBlock());
    H.push(`<div class="btn-row"><button class="btn btn-danger" data-act="del">Sil</button></div>`);
    box.innerHTML = H.join('');
    bindInspector(box);
    return;
  }

  if (S.sel.type === 'clip') {
    const m = S.media.find((x) => x.id === o.mediaId) || {};
    H.push(`<h4 class="insp-title">Video klip</h4><p class="insp-sub">${esc(m.name || '')}</p>`);
    H.push(group('Kırpma', [
      num('in', 'Başlangıç (sn)', o.in, 0, m.duration || 999, 0.1),
      num('out', 'Bitiş (sn)', o.out, 0, m.duration || 999, 0.1),
      `<div class="field"><label>Süre<b>${fmt(o.dur, 1)}</b></label></div>`,
    ]));
    H.push(group('Görüntü', [
      sel('fit', 'Yerleşim', o.fit, [['contain', 'Sığdır (bar’lı)'], ['cover', 'Doldur (kırp)']]),
      rng('speed', 'Hız', o.speed, 0.25, 4, 0.05, 'x'),
      rng('volume', 'Ses', o.volume, 0, 2, 0.05),
    ]));
    H.push(group('Geçiş', [
      sel('trans.type', 'Tip', o.trans.type, [['none', 'Yok'], ['fade', 'Karartma'], ['cross', 'Çapraz geçiş']]),
      rng('trans.dur', 'Süre', o.trans.dur, 0.1, 3, 0.1, 'sn'),
    ]));
    H.push(group('Efekt', [
      rng('filter.brightness', 'Parlaklık', o.filter.brightness, 0.2, 2, 0.05),
      rng('filter.contrast', 'Kontrast', o.filter.contrast, 0.2, 2, 0.05),
      rng('filter.saturate', 'Doygunluk', o.filter.saturate, 0, 2.5, 0.05),
      rng('filter.grayscale', 'Siyah-beyaz', o.filter.grayscale, 0, 1, 0.05),
      rng('filter.sepia', 'Sepya', o.filter.sepia, 0, 1, 0.05),
      rng('filter.blur', 'Bulanıklık', o.filter.blur, 0, 20, 0.5, 'px'),
    ]));
    H.push(`<div class="btn-row">
      <button class="btn" data-act="split">Böl</button>
      <button class="btn" data-act="dup">Kopyala</button>
      <button class="btn btn-danger" data-act="del">Sil</button></div>`);
  }

  if (S.sel.type === 'text') {
    H.push(`<h4 class="insp-title">Metin</h4><p class="insp-sub">${fmt(o.start, 1)} → ${fmt(o.start + o.dur, 1)}</p>`);
    H.push(group('İçerik', [
      `<div class="field"><label>Yazı</label><textarea data-k="text">${esc(o.text)}</textarea></div>`,
      `<div class="row2">${num('start', 'Başlangıç', o.start, 0, 9999, 0.1)}${num('dur', 'Süre', o.dur, 0.2, 9999, 0.1)}</div>`,
    ]));
    H.push(group('Biçim', [
      rng('size', 'Boyut', o.size, 1.5, 20, 0.25, '%'),
      sel('weight', 'Kalınlık', o.weight, [[400, 'Normal'], [600, 'Yarı kalın'], [700, 'Kalın'], [900, 'Çok kalın']]),
      sel('font', 'Yazı tipi', o.font, [['Segoe UI', 'Segoe UI'], ['Georgia', 'Georgia'], ['Impact', 'Impact'], ['Courier New', 'Courier New'], ['Trebuchet MS', 'Trebuchet MS']]),
      sel('align', 'Hizalama', o.align, [['left', 'Sola'], ['center', 'Ortaya'], ['right', 'Sağa']]),
      `<div class="row2"><div class="field"><label>Renk</label><input type="color" data-k="color" value="${o.color}"></div>
       <div class="field"><label>Arka plan</label><input type="color" data-k="bg" value="${o.bg}"></div></div>`,
      sel('bgOn', 'Arka plan kutusu', o.bgOn ? '1' : '0', [['1', 'Açık'], ['0', 'Kapalı']]),
    ]));
    H.push(group('Konum', [
      rng('x', 'Yatay', o.x, 0, 100, 1, '%'),
      rng('y', 'Dikey', o.y, 0, 100, 1, '%'),
    ]));
    H.push(`<div class="btn-row">
      <button class="btn" data-act="dup">Kopyala</button>
      <button class="btn btn-danger" data-act="del">Sil</button></div>`);
  }

  if (S.sel.type === 'image') {
    H.push(`<h4 class="insp-title">Grafik / Logo</h4><p class="insp-sub">${esc(o.name)}</p>`);
    H.push(group('Zamanlama', [
      `<div class="row2">${num('start', 'Başlangıç', o.start, 0, 9999, 0.1)}${num('dur', 'Süre', o.dur, 0.2, 9999, 0.1)}</div>`,
    ]));
    H.push(group('Yerleşim', [
      rng('size', 'Genişlik', o.size, 2, 100, 0.5, '%'),
      rng('x', 'Yatay', o.x, 0, 100, 1, '%'),
      rng('y', 'Dikey', o.y, 0, 100, 1, '%'),
      rng('opacity', 'Saydamlık', o.opacity, 0.05, 1, 0.05),
    ]));
    H.push(`<div class="btn-row">
      <button class="btn" data-act="dup">Kopyala</button>
      <button class="btn btn-danger" data-act="del">Sil</button></div>`);
  }

  if (S.sel.type === 'audio') {
    const m = S.media.find((x) => x.id === o.mediaId) || {};
    H.push(`<h4 class="insp-title">Ses parçası</h4><p class="insp-sub">${esc(m.name || '')}</p>`);
    H.push(group('Zamanlama', [
      `<div class="row2">${num('start', 'Başlangıç', o.start, 0, 9999, 0.1)}${num('dur', 'Süre', o.dur, 0.2, 9999, 0.1)}</div>`,
      num('offset', 'Parça içi kaydırma', o.offset, 0, m.duration || 999, 0.1),
    ]));
    H.push(group('Ses', [
      rng('volume', 'Seviye', o.volume, 0, 2, 0.05),
      rng('fadeIn', 'Fade in', o.fadeIn, 0, 8, 0.1, 'sn'),
      rng('fadeOut', 'Fade out', o.fadeOut, 0, 8, 0.1, 'sn'),
    ]));
    H.push(`<div class="btn-row"><button class="btn btn-danger" data-act="del">Sil</button></div>`);
  }

  box.innerHTML = H.join('');
  bindInspector(box);
}

function bindInspector(box) {
  box.querySelectorAll('[data-k]').forEach((inp) => {
    const ev = inp.type === 'range' || inp.tagName === 'TEXTAREA' ? 'input' : 'change';
    inp.addEventListener(ev, () => applyField(inp));
    if (inp.type === 'color') inp.addEventListener('input', () => applyField(inp));
  });
  box.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => action(b.dataset.act));
}

/* ---------- Renk paleti bloğu (videodan çıkarılan) ---------- */
function paletteBlock() {
  const R = roles();
  const src = S.palette
    ? 'Renkler timeline’daki videodan alındı.'
    : 'Video eklenince renkler ondan alınır. Şu an marka rengi kullanılıyor.';
  const sw = [R.deep, R.base, R.vivid, R.light]
    .map((c) => `<i style="background:${c}" title="${c}"></i>`).join('');
  return group('Renk paleti', [
    `<div class="pal">${sw}</div>`,
    `<p class="mini">${src}</p>`,
    `<div class="btn-row">
       <button class="btn" data-act="palRefresh">Videodan yenile</button>
       <button class="btn" data-act="palReset">Markaya dön</button>
     </div>`,
  ]);
}

/* ---------- Seçim yokken: sahne ayarları ---------- */
function buildScenePanel() {
  const box = $('#inspector');
  const bd = S.backdrop;
  const H = [];
  H.push(`<h4 class="insp-title">Sahne</h4>
          <p class="insp-sub">Hiçbir öğe seçili değil.</p>`);
  H.push(group('Arka plan', [
    `<p class="mini">Kliplerin altında duran üretilmiş zemin. Videon yokken de
      görüntü olur; şablonlar bunu kendiliğinden seçer.</p>`,
    `<div class="field"><label>Tip</label>
      <select data-s="type">${BACKDROPS.map(([v, l]) =>
        `<option value="${v}"${v === bd.type ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`,
    bd.type === 'none' ? '' :
      `<div class="field"><label>Süre<b>${fmtNum(bd.dur)}sn</b></label>
        <input type="range" data-s="dur" min="2" max="60" step="0.5" value="${bd.dur}"></div>`,
  ]));
  H.push(paletteBlock());
  H.push(group('Hızlı ekle', [
    `<div class="btn-row"><button class="btn" data-act="addIntro">Açılış klibi ekle</button></div>`,
  ]));

  box.innerHTML = H.join('');
  box.querySelectorAll('[data-s]').forEach((inp) => {
    const ev = inp.type === 'range' ? 'input' : 'change';
    inp.addEventListener(ev, () => {
      S.backdrop[inp.dataset.s] = inp.type === 'range' ? parseFloat(inp.value) : inp.value;
      layout(); draw();
      if (inp.dataset.s === 'type') buildScenePanel();
      else {
        const lab = inp.closest('.field').querySelector('label b');
        if (lab) lab.textContent = fmtNum(S.backdrop.dur) + 'sn';
      }
    });
  });
  bindInspector(box);
}

function applyField(inp) {
  const o = selected(); if (!o) return;
  const path = inp.dataset.k;
  let v = inp.value;
  if (inp.type === 'range' || inp.type === 'number') v = parseFloat(v) || 0;
  if (path === 'bgOn') v = v === '1';
  if (path === 'weight') v = parseInt(v);

  const parts = path.split('.');
  let tgt = o;
  for (let i = 0; i < parts.length - 1; i++) tgt = tgt[parts[i]];
  tgt[parts[parts.length - 1]] = v;

  // canlı etiket güncelle
  const lab = inp.closest('.field')?.querySelector('label b');
  if (lab && inp.type === 'range') lab.textContent = fmtNum(v) + (inp.dataset.unit || '');

  layout();
  if (S.sel.type !== 'clip') renderTimeline();
  if (path === 'text') renderTimeline();
  draw();
  if (['in', 'out', 'speed', 'start', 'offset'].includes(path)) syncMedia(true);
}

function action(a) {
  // seçim gerektirmeyen eylemler
  if (a === 'addIntro') { addIntro(); return; }
  if (a === 'palReset') { S.palette = null; buildInspector(); draw(); return; }
  if (a === 'palRefresh') {
    const src = S.clips.find((c) => c.kind !== 'intro' && c.el && c.el.videoWidth);
    if (!src) { alert('Önce timeline’a bir video ekle.'); return; }
    const p = extractPalette(src.el);
    if (p) { S.palette = p; buildInspector(); draw(); }
    else alert('Bu videodan renk okunamadı.');
    return;
  }

  const o = selected(); if (!o) return;
  const type = S.sel.type;

  if (a === 'del') {
    if (type === 'clip') { o.el?.pause(); S.clips = S.clips.filter((x) => x !== o); }
    if (type === 'text') S.texts = S.texts.filter((x) => x !== o);
    if (type === 'image') S.images = S.images.filter((x) => x !== o);
    if (type === 'audio') { o.el.pause(); S.audios = S.audios.filter((x) => x !== o); }
    S.sel = null;
  }

  if (a === 'dup') {
    if (type === 'clip' && o.kind === 'intro') {
      const c = { ...o, id: uid(), trans: { ...o.trans } };
      S.clips.splice(S.clips.indexOf(o) + 1, 0, c);
      S.sel = { type: 'clip', id: c.id };
    } else if (type === 'clip') {
      const m = S.media.find((x) => x.id === o.mediaId);
      const el = document.createElement('video');
      el.src = m.url; el.preload = 'auto'; el.playsInline = true;
      const c = { ...o, id: uid(), el, filter: { ...o.filter }, trans: { ...o.trans } };
      wireAudio(el, c);
      S.clips.splice(S.clips.indexOf(o) + 1, 0, c);
      S.sel = { type: 'clip', id: c.id };
    } else if (type === 'text') {
      const t = { ...o, id: uid(), start: o.start + o.dur };
      S.texts.push(t);
      S.sel = { type: 'text', id: t.id };
    } else if (type === 'image') {
      const g = addImage(o.src, o.name, { ...o, start: o.start + o.dur, silent: true });
      S.sel = { type: 'image', id: g.id };
    }
  }

  if (a === 'split' && type === 'clip' && o.kind !== 'intro') {
    const cut = S.time;
    if (cut > o.start + 0.15 && cut < o.start + o.dur - 0.15) {
      const srcCut = o.in + (cut - o.start) * o.speed;
      const m = S.media.find((x) => x.id === o.mediaId);
      const el = document.createElement('video');
      el.src = m.url; el.preload = 'auto'; el.playsInline = true;
      const b = { ...o, id: uid(), el, in: srcCut, filter: { ...o.filter }, trans: { type: 'none', dur: 0.6 } };
      wireAudio(el, b);
      o.out = srcCut;
      S.clips.splice(S.clips.indexOf(o) + 1, 0, b);
    }
  }

  layout(); buildInspector(); draw();
}

/* ---------------- Inspector yardımcıları ---------------- */
function group(name, fields) {
  return `<div class="group"><div class="group-name">${name}</div>${fields.join('')}</div>`;
}
function rng(k, label, v, min, max, step, unit = '') {
  return `<div class="field"><label>${label}<b>${fmtNum(v)}${unit}</b></label>
    <input type="range" data-k="${k}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
}
function num(k, label, v, min, max, step) {
  return `<div class="field"><label>${label}</label>
    <input type="number" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${round(v, 2)}"></div>`;
}
function sel(k, label, v, opts) {
  const o = opts.map(([val, txt]) => `<option value="${val}"${String(val) === String(v) ? ' selected' : ''}>${txt}</option>`).join('');
  return `<div class="field"><label>${label}</label><select data-k="${k}">${o}</select></div>`;
}

/* =========================================================
   En-boy oranı
   ========================================================= */
$('#ratio').addEventListener('change', (e) => {
  const [w, h] = e.target.value.split('x').map(Number);
  S.W = w; S.H = h;
  cv.width = w; cv.height = h;
  $('#stageBadge').textContent = `${w}×${h}`;
  draw();
});

/* =========================================================
   Dışa aktarma (gerçek zamanlı kayıt)
   ========================================================= */
let rec = null, chunks = [];

$('#btnExport').onclick = () => {
  if (!S.clips.length) { alert('Önce timeline’a bir video ekle.'); return; }
  startExport();
};

function startExport() {
  audio();
  chunks = [];
  const vStream = cv.captureStream(30);
  audioDest = actx.createMediaStreamDestination();
  master.connect(audioDest);
  master.disconnect(actx.destination); // kayıt sırasında hoparlörü sustur

  const tracks = [...vStream.getVideoTracks(), ...audioDest.stream.getAudioTracks()];
  const stream = new MediaStream(tracks);

  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';

  rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = onRecStop;

  $('#exportModal').hidden = false;
  $('#expTitle').textContent = 'Dışa aktarılıyor…';
  $('#expNote').textContent = 'Kayıt gerçek zamanlı yapılır; videonun süresi kadar sürer. Bu sekmeyi arka plana alma.';
  $('#expBar').style.width = '0%';
  $('#expDownload').hidden = true;

  S.exporting = true;
  stop();
  seek(0);
  setTimeout(() => { rec.start(200); play(); }, 350);
}

function finishExport() {
  if (rec && rec.state !== 'inactive') setTimeout(() => rec.stop(), 300);
}

function onRecStop() {
  S.exporting = false;
  try { master.disconnect(audioDest); } catch (e) {}
  try { master.connect(actx.destination); } catch (e) {}

  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = $('#expDownload');
  a.href = url;
  a.hidden = false;
  $('#expTitle').textContent = 'Hazır';
  $('#expNote').textContent = `Boyut: ${(blob.size / 1048576).toFixed(1)} MB · WebM formatı (Chrome, Edge, VLC ve tüm sosyal medya platformları destekler).`;
  $('#expBar').style.width = '100%';
  $('#expCancel').textContent = 'Kapat';
}

$('#expCancel').onclick = () => {
  if (rec && rec.state === 'recording') { rec.stop(); stop(); }
  S.exporting = false;
  $('#exportModal').hidden = true;
  $('#expCancel').textContent = 'İptal';
};

/* =========================================================
   Klavye
   ========================================================= */
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.code === 'Space') { e.preventDefault(); S.playing ? stop() : play(); }
  if (e.key === 'Delete' && S.sel) action('del');
  if (e.key === 'ArrowLeft') { stop(); seek(S.time - (e.shiftKey ? 1 : 1 / 30)); }
  if (e.key === 'ArrowRight') { stop(); seek(S.time + (e.shiftKey ? 1 : 1 / 30)); }
  if (e.key.toLowerCase() === 's' && S.sel?.type === 'clip') action('split');
});

/* =========================================================
   Yardımcılar
   ========================================================= */
function fmt(s, dec = 0) {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(dec).padStart(dec ? 4 : 2, '0')}`;
}
function round(v, d) { const p = 10 ** d; return Math.round(v * p) / p; }
function fmtNum(v) { return Number.isInteger(v) ? v : round(v, 2); }
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* =========================================================
   Sol panel sekmeleri
   ========================================================= */
document.querySelectorAll('.tab').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab-page').forEach((p) => p.hidden = p.dataset.page !== b.dataset.tab);
  };
});

/* =========================================================
   Marka paneli
   ========================================================= */
const BRAND_FIELDS = [
  ['name', 'Site adı', 'text'],
  ['tagline', 'Slogan', 'text'],
  ['url', 'Adres', 'text'],
  ['cta', 'Çağrı metni', 'text'],
  ['f1', '1. özellik', 'text'],
  ['f2', '2. özellik', 'text'],
  ['f3', '3. özellik', 'text'],
];

function renderBrand() {
  const box = $('#brandPanel');
  const b = S.brand;
  box.innerHTML = `
    <p class="hint">Bir kere doldur — bütün şablonlar bu bilgilere göre kurulur.
    Tarayıcında saklanır, sunucuya gitmez.</p>
    ${BRAND_FIELDS.map(([k, l]) =>
      `<div class="field"><label>${l}</label><input type="text" data-b="${k}" value="${esc(b[k])}"></div>`
    ).join('')}
    <div class="row2">
      <div class="field"><label>Vurgu rengi</label><input type="color" data-b="accent" value="${b.accent}"></div>
      <div class="field"><label>Yazı rengi</label><input type="color" data-b="ink" value="${b.ink}"></div>
    </div>
    <div class="field"><label>Yazı tipi</label>
      <select data-b="font">
        ${['Segoe UI', 'Georgia', 'Impact', 'Trebuchet MS', 'Courier New']
          .map((f) => `<option${f === b.font ? ' selected' : ''}>${f}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Logo (PNG, şeffaf zemin önerilir)</label>
      <div class="logo-box">
        ${b.logo ? `<img src="${b.logo}" alt="logo">` : '<span>Logo yok</span>'}
      </div>
      <div class="btn-row">
        <label class="btn">Logo seç<input type="file" id="fileLogo" accept="image/*" hidden></label>
        <button class="btn btn-danger" id="logoClear">Kaldır</button>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn" id="brandExport">Profili indir</button>
      <label class="btn">Profil yükle<input type="file" id="brandImport" accept="application/json" hidden></label>
    </div>`;

  box.querySelectorAll('[data-b]').forEach((inp) => {
    inp.addEventListener('input', () => {
      S.brand[inp.dataset.b] = inp.value;
      saveBrand();
    });
  });

  $('#fileLogo').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { S.brand.logo = r.result; saveBrand(); refreshLogo(); renderBrand(); };
    r.readAsDataURL(f);
  };
  $('#logoClear').onclick = () => { S.brand.logo = ''; saveBrand(); refreshLogo(); renderBrand(); };

  $('#brandExport').onclick = () => {
    const blob = new Blob([JSON.stringify(S.brand, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (S.brand.name || 'marka').replace(/\s+/g, '-').toLowerCase() + '-profil.json';
    a.click();
  };
  $('#brandImport').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        S.brand = { ...defBrand(), ...JSON.parse(r.result) };
        saveBrand(); refreshLogo(); renderBrand(); draw();
      } catch (err) { alert('Profil dosyası okunamadı.'); }
    };
    r.readAsText(f);
  };
}

/* =========================================================
   Şablonlar
   ========================================================= */
function renderTemplates() {
  const box = $('#tplPanel');
  box.innerHTML = `<p class="hint">Şablon, marka bilgilerini kullanarak metin ve logo
    katmanlarını kurar. Timeline'daki videon varsa süresine göre yayılır.</p>` +
    TEMPLATES.map((t) => `
      <div class="tpl" data-id="${t.id}">
        <div class="tpl-swatch" style="background:linear-gradient(135deg,${t.swatch[0]},${t.swatch[1]})">
          ${t.ratio.split('x')[0] > t.ratio.split('x')[1] ? '▭' : t.ratio.split('x')[0] === t.ratio.split('x')[1] ? '▢' : '▯'}
        </div>
        <div class="tpl-meta">
          <div class="tpl-name">${t.name}</div>
          <div class="tpl-desc">${t.desc}</div>
          <div class="tpl-tag">${ratioLabel(t.ratio)} · ~${t.defaultDur} sn</div>
        </div>
      </div>`).join('');

  box.querySelectorAll('.tpl').forEach((el) => {
    el.onclick = () => applyTemplate(TEMPLATES.find((t) => t.id === el.dataset.id));
  });
}

function ratioLabel(r) {
  const [w, h] = r.split('x').map(Number);
  if (w === h) return '1:1';
  return w > h ? '16:9' : '9:16';
}

function applyTemplate(tpl) {
  if (!tpl) return;
  if ((S.texts.length || S.images.length) &&
      !confirm('Mevcut metin ve grafik katmanları silinip şablon uygulanacak. Devam?')) return;

  stop();
  S.texts = [];
  S.images = [];

  // en-boy oranı
  const [w, h] = tpl.ratio.split('x').map(Number);
  S.W = w; S.H = h;
  cv.width = w; cv.height = h;
  $('#stageBadge').textContent = `${w}×${h}`;
  $('#ratio').value = tpl.ratio;

  // eski açılış klibini at, yenisini kur
  S.clips = S.clips.filter((c) => c.kind !== 'intro');
  const intro = addIntro(tpl.intro, tpl.introDur);

  // arka plan zemini — videon yoksa görüntüyü bu taşır
  S.backdrop.type = tpl.backdrop || 'mesh';
  // dekor (çerçeve, köşe aksanları, ilerleme çubuğu) ve yavaş yakınlaşma
  S.decor = { frame: false, corners: false, bar: false, tab: false, ...(tpl.decor || {}) };
  S.clips.forEach((c) => { if (c.kind !== 'intro') c.zoom = tpl.zoom || 0; });

  // metinlerin yayılacağı süre: açılıştan sonraki video, yoksa şablonun kendi süresi
  let T = 0;
  S.clips.forEach((c) => { if (c.kind !== 'intro') T = Math.max(T, c.start + c.dur - intro.dur); });
  if (T < 3) T = tpl.defaultDur;

  const out = tpl.build(S.brand, T, { intro: true });
  const off = intro.dur;   // katmanlar açılıştan sonra başlar

  out.texts.forEach((t) => S.texts.push({ id: uid(), ...t, start: t.start + off }));

  if (out.logo && S.brand.logo) {
    addImage(S.brand.logo, 'Logo', { ...out.logo, start: out.logo.start + off, silent: true });
  }

  // klip geçişleri (açılış hariç, o kendi kapanışını çiziyor)
  S.clips.forEach((c, i) => {
    if (c.kind === 'intro') return;
    c.trans = { type: i === 0 && out.trans === 'cross' ? 'fade' : out.trans, dur: out.transDur };
  });

  S.backdrop.dur = off + T;   // zemin tam şablon boyunca sürer

  S.sel = null;
  layout();
  buildInspector();
  seek(0);
  draw();

  const st = INTROS.find((i) => i[0] === tpl.intro);
  $('#tplNote').textContent =
    `“${tpl.name}” uygulandı — ${st ? st[1] : 'açılış'} klibi + ${S.texts.length} metin katmanı.`;
}

/* =========================================================
   Ekran kaydı — kullanıcı kendi sitesini gezerken kaydeder
   ========================================================= */
let screenRec = null, screenChunks = [], screenStream = null;

$('#btnScreen').onclick = async () => {
  if (screenRec && screenRec.state === 'recording') { stopScreen(); return; }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert('Tarayıcın ekran kaydını desteklemiyor. Chrome veya Edge dene.');
    return;
  }
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true,
    });
  } catch (e) { return; } // kullanıcı vazgeçti

  screenChunks = [];
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  screenRec = new MediaRecorder(screenStream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);

  screenRec.ondataavailable = (e) => { if (e.data.size) screenChunks.push(e.data); };
  screenRec.onstop = () => {
    screenStream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(screenChunks, { type: 'video/webm' });
    const stamp = new Date().toTimeString().slice(0, 5).replace(':', '.');
    loadFiles([new File([blob], `ekran-kaydi-${stamp}.webm`, { type: 'video/webm' })], 'video');
    setScreenUI(false);
  };

  // kullanıcı tarayıcının kendi "paylaşımı durdur" düğmesine basarsa
  screenStream.getVideoTracks()[0].onended = () => stopScreen();

  screenRec.start(300);
  setScreenUI(true);
};

function stopScreen() {
  if (screenRec && screenRec.state !== 'inactive') screenRec.stop();
}
function setScreenUI(on) {
  const b = $('#btnScreen');
  b.classList.toggle('rec', on);
  b.textContent = on ? '■ Kaydı bitir' : 'Ekran kaydet';
}

/* ---------------- Grafik ekleme (topbar) ---------------- */
$('#fileImage')?.addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => addImage(r.result, f.name, { start: S.time, dur: 4 });
  r.readAsDataURL(f);
  e.target.value = '';
});

/* ---------------- Başlangıç ---------------- */
refreshLogo();
renderMedia();
renderBrand();
buildInspector();
renderTemplates();
renderTimeline();
draw();
updateTime();
