# POS APOTEK - Revisi 1-10

Perubahan pada versi ini:
1. Penjualan umum: diskon per item.
2. Penjualan resep: tidak menampilkan No. SIP dokter.
3. Semua penjualan: pembulatan manual.
4. Keranjang kasir: area scroll dan tampilan item diperbaiki untuk layar kecil/besar.
5. Printer thermal: layout 58 mm diperbaiki.
6. Input angka stok/harga dapat dikosongkan dan diganti tanpa dipaksa menjadi 0.
7. Satuan obat mendukung satuan custom/manual.
8. Sistem print dipusatkan menggunakan jendela print baru untuk menghindari iframe + delay lama.
9. Form Edit Obat & Stok diperbaiki (state satuan custom tidak lagi undefined).
10. Penjualan umum tidak menampilkan field Dokter; Dokter hanya muncul pada Resep/Penjualan Dokter.

## Menjalankan

npm install
npm run dev

## Pemeriksaan source

Syntax TS/TSX untuk file yang diubah telah diperiksa menggunakan TypeScript transpilation dan tidak menghasilkan diagnostic sintaks.

## Catatan printer

Browser tetap menampilkan print preview milik sistem operasi. Pastikan pop-up untuk alamat aplikasi diizinkan. Sistem baru membuka dokumen cetak secara langsung dari aksi tombol agar lebih kompatibel dengan Chrome, Edge, Safari, iPhone, iPad, dan Android.

## Supabase

Jika migration pembulatan belum dijalankan, jalankan:
`supabase/migrations/20260907000100_add_sale_rounding.sql`
