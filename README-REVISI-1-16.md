# POS APOTEK - REVISI 1-16

Versi gabungan revisi 1 sampai 16.

## Revisi yang termasuk
1. Diskon per item Penjualan Umum.
2. No. SIP dokter dihilangkan dari Penjualan Resep.
3. Pembulatan manual untuk semua penjualan.
4. Layout keranjang kasir diperbaiki agar item mudah terlihat.
5. Format struk thermal 58 mm diperbaiki.
6. Input angka harga/stok dapat dikosongkan dan diganti.
7. Satuan obat dapat diisi manual.
8. Sistem print preview menggunakan print window yang dibuka langsung dari aksi tombol.
9. Edit Obat & Stok diperbaiki dari blank screen.
10. Dokter tidak ditampilkan pada Penjualan Umum.
11. Harga Penjualan Resep tetap menggunakan harga resep saat pasien/dokter dipilih.
12. Pembulatan memiliki keterangan, misalnya Konsultasi/Donasi.
13. Tombol Print Surat Pesanan diperbaiki agar popup tidak diblokir setelah query async.
14. SP Prekursor memiliki Zat Aktif Prekursor Farmasi yang dapat diedit dan dicetak.
15. Bentuk Sediaan diperluas.
16. Kategori dan Bentuk Sediaan mendukung Lainnya/Manual.

## Database
Jalankan migration Supabase di folder `supabase/migrations` yang belum dijalankan pada database produksi, khususnya:
- 20260907000100_add_sale_rounding.sql
- 20260907000200_add_rounding_note.sql
- 20260908000100_add_precursor_active_ingredient_to_purchase_order_items.sql

## Menjalankan
npm install
npm run dev

Sebelum deploy ke Netlify, lakukan pengujian kasir, stok, SP, penerimaan, scanner, dan printer thermal.
