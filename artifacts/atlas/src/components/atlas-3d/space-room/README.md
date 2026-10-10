# ATLAS uzay odası entegrasyonu

Kullanıcının sağladığı ATLAS sahne paketinin Room, Skyline, Holograms, CameraRig ve bunların yardımcıları mevcut ATLAS 3D görüntüleyicisine aktarılmıştır. Paketin bağımsız App/main/index dosyaları veya global CSS'i kullanılmaz. Mevcut uygulamada yalnız bir React Three Fiber Canvas bulunur.

## Kullanıcının istediği değişiklikler

- Fiziksel sandalyeler kaldırıldı.
- Siyah masa, oda geometrisi, uzay görseli ve yedi masa hologram yuvası korundu.
- Masanın arkasında, oval kenarı takip eden MIRA, NOVA, ATLAS, VEX, LUNA, ORION alanları ve farklı renkte neon arka ışıkları bulunur. ATLAS arka merkezde durur; ışıklar masa merkezine yönelir. Gerçek model de aynı arka merkez konumunu kullanır.
- Kamera ayakta alanlarını kapsayacak şekilde ayarlandı; sinematik, masa üstü ve serbest bakış seçenekleri korundu.
- Görsel hologramlar dekoratiftir, kullanıcı/CRM/finans kayıtları değildir. Sahne store'u kişisel verileri veya localStorage'ı okumaz/yazmaz.

## Gerçek karakterler

Kaynak pakette karakter yoktur. Kullanıcı yalnız sabit ayakta karakterler istiyor; iskelet veya animasyon şartı yoktur. Mevcut GLB sağlayıcısı gerçek dosyayı yükler, kaynak pozu ve kostüm korunur. Dosyada animasyon varsa oynatılmaz. Ayakta poz dosyanın kendisinde hazırlanmış olmalıdır; oturan bir model otomatik ayağa kaldırılmaz. Diğer uzman alanları gerçek modeller sağlanana kadar boş kalır.

Gerçek modeller olmadan kostüm ve beden–masa çakışması kontrolü tamamlandı sayılmaz. Ses/Claude akışı değişmez; ses durumunda yalnız mevcut ışık/dalga durumu değişebilir, karakter bedeni sabittir.

## Grafik desteği ve sınırlar

Mobilde ve yazılımsal WebGL ortamında başlangıç kalitesi azaltılır. Yazılımsal renderer için küçük piksel bütçesi ve düşük yenileme sıklığı kullanılır; bu fiziksel telefon performansı ölçümü değildir. Donanımlı masaüstünde yumuşak gölgeler/çevresel yansımalar etkinleşir. WebGL açılamazsa anlaşılır hata gösterilir, sahte karakter çizilmez. Hesap, Claude, ses ve kayıt davranışları host uygulamanın mevcut akışlarında kalır.

Uzay görseli kaynak ve lisans bilgileri: `src/assets/atlas-space/ASSET-CREDITS.md`.
