// Inisialisasi Tema (dijalankan langsung untuk mencegah kedipan/flash)
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
} else {
  document.body.classList.remove('dark-mode');
}

// State Global Ekstensi
let activeTab = null;
let isMockMode = false;
let meetingsList = [];
let maxMeetingNum = 16;
let studentsData = []; // Array of { nim, name, attendance: { 1: status, 2: status, ... } }
let uniqueMeetingNums = [];

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const btnScrape = document.getElementById('btnScrape');
const toggleAbbr = document.getElementById('toggleAbbr');
const progressPanel = document.getElementById('progressPanel');
const progressLabel = document.getElementById('progressLabel');
const progressPct = document.getElementById('progressPct');
const progressBar = document.getElementById('progressBar');
const helpPanel = document.getElementById('helpPanel');
const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const previewPanel = document.getElementById('previewPanel');
const tableHeader = document.getElementById('tableHeader');
const tableBody = document.getElementById('tableBody');
const btnCopy = document.getElementById('btnCopy');
const btnDownload = document.getElementById('btnDownload');
const btnDownloadTSV = document.getElementById('btnDownloadTSV');
const toast = document.getElementById('toast');

// Inisialisasi: Deteksi Halaman Aktif saat Popup Dibuka
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tabIdParam = urlParams.get('tabId');
  const toggleTabMode = document.getElementById('toggleTabMode');

  if (tabIdParam) {
    // Berjalan di Tab Mode
    document.body.classList.add('tab-mode');
    
    if (toggleTabMode) {
      toggleTabMode.checked = true;
      toggleTabMode.addEventListener('change', () => {
        localStorage.setItem('openInTab', toggleTabMode.checked ? 'true' : 'false');
      });
    }

    const parsedTabId = parseInt(tabIdParam, 10);
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.get) {
      chrome.tabs.get(parsedTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          showStatus('Tab asli tertutup/tidak valid (Mode Tab)', 'warn');
        } else {
          activeTab = tab;
          checkPageValidity(activeTab.url);
        }
      });
    } else {
      showStatus('Mode Standalone (Pengujian)', 'ready');
      if (btnScrape) btnScrape.removeAttribute('disabled');
    }
  } else {
    // Berjalan di Popup Mode Biasa
    const openInTab = localStorage.getItem('openInTab') === 'true';

    if (openInTab && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          const activeTabInfo = tabs[0];

          // Cari apakah ada tab ekstensi yang sudah terbuka sebelumnya
          chrome.tabs.query({}, (allTabs) => {
            const extensionTab = allTabs.find(t => t.url && t.url.startsWith(chrome.runtime.getURL("popup.html")));
            if (extensionTab) {
              chrome.tabs.update(extensionTab.id, {
                url: chrome.runtime.getURL(`popup.html?tabId=${activeTabInfo.id}`),
                active: true
              });
            } else {
              chrome.tabs.create({
                url: chrome.runtime.getURL(`popup.html?tabId=${activeTabInfo.id}`)
              });
            }
            window.close();
          });
        }
      });
      return; // Batalkan inisialisasi popup karena akan ditutup
    }

    if (toggleTabMode) {
      toggleTabMode.checked = openInTab;
      toggleTabMode.addEventListener('change', () => {
        const isChecked = toggleTabMode.checked;
        localStorage.setItem('openInTab', isChecked ? 'true' : 'false');
        if (isChecked && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
              // Cari apakah ada tab ekstensi yang sudah terbuka sebelumnya
              chrome.tabs.query({}, (allTabs) => {
                const extensionTab = allTabs.find(t => t.url && t.url.startsWith(chrome.runtime.getURL("popup.html")));
                if (extensionTab) {
                  chrome.tabs.update(extensionTab.id, {
                    url: chrome.runtime.getURL(`popup.html?tabId=${tabs[0].id}`),
                    active: true
                  });
                } else {
                  chrome.tabs.create({
                    url: chrome.runtime.getURL(`popup.html?tabId=${tabs[0].id}`)
                  });
                }
                window.close();
              });
            }
          });
        }
      });
    }

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          activeTab = tabs[0];
          checkPageValidity(activeTab.url);
        } else {
          showStatus('Halaman tidak terdeteksi', 'warn');
        }
      });
    } else {
      showStatus('Mode Standalone (Pengujian)', 'ready');
      if (btnScrape) btnScrape.removeAttribute('disabled');
    }
  }

  // Event Listeners umum
  btnScrape.addEventListener('click', startScraping);
  toggleAbbr.addEventListener('change', renderTable);
  searchInput.addEventListener('input', filterTable);
  btnCopy.addEventListener('click', copyToExcel);
  btnDownload.addEventListener('click', downloadCSV);
  btnDownloadTSV.addEventListener('click', downloadTSV);

  // Event Listener untuk Toggle Tema
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }
});

/**
 * Memvalidasi apakah tab aktif merupakan halaman TeraVersa yang valid
 * @param {string} url URL tab aktif
 */
function checkPageValidity(url) {
  if (!url) return;
  
  const isTeraversaDashboard = url.includes('teraversa.unsoed.ac.id/dosen/prdosen');
  const isLocalMock = url.startsWith('file://') && url.includes('contoh_halaman_awal.html');

  const inTabMode = document.body.classList.contains('tab-mode');
  const suffix = inTabMode ? ' (Mode Tab)' : '';

  if (isTeraversaDashboard || isLocalMock) {
    isMockMode = isLocalMock;
    showStatus('Halaman Siap' + suffix, 'ready');
    btnScrape.removeAttribute('disabled');
  } else {
    showStatus('Buka halaman presensi' + suffix, 'warn');
    btnScrape.setAttribute('disabled', 'true');
  }
}

/**
 * Memperbarui tampilan indikator status halaman
 */
function showStatus(text, type) {
  statusText.textContent = text;
  statusBadge.className = 'status-badge';
  if (type === 'ready') {
    statusBadge.classList.add('status-ready');
  } else if (type === 'warn') {
    statusBadge.classList.add('status-warn');
  }
}

/**
 * Memulai proses scraping data presensi
 */
function startScraping() {
  if (!activeTab) return;

  // Reset UI
  btnScrape.setAttribute('disabled', 'true');
  helpPanel.style.display = 'none';
  previewPanel.style.display = 'none';
  searchContainer.style.display = 'none';
  progressPanel.style.display = 'block';
  updateProgress(0, 'Memulai pemindaian dashboard...');

  // Kirim pesan ke content script untuk mendapatkan daftar pertemuan
  chrome.tabs.sendMessage(activeTab.id, { action: "scrape_dashboard" }, async (response) => {
    // Penanganan jika ada error saat berkomunikasi dengan content.js
    if (chrome.runtime.lastError || !response || !response.success) {
      const errorMsg = response ? response.error : (chrome.runtime.lastError ? chrome.runtime.lastError.message : "Gagal terhubung ke halaman web.");
      
      // Jika error terjadi karena script belum diinjeksi (misal di halaman local file:// tanpa izin)
      if (isMockMode && errorMsg.includes("Could not establish connection")) {
        showToast("Error: Aktifkan 'Izinkan akses ke URL file' di pengaturan ekstensi Chrome.", 4000);
      } else {
        showToast("Error: " + errorMsg, 4000);
      }
      
      resetScrapeButton();
      return;
    }

    meetingsList = response.meetings;
    
    // Ambil daftar nomor pertemuan yang unik
    uniqueMeetingNums = meetingsList.map(m => m.meetingNum).sort((a, b) => a - b);
    if (uniqueMeetingNums.length > 0) {
      maxMeetingNum = Math.max(...uniqueMeetingNums);
    }

    try {
      await processMeetings();
    } catch (err) {
      showToast("Gagal memproses detail: " + err.message, 4000);
      resetScrapeButton();
    }
  });
}

/**
 * Melakukan iterasi dan fetching halaman detail presensi dari daftar pertemuan
 */
async function processMeetings() {
  const masterStudents = {};
  const total = meetingsList.length;

  for (let i = 0; i < total; i++) {
    const meeting = meetingsList[i];
    const pct = Math.round((i / total) * 100);
    
    updateProgress(pct, `Memproses Pertemuan ${meeting.meetingNum}...`);

    if (!meeting.hasButton) {
      // Pertemuan tidak diampu oleh user (tombol "Lihat Presensi" tidak ada)
      continue;
    }

    let fetchUrl = meeting.url;
    
    // Jika dalam mode mock file:// lokal
    if (isMockMode) {
      const dirPath = activeTab.url.substring(0, activeTab.url.lastIndexOf('/'));
      fetchUrl = dirPath + '/contoh_halaman_per_pertemuan.html';
    }

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      
      const htmlText = await response.text();
      parseAndAggregateAttendance(htmlText, meeting.meetingNum, masterStudents);
    } catch (err) {
      console.error(`Gagal mengambil detail pertemuan ${meeting.meetingNum}:`, err);
      // Skip pertemuan ini, akan terisi status "-"
    }
    
    // Memberikan jeda waktu kecil agar browser tidak hang & progress bar teranimasi dengan baik
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  // Selesai memproses semua pertemuan
  updateProgress(100, "Menyusun rekapitulasi data...");
  
  // Konversi map mahasiswa ke array dan urutkan berdasarkan NIM
  studentsData = Object.values(masterStudents).sort((a, b) => a.nim.localeCompare(b.nim));

  // Sembunyikan progress bar dan tampilkan data
  setTimeout(() => {
    progressPanel.style.display = 'none';
    searchContainer.style.display = 'block';
    previewPanel.style.display = 'flex';
    resetScrapeButton();
    renderTable();
    showToast(`Berhasil menarik ${studentsData.length} data mahasiswa!`);
  }, 400);
}

/**
 * Mem-parsing HTML detail presensi dan menggabungkannya ke master mahasiswa
 * @param {string} htmlText HTML teks halaman presensi per pertemuan
 * @param {number} meetingNum Nomor pertemuan
 * @param {Object} masterStudents Objek map mahasiswa (NIM sebagai key)
 */
function parseAndAggregateAttendance(htmlText, meetingNum, masterStudents) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  
  // Cari tabel presensi (tabel yang memiliki class table-striped)
  const table = doc.querySelector('table.table-striped') || doc.querySelector('table');
  if (!table) return;

  const rows = table.querySelectorAll('tr');
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');
    
    if (cells.length >= 4) {
      const nim = cells[1].textContent.trim();
      const name = cells[2].textContent.trim();
      
      // Lewati baris header jika terdeteksi
      if (nim === 'NIM' && name === 'NAMA') {
        continue;
      }
      
      // Jika NIM kosong, lewati
      if (!nim) continue;

      // Inisialisasi objek mahasiswa jika belum ada
      if (!masterStudents[nim]) {
        masterStudents[nim] = {
          nim: nim,
          name: name,
          attendance: {}
        };
        // Set default status "-" untuk semua pertemuan
        uniqueMeetingNums.forEach(num => {
          masterStudents[nim].attendance[num] = '-';
        });
      }

      // Deteksi status kehadiran di kolom ke-4
      const statusCell = cells[3];
      let status = 'Tidak Hadir';
      
      // Cek apakah terdapat badge "hadir", "sakit", atau "pending"
      const badge = statusCell.querySelector('.badge');
      const checkbox = statusCell.querySelector('input[type="checkbox"]');
      
      if (badge) {
        const badgeText = badge.textContent.toLowerCase();
        if (badgeText.includes('hadir')) {
          status = 'Hadir';
        } else if (badgeText.includes('sakit')) {
          status = 'Sakit';
        } else if (badgeText.includes('pending') || badgeText.includes('tunda')) {
          status = 'Pending';
        } else {
          status = badge.textContent.trim();
        }
      } else if (checkbox) {
        status = 'Tidak Hadir';
      } else {
        // Fallback mengambil teks langsung dari cell (jika ada status khusus lain)
        const cellText = statusCell.textContent.trim().toLowerCase();
        if (cellText.includes('hadir')) {
          status = 'Hadir';
        } else if (cellText.includes('sakit')) {
          status = 'Sakit';
        } else if (cellText.includes('pending') || cellText.includes('tunda')) {
          status = 'Pending';
        } else if (cellText.includes('tidak hadir') || cellText.includes('absen') || cellText.includes('alpha')) {
          status = 'Tidak Hadir';
        } else {
          status = statusCell.textContent.trim() || 'Tidak Hadir';
        }
      }

      masterStudents[nim].attendance[meetingNum] = status;
    }
  }
}

/**
 * Merender tabel visual di popup ekstensi
 */
function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const useAbbr = toggleAbbr.checked;

  // 1. Generate Header Table
  let headerHtml = `
    <th class="col-no">No</th>
    <th class="col-nim">NIM</th>
    <th class="col-nama">Nama</th>
  `;
  
  uniqueMeetingNums.forEach(num => {
    headerHtml += `<th style="text-align: center; width: 25px;" title="Pertemuan ${num}">${num}</th>`;
  });
  
  // Kolom ringkasan (Summary) kehadiran di akhir
  headerHtml += `
    <th style="text-align: center; width: 45px;" title="Persentase Hadir">% H</th>
    <th style="text-align: center; width: 45px;" title="Persentase Sakit">% S</th>
    <th style="text-align: center; width: 45px;" title="Persentase Pending">% P</th>
    <th style="text-align: center; width: 45px;" title="Persentase Alpha">% A</th>
    <th style="text-align: center; width: 85px;" title="Rekap Kehadiran (Hadir/Sakit/Pending/Alpha)">H/S/P/A</th>
  `;
  
  tableHeader.innerHTML = headerHtml;

  // 2. Generate Body Table
  let bodyHtml = '';
  let visibleIndex = 1;

  studentsData.forEach(student => {
    // Filter Pencarian
    const matchesSearch = student.nim.toLowerCase().includes(query) || student.name.toLowerCase().includes(query);
    if (!matchesSearch) return;

    let rowHtml = `
      <tr>
        <td class="col-no">${visibleIndex++}</td>
        <td class="col-nim">${student.nim}</td>
        <td class="col-nama" title="${student.name}">${student.name}</td>
    `;

    let totalTaught = 0;
    let countH = 0;
    let countS = 0;
    let countP = 0;
    let countA = 0;

    uniqueMeetingNums.forEach(num => {
      const status = student.attendance[num];
      let displayStatus = status;
      let badgeClass = 'badge-na';

      if (status === 'Hadir') {
        displayStatus = useAbbr ? 'H' : 'Hadir';
        badgeClass = 'badge-hadir';
        countH++;
        totalTaught++;
      } else if (status === 'Sakit') {
        displayStatus = useAbbr ? 'S' : 'Sakit';
        badgeClass = 'badge-sakit';
        countS++;
        totalTaught++;
      } else if (status === 'Pending') {
        displayStatus = useAbbr ? 'P' : 'Pending';
        badgeClass = 'badge-pending';
        countP++;
        totalTaught++;
      } else if (status === 'Tidak Hadir') {
        displayStatus = useAbbr ? 'A' : 'Tidak Hadir';
        badgeClass = 'badge-absen';
        countA++;
        totalTaught++;
      } else {
        displayStatus = '—';
        badgeClass = 'badge-na';
      }

      rowHtml += `<td style="text-align: center;"><span class="badge-status ${badgeClass}">${displayStatus}</span></td>`;
    });

    // Hitung persentase kehadiran berdasarkan total pertemuan yang diampu
    const pctH = totalTaught > 0 ? ((countH / totalTaught) * 100).toFixed(0) : '0';
    const pctS = totalTaught > 0 ? ((countS / totalTaught) * 100).toFixed(0) : '0';
    const pctP = totalTaught > 0 ? ((countP / totalTaught) * 100).toFixed(0) : '0';
    const pctA = totalTaught > 0 ? ((countA / totalTaught) * 100).toFixed(0) : '0';
    const rekapString = `${countH}/${countS}/${countP}/${countA} dari ${totalTaught}`;

    rowHtml += `
      <td style="text-align: center; font-weight: 600; color: var(--accent-success);">${pctH}</td>
      <td style="text-align: center; font-weight: 500; color: var(--accent-warning);">${pctS}</td>
      <td style="text-align: center; font-weight: 500; color: #818cf8;">${pctP}</td>
      <td style="text-align: center; font-weight: 500; color: var(--accent-danger);">${pctA}</td>
      <td style="text-align: center; font-weight: 600; font-family: monospace;">${rekapString}</td>
    `;

    rowHtml += '</tr>';
    bodyHtml += rowHtml;
  });

  if (visibleIndex === 1) {
    // Jika tidak ada data yang cocok dengan pencarian
    bodyHtml = `<tr><td colspan="${3 + uniqueMeetingNums.length}" style="text-align: center; color: var(--text-muted); padding: 20px;">Data tidak ditemukan</td></tr>`;
  }

  tableBody.innerHTML = bodyHtml;
}

/**
 * Filter tabel berdasarkan input search
 */
function filterTable() {
  renderTable();
}

/**
 * Menyalin data presensi ke clipboard dalam format TSV (untuk paste langsung ke Excel)
 */
function copyToExcel() {
  if (studentsData.length === 0) return;

  const useAbbr = toggleAbbr.checked;
  let tsvContent = '';

  // Header row
  const headers = ['No', 'NIM', 'Nama'];
  uniqueMeetingNums.forEach(num => {
    headers.push(`P${num}`);
  });
  headers.push('% Hadir', '% Sakit', '% Pending', '% Alpha', 'Rekap (H/S/P/A)');
  tsvContent += headers.join('\t') + '\n';

  // Data rows
  studentsData.forEach((student, index) => {
    const row = [index + 1, student.nim, student.name];
    
    let totalTaught = 0;
    let countH = 0;
    let countS = 0;
    let countP = 0;
    let countA = 0;

    uniqueMeetingNums.forEach(num => {
      const status = student.attendance[num];
      let statusStr = '—';
      if (status === 'Hadir') {
        statusStr = useAbbr ? 'H' : 'Hadir';
        countH++;
        totalTaught++;
      } else if (status === 'Sakit') {
        statusStr = useAbbr ? 'S' : 'Sakit';
        countS++;
        totalTaught++;
      } else if (status === 'Pending') {
        statusStr = useAbbr ? 'P' : 'Pending';
        countP++;
        totalTaught++;
      } else if (status === 'Tidak Hadir') {
        statusStr = useAbbr ? 'A' : 'Tidak Hadir';
        countA++;
        totalTaught++;
      }
      row.push(statusStr);
    });

    const pctH = totalTaught > 0 ? ((countH / totalTaught) * 100).toFixed(0) : '0';
    const pctS = totalTaught > 0 ? ((countS / totalTaught) * 100).toFixed(0) : '0';
    const pctP = totalTaught > 0 ? ((countP / totalTaught) * 100).toFixed(0) : '0';
    const pctA = totalTaught > 0 ? ((countA / totalTaught) * 100).toFixed(0) : '0';
    const rekapString = `${countH}/${countS}/${countP}/${countA} dari ${totalTaught}`;

    row.push(pctH, pctS, pctP, pctA, rekapString);
    tsvContent += row.join('\t') + '\n';
  });

  // Salin ke Clipboard
  navigator.clipboard.writeText(tsvContent)
    .then(() => {
      showToast("Tabel kehadiran berhasil disalin! Buka Excel lalu paste (Ctrl+V).");
    })
    .catch(err => {
      console.error('Gagal menyalin ke clipboard:', err);
      showToast("Gagal menyalin data.");
    });
}

/**
 * Mengunduh data presensi dalam format file CSV
 */
function downloadCSV() {
  if (studentsData.length === 0) return;

  const useAbbr = toggleAbbr.checked;
  
  // Fungsi pembantu untuk mengamankan data CSV dari karakter pemisah
  const escapeCSV = (val) => {
    const str = String(val);
    if (str.includes(',') || str.includes(';') || str.includes('\n') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  let csvContent = '';

  // Header row
  const headers = ['No', 'NIM', 'Nama'];
  uniqueMeetingNums.forEach(num => {
    headers.push(`Pertemuan ${num}`);
  });
  headers.push('% Hadir', '% Sakit', '% Pending', '% Alpha', 'Rekap (H/S/P/A)');
  csvContent += headers.map(escapeCSV).join(',') + '\n';

  // Data rows
  studentsData.forEach((student, index) => {
    const row = [index + 1, student.nim, student.name];
    
    let totalTaught = 0;
    let countH = 0;
    let countS = 0;
    let countP = 0;
    let countA = 0;

    uniqueMeetingNums.forEach(num => {
      const status = student.attendance[num];
      let statusStr = '—';
      if (status === 'Hadir') {
        statusStr = useAbbr ? 'H' : 'Hadir';
        countH++;
        totalTaught++;
      } else if (status === 'Sakit') {
        statusStr = useAbbr ? 'S' : 'Sakit';
        countS++;
        totalTaught++;
      } else if (status === 'Pending') {
        statusStr = useAbbr ? 'P' : 'Pending';
        countP++;
        totalTaught++;
      } else if (status === 'Tidak Hadir') {
        statusStr = useAbbr ? 'A' : 'Tidak Hadir';
        countA++;
        totalTaught++;
      }
      row.push(statusStr);
    });

    const pctH = totalTaught > 0 ? ((countH / totalTaught) * 100).toFixed(0) : '0';
    const pctS = totalTaught > 0 ? ((countS / totalTaught) * 100).toFixed(0) : '0';
    const pctP = totalTaught > 0 ? ((countP / totalTaught) * 100).toFixed(0) : '0';
    const pctA = totalTaught > 0 ? ((countA / totalTaught) * 100).toFixed(0) : '0';
    const rekapString = `${countH}/${countS}/${countP}/${countA} dari ${totalTaught}`;

    row.push(pctH, pctS, pctP, pctA, rekapString);
    csvContent += row.map(escapeCSV).join(',') + '\n';
  });

  // Trigger download file dengan UTF-8 BOM agar Excel dapat menampilkan karakter khusus (seperti em-dash '—') dengan benar
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Rekap_Kehadiran_Pertemuan_1_${maxMeetingNum}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("File CSV berhasil diunduh!");
}

/**
 * Mengunduh data presensi dalam format file TSV dengan UTF-8 BOM
 */
function downloadTSV() {
  if (studentsData.length === 0) return;

  const useAbbr = toggleAbbr.checked;
  
  // Fungsi pembantu untuk mengamankan data TSV dari karakter pemisah
  const escapeTSV = (val) => {
    const str = String(val);
    if (str.includes('\t') || str.includes('\n') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  let tsvContent = '';

  // Header row
  const headers = ['No', 'NIM', 'Nama'];
  uniqueMeetingNums.forEach(num => {
    headers.push(`Pertemuan ${num}`);
  });
  headers.push('% Hadir', '% Sakit', '% Pending', '% Alpha', 'Rekap (H/S/P/A)');
  tsvContent += headers.map(escapeTSV).join('\t') + '\n';

  // Data rows
  studentsData.forEach((student, index) => {
    const row = [index + 1, student.nim, student.name];
    
    let totalTaught = 0;
    let countH = 0;
    let countS = 0;
    let countP = 0;
    let countA = 0;

    uniqueMeetingNums.forEach(num => {
      const status = student.attendance[num];
      let statusStr = '—';
      if (status === 'Hadir') {
        statusStr = useAbbr ? 'H' : 'Hadir';
        countH++;
        totalTaught++;
      } else if (status === 'Sakit') {
        statusStr = useAbbr ? 'S' : 'Sakit';
        countS++;
        totalTaught++;
      } else if (status === 'Pending') {
        statusStr = useAbbr ? 'P' : 'Pending';
        countP++;
        totalTaught++;
      } else if (status === 'Tidak Hadir') {
        statusStr = useAbbr ? 'A' : 'Tidak Hadir';
        countA++;
        totalTaught++;
      }
      row.push(statusStr);
    });

    const pctH = totalTaught > 0 ? ((countH / totalTaught) * 100).toFixed(0) : '0';
    const pctS = totalTaught > 0 ? ((countS / totalTaught) * 100).toFixed(0) : '0';
    const pctP = totalTaught > 0 ? ((countP / totalTaught) * 100).toFixed(0) : '0';
    const pctA = totalTaught > 0 ? ((countA / totalTaught) * 100).toFixed(0) : '0';
    const rekapString = `${countH}/${countS}/${countP}/${countA} dari ${totalTaught}`;

    row.push(pctH, pctS, pctP, pctA, rekapString);
    tsvContent += row.map(escapeTSV).join('\t') + '\n';
  });

  // Trigger download file dengan UTF-8 BOM agar Excel dapat menampilkan karakter khusus dengan benar
  const blob = new Blob(["\uFEFF" + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Rekap_Kehadiran_Pertemuan_1_${maxMeetingNum}.tsv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("File TSV berhasil diunduh!");
}

/**
 * Memperbarui progress bar UI
 */
function updateProgress(percentage, text) {
  progressPct.textContent = `${percentage}%`;
  progressLabel.textContent = text;
  progressBar.style.width = `${percentage}%`;
}

/**
 * Mereset status tombol scrape ke kondisi normal
 */
function resetScrapeButton() {
  btnScrape.removeAttribute('disabled');
}

/**
 * Menampilkan notifikasi toast sesaat
 */
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}
