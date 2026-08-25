# CleanStream Laundry (Laundry On-Demand)

Aplikasi laundry **pickup & delivery**.

| Peran | URL | Demo (password: `password123`) |
|--------|-----|--------------------------------|
| Customer | `/home` | `082222222222` |
| Admin | `/admin` | `081111111111` |

### SaaS platform fee

- **Rp 1.500** per transaksi (pembayaran pertama order berhasil) — ditetapkan **developer** lewat env `PLATFORM_FEE_PER_ORDER` (bukan admin outlet)
- Akumulasi per bulan, jatuh tempo **akhir bulan**
- Jika invoice bulan sebelumnya belum dibayar → **sistem terkunci** (order baru & operasi dihentikan)
- Admin outlet hanya melihat tagihan & menandai lunas di **Tagihan SaaS** (`/admin/billing`)

Kurir digabung ke portal admin (logistik jemput/antar).

## Tech

- Next.js 16 + TypeScript + Tailwind 4  
- Prisma + **SQLite**  
- JWT cookie auth  

## Lokal (development)

```bash
# 1. Install
npm install

# 2. Env
copy .env.example .env
# Windows PowerShell: Copy-Item .env.example .env

# 3. Database + data demo
npx prisma migrate dev
npm run db:seed

# 4. Jalankan
npm run dev
```

Buka http://localhost:3000

### Script berguna

| Command | Fungsi |
|---------|--------|
| `npm run dev` | Development |
| `npm run build` | Production build |
| `npm start` | Jalankan hasil build |
| `npm run setup` | Migrate + seed (server/VPS) |
| `npm run db:deploy` | Apply migration (production) |
| `npm run db:seed` | Isi data demo |
| `npm run deploy:check` | Cek build sebelum deploy |

---

## Deploy (pilih satu)

### A) Docker Compose (paling mudah)

Butuh Docker Desktop / Docker Engine.

```bash
# Set secret (penting)
# PowerShell:
$env:JWT_SECRET="rahasia-panjang-acak-minimal-32-karakter"

docker compose up -d --build
```

App: http://localhost:3000  

Database SQLite disimpan di volume Docker `laundry_data`.

Seed data demo (sekali):

```bash
docker compose exec app npx tsx prisma/seed.ts
```

Stop:

```bash
docker compose down
```

### B) VPS / server Node (Ubuntu, dll.)

```bash
# Node 20+
git clone <repo-anda> cleanstream
cd cleanstream
cp .env.example .env
# Edit .env → JWT_SECRET yang kuat
# DATABASE_URL="file:./prod.db"

npm ci
npm run build
npm run setup          # migrate + seed (opsional seed)
npm start              # port 3000
```

Disarankan pakai **PM2** atau reverse proxy **Nginx**:

```bash
npm i -g pm2
pm2 start npm --name cleanstream -- start
pm2 save
```

### C) Hosting serverless (Vercel / Netlify)

**Tidak disarankan** untuk setup ini karena memakai **SQLite file** (filesystem tidak persisten di serverless).  
Jika ingin Vercel, ganti database ke **PostgreSQL / Neon / Supabase** dan ubah `prisma/schema.prisma` provider ke `postgresql`.

---

## Environment

| Variable | Wajib | Keterangan |
|----------|-------|------------|
| `DATABASE_URL` | Ya | `file:./dev.db` lokal; `file:./prod.db` di server |
| `JWT_SECRET` | Ya (prod) | String acak panjang; **jangan** pakai default |
| `PLATFORM_FEE_PER_ORDER` | Tidak | Fee SaaS per order selesai (default `1500`); **developer only** |
| `NEXT_PUBLIC_APP_NAME` | Tidak | Nama app di klien |
| `PORT` | Tidak | Default 3000 |

---

## Alur bisnis singkat

1. Customer pilih layanan + alamat → bayar ongkir (laundry dihitung setelah timbang)  
2. Admin jemput → terima outlet → timbang → customer bayar laundry  
3. Proses cuci → antar → selesai → rating  

Harga & ongkir dihitung di **server** (bukan frontend).

---

## Struktur proyek

```text
src/app/          # Halaman + API
src/components/   # UI shell
src/lib/          # auth, pricing, order, distance
src/i18n/         # ID / EN
prisma/           # schema + migrations + seed
Dockerfile        # image production
docker-compose.yml
```

---

## Cek sebelum go-live

1. [ ] `JWT_SECRET` diganti (bukan `change-me...`)  
2. [ ] `npm run build` sukses  
3. [ ] Hapus / nonaktifkan akun demo jika production publik  
4. [ ] HTTPS (Nginx / Cloudflare)  
5. [ ] Backup file SQLite (`prod.db`) berkala  

---

## Isi demo setelah seed

- Layanan cuci / setrika / express  
- Outlet + pricing default  
- Promo contoh  
- Alamat customer demo  
