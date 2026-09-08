# POS Apotek — Versi Diperiksa & Diperbaiki

## Kebutuhan
- Node.js 18+ (disarankan Node.js 20 LTS atau 22 LTS)
- VS Code (opsional, untuk mengedit source code)
- Browser modern: Chrome, Edge, Safari, Firefox

## Menjalankan di Windows
1. Extract ZIP.
2. Buka folder `project`.
3. Jalankan `JALANKAN-WINDOWS.bat`.
4. Tunggu `npm install` selesai.
5. Buka alamat Vite yang ditampilkan, biasanya `http://localhost:5173`.

Jika ingin melalui VS Code:
```bash
npm install
npm run dev
```

## Verifikasi sebelum deploy
```bash
npm run typecheck
npm run build
```

## Scanner
### Scanner USB/Bluetooth HID
Scanner yang berperilaku sebagai keyboard tidak membutuhkan driver khusus di aplikasi. Pilih **Scan Barcode → Scanner USB**, lalu scan barcode. Scanner sebaiknya dikonfigurasi mengirim tombol Enter setelah barcode.

### Kamera HP/iPhone/iPad
Gunakan **Scan Barcode → Kamera**. Browser harus diberi izin kamera dan website harus berjalan melalui HTTPS atau localhost.

## Printer
Aplikasi menggunakan dialog print browser/sistem. Ini kompatibel dengan printer yang sudah terpasang di Windows/macOS/iPadOS/Android.

- Struk kasir: thermal 58 mm.
- Etiket obat: 70 × 35 mm.
- Surat Pesanan: A4.
- Berita Acara/Penerimaan: A4.
- Laporan: ukuran mengikuti template laporan.

Pada iPad/iPhone, pilih printer AirPrint yang tersedia dari dialog cetak.

## Catatan penting
Aplikasi web tidak dapat menjamin printer USB tertentu mencetak tanpa dialog browser. Untuk pencetakan langsung tanpa dialog diperlukan aplikasi/bridge lokal atau integrasi printer khusus.

Source sudah diperiksa untuk:
- TypeScript compile check.
- Routing/menu utama.
- Scanner kamera + HID keyboard.
- Pencetakan yang tidak bergantung pada popup `window.open` untuk bagian yang sebelumnya menggunakannya.
- Layout mobile/tablet/iPad.

Uji fisik printer dan kamera tetap perlu dilakukan pada perangkat/printer yang benar-benar digunakan di apotek.

## Migrasi database untuk pembulatan manual

Versi ini menambahkan kolom `sales.rounding_amount`. Jika database Supabase Anda sudah digunakan, jalankan migration berikut melalui SQL Editor Supabase:

`supabase/migrations/20260907000100_add_sale_rounding.sql`

Aplikasi tetap memiliki fallback agar transaksi tidak langsung gagal jika migration belum dijalankan, tetapi nilai pembulatan baru tidak akan tersimpan sampai kolom tersebut tersedia.


### Pembulatan / Penyesuaian Manual
Versi ini menyimpan nominal pada `sales.rounding_amount` dan keterangan pada `sales.rounding_note`. Jalankan dua migration terbaru di Supabase SQL Editor jika migration belum diterapkan.
