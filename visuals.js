/* =========================================================
   Prosedürel görseller
   - Kullanıcının videosundan renk paleti çıkarma
   - Animasyonlu arka plan zeminleri
   - Otomatik açılış (intro) klipleri
   Hepsi zamanın saf fonksiyonu: önizleme ile dışa aktarma birebir aynı.
   ========================================================= */

/* ---------------- Renk yardımcıları ---------------- */
function hex2rgb(h) {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}
function rgb2hex(r, g, b) {
  const f = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, f) {
  const [r, g, b] = hex2rgb(h);
  const m = (v) => (f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return rgb2hex(m(r), m(g), m(b));
}
function mixHex(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function lum(h) { const [r, g, b] = hex2rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

const ease = (t) => 1 - Math.pow(1 - t, 3);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const cl01 = (v) => Math.min(1, Math.max(0, v));

/* =========================================================
   Videodan renk paleti çıkarma
   Kaynağın ortasından bir kare alır, renkleri kutulara böler,
   en baskın ve en renkli beş tonu döndürür.
   ========================================================= */
function extractPalette(el) {
  try {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 36;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(el, 0, 0, 64, 36);
    const d = x.getImageData(0, 0, 64, 36).data;

    const bins = {};
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const k = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
      const o = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 });
      o.n++; o.r += r; o.g += g; o.b += b;
    }

    const arr = Object.values(bins).map((o) => {
      const r = o.r / o.n, g = o.g / o.n, b = o.b / o.n;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx ? (mx - mn) / mx : 0;
      return { r, g, b, sat, score: o.n * (0.3 + sat * 1.6) };
    });
    if (!arr.length) return null;

    arr.sort((a, b) => b.score - a.score);
    // birbirine çok yakın tonları ele
    const out = [];
    for (const c2 of arr) {
      if (out.length >= 5) break;
      const dup = out.some((o) =>
        Math.abs(o.r - c2.r) + Math.abs(o.g - c2.g) + Math.abs(o.b - c2.b) < 60);
      if (!dup) out.push(c2);
    }
    return out.map((o) => rgb2hex(o.r, o.g, o.b));
  } catch (e) {
    return null; // kirlenmiş canvas veya hazır olmayan kaynak
  }
}

/* Paletten kullanışlı roller türet */
function paletteRoles(pal, accent) {
  const p = (pal && pal.length) ? pal.slice() : [accent, shade(accent, 0.4), shade(accent, -0.5)];
  const sorted = p.slice().sort((a, b) => lum(a) - lum(b));
  const dark = shade(sorted[0], -0.35);
  // en renkli tonu vurgu olarak seç
  let vivid = p[0];
  let best = -1;
  p.forEach((h) => {
    const [r, g, b] = hex2rgb(h);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx ? (mx - mn) / mx : 0;
    if (s > best) { best = s; vivid = h; }
  });
  if (best < 0.18) vivid = accent; // görüntü griyse markanın rengine düş
  return {
    deep: dark,
    base: sorted[Math.min(1, sorted.length - 1)],
    vivid,
    light: sorted[sorted.length - 1],
    all: p,
  };
}

/* =========================================================
   Arka plan zeminleri
   ========================================================= */
const BACKDROPS = [
  ['none', 'Yok (siyah)'],
  ['mesh', 'Işık lekeleri'],
  ['flow', 'Akan gradyan'],
  ['grid', 'Perspektif ızgara'],
  ['bokeh', 'Parçacıklar'],
  ['waves', 'Dalgalar'],
];

/* Zeminler yumuşak geçişlerden oluştuğu için tam çözünürlükte çizmek gereksiz.
   Küçük bir ara katmana çizip büyütmek görsel olarak aynı, ~16 kat ucuz. */
let _bdCanvas = null, _bdCtx = null;
const BACKDROP_MAX_W = 512;

function drawBackdrop(ctx, type, t, W, H, roles) {
  if (!type || type === 'none') return;
  if (W <= BACKDROP_MAX_W) { paintBackdrop(ctx, type, t, W, H, roles); return; }

  const s = BACKDROP_MAX_W / W;
  const w = Math.round(W * s), h = Math.round(H * s);
  if (!_bdCanvas) {
    _bdCanvas = document.createElement('canvas');
    _bdCtx = _bdCanvas.getContext('2d');
  }
  if (_bdCanvas.width !== w || _bdCanvas.height !== h) {
    _bdCanvas.width = w; _bdCanvas.height = h;
  }
  paintBackdrop(_bdCtx, type, t, w, h, roles);
  ctx.drawImage(_bdCanvas, 0, 0, W, H);
}

function paintBackdrop(ctx, type, t, W, H, roles) {
  const { deep, base, vivid, light } = roles;

  ctx.save();
  const g0 = ctx.createLinearGradient(0, 0, 0, H);
  g0.addColorStop(0, shade(base, -0.62));
  g0.addColorStop(1, shade(deep, -0.3));
  ctx.fillStyle = g0;
  ctx.fillRect(0, 0, W, H);

  if (type === 'mesh') {
    const blobs = [
      [0.24, 0.28, 0.60, vivid], [0.78, 0.33, 0.52, light],
      [0.50, 0.82, 0.66, base], [0.88, 0.78, 0.44, vivid],
    ];
    blobs.forEach((b, i) => {
      const px = (b[0] + Math.sin(t * 0.24 + i * 1.7) * 0.085) * W;
      const py = (b[1] + Math.cos(t * 0.19 + i * 2.3) * 0.07) * H;
      const r = b[2] * Math.max(W, H) * 0.62;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, rgba(b[3], 0.4));
      g.addColorStop(1, rgba(b[3], 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
  }

  if (type === 'flow') {
    const a = t * 0.14;
    const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
    const g = ctx.createLinearGradient(
      cx - Math.cos(a) * R, cy - Math.sin(a) * R,
      cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.addColorStop(0, rgba(vivid, 0.55));
    g.addColorStop(0.45, rgba(light, 0.22));
    g.addColorStop(1, rgba(deep, 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(
      W * (0.5 + Math.sin(t * 0.3) * 0.2), H * (0.5 + Math.cos(t * 0.23) * 0.18), 0,
      W / 2, H / 2, Math.max(W, H) * 0.7);
    g2.addColorStop(0, rgba(light, 0.2));
    g2.addColorStop(1, rgba(light, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }

  if (type === 'grid') {
    ctx.lineWidth = Math.max(1, W / 1100);
    const vy = H * 0.46, rows = 20, off = (t * 0.32) % 1;
    for (let i = 0; i < rows; i++) {
      const p = (i + off) / rows;
      const y = vy + Math.pow(p, 2.3) * H * 0.62;
      ctx.globalAlpha = cl01(1 - p) * 0.75;
      ctx.strokeStyle = vivid;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.42;
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * W * 0.13, H * 1.08);
      ctx.lineTo(W / 2 + i * W * 0.012, vy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const gg = ctx.createLinearGradient(0, vy - H * 0.15, 0, vy + H * 0.12);
    gg.addColorStop(0, rgba(deep, 0.9));
    gg.addColorStop(1, rgba(deep, 0));
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, W, vy + H * 0.12);
  }

  if (type === 'bokeh') {
    const rnd = (i, s) => { const v = Math.sin(i * s) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 38; i++) {
      const r1 = rnd(i + 1, 12.9898), r2 = rnd(i + 1, 78.233), r3 = rnd(i + 1, 39.425);
      const sp = 0.015 + r3 * 0.045;
      const y = ((r2 - t * sp) % 1 + 1) % 1;
      const x = r1 + Math.sin(t * 0.28 + i) * 0.018;
      const rad = (0.008 + r3 * 0.048) * W;
      ctx.globalAlpha = 0.05 + r3 * 0.16;
      ctx.fillStyle = i % 3 === 0 ? light : vivid;
      ctx.beginPath();
      ctx.arc(x * W, y * H, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (type === 'waves') {
    for (let l = 0; l < 4; l++) {
      const amp = H * 0.045 * (1 + l * 0.4);
      const yb = H * (0.52 + l * 0.13);
      const sp = 0.45 + l * 0.22, wl = 1.1 + l * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        ctx.lineTo(x, yb + Math.sin((x / W) * Math.PI * 2 * wl + t * sp + l) * amp);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = rgba(l % 2 ? light : vivid, 0.13 + l * 0.06);
      ctx.fill();
    }
  }

  // köşe karartma — yazı okunurluğu için
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* =========================================================
   Dekor: kliplerin üstüne çizilen sabit grafik öğeler.
   Yazıya ek olarak videoya kimlik veren kısım burası.
   ========================================================= */
function drawDecor(ctx, d, t, toplam, W, H, roles) {
  if (!d) return;
  const { deep, vivid, light } = roles;
  ctx.save();

  // bolunmus ekran: bir yani renk blogu, yazilar orada durur
  if (d.split) {
    const sag = d.split === 'right';
    const w = W * 0.44;
    const x = sag ? W - w : 0;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, rgba(deep, sag ? 0.5 : 0.95));
    g.addColorStop(1, rgba(deep, sag ? 0.95 : 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, H);
    const k = Math.max(3, W * 0.004);
    ctx.fillStyle = rgba(vivid, 0.95);
    ctx.fillRect(sag ? x : x + w - k, 0, k, H);
  }

  // marka renginde ince çerçeve
  if (d.frame) {
    const k = Math.max(2, H * 0.0045);
    ctx.strokeStyle = rgba(vivid, 0.85);
    ctx.lineWidth = k;
    ctx.strokeRect(k / 2, k / 2, W - k, H - k);
  }

  // köşe aksanları (L şeklinde kısa çizgiler)
  if (d.corners) {
    const m = Math.round(W * 0.035);       // kenardan boşluk
    const u = Math.round(W * 0.045);       // kol uzunluğu
    const k = Math.max(2, H * 0.005);
    ctx.strokeStyle = rgba(light, 0.9);
    ctx.lineWidth = k;
    ctx.lineCap = 'square';
    const kose = (cx, cy, sx, sy) => {
      ctx.beginPath();
      ctx.moveTo(cx + sx * u, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * u);
      ctx.stroke();
    };
    kose(m, m, 1, 1);
    kose(W - m, m, -1, 1);
    kose(m, H - m, 1, -1);
    kose(W - m, H - m, -1, -1);
  }

  // altta ilerleme çubuğu
  if (d.bar && toplam > 0) {
    const h = Math.max(3, H * 0.008);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, H - h, W, h);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, vivid);
    g.addColorStop(1, light);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - h, W * cl01(t / toplam), h);
  }

  // üst köşede ince marka şeridi
  if (d.tab) {
    const w = W * 0.16, h = H * 0.007;
    ctx.fillStyle = rgba(vivid, 0.95);
    ctx.fillRect(W * 0.035, H * 0.035, w, h);
  }

  ctx.restore();
}

/* =========================================================
   Açılış (intro) klipleri
   p = 0..1 ilerleme, roles = videodan çıkarılmış renkler
   ========================================================= */
const INTROS = [
  ['reveal', 'Perde Açılışı', 'Çizgi ortadan açılır, isim arkasından çıkar. Sakin ve kurumsal.'],
  ['slide', 'Kayan Blok', 'Renk bloğu yandan geçer, isim ve slogan ters yönden gelir.'],
  ['pulse', 'Nabız', 'Merkezden halkalar yayılır, logo büyüyerek yerine oturur.'],
  ['bars', 'Çubuklar', 'Paletten renkli çubuklar iner, isim üstüne oturur.'],
];

function drawIntro(ctx, style, p, W, H, brand, roles, logoImg) {
  const { deep, base, vivid, light } = roles;
  const name = (brand.name || '').toUpperCase();
  const tag = brand.tagline || '';
  const ink = brand.ink || '#fff';
  const font = brand.font || 'Segoe UI';

  ctx.save();

  /* --- ortak zemin --- */
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, shade(deep, -0.15));
  g.addColorStop(1, shade(base, -0.55));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* --- stiller --- */
  if (style === 'reveal') introReveal();
  else if (style === 'slide') introSlide();
  else if (style === 'pulse') introPulse();
  else introBars();

  /* --- kapanış karartması --- */
  if (p > 0.86) {
    ctx.fillStyle = `rgba(0,0,0,${(p - 0.86) / 0.14})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  /* ---------------------------------------------------- */
  function introReveal() {
    const a = ease(cl01(p / 0.35));            // çizgi açılışı
    const b = ease(cl01((p - 0.25) / 0.4));    // yazı açılışı
    const cy = H * 0.5;

    // yumuşak vurgu ışığı
    const rg = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, W * 0.62);
    rg.addColorStop(0, rgba(vivid, 0.3 * a));
    rg.addColorStop(1, rgba(vivid, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    // ortadan açılan çizgi
    const lw = W * 0.62 * a;
    ctx.fillStyle = rgba(vivid, 0.95);
    ctx.fillRect(W / 2 - lw / 2, cy - H * 0.0035, lw, H * 0.007);

    // isim (çizginin üstünde, maskeyle açılır)
    ctx.save();
    const bw = W * 0.9 * b;
    ctx.beginPath();
    ctx.rect(W / 2 - bw / 2, 0, bw, H);
    ctx.clip();
    fitFont(name, H * 0.108, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    ctx.globalAlpha = b;
    ctx.fillText(name, W / 2, cy - H * 0.045);
    ctx.restore();

    // slogan
    const c = ease(cl01((p - 0.45) / 0.4));
    ctx.globalAlpha = c;
    fitFont(tag, H * 0.034, 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = rgba(ink, 0.82);
    ctx.fillText(tag, W / 2, cy + H * 0.04);
    ctx.globalAlpha = 1;

    if (logoImg) logo(W / 2, cy - H * 0.2, H * 0.14, ease(cl01((p - 0.1) / 0.35)));
  }

  /* ---------------------------------------------------- */
  function introSlide() {
    const a = easeIO(cl01(p / 0.55));
    // geçen renk bloğu
    ctx.fillStyle = rgba(vivid, 0.9);
    ctx.fillRect(-W + a * W * 1.75, 0, W, H);
    ctx.fillStyle = rgba(light, 0.35);
    ctx.fillRect(-W + a * W * 2.1, 0, W * 0.5, H);

    const b = ease(cl01((p - 0.3) / 0.45));
    const dx = (1 - b) * W * 0.28;

    ctx.globalAlpha = b;
    fitFont(name, H * 0.1, 900, 0.82);   // sola hizali, W*0.09'dan basliyor
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    ctx.fillText(name, W * 0.09 - dx, H * 0.5);

    // ince ayraç
    ctx.fillStyle = rgba(vivid, 0.95);
    ctx.fillRect(W * 0.09 - dx, H * 0.535, W * 0.16 * b, H * 0.006);

    fitFont(tag, H * 0.033, 400, 0.82);
    ctx.fillStyle = rgba(ink, 0.8);
    ctx.fillText(tag, W * 0.09 + dx, H * 0.61);
    ctx.globalAlpha = 1;

    if (logoImg) logo(W * 0.09 + H * 0.05, H * 0.3, H * 0.11, b, 'left');
  }

  /* ---------------------------------------------------- */
  function introPulse() {
    const cx = W / 2, cy = H * 0.5;
    // yayılan halkalar
    for (let i = 0; i < 3; i++) {
      const q = ((p * 1.5 + i / 3) % 1);
      ctx.globalAlpha = (1 - q) * 0.5;
      ctx.strokeStyle = i % 2 ? light : vivid;
      ctx.lineWidth = Math.max(2, H * 0.006);
      ctx.beginPath();
      ctx.arc(cx, cy, q * Math.max(W, H) * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const a = ease(cl01(p / 0.4));
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.4 * a);
    rg.addColorStop(0, rgba(vivid, 0.42));
    rg.addColorStop(1, rgba(vivid, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    if (logoImg) logo(cx, cy - H * 0.11, H * 0.17 * (0.75 + a * 0.25), a);

    const b = ease(cl01((p - 0.3) / 0.45));
    ctx.globalAlpha = b;
    fitFont(name, H * 0.095 * (0.94 + b * 0.06), 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    ctx.fillText(name, cx, cy + H * (logoImg ? 0.13 : 0.02));
    fitFont(tag, H * 0.032, 400);
    ctx.textBaseline = 'top';
    ctx.fillStyle = rgba(ink, 0.78);
    ctx.fillText(tag, cx, cy + H * (logoImg ? 0.17 : 0.06));
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------- */
  function introBars() {
    const cols = [vivid, light, base, shade(vivid, 0.3), shade(base, 0.25)];
    const n = 5, bw = W / n;
    for (let i = 0; i < n; i++) {
      const d = i * 0.07;
      const q = easeIO(cl01((p - d) / 0.45));
      ctx.fillStyle = rgba(cols[i % cols.length], 0.9);
      const h = H * q;
      ctx.fillRect(i * bw, i % 2 ? H - h : 0, bw + 1, h);
    }
    // koyu perde ortaya iner
    const c = ease(cl01((p - 0.4) / 0.35));
    ctx.fillStyle = rgba(shade(deep, -0.3), 0.88 * c);
    ctx.fillRect(0, H * 0.5 - H * 0.24 * c, W, H * 0.48 * c);

    const b = ease(cl01((p - 0.52) / 0.38));
    ctx.globalAlpha = b;
    fitFont(name, H * 0.098, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    ctx.fillText(name, W / 2, H * 0.51);
    fitFont(tag, H * 0.031, 500);
    ctx.textBaseline = 'top';
    ctx.fillStyle = rgba(ink, 0.8);
    ctx.fillText(tag, W / 2, H * 0.545);
    ctx.globalAlpha = 1;

    if (logoImg) logo(W / 2, H * 0.3, H * 0.12, ease(cl01((p - 0.45) / 0.4)));
  }

  /* ---------------------------------------------------- */
  function setFont(px, w) { ctx.font = `${w} ${px}px "${font}", sans-serif`; }

  /* Punto yukseklige oranli hesaplaniyor; dikey formatta (9:16) genislik
     sinirlayici oluyor ve uzun isimler tuvali tasiyor. Sigmiyorsa kucult. */
  function fitFont(txt, px, w, maxFrac) {
    setFont(px, w);
    if (!txt) return px;
    const maxW = W * (maxFrac || 0.88);
    const m = ctx.measureText(txt).width;
    if (m > maxW) { px *= maxW / m; setFont(px, w); }
    return px;
  }

  function logo(cx, cy, h, a, align) {
    if (!logoImg || !logoImg.naturalWidth || a <= 0) return;
    const w = h * (logoImg.naturalWidth / logoImg.naturalHeight);
    ctx.globalAlpha = cl01(a);
    const x = align === 'left' ? cx - w / 2 : cx - w / 2;
    ctx.drawImage(logoImg, x, cy - h / 2, w, h);
    ctx.globalAlpha = 1;
  }
}
