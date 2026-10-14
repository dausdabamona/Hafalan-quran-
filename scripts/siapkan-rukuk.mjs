// Penyiapan data rukuk Juz 30 dari paket quran-meta (MIT, riwayat Hafs).
// Hasil: data/rukuk-juz30.json. Jalankan: npm run siapkan-rukuk
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getRukuMeta } from 'quran-meta/hafs';

const SURAH_AWAL_JUZ_30 = 78;
const JUMLAH_RUKUK = 556;

const rukuk = [];
for (let r = 1; r <= JUMLAH_RUKUK; r++) {
  const m = getRukuMeta(r);
  const [surah, ayatAwal] = m.first;
  const [surahAkhir, ayatAkhir] = m.last;
  if (surah < SURAH_AWAL_JUZ_30) continue;
  if (surah !== surahAkhir) throw new Error(`Rukuk ${r} melintasi surah`);
  rukuk.push({ nomor: r, surah, ayatAwal, ayatAkhir });
}

const hasil = {
  sumber: 'quran-meta (npm, lisensi MIT), daftar rukuk riwayat Hafs',
  rukuk,
};
const tujuan = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'rukuk-juz30.json');
await writeFile(tujuan, JSON.stringify(hasil, null, 1) + '\n', 'utf8');
console.log(`${rukuk.length} rukuk → data/rukuk-juz30.json`);
