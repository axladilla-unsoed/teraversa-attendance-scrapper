# TeraVersa Attendance Scraper

**TeraVersa Attendance Scraper** adalah ekstensi Google Chrome khusus (Manifest V3) yang dirancang untuk mempermudah dosen dalam merekapitulasi, memproses, dan mengunduh data presensi mahasiswa dari pertemuan 1 hingga 16 di portal akademik **TeraVersa Unsoed** secara otomatis menjadi satu tabel rekapitulasi tunggal.

---

## Fitur Utama

- **Deteksi Pertemuan Otomatis (1-16):** Secara cerdas memindai baris pertemuan pada dashboard dosen. Jika pertemuan tertentu tidak diampu oleh dosen yang bersangkutan (tombol "Lihat Presensi" tidak ada), status kehadiran akan otomatis diisi dengan tanda strip (`—`).
- **Salin untuk Excel (TSV):** Menyalin tabel rekapitulasi dalam format TSV ke clipboard. Anda cukup membuka Microsoft Excel atau Google Sheets lalu menempelkannya (`Ctrl+V` atau `Cmd+V`) untuk memindahkan data dengan rapi.
- **Unduh CSV:** Menyimpan seluruh data presensi dalam file `.csv` dengan pemisah koma `,`.
- **Pencarian Real-Time:** Memungkinkan Anda mencari mahasiswa berdasarkan NIM atau Nama secara langsung di dalam popup ekstensi.
- **Opsi Tampilan Ringkas:** Mengubah tampilan status kehadiran antara teks lengkap ("Hadir" / "Tidak Hadir") atau inisial ringkas ("H" / "A") untuk menghemat ruang tabel.
- **Mode Simulasi (Offline Mock Mode):** Memungkinkan pengujian secara offline langsung menggunakan berkas contoh HTML lokal.

---

## Struktur File Proyek

```text
├── manifest.json      # Konfigurasi utama ekstensi Chrome
├── content.js         # Script pembaca data halaman (DOM parser)
├── popup.html         # Struktur tampilan UI popup ekstensi
├── styles.css         # Gaya desain visual (dark mode glassmorphism)
├── popup.js           # Logika pemrosesan dan ekspor data presensi
└── README.md          # Dokumen panduan instalasi dan penggunaan
```

---

## Cara Instalasi Ekstensi di Google Chrome

Karena ekstensi ini dikembangkan secara lokal untuk keperluan kantor/kantor khusus, Anda dapat memasangnya menggunakan mode pengembang:

1. Buka browser **Google Chrome**.
2. Masuk ke halaman pengelolaan ekstensi dengan mengetik **`chrome://extensions/`** di bilah alamat browser.
3. Aktifkan **"Developer mode"** (Mode Pengembang) melalui tombol toggle yang ada di pojok kanan atas halaman.
4. Klik tombol **"Load unpacked"** (Muat ekstensi yang belum dikemas) di pojok kiri atas halaman.
5. Pilih folder proyek tempat Anda menyimpan berkas ekstensi ini
6. Ekstensi **"TeraVersa Attendance Scraper"** sekarang sudah berhasil terpasang dan siap digunakan!


## Cara Penggunaan Langsung (Production / Live)

1. Buka portal **TeraVersa** dan masuk ke akun dosen Anda.
2. Navigasikan ke halaman **Jadwal Mengajar / Presensi Dosen** (Pastikan URL di address bar memuat bagian `/dosen/prdosen`).
3. Klik ikon ekstensi di toolbar Chrome Anda.
4. Klik tombol **"Mulai Scrape Kehadiran"**.
5. Ekstensi akan mengumpulkan data presensi setiap pertemuan secara asinkron di latar belakang menggunakan cookie session Anda yang sudah masuk log (tidak perlu login ulang).
6. Setelah selesai, gunakan fitur pencarian untuk memverifikasi, atau klik **"Salin untuk Excel"** / **"Unduh CSV"** untuk mengekspor datanya.

---

## Catatan Penting
- **Pembaruan Kode:** Jika Anda mengubah file kode ekstensi (`manifest.json`, `popup.js`, dll.), jangan lupa untuk menekan tombol **Reload** (ikon panah melingkar) di halaman `chrome://extensions/` agar perubahan tersebut diterapkan oleh Chrome.
- **Refresh Halaman:** Setelah menginstal atau memuat ulang ekstensi, silakan muat ulang (refresh/F5) halaman TeraVersa yang sedang Anda buka sebelum menjalankan tombol scrape.
