// Listener untuk menerima instruksi dari popup ekstensi
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape_dashboard") {
    try {
      const meetings = parseDashboard();
      sendResponse({ success: true, meetings: meetings });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Menjaga channel tetap terbuka untuk respon asinkron
});

/**
 * Mem-parsing tabel jadwal pertemuan pada dashboard TeraVersa
 * @returns {Array} List dari detail pertemuan { meetingNum, url, hasButton, buttonText }
 */
function parseDashboard() {
  // Mencari tabel utama presensi
  const table = document.querySelector('table.table-striped') || document.querySelector('table');
  if (!table) {
    throw new Error("Tabel jadwal presensi tidak ditemukan. Pastikan Anda membuka halaman presensi dosen di TeraVersa.");
  }
  
  const rows = table.querySelectorAll('tr');
  const meetings = [];
  
  // Melompati baris header (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');
    
    if (cells.length >= 2) {
      const meetingText = cells[0].textContent.trim();
      const meetingNum = parseInt(meetingText, 10);
      
      // Jika kolom pertama bukan angka (misal header tambahan atau footer), lewati
      if (isNaN(meetingNum)) {
        continue;
      }
      
      // Cari elemen tautan <a> di kolom kedua (Nama MK / Lihat Presensi)
      const link = cells[1].querySelector('a');
      let url = null;
      let hasButton = false;
      let buttonText = "";
      
      // Memeriksa apakah terdapat tombol "Lihat Presensi"
      if (link && (link.textContent.includes('Lihat Presensi') || link.href.includes('/manual2/'))) {
        url = link.href;
        hasButton = true;
        buttonText = link.textContent.trim();
      }
      
      meetings.push({
        meetingNum: meetingNum,
        url: url,
        hasButton: hasButton,
        buttonText: buttonText
      });
    }
  }
  
  if (meetings.length === 0) {
    throw new Error("Format tabel tidak sesuai atau baris pertemuan tidak ditemukan.");
  }
  
  return meetings;
}
