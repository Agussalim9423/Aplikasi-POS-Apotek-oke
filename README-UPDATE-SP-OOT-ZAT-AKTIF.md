# Update SP OOT & Posisi Zat Aktif

Perbaikan ini menambahkan:

1. Kolom **Zat Aktif** pada SP Obat-Obat Tertentu (OOT), dapat diedit saat membuat SP.
2. Nilai awal otomatis mengambil `generic_name`, lalu `description` jika tersedia.
3. Nilai OOT disimpan pada `purchase_order_items.active_ingredient`.
4. Pada hasil cetak, urutan kolom menjadi:
   **No | Nama Obat / Bahan Obat | Zat Aktif | Bentuk Sediaan & Kekuatan | Jumlah Pesanan**.
5. SP Prekursor tetap menggunakan `precursor_active_ingredient` dan ditempatkan pada posisi yang sama.

## SQL wajib dijalankan sekali

Buka Supabase SQL Editor dan jalankan migration:

`supabase/migrations/20260908000200_add_active_ingredient_to_purchase_order_items.sql`

Setelah berhasil, refresh aplikasi.
