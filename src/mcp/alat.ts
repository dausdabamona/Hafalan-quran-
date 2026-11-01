import { cariAyat, cariSurah, segmenAyat } from '../data';
import type { SakuDB, TabelUsulan } from '../db';
import { buatUsulan, daftarUsulan, GalatUsulan } from './usulan';
import { bacaMeta } from '../sinkron/mesin';
import type { HasilSinkron, Pusat } from '../sinkron/protokol';

// K-89–K-91: alat MCP Saku Hati. Tahap (a) = baca saja.
// Fungsi di sini murni terhadap database yang diberikan agar bisa diuji tanpa jendela Electron.
// Setiap jawaban menyertakan waktu sinkron HP terakhir (K-90 butir 5).

export class GalatAlat extends Error {}

type Baris = { ubahMs?: number; asal?: string; diubah?: string };

interface Konteks {
  sinkronHpTerakhir: string | null;
  idHp: string | null;
}

async function konteks(d: SakuDB): Promise<Konteks> {
  const terakhir = await bacaMeta<HasilSinkron>(d, 'sinkronTerakhir');
  const pusat = await bacaMeta<Pusat>(d, 'pusat');
  return { sinkronHpTerakhir: terakhir?.waktu ?? null, idHp: pusat?.id ?? null };
}

// Penanda asal memakai kolom mesin sinkron yang sudah ada (K-90 butir 6).
function penanda(x: Baris, k: Konteks) {
  const asal = !x.asal ? 'komputer ini' : x.asal === k.idHp ? 'HP' : 'perangkat lain';
  return {
    diubah: x.ubahMs ? new Date(x.ubahMs).toISOString() : (x.diubah ?? null),
    asal,
  };
}

function bilangan(nilai: unknown, nama: string): number {
  const n = typeof nilai === 'string' ? Number(nilai.trim()) : nilai;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new GalatAlat(`${nama} harus berupa bilangan bulat.`);
  return n;
}

function teks(nilai: unknown, nama: string): string {
  if (typeof nilai !== 'string' || !nilai.trim()) throw new GalatAlat(`${nama} harus diisi.`);
  return nilai.trim();
}

function ayatSah(surahArg: unknown, ayatArg: unknown) {
  const surah = bilangan(surahArg, 'surah');
  const nomorAyat = bilangan(ayatArg, 'ayat');
  const s = cariSurah(surah);
  if (!s) throw new GalatAlat(`Surah ${surah} tidak ada (1–114).`);
  const ayat = cariAyat(surah, nomorAyat);
  if (!ayat) throw new GalatAlat(`Surah ${s.nama} hanya ${s.jumlahAyat} ayat (penomoran Saku Hati).`);
  return { s, ayat, surah, nomorAyat };
}

// ---------- baca_makna ----------

export async function bacaMakna(d: SakuDB, argumen: Record<string, unknown>) {
  const { s, ayat, surah, nomorAyat } = ayatSah(argumen.surah, argumen.ayat);
  const k = await konteks(d);
  const sendiri = await d.makna.where('[surah+ayat]').equals([surah, nomorAyat]).toArray();
  const peta = new Map(sendiri.map((m) => [m.segmen, m]));
  return {
    surah: { nomor: s.nomor, nama: s.nama, arti: s.arti },
    ayat: nomorAyat,
    teksAyat: ayat.teks,
    potongan: segmenAyat(ayat).map((sg) => {
      const m = peta.get(sg.indeks);
      return {
        potongan: sg.indeks + 1,
        lafaz: sg.kata.map((x) => x.teks).join(' '),
        artiPerKata: sg.kata.map((x) => ({ urutan: x.urutan, kata: x.teks, arti: x.arti })),
        maknaBawaan: sg.maknaBawaan,
        maknaSendiri: m?.isi ?? null,
        ...(m ? penanda(m, k) : {}),
      };
    }),
    sinkronHpTerakhir: k.sinkronHpTerakhir,
  };
}

// ---------- baca_keterangan ----------

export async function bacaKeterangan(d: SakuDB, argumen: Record<string, unknown>) {
  const { s, ayat, surah, nomorAyat } = ayatSah(argumen.surah, argumen.ayat);
  const k = await konteks(d);
  const daftar = await d.keterangan.where('[surah+ayat]').equals([surah, nomorAyat]).toArray();
  const kataPerUrutan = new Map(ayat.kata.map((x) => [x.urutan, x]));
  const ayatSendiri = daftar.find((x) => x.urutan === 0);
  return {
    surah: { nomor: s.nomor, nama: s.nama },
    ayat: nomorAyat,
    keteranganAyat: ayatSendiri ? { isi: ayatSendiri.isi, ...penanda(ayatSendiri, k) } : null,
    keteranganKata: daftar
      .filter((x) => x.urutan > 0)
      .sort((a, b) => a.urutan - b.urutan)
      .map((x) => ({
        urutan: x.urutan,
        kata: kataPerUrutan.get(x.urutan)?.teks ?? null,
        artiKata: kataPerUrutan.get(x.urutan)?.arti ?? null,
        isi: x.isi,
        ...penanda(x, k),
      })),
    sinkronHpTerakhir: k.sinkronHpTerakhir,
  };
}

// ---------- baca_kajian_hadits ----------

export async function bacaKajianHadits(d: SakuDB, argumen: Record<string, unknown>) {
  const kitab = teks(argumen.kitab, 'kitab').toLowerCase();
  const nomor = bilangan(argumen.nomor, 'nomor');
  const kunci = `${kitab}:${nomor}`;
  const k = await konteks(d);
  const [hadits, sunting, catatan, kait, kaitManual] = await Promise.all([
    d.hadits.get(kunci),
    d.maknaHadits.get(kunci),
    d.catatanHadits.get(kunci),
    d.haditsKait.get(kunci),
    d.kaitanAyatHadits.where('hadits').equals(kunci).toArray(),
  ]);
  if (!hadits && !sunting && !catatan && !kaitManual.length) {
    throw new GalatAlat(
      `Hadits ${kunci} tidak ditemukan di komputer ini. Pastikan kode kitab benar (mis. bukhari, muslim) dan data hadits sudah dimuat di Saku Hati.`,
    );
  }
  return {
    kunci,
    kitab,
    nomor,
    bab: hadits?.bab ?? null,
    arab: hadits?.arab ?? null,
    terjemahAsli: hadits?.terjemah ?? null,
    terjemahSendiri: sunting ? { isi: sunting.isi, ...penanda(sunting, k) } : null,
    catatan: catatan ? { isi: catatan.isi, ...penanda(catatan, k) } : null,
    ayatTerkaitManual: kaitManual.map((x) => `${x.surah}:${x.ayat}`),
    ayatTerkaitData: kait?.ayat ?? [],
    padanan: kait?.padanan ?? [],
    dataHaditsTersedia: !!hadits,
    sinkronHpTerakhir: k.sinkronHpTerakhir,
  };
}

// ---------- cari_kajian ----------

const MAKS_HASIL = 50;

function cuplik(isi: string, cari: string): string {
  const i = isi.toLowerCase().indexOf(cari);
  if (isi.length <= 200) return isi;
  const awal = Math.max(0, i - 80);
  return `${awal > 0 ? '…' : ''}${isi.slice(awal, awal + 200)}${awal + 200 < isi.length ? '…' : ''}`;
}

export async function cariKajian(d: SakuDB, argumen: Record<string, unknown>) {
  const kata = teks(argumen.kata, 'kata');
  if (kata.length < 2) throw new GalatAlat('Kata yang dicari minimal 2 huruf.');
  const cari = kata.toLowerCase();
  const k = await konteks(d);
  const cocok = (isi: string) => isi.toLowerCase().includes(cari);

  const [makna, keterangan, maknaHadits, catatanHadits] = await Promise.all([
    d.makna.filter((x) => cocok(x.isi)).toArray(),
    d.keterangan.filter((x) => cocok(x.isi)).toArray(),
    d.maknaHadits.filter((x) => cocok(x.isi)).toArray(),
    d.catatanHadits.filter((x) => cocok(x.isi)).toArray(),
  ]);

  const hasil = [
    ...makna
      .sort((a, b) => a.surah - b.surah || a.ayat - b.ayat || a.segmen - b.segmen)
      .map((x) => ({
        jenis: 'makna',
        rujukan: `${x.surah}:${x.ayat}`,
        potongan: x.segmen + 1,
        cuplikan: cuplik(x.isi, cari),
        ...penanda(x, k),
      })),
    ...keterangan
      .sort((a, b) => a.surah - b.surah || a.ayat - b.ayat || a.urutan - b.urutan)
      .map((x) => ({
        jenis: x.urutan === 0 ? 'keterangan ayat' : 'keterangan kata',
        rujukan: `${x.surah}:${x.ayat}`,
        ...(x.urutan > 0 ? { urutanKata: x.urutan } : {}),
        cuplikan: cuplik(x.isi, cari),
        ...penanda(x, k),
      })),
    ...maknaHadits.map((x) => ({
      jenis: 'terjemah hadits sendiri',
      rujukan: x.kunci,
      cuplikan: cuplik(x.isi, cari),
      ...penanda(x, k),
    })),
    ...catatanHadits.map((x) => ({
      jenis: 'catatan hadits',
      rujukan: x.kunci,
      cuplikan: cuplik(x.isi, cari),
      ...penanda(x, k),
    })),
  ];

  return {
    kata,
    jumlah: hasil.length,
    ditampilkan: Math.min(hasil.length, MAKS_HASIL),
    hasil: hasil.slice(0, MAKS_HASIL),
    sinkronHpTerakhir: k.sinkronHpTerakhir,
  };
}

// ---------- status_sinkron ----------

export async function statusSinkron(d: SakuDB) {
  const terakhir = await bacaMeta<HasilSinkron>(d, 'sinkronTerakhir');
  const pusat = await bacaMeta<Pusat>(d, 'pusat');
  const [makna, keterangan, maknaHadits, catatanHadits] = await Promise.all([
    d.makna.count(),
    d.keterangan.count(),
    d.maknaHadits.count(),
    d.catatanHadits.count(),
  ]);
  return {
    terpasangDenganHp: !!pusat,
    alamatHp: pusat?.alamat ?? null,
    sinkronHpTerakhir: terakhir?.waktu ?? null,
    hasilSinkronTerakhir: terakhir ? { dikirim: terakhir.dikirim, diterima: terakhir.diterima } : null,
    jumlahCatatan: { makna, keterangan, terjemahHaditsSendiri: maknaHadits, catatanHadits },
    catatan:
      'Data di komputer ini adalah cermin dari HP per sinkron terakhir. Sinkron berjalan otomatis tiap 2 menit selama Saku Hati di HP terbuka di Wi-Fi yang sama.',
  };
}

// ---------- Usulan (tahap b, K-91/K-92) ----------

const ALAT_USULAN: Record<string, TabelUsulan> = {
  usul_makna: 'makna',
  usul_keterangan: 'keterangan',
  usul_terjemah_hadits: 'maknaHadits',
  usul_catatan_hadits: 'catatanHadits',
};

async function usul(d: SakuDB, jenis: TabelUsulan, argumen: Record<string, unknown>) {
  const k = await konteks(d);
  try {
    const { usulan, diganti } = await buatUsulan(d, jenis, argumen);
    return {
      tersimpan: true,
      idUsulan: usulan.kunci,
      rujukan: usulan.rujukan,
      isiLama: usulan.isiLama,
      isiBawaan: usulan.isiBawaan,
      isiBaru: usulan.isiBaru,
      menggantikanUsulanSebelumnya: diganti,
      catatan:
        'Ini usulan, belum mengubah data. Usulan masuk ke HP saat sinkron berikutnya dan berlaku setelah Firdaus menerimanya di layar Usulan Claude.',
      sinkronHpTerakhir: k.sinkronHpTerakhir,
    };
  } catch (e) {
    if (e instanceof GalatUsulan) throw new GalatAlat(e.message);
    throw e;
  }
}

async function lihatUsulan(d: SakuDB, argumen: Record<string, unknown>) {
  const semua = argumen.status === 'semua';
  const batas = argumen.batas === undefined ? 30 : Math.min(100, Math.max(1, bilangan(argumen.batas, 'batas')));
  const k = await konteks(d);
  const { jumlah, hasil } = await daftarUsulan(d, !semua, batas);
  return {
    jumlah,
    usulan: hasil.map((u) => ({
      idUsulan: u.kunci,
      rujukan: u.rujukan,
      status: u.statusEfektif,
      isiBaru: u.isiBaru,
      isiLama: u.isiLama,
      catatan: u.catatan ?? null,
      dibuat: u.dibuat,
      diputuskan: u.diputuskan ?? null,
    })),
    sinkronHpTerakhir: k.sinkronHpTerakhir,
  };
}

// ---------- Pengarah ----------

export const NAMA_ALAT = [
  'baca_makna',
  'baca_keterangan',
  'baca_kajian_hadits',
  'cari_kajian',
  'status_sinkron',
  'daftar_usulan',
  ...Object.keys(ALAT_USULAN),
] as const;

export async function jalankanAlat(d: SakuDB, nama: string, argumen: Record<string, unknown> = {}) {
  if (nama in ALAT_USULAN) return usul(d, ALAT_USULAN[nama], argumen);
  switch (nama) {
    case 'daftar_usulan':
      return lihatUsulan(d, argumen);
    case 'baca_makna':
      return bacaMakna(d, argumen);
    case 'baca_keterangan':
      return bacaKeterangan(d, argumen);
    case 'baca_kajian_hadits':
      return bacaKajianHadits(d, argumen);
    case 'cari_kajian':
      return cariKajian(d, argumen);
    case 'status_sinkron':
      return statusSinkron(d);
    default:
      throw new GalatAlat(`Alat "${nama}" tidak dikenal.`);
  }
}
