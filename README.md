# Kesit — tarayıcıda çalışan website tanıtım videosu editörü

Marka bilgilerini bir kere gir, şablonu seç, videonu indir.
Kurulum yok, derleme yok, sunucu yok, hesap yok. Altı statik dosya.
Hiçbir dış kütüphane kullanmaz — tamamen tarayıcının kendi API'leri
(Canvas, WebAudio, MediaRecorder).

## Çalıştırma
`index.html`'e çift tıkla (tanıtım sayfası) veya doğrudan `editor.html`'i aç.
Chrome ya da Edge kullan — Firefox'ta canvas kaydı sorunlu.

## Dosyalar
```
index.html      ürün tanıtım (landing) sayfası
editor.html     editörün kendisi
app.js          motor: render, oynatma, ses grafiği, dışa aktarma
visuals.js      palet çıkarma, arka plan zeminleri, açılış klipleri
templates.js    tanıtım videosu şablonları
style.css       editör arayüzü
landing.css     tanıtım sayfası
```

## Ekran kaydı
Üst çubuktaki **Ekran kaydet**: tarayıcı hangi sekmeyi/ekranı paylaşacağını sorar,
sitenizi gezersiniz, **Kaydı bitir**'e basınca kayıt klip olarak timeline'a düşer.
Harici program gerekmez (`getDisplayMedia` API'si). Sekme sesi de kaydedilir.

## Açılış klibi
Videonun önüne, marka bilgilerinden **çizilen** animasyonlu bir açılış konur —
dosya değil, her karesi canlı hesaplanan bir çizim. Şablon seçtiğinde kendiliğinden
eklenir; elle eklemek için timeline'da boş bir yere tıkla (seçim kalkar) ve sağdaki
**Sahne** panelinden *Açılış klibi ekle*.

| Stil | Kurgu |
|---|---|
| Perde Açılışı | Çizgi ortadan açılır, isim arkasından çıkar |
| Kayan Blok | Renk bloğu yandan geçer, isim ve slogan ters yönden gelir |
| Nabız | Merkezden halkalar yayılır, logo büyüyerek yerine oturur |
| Çubuklar | Paletten renkli çubuklar iner, isim üstüne oturur |

### Renk paleti
Timeline'a video eklendiğinde Kesit bir kare alır, baskın renkleri kutulara bölerek
çıkarır ve açılış ile arka planları o paletle çizer — açılış, asıl görüntüyle aynı
dünyaya ait görünür. Palet **Sahne** panelinden *Videodan yenile* / *Markaya dön*
ile değiştirilebilir. Video yoksa marka vurgu rengi kullanılır.

## Arka plan zeminleri
Kliplerin altında duran üretilmiş zemin. Videon olmadan da ortada bir görüntü olur.
Marka renginden (ya da videodan çıkan paletten) türetilir: **Işık lekeleri**,
**Akan gradyan**, **Perspektif ızgara**, **Parçacıklar**, **Dalgalar**.
Şablon seçince kendiliğinden ayarlanır; **Sahne** panelinden değiştirilir.

## Kendi sitene koymak
Altı dosyayı sitenin bir klasörüne at (`/editor/`), `siten.com/editor/` adresinden açılır.
Statik hosting yeter: Vercel, Netlify, GitHub Pages, cPanel — hepsi çalışır.
Videolar kullanıcının kendi bilgisayarında işlenir, hiçbir dosya sunucuya gitmez.

Markayı sabitlemek istersen `app.js` içindeki `defBrand()` fonksiyonunu düzenle;
editör her açıldığında senin bilgilerinle gelir.

## Marka profili
**Marka** sekmesinde: site adı, slogan, adres, çağrı metni, üç özellik, logo,
vurgu rengi, yazı rengi ve yazı tipi. Tarayıcının `localStorage`'ında saklanır.

Birden çok müşteriyle çalışıyorsan **Profili indir** ile JSON olarak kaydet,
sonra **Profil yükle** ile geri getir. Her müşteri için bir dosya.

## Şablonlar
| Şablon | Format | Süre | Açılış | Zemin | Kurgu |
|---|---|---|---|---|---|
| Klasik Tanıtım | 16:9 | ~18 sn | Perde | Işık lekeleri | Üç özellik alt bantta → kapanış çağrısı |
| Sosyal Vitrin | 9:16 | ~15 sn | Çubuklar | Parçacıklar | Dikey, hızlı kesme (Reels/TikTok/Shorts) |
| Minimal | 16:9 | ~12 sn | Perde | Akan gradyan | Slogan ve adres — az yazı |
| Özellik Turu | 16:9 | ~24 sn | Kayan blok | Izgara | Numaralı 01/02/03 (SaaS, panel) |
| Lansman Duyurusu | 1:1 | ~10 sn | Nabız | Dalgalar | "Yayında" duyurusu, kampanya |

Şablon uygulandığında en-boy oranı, açılış klibi ve arka plan zemini kendiliğinden
ayarlanır. Timeline'da videon varsa metinler onun uzunluğuna yayılır; yoksa şablonun
kendi süresi kullanılır. Açılış klibi varken şablon kendi açılış başlığını koymaz —
o işi intro yapar. Mevcut metin ve grafik katmanları silinir (onay sorulur), video
ve ses kalır.

### Yeni şablon yazmak
`templates.js` içine bir nesne ekle:

```js
{
  id: 'benimki',
  name: 'Benim Kurgum',
  desc: 'Panelde görünecek açıklama.',
  ratio: '1920x1080',
  defaultDur: 15,
  swatch: ['#1b2a44', '#4f8cff'],   // kart rengi
  intro: 'reveal',                   // açılış stili: reveal|slide|pulse|bars
  introDur: 3.2,
  backdrop: 'mesh',                  // none|mesh|flow|grid|bokeh|waves
  build(b, T, o) {                   // b = marka, T = süre, o.intro = açılış var mı
    return {
      texts: [
        { text: b.tagline, start: 0, dur: T * 0.3, x: 50, y: 50, size: 8,
          weight: 900, color: b.ink, bg: b.accent, bgOn: true,
          font: b.font, align: 'center' },
      ],
      logo: { x: 90, y: 10, size: 11, start: 0, dur: T },
      trans: 'cross', transDur: 0.8,
    };
  },
}
```
`start` değerleri açılış klibine göre değil, **açılıştan sonrasına** göredir —
kaydırmayı `applyTemplate` yapar.
`x`, `y`, `size` yüzde cinsindendir (`size` ekran yüksekliğine oranlı).

## Editör
**Kesme & birleştirme** — Çoklu klip, timeline'da yan yana dizilir. Kenardan çekerek
kırp, ortadan tutup sürükleyerek sırayı değiştir, `S` ile playhead'den böl.

**Metin & altyazı** — Yazı tipi, boyut, kalınlık, renk, arka plan kutusu, hizalama,
serbest konum. Altyazı için: her replik bir katman, dikey ~85%.

**Grafik / logo** — PNG yükle, konum-boyut-saydamlık ayarla. Şablonlar marka logonu
otomatik yerleştirir.

**Ses** — Ayrı müzik şeridi, fade in/out, parça içi kaydırma. Video kliplerin kendi
sesi klip başına ayarlanır (0 = sustur).

**Efekt & geçişler** — Parlaklık, kontrast, doygunluk, siyah-beyaz, sepya, bulanıklık,
hız 0.25x–4x. Geçiş: karartma veya çapraz geçiş.

## Kısayollar
| Tuş | İş |
|---|---|
| `Space` | Oynat / duraklat |
| `←` `→` | Kare kare ilerle (Shift ile 1 saniye) |
| `S` | Seçili klibi böl |
| `Delete` | Seçili öğeyi sil |

## Bilinmesi gerekenler
- **Dışa aktarma gerçek zamanlıdır.** 2 dakikalık video 2 dakikada kaydedilir; kayıt
  sırasında sekmeyi arka plana alma, tarayıcı render'ı yavaşlatır ve kareler düşer.
- Çıktı **WebM** formatındadır. Instagram, YouTube, TikTok, WhatsApp kabul eder.
  MP4 gerekiyorsa VLC veya HandBrake ile saniyeler içinde dönüştürülür.
- Her şey tarayıcı belleğinde döner — 4K veya 10 dakika üstü kaynaklarda ağırlaşır.
- Timeline kaydedilmez: sekmeyi kapatınca sıfırlanır. Kalıcı olan tek şey marka profili.
