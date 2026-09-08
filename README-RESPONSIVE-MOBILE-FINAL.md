# Responsive & Mobile UX Final

Perbaikan responsive untuk POS Apotek Revisi 1–16.

## Target perangkat
- HP Android/iPhone 360–430 px
- HP landscape
- Tablet Android 7–10 inci
- iPad portrait/landscape
- Laptop dan desktop

## Perubahan utama
- Sidebar mobile menjadi drawer + backdrop.
- Header mobile tetap ringkas dan aman pada Safari/iOS.
- Form padat berubah menjadi satu kolom di HP.
- Tabel tetap dapat digeser horizontal dengan touch scrolling.
- Kartu produk Kasir POS menjadi satu kolom di HP dan kembali dua kolom pada layar lebih besar.
- Area produk dan keranjang Kasir diatur agar tetap usable dalam viewport HP.
- Tombol, input, select, dan textarea memiliki tap target yang nyaman.
- Modal dan toast disesuaikan agar tidak keluar layar.
- Dukungan safe-area untuk iPhone/iPad.
- Tidak mengubah logika transaksi, SP, prekursor, OOT, stok, pembayaran, atau pencetakan.

## Menjalankan
```bash
npm install
npm run dev
```

Untuk production:
```bash
npm run build
```
