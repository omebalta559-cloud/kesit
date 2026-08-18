/* =========================================================
   Website tanıtım videosu şablonları

   build(b, T, o):
     b = marka bilgileri
     T = metin katmanlarının yayılacağı süre (açılış klibi hariç)
     o = { intro: true/false } — açılış klibi eklendiyse şablon
         kendi açılış başlığını koymaz, o işi intro yapar.

   Metin alanları:
     anim : fade | up | down | left | right | scale | pop | wipe | words
     band : true ise koyu şerit + marka renginde dikey aksan
     bgOn : true ise yuvarlak köşeli yarı saydam kutu

   Şablon alanları:
     decor : { frame, corners, bar, tab, split:'left'|'right' }
     zoom  : klip boyunca yavaş yakınlaşma oranı (0 = kapalı)
   ========================================================= */

const TEMPLATES = [

/* ---------- 1. Klasik Tanıtım ---------- */
{
  id: 'classic',
  name: 'Klasik Tanıtım',
  desc: 'Açılış → üç özellik alt bantta → kapanış çağrısı. Kurumsal ve güvenli.',
  ratio: '1920x1080',
  defaultDur: 18,
  intro: 'reveal',
  introDur: 3.2,
  backdrop: 'mesh',
  decor: { corners: true, bar: true, tab: true },
  zoom: 0.08,
  swatch: ['#1b2a44', '#4f8cff'],
  build(b, T, o) {
    const A = o.intro ? 0 : T * 0.22;
    const C = T * 0.24;
    const each = (T - A - C) / 3;
    const texts = [];

    if (!o.intro) {
      texts.push(
        { text: b.name, start: 0, dur: A, x: 50, y: 44, size: 9, weight: 900, anim: 'scale',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
        { text: b.tagline, start: 0.4, dur: A - 0.4, x: 50, y: 56, size: 3.6, weight: 400, anim: 'up',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      );
    }
    [b.f1, b.f2, b.f3].forEach((f, i) => {
      const s = A + each * i;
      texts.push(
        { text: '0' + (i + 1), start: s, dur: each - 0.2, x: 6, y: 77, size: 2.6, weight: 800,
          anim: 'left', color: b.accent, bg: '#000000', bgOn: false, font: b.font, align: 'left' },
        { text: f, start: s + 0.12, dur: each - 0.32, x: 6, y: 85, size: 4.2, weight: 700,
          anim: 'left', band: true, color: b.ink, bg: b.accent, font: b.font, align: 'left' },
      );
    });
    texts.push(
      { text: b.cta, start: T - C, dur: C, x: 50, y: 45, size: 6.2, weight: 800, anim: 'scale',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      { text: b.url, start: T - C + 0.35, dur: C - 0.35, x: 50, y: 58, size: 3.8, weight: 700,
        anim: 'up', band: true, color: b.ink, bg: b.accent, font: b.font, align: 'center' },
    );
    return { texts, logo: { x: 90, y: 10, size: 11, start: 0, dur: T }, trans: 'cross', transDur: 0.8 };
  },
},

/* ---------- 2. Sosyal Vitrin (dikey) ---------- */
{
  id: 'social',
  name: 'Sosyal Vitrin',
  desc: 'Dikey 9:16, hızlı kesmeler, büyük yazı. Reels, TikTok ve Shorts için.',
  ratio: '1080x1920',
  defaultDur: 15,
  intro: 'bars',
  introDur: 2.4,
  backdrop: 'bokeh',
  decor: { bar: true, tab: true },
  zoom: 0.14,
  swatch: ['#2d1b44', '#c05cf0'],
  build(b, T, o) {
    const A = o.intro ? 0 : T * 0.2;
    const C = T * 0.22;
    const each = (T - A - C) / 3;
    const texts = [];

    if (!o.intro) {
      texts.push(
        { text: b.name, start: 0, dur: A, x: 50, y: 38, size: 8, weight: 900, anim: 'pop',
          color: b.ink, bg: b.accent, bgOn: true, font: b.font, align: 'center' },
        { text: b.tagline, start: 0.3, dur: A - 0.3, x: 50, y: 50, size: 3.4, weight: 500, anim: 'up',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      );
    }
    [b.f1, b.f2, b.f3].forEach((f, i) => {
      texts.push({ text: f, start: A + each * i, dur: each - 0.1, x: 50, y: 50, size: 6.2,
        weight: 800, anim: 'words', color: b.ink, bg: '#000000', bgOn: true, font: b.font, align: 'center' });
    });
    texts.push(
      { text: b.cta, start: T - C, dur: C, x: 50, y: 45, size: 6.5, weight: 900, anim: 'pop',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      { text: b.url, start: T - C + 0.2, dur: C - 0.2, x: 50, y: 55, size: 3.6, weight: 700,
        anim: 'up', band: true, color: b.ink, bg: b.accent, font: b.font, align: 'center' },
    );
    return { texts, logo: { x: 50, y: 12, size: 26, start: 0, dur: T }, trans: 'fade', transDur: 0.35 };
  },
},

/* ---------- 3. Minimal ---------- */
{
  id: 'minimal',
  name: 'Minimal',
  desc: 'Üç vuruş: isim, slogan, adres. Yazı az, görüntü önde. Portfolyo ve ajans işleri için.',
  ratio: '1920x1080',
  defaultDur: 12,
  intro: 'reveal',
  introDur: 3.6,
  backdrop: 'flow',
  decor: {},
  zoom: 0.05,
  swatch: ['#111111', '#e8e8e8'],
  build(b, T, o) {
    const texts = [];
    if (!o.intro) {
      texts.push(
        { text: b.name, start: T * 0.08, dur: T * 0.26, x: 50, y: 50, size: 7.5, weight: 300, anim: 'wipe',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
        { text: b.tagline, start: T * 0.42, dur: T * 0.26, x: 50, y: 50, size: 4.2, weight: 300, anim: 'fade',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      );
    } else {
      texts.push(
        { text: b.tagline, start: T * 0.3, dur: T * 0.3, x: 50, y: 50, size: 4.2, weight: 300, anim: 'fade',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      );
    }
    texts.push(
      { text: b.url, start: T * 0.76, dur: T * 0.24, x: 50, y: 50, size: 4.6, weight: 600, anim: 'wipe',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
    );
    return {
      texts,
      logo: { x: 50, y: 32, size: 10, start: T * 0.76, dur: T * 0.24 },
      trans: 'fade', transDur: 1,
    };
  },
},

/* ---------- 4. Özellik Turu ---------- */
{
  id: 'tour',
  name: 'Özellik Turu',
  desc: 'Numaralı 01 / 02 / 03 bölümler. Ekran kaydıyla ürün gezdirmek için birebir.',
  ratio: '1920x1080',
  defaultDur: 24,
  intro: 'slide',
  introDur: 3,
  backdrop: 'grid',
  decor: { corners: true, bar: true, tab: true, frame: true },
  zoom: 0.06,
  swatch: ['#12352b', '#2f8f6b'],
  build(b, T, o) {
    const A = o.intro ? 0 : T * 0.16;
    const C = T * 0.18;
    const each = (T - A - C) / 3;
    const texts = [];

    if (!o.intro) {
      texts.push(
        { text: b.name, start: 0, dur: A, x: 50, y: 48, size: 8, weight: 800, anim: 'scale',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
        { text: b.tagline, start: 0.3, dur: A - 0.3, x: 50, y: 59, size: 3.4, weight: 400, anim: 'up',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      );
    }
    [b.f1, b.f2, b.f3].forEach((f, i) => {
      const s = A + each * i;
      texts.push(
        { text: '0' + (i + 1), start: s, dur: each - 0.15, x: 6, y: 74, size: 7, weight: 900,
          anim: 'pop', color: b.accent, bg: '#000000', bgOn: false, font: b.font, align: 'left' },
        { text: f, start: s + 0.2, dur: each - 0.35, x: 6, y: 86, size: 4, weight: 600,
          anim: 'left', band: true, color: b.ink, bg: b.accent, font: b.font, align: 'left' },
      );
    });
    texts.push(
      { text: b.cta, start: T - C, dur: C, x: 50, y: 45, size: 5.5, weight: 800, anim: 'scale',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      { text: b.url, start: T - C + 0.25, dur: C - 0.25, x: 50, y: 57, size: 3.8, weight: 600,
        anim: 'up', band: true, color: b.ink, bg: b.accent, font: b.font, align: 'center' },
    );
    return { texts, logo: { x: 91, y: 89, size: 9, start: 0, dur: T }, trans: 'cross', transDur: 0.5 };
  },
},

/* ---------- 5. Lansman Duyurusu (kare) ---------- */
{
  id: 'launch',
  name: 'Lansman Duyurusu',
  desc: 'Kare 1:1, kısa ve yüksek sesli. Yayında duyurusu, kampanya ve reklam için.',
  ratio: '1080x1080',
  defaultDur: 10,
  intro: 'pulse',
  introDur: 2.6,
  backdrop: 'waves',
  decor: { frame: true, bar: true },
  zoom: 0.16,
  swatch: ['#44140f', '#ff6a3d'],
  build(b, T, o) {
    const texts = [];
    if (!o.intro) {
      texts.push(
        { text: 'YAYINDA', start: 0, dur: T * 0.32, x: 50, y: 42, size: 8, weight: 900, anim: 'pop',
          color: b.ink, bg: b.accent, bgOn: true, font: b.font, align: 'center' },
        { text: b.name, start: T * 0.1, dur: T * 0.22, x: 50, y: 56, size: 5, weight: 600, anim: 'up',
          color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      );
    }
    texts.push(
      { text: b.tagline, start: T * 0.06, dur: T * 0.34, x: 50, y: 50, size: 5.5, weight: 700, anim: 'words',
        color: b.ink, bg: '#000000', bgOn: true, font: b.font, align: 'center' },
      { text: b.cta, start: T * 0.5, dur: T * 0.5, x: 50, y: 44, size: 6, weight: 900, anim: 'pop',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      { text: b.url, start: T * 0.56, dur: T * 0.44, x: 50, y: 56, size: 4, weight: 700, anim: 'up',
        band: true, color: b.ink, bg: b.accent, font: b.font, align: 'center' },
    );
    return { texts, logo: { x: 50, y: 16, size: 22, start: 0, dur: T }, trans: 'fade', transDur: 0.4 };
  },
},

/* ---------- 6. Kinetik Tipografi ---------- */
{
  id: 'kinetic',
  name: 'Kinetik Tipografi',
  desc: 'Kelimeler sırayla patlayarak giriyor, yazılar dönüşümlü olarak iki yandan geliyor. Yazının kendisi gösteri.',
  ratio: '1920x1080',
  defaultDur: 16,
  intro: 'bars',
  introDur: 2.2,
  backdrop: 'flow',
  decor: { bar: true, corners: true },
  zoom: 0.12,
  swatch: ['#2b0f3a', '#f04c8c'],
  build(b, T, o) {
    const texts = [];
    const C = T * 0.26;
    const govde = T - C;
    const parca = govde / 4;

    // slogan kelime kelime açılıyor
    texts.push({ text: b.tagline, start: 0.1, dur: parca - 0.15, x: 50, y: 46, size: 7, weight: 900,
      anim: 'words', color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' });

    // üç özellik dönüşümlü olarak soldan ve sağdan
    [b.f1, b.f2, b.f3].forEach((f, i) => {
      const solda = i % 2 === 0;
      texts.push({
        text: f, start: parca * (i + 1), dur: parca - 0.15,
        x: solda ? 8 : 92, y: 40 + i * 9, size: 5.4, weight: 900,
        anim: solda ? 'left' : 'right',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font,
        align: solda ? 'left' : 'right',
      });
    });

    texts.push(
      { text: b.cta, start: T - C, dur: C, x: 50, y: 44, size: 8, weight: 900, anim: 'pop',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      { text: b.url, start: T - C + 0.4, dur: C - 0.4, x: 50, y: 58, size: 3.8, weight: 700,
        anim: 'wipe', band: true, color: b.ink, bg: b.accent, font: b.font, align: 'center' },
    );
    return { texts, logo: { x: 90, y: 11, size: 10, start: 0, dur: T }, trans: 'fade', transDur: 0.3 };
  },
},

/* ---------- 7. Bölünmüş Ekran ---------- */
{
  id: 'split',
  name: 'Bölünmüş Ekran',
  desc: 'Sol yanda renk bloğu ve yazılar, sağda görüntü. Ekran kaydını çerçeveleyen düzenli bir kurgu.',
  ratio: '1920x1080',
  defaultDur: 20,
  intro: 'slide',
  introDur: 2.8,
  backdrop: 'mesh',
  decor: { split: 'left', bar: true, tab: true },
  zoom: 0.07,
  swatch: ['#0f2233', '#39b6d8'],
  build(b, T, o) {
    const C = T * 0.2;
    const govde = T - C;
    const each = govde / 3;
    const texts = [];
    const X = 4;                       // sol blogun icinde, kenardan %4

    texts.push({ text: b.name, start: 0, dur: govde, x: X, y: 22, size: 4.6, weight: 900,
      anim: 'left', color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'left' });

    [b.f1, b.f2, b.f3].forEach((f, i) => {
      texts.push({
        text: f, start: each * i + 0.2, dur: each - 0.25,
        x: X, y: 46, size: 3.4, weight: 600, anim: 'up',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'left',
      });
    });

    texts.push(
      { text: b.cta, start: T - C, dur: C, x: X, y: 44, size: 4.4, weight: 900, anim: 'pop',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'left' },
      { text: b.url, start: T - C + 0.3, dur: C - 0.3, x: X, y: 54, size: 2.8, weight: 700,
        anim: 'left', band: true, color: b.ink, bg: b.accent, font: b.font, align: 'left' },
    );
    return { texts, logo: { x: 12, y: 82, size: 14, start: 0, dur: T }, trans: 'cross', transDur: 0.6 };
  },
},

/* ---------- 8. Hızlı Vitrin ---------- */
{
  id: 'flash',
  name: 'Hızlı Vitrin',
  desc: 'Sekiz saniye, kare format, çok hızlı ritim. Ücretli reklam ve ilk saniyede dikkat çekmek için.',
  ratio: '1080x1080',
  defaultDur: 8,
  intro: 'pulse',
  introDur: 1.6,
  backdrop: 'bokeh',
  decor: { frame: true, bar: true, corners: true },
  zoom: 0.2,
  swatch: ['#3a2408', '#ffb020'],
  build(b, T, o) {
    const texts = [];
    const C = T * 0.34;
    const each = (T - C) / 3;

    [b.f1, b.f2, b.f3].forEach((f, i) => {
      texts.push({
        text: f, start: each * i, dur: each - 0.05,
        x: 50, y: 48, size: 6.4, weight: 900, anim: 'pop',
        color: b.ink, bg: '#000000', bgOn: true, font: b.font, align: 'center',
      });
    });

    texts.push(
      { text: b.cta, start: T - C, dur: C, x: 50, y: 42, size: 8, weight: 900, anim: 'pop',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      { text: b.url, start: T - C + 0.25, dur: C - 0.25, x: 50, y: 56, size: 4.2, weight: 800,
        anim: 'up', band: true, color: b.ink, bg: b.accent, font: b.font, align: 'center' },
    );
    return { texts, logo: { x: 50, y: 18, size: 20, start: 0, dur: T }, trans: 'fade', transDur: 0.2 };
  },
},

/* ---------- 9. Sakin Kurumsal ---------- */
{
  id: 'calm',
  name: 'Sakin Kurumsal',
  desc: 'Yavaş geçişler, ince çerçeve, az yazı. Finans, hukuk ve danışmanlık gibi ciddi işler için.',
  ratio: '1920x1080',
  defaultDur: 22,
  intro: 'reveal',
  introDur: 4,
  backdrop: 'flow',
  decor: { frame: true, tab: true },
  zoom: 0.04,
  swatch: ['#14202e', '#8aa4c8'],
  build(b, T, o) {
    const C = T * 0.24;
    const govde = T - C;
    const each = govde / 3;
    const texts = [];

    [b.f1, b.f2, b.f3].forEach((f, i) => {
      texts.push({
        text: f, start: each * i + 0.3, dur: each - 0.5,
        x: 50, y: 84, size: 3.4, weight: 500, anim: 'wipe',
        band: true, color: b.ink, bg: b.accent, font: b.font, align: 'center',
      });
    });

    texts.push(
      { text: b.cta, start: T - C, dur: C, x: 50, y: 46, size: 5, weight: 600, anim: 'fade',
        color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
      { text: b.url, start: T - C + 0.6, dur: C - 0.6, x: 50, y: 57, size: 3.4, weight: 600,
        anim: 'fade', color: b.ink, bg: '#000000', bgOn: false, font: b.font, align: 'center' },
    );
    return { texts, logo: { x: 90, y: 11, size: 10, start: 0, dur: T }, trans: 'fade', transDur: 1.2 };
  },
},

];
