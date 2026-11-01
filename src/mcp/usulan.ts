import { cariAyat, cariSurah, segmenAyat } from '../data';
import { catatHapus, idAcak, type SakuDB, type StatusUsulan, type TabelUsulan, type UsulanClaude } from '../db';

// K-92/K-93: pembuatan usulan Claude dan penentuan status efektifnya.
// Dipakai alat MCP (tahap b) dan layar Usulan Claude di HP (tahap c).

export class GalatUsulan extends Error {}

export const MAKS_ISI = 4000;
export const MAKS_CATATAN = 1000;

export type StatusEfektif = StatusUsulan | 'bentrok';

type BarisTujuan = { isi: string; ubahMs?: number } | undefined;

export async function barisTujuan(d: SakuDB, tabel: TabelUsulan, kunci: string): Promise<BarisTujuan> {
  return (await d.table(tabel).get(kunci)) as BarisTujuan;
}

// Usulan yang masih menunggu dianggap bentrok bila baris tujuannya berubah sesudah usulan dibuat (K-93).
export function statusEfektif(u: UsulanClaude, baris: BarisTujuan): StatusEfektif {
  if (u.status !== 'menunggu') return u.status;
  return (baris?.ubahMs ?? 0) !== u.dasarUbahMs ? 'bentrok' : 'menunggu';
}

function bersihkan(isi: unknown, catatan: unknown) {
  if (typeof isi !== 'string' || !isi.trim()) {
    throw new GalatUsulan('Isi usulan harus diisi. Claude tidak bisa mengosongkan atau menghapus catatan.');
  }
  const isiBersih = isi.trim();
  if (isiBersih.length > MAKS_ISI) throw new GalatUsulan(`Isi usulan terlalu panjang (maksimal ${MAKS_ISI} huruf).`);
  let catatanBersih: string | undefined;
  if (catatan !== undefined && catatan !== null && catatan !== '') {
    if (typeof catatan !== 'string') throw new GalatUsulan('Catatan harus berupa teks.');
    catatanBersih = catatan.trim().slice(0, MAKS_CATATAN) || undefined;
  }
  return { isiBersih, catatanBersih };
}

function bilangan(nilai: unknown, nama: string): number {
  const n = typeof nilai === 'string' ? Number(nilai.trim()) : nilai;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new GalatUsulan(`${nama} harus berupa bilangan bulat.`);
  return n;
}

interface Sasaran {
  tabel: TabelUsulan;
  kunciTujuan: string;
  rujukan: string;
  isiBawaan: string | null;
  lokasi: Pick<UsulanClaude, 'surah' | 'ayat' | 'segmen' | 'urutan' | 'kitab' | 'nomor'>;
}

function ayatSah(surahArg: unknown, ayatArg: unknown) {
  const surah = bilangan(surahArg, 'surah');
  const nomorAyat = bilangan(ayatArg, 'ayat');
  const s = cariSurah(surah);
  if (!s) throw new GalatUsulan(`Surah ${surah} tidak ada (1–114).`);
  const ayat = cariAyat(surah, nomorAyat);
  if (!ayat) throw new GalatUsulan(`Surah ${s.nama} hanya ${s.jumlahAyat} ayat (penomoran Saku Hati).`);
  return { s, ayat, surah, nomorAyat };
}

export function sasaranMakna(a: Record<string, unknown>): Sasaran {
  const { s, ayat, surah, nomorAyat } = ayatSah(a.surah, a.ayat);
  // Potongan bernomor mulai 1 seperti di baca_makna; di database (segmen) mulai 0.
  const potongan = bilangan(a.potongan, 'potongan');
  const daftar = segmenAyat(ayat);
  const sg = daftar[potongan - 1];
  if (!sg) {
    throw new GalatUsulan(`${s.nama} ${nomorAyat} punya ${daftar.length} potongan waqaf (1–${daftar.length}). Lihat baca_makna.`);
  }
  return {
    tabel: 'makna',
    kunciTujuan: `${surah}:${nomorAyat}:${sg.indeks}`,
    rujukan: `${s.nama} ${nomorAyat} · potongan ${potongan}`,
    isiBawaan: sg.maknaBawaan || null,
    lokasi: { surah, ayat: nomorAyat, segmen: sg.indeks },
  };
}

export function sasaranKeterangan(a: Record<string, unknown>): Sasaran {
  const { s, ayat, surah, nomorAyat } = ayatSah(a.surah, a.ayat);
  const urutan = a.urutan_kata === undefined || a.urutan_kata === null ? 0 : bilangan(a.urutan_kata, 'urutan_kata');
  const kata = urutan > 0 ? ayat.kata.find((k) => k.urutan === urutan) : undefined;
  if (urutan < 0 || (urutan > 0 && !kata)) {
    throw new GalatUsulan(`${s.nama} ${nomorAyat} punya ${ayat.kata.length} kata (urutan_kata 1–${ayat.kata.length}; 0 = ayat).`);
  }
  return {
    tabel: 'keterangan',
    kunciTujuan: `${surah}:${nomorAyat}:${urutan}`,
    rujukan: kata ? `${s.nama} ${nomorAyat} · kata ${urutan} (${kata.teks})` : `${s.nama} ${nomorAyat} · keterangan ayat`,
    isiBawaan: null,
    lokasi: { surah, ayat: nomorAyat, urutan },
  };
}

async function sasaranHadits(d: SakuDB, a: Record<string, unknown>, tabel: 'maknaHadits' | 'catatanHadits') {
  if (typeof a.kitab !== 'string' || !a.kitab.trim()) throw new GalatUsulan('kitab harus diisi.');
  const kitab = a.kitab.trim().toLowerCase();
  const nomor = bilangan(a.nomor, 'nomor');
  const kunci = `${kitab}:${nomor}`;
  const hadits = await d.hadits.get(kunci);
  const sudahAda = await d.table(tabel).get(kunci);
  if (!hadits && !sudahAda) {
    throw new GalatUsulan(`Hadits ${kunci} tidak ditemukan di komputer ini, jadi belum bisa diberi usulan.`);
  }
  const s: Sasaran = {
    tabel,
    kunciTujuan: kunci,
    rujukan: `${kitab} ${nomor} · ${tabel === 'maknaHadits' ? 'terjemah' : 'catatan'}`,
    isiBawaan: tabel === 'maknaHadits' ? (hadits?.terjemah ?? null) : null,
    lokasi: { kitab, nomor },
  };
  return s;
}

export async function sasaranUsulan(d: SakuDB, jenis: TabelUsulan, a: Record<string, unknown>): Promise<Sasaran> {
  if (jenis === 'makna') return sasaranMakna(a);
  if (jenis === 'keterangan') return sasaranKeterangan(a);
  return sasaranHadits(d, a, jenis);
}

// Membuat satu usulan. Usulan lama yang masih menunggu untuk baris yang sama ditandai "diganti".
export async function buatUsulan(d: SakuDB, jenis: TabelUsulan, a: Record<string, unknown>) {
  const { isiBersih, catatanBersih } = bersihkan(a.isi, a.catatan);
  const sasaran = await sasaranUsulan(d, jenis, a);
  const baris = await barisTujuan(d, sasaran.tabel, sasaran.kunciTujuan);
  const isiSekarang = baris?.isi ?? sasaran.isiBawaan ?? '';
  if (isiSekarang.trim() === isiBersih) throw new GalatUsulan('Usulan sama dengan isi yang berlaku sekarang.');

  const kini = new Date().toISOString();
  const usulan: UsulanClaude = {
    kunci: idAcak(),
    tabel: sasaran.tabel,
    kunciTujuan: sasaran.kunciTujuan,
    rujukan: sasaran.rujukan,
    isiBaru: isiBersih,
    isiLama: baris?.isi ?? null,
    isiBawaan: sasaran.isiBawaan,
    dasarUbahMs: baris?.ubahMs ?? 0,
    ...(catatanBersih ? { catatan: catatanBersih } : {}),
    dibuat: kini,
    status: 'menunggu',
    ...sasaran.lokasi,
  };

  let diganti = 0;
  await d.transaction('rw', d.usulanClaude, async () => {
    const lama = await d.usulanClaude
      .where('[tabel+kunciTujuan]')
      .equals([sasaran.tabel, sasaran.kunciTujuan])
      .filter((x) => x.status === 'menunggu')
      .toArray();
    for (const x of lama) await d.usulanClaude.update(x.kunci, { status: 'diganti', diputuskan: kini });
    diganti = lama.length;
    await d.usulanClaude.add(usulan);
  });
  return { usulan, diganti };
}

export async function daftarUsulan(d: SakuDB, hanyaMenunggu: boolean, batas = 50) {
  const semua = hanyaMenunggu
    ? await d.usulanClaude.where('status').equals('menunggu').toArray()
    : await d.usulanClaude.toArray();
  semua.sort((a, b) => b.dibuat.localeCompare(a.dibuat));
  const hasil: (UsulanClaude & { statusEfektif: StatusEfektif })[] = [];
  for (const u of semua.slice(0, batas)) {
    hasil.push({ ...u, statusEfektif: statusEfektif(u, await barisTujuan(d, u.tabel, u.kunciTujuan)) });
  }
  return { jumlah: semua.length, hasil };
}

// ---------- Keputusan Firdaus (tahap c, K-92/K-93) ----------

// Baris tujuan ditulis seperti suntingan biasa (penanda sinkron diisi otomatis oleh hook).
// `dariUsulan` menandai baris yang isinya berasal dari usulan Claude; hilang sendiri bila disunting lagi.
async function tulisTujuan(d: SakuDB, u: UsulanClaude, isi: string | null, dariUsulan?: string) {
  const tabel = d.table(u.tabel);
  if (isi === null) {
    if (await tabel.get(u.kunciTujuan)) {
      await tabel.delete(u.kunciTujuan);
      await catatHapus(d, u.tabel, [u.kunciTujuan]);
    }
    return;
  }
  const diubah = new Date().toISOString();
  const tanda = dariUsulan ? { dariUsulan } : {};
  if (u.tabel === 'makna') {
    await tabel.put({ kunci: u.kunciTujuan, surah: u.surah, ayat: u.ayat, segmen: u.segmen, isi, diubah, ...tanda });
  } else if (u.tabel === 'keterangan') {
    await tabel.put({ kunci: u.kunciTujuan, surah: u.surah, ayat: u.ayat, urutan: u.urutan, isi, diubah, ...tanda });
  } else {
    await tabel.put({ kunci: u.kunciTujuan, kitab: u.kitab, nomor: u.nomor, isi, diubah, ...tanda });
  }
}

async function ambilMenunggu(d: SakuDB, kunci: string): Promise<UsulanClaude> {
  const u = await d.usulanClaude.get(kunci);
  if (!u) throw new GalatUsulan('Usulan tidak ditemukan.');
  if (u.status !== 'menunggu') throw new GalatUsulan('Usulan ini sudah diputuskan.');
  return u;
}

// Terima usulan. `isi` diisi bila Firdaus menyunting gabungan atau memilih usulan saat bentrok.
// Tanpa `paksa`, usulan yang bentrok ditolak agar versi HP tidak tertimpa diam-diam (K-93).
export async function terimaUsulan(d: SakuDB, kunci: string, opsi: { isi?: string; paksa?: boolean } = {}) {
  await d.transaction('rw', [d.usulanClaude, d.table('makna'), d.table('keterangan'), d.maknaHadits, d.catatanHadits, d.hapus], async () => {
    const u = await ambilMenunggu(d, kunci);
    const baris = await barisTujuan(d, u.tabel, u.kunciTujuan);
    if (statusEfektif(u, baris) === 'bentrok' && !opsi.paksa) {
      throw new GalatUsulan('Catatan ini sudah diubah sesudah usulan dibuat. Pilih versi yang dipakai.');
    }
    const isi = (opsi.isi ?? u.isiBaru).trim();
    if (!isi) throw new GalatUsulan('Isi tidak boleh kosong.');
    const kini = new Date().toISOString();
    await tulisTujuan(d, u, isi, kini);
    // Isi lama yang sebenarnya ditimpa disimpan agar "Kembalikan" memulihkan versi yang tepat.
    await d.usulanClaude.update(u.kunci, {
      status: 'diterima',
      diputuskan: kini,
      isiDiterima: isi,
      isiLama: baris?.isi ?? null,
    });
  });
}

export async function tolakUsulan(d: SakuDB, kunci: string) {
  const u = await ambilMenunggu(d, kunci);
  await d.usulanClaude.update(u.kunci, { status: 'ditolak', diputuskan: new Date().toISOString() });
}

// "Terima semua" melewati usulan yang bentrok (K-92). Mengembalikan jumlah diterima dan dilewati.
export async function terimaSemua(d: SakuDB) {
  const menunggu = await d.usulanClaude.where('status').equals('menunggu').toArray();
  let diterima = 0;
  let dilewati = 0;
  for (const u of menunggu) {
    if (statusEfektif(u, await barisTujuan(d, u.tabel, u.kunciTujuan)) === 'bentrok') {
      dilewati++;
      continue;
    }
    await terimaUsulan(d, u.kunci);
    diterima++;
  }
  return { diterima, dilewati };
}

// Mengembalikan suntingan yang diterima ke isi lama — hanya bila catatan itu belum diubah lagi.
export async function kembalikanUsulan(d: SakuDB, kunci: string) {
  await d.transaction('rw', [d.usulanClaude, d.table('makna'), d.table('keterangan'), d.maknaHadits, d.catatanHadits, d.hapus], async () => {
    const u = await d.usulanClaude.get(kunci);
    if (!u || u.status !== 'diterima' || u.dikembalikan) throw new GalatUsulan('Usulan ini tidak bisa dikembalikan.');
    const baris = await barisTujuan(d, u.tabel, u.kunciTujuan);
    if ((baris?.isi ?? null) !== (u.isiDiterima ?? u.isiBaru)) {
      throw new GalatUsulan('Catatan ini sudah diubah lagi sesudah usulan diterima, jadi tidak dikembalikan otomatis.');
    }
    await tulisTujuan(d, u, u.isiLama);
    await d.usulanClaude.update(u.kunci, { dikembalikan: new Date().toISOString() });
  });
}
