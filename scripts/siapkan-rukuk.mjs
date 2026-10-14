// Penyiapan data rukuk dan juz seluruh Al-Qur'an dari paket quran-meta (MIT, riwayat Hafs).
// Hasil: data/rukuk.json. Jalankan: npm run siapkan-rukuk
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getRukuMeta, getJuzMeta } from 'quran-meta/hafs';

const JUMLAH_RUKUK = 556;
const JUMLAH_JUZ = 30;

const rukuk = [];
for (let r = 1; r <= JUMLAH_RUKUK; r++) {
  const m = getRukuMeta(r);
  const [surah, ayatAwal] = m.first;
  const [surahAkhir, ayatAkhir] = m.last;
  if (surah !== surahAkhir) throw new Error(`Rukuk ${r} melintasi surah`);
  rukuk.push({ nomor: r, surah, ayatAwal, ayatAkhir });
}

// Awal tiap juz: [surah, ayat]
const juz = [];
for (let j = 1; j <= JUMLAH_JUZ; j++) {
  const m = getJuzMeta(j);
  juz.push({ nomor: j, surah: m.first[0], ayat: m.first[1] });
}

const hasil = {
  sumber: 'quran-meta (npm, lisensi MIT), daftar rukuk dan juz riwayat Hafs',
  rukuk,
  juz,
};
const tujuan = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'rukuk.json');
await writeFile(tujuan, JSON.stringify(hasil) + '\n', 'utf8');
console.log(`${rukuk.length} rukuk, ${juz.length} juz → data/rukuk.json`);
