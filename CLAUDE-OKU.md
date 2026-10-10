# ATLAS — Claude için güncel proje paketi

Bu paket mevcut ATLAS uygulamasının kaynak kopyasıdır; yeni veya bağımsız bir örnek değildir.

## Claude'a iletilecek talimat
Mevcut ATLAS kaynaklarını incele ve yalnız istediğim değişikliği yap. Mevcut uygulama girişini, hesapları, Claude bağlantısını, sesli asistanı, kullanıcı verilerini ve şifreli anahtar düzenini koru. Yeni uygulama veya alternatif oda üretme. İznim olmadan veritabanı migration/push, canlı Claude çağrısı veya yayınlama yapma.

## Güncel görsel kararlar
- Kullanıcının yüklediği sandalyesiz neon oda kaynakları entegre edilmiştir.
- Altı gerçek GLB: ATLAS, MIRA, NOVA, VEX, LUNA ve ORION. Bunlar sabit ayakta modellerdir; iskelet animasyonu veya dudak senkronu varmış gibi sunma.
- Karakterler masanın arkasındaki oval yerleşimde kalır; sandalye ve hologram kullanılmaz.
- Dik neon arkalık çerçeveleri kaldırılmıştır.
- Karakterlerin görünen isim ve rol etiketleri kaldırılmıştır; erişilebilir seçim adları ve sesle hitap korunur.
- Arka plan içindeki ATLAS marka yazısı korunur.
- Altı karakter kadrajda kalsın diye mevcut kamera mesafesi, odak/sıfırlama ve mobil kontrol davranışı korunmuştur.

## Dosya haritası
- artifacts/atlas: React/Vite frontend, gerçek oda, altı GLB ve arka plan.
- artifacts/atlas/src/components/atlas-3d: 3D deneyim, yükleyici ve kamera bağlantıları.
- artifacts/atlas/src/components/atlas-3d/space-room: oda, masa, arka plan ve karakter yerleşimi.
- artifacts/api-server: hesap, Claude Messages API, şifreleme ve uygulama endpoint kaynakları.
- lib/db: ORM ve şema tanımları; veritabanı içeriği DEĞİLDİR.
- lib/api-spec, lib/api-client-react, lib/api-zod: API sözleşmesi ve üretilmiş istemci kodu.
- tests ve scripts: mevcut kontroller; scripts/post-merge.sh veritabanı push içerir, otomatik çalıştırma.

## Hariç tutulanlar
Gerçek ortam değişkenleri, .env dosyaları, gizli anahtarlar, kullanıcı veritabanı/kayıtları, oturum çerezleri, kişisel model deposu, loglar, sohbet ekleri, node_modules, derleme çıktıları ve başka tasarım sandbox'ı dahil değildir. Replit'e özgü servis/ortam dosyaları da dışarıda tutulmuştur. Bu ZIP bir üretim veri yedeği değildir; hesap/Claude bağlantısının mevcut gizli değerlerini başka ortama taşımaz.

## Kurulum ve kontrol
Node.js 24 ve pnpm kullan. Bağımlılıklar: pnpm install --frozen-lockfile
Frontend tipi: pnpm --filter @workspace/atlas run typecheck
Frontend geliştirme: PORT=20388 BASE_PATH=/ pnpm --filter @workspace/atlas run dev
Frontend derleme: PORT=20388 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/atlas run build
API geliştirme: PORT=8080 pnpm --filter @workspace/api-server run dev
API mevcut ortamın güvenli secret ayarlarına ve PostgreSQL bağlantısına ihtiyaç duyar. Eksik anahtarları kod içine yazma. Mevcut şifreli kayıtlar varsa SESSION_SECRET değerini değiştirme.

Yeni oda entegrasyonu masaüstü/mobil Chromium boyutlarında ve derlemede kontrol edildi. En son etiket kaldırma için TypeScript kontrolü geçti. Gerçek iPhone/Safari ve fiziksel GPU performansı doğrulanmadı. Bu aktarımda yayınlama yapılmadı.

MANIFEST.json her dosyanın byte sayısını ve SHA-256 özetini içerir.
