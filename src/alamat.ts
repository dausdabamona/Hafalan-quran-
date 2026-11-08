import { cariRukuk, cariSurah, daftarRukuk, juzAyat, type Rukuk } from './data';
import { catatHapus, db, type AlamatAyat, type JenisAlamat, type UsulanClaude } from './db';

// K-97: Tata Alamat — judul ayat (2–5 kata makna) dan jembatan dari satu ayat ke ayat berikutnya.
// Ditulis Firdaus sendiri lebih dulu; Claude hanya cadangan lewat Usulan Claude (K-92).

export const MAKS_JUDUL = 80;
export const MAKS_JEMBATAN = 300;
export const JUZ_TATA_ALAMAT = 30;

export function kunciAlamat(surah: number, ayat: number, jenis: JenisAlamat): string {
  return `${surah}:${ayat}:${jenis}`;
}

export async function ambilAlamatSurah(surah: number): Promise<Map<string, AlamatAyat>> {
  const daftar = await db.alamatAyat.where('surah').equals(surah).toArray();
  return new Map(daftar.map((x) => [x.kunci, x]));
}

// Isi kosong = hapus (ikut sinkron lewat catatan penghapusan). Isi sama = tidak ditulis ulang.
export async function simpanAlamat(surah: number, ayat: number, jenis: JenisAlamat, isi: string): Promise<boolean> {
  const kunci = kunciAlamat(surah, ayat, jenis);
  const bersih = isi
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, jenis === 'judul' ? MAKS_JUDUL : MAKS_JEMBATAN);
  return db.transaction('rw', db.alamatAyat, db.hapus, async () => {
    const lama = await db.alamatAyat.get(kunci);
    if (!bersih) {
      if (!lama) return false;
      await db.alamatAyat.delete(kunci);
      await catatHapus(db, 'alamatAyat', [kunci]);
      return true;
    }
    if (lama?.isi === bersih) return false;
    await db.alamatAyat.put({ kunci, surah, ayat, jenis, isi: bersih, diubah: new Date().toISOString() });
    return true;
  });
}

// Rukuk dalam satu juz (rukuk dihitung masuk juz tempat ayat pertamanya berada).
export function rukukJuz(juz: number): Rukuk[] {
  return daftarRukuk.filter((r) => juzAyat(r.surah, r.ayatAwal) === juz);
}

// Sasaran jembatan dari ayat terakhir rukuk: ayat berikutnya di surah yang sama, atau surah berikutnya.
export function labelJembatan(surah: number, ayat: number): string | null {
  const s = cariSurah(surah);
  if (!s) return null;
  if (ayat < s.jumlahAyat) return `ayat ${ayat + 1}`;
  const berikut = cariSurah(surah + 1);
  return berikut ? `surah ${berikut.nama}` : null;
}

export interface RingkasanAlamat {
  jumlahAyat: number;
  judul: number;
  jembatan: number;
  jumlahJembatan: number;
}

// Hitungan judul & jembatan per rukuk, untuk daftar dan peta kemajuan.
export async function ringkasanRukuk(daftar: Rukuk[]): Promise<Map<number, RingkasanAlamat>> {
  const surahSet = [...new Set(daftar.map((r) => r.surah))];
  const semua = surahSet.length ? await db.alamatAyat.where('surah').anyOf(surahSet).toArray() : [];
  const ada = new Set(semua.filter((x) => x.isi.trim()).map((x) => x.kunci));
  const hasil = new Map<number, RingkasanAlamat>();
  for (const r of daftar) {
    const h: RingkasanAlamat = { jumlahAyat: 0, judul: 0, jembatan: 0, jumlahJembatan: 0 };
    for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) {
      h.jumlahAyat++;
      if (ada.has(kunciAlamat(r.surah, a, 'judul'))) h.judul++;
      if (labelJembatan(r.surah, a)) {
        h.jumlahJembatan++;
        if (ada.has(kunciAlamat(r.surah, a, 'jembatan'))) h.jembatan++;
      }
    }
    hasil.set(r.nomor, h);
  }
  return hasil;
}

// Usulan Claude yang masih menunggu untuk judul/jembatan satu surah, per kunci tujuan.
export async function usulanAlamatSurah(surah: number): Promise<Map<string, UsulanClaude>> {
  const daftar = await db.usulanClaude
    .where('status')
    .equals('menunggu')
    .filter((x) => x.tabel === 'alamatAyat' && x.surah === surah)
    .toArray();
  daftar.sort((a, b) => a.dibuat.localeCompare(b.dibuat));
  return new Map(daftar.map((x) => [x.kunciTujuan, x]));
}

// "3, 4, 5, 7" → "3–5, 7"
function ringkasNomor(daftar: number[]): string {
  const bagian: string[] = [];
  for (let i = 0; i < daftar.length;) {
    let j = i;
    while (j + 1 < daftar.length && daftar[j + 1] === daftar[j] + 1) j++;
    bagian.push(j > i ? `${daftar[i]}–${daftar[j]}` : `${daftar[i]}`);
    i = j + 1;
  }
  return bagian.join(', ');
}

// Permintaan siap tempel untuk Claude desktop (cadangan bila buntu), hanya untuk yang masih kosong.
export function permintaanClaude(nomorRukuk: number, alamat: Map<string, AlamatAyat>): string | null {
  const r = cariRukuk(nomorRukuk);
  const s = r && cariSurah(r.surah);
  if (!r || !s) return null;
  const judulKosong: number[] = [];
  const jembatanKosong: number[] = [];
  for (let a = r.ayatAwal; a <= r.ayatAkhir; a++) {
    if (!alamat.get(kunciAlamat(r.surah, a, 'judul'))?.isi) judulKosong.push(a);
    if (labelJembatan(r.surah, a) && !alamat.get(kunciAlamat(r.surah, a, 'jembatan'))?.isi) jembatanKosong.push(a);
  }
  if (!judulKosong.length && !jembatanKosong.length) return null;
  const baris = [
    `Di Saku Hati, bantu Tata Alamat surah ${s.nama} (${r.surah}) ayat ${r.ayatAwal}–${r.ayatAkhir}.`,
    'Baca dulu dengan alat baca_alamat.',
  ];
  if (judulKosong.length)
    baris.push(
      `Usulkan judul ayat 2–5 kata (makna inti, bahasa sederhana) dengan usul_judul_ayat untuk ayat ${ringkasNomor(judulKosong)}.`,
    );
  if (jembatanKosong.length)
    baris.push(
      `Usulkan jembatan satu kalimat (alasan ayat berikutnya datang) dengan usul_jembatan untuk ayat ${ringkasNomor(jembatanKosong)}.`,
    );
  baris.push('Judul dan jembatan yang sudah saya tulis biarkan tetap.');
  return baris.join(' ');
}
