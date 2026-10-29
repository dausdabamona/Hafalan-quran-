import { describe, expect, it } from 'vitest';
import { cariRukuk, rukukAyat } from './data';
import {
  ayatHafal,
  batalkanBaru,
  daftarPemantapan,
  hafalanBaruTerakhir,
  jalurHafalan,
  kunciPotongan,
  pemantapanTertunda,
  pilihHafalanBaru,
  setelahKoreksiPotongan,
  tambahHari,
  tandaiAyatLama,
  type EntriHafalan,
  type EntriJadwal,
} from './jadwal';
import type { Potongan } from './data';
import { perkiraanSelesai } from './target';

// K-88: pemantapan hafalan baru, gerbang adaptif, dan kembalikan ke belum hafal.
const H1 = '2026-11-01';
const H2 = tambahHari(H1, 1);
const H3 = tambahHari(H1, 2);
const H4 = tambahHari(H1, 3);

interface Keadaan {
  hafalan: Map<string, EntriHafalan>;
  jadwal: Map<number, EntriJadwal>;
}

const kosong = (): Keadaan => ({ hafalan: new Map(), jadwal: new Map() });

function rekam(k: Keadaan, p: Potongan, lancar: boolean, hari: string) {
  const u = setelahKoreksiPotongan(k.hafalan, k.jadwal, p, lancar, hari);
  if (u.hafalan) k.hafalan.set(u.hafalan.kunci, u.hafalan);
  for (const j of u.jadwal) k.jadwal.set(j.nomor, j);
  return u.hafalan!;
}

const [P1, P2, P3] = jalurHafalan();

describe('pemantapan (K-88 C)', () => {
  it('hari menghafal = pemantapan ke-1; mantap setelah lancar 3 hari berbeda', () => {
    const k = kosong();
    expect(rekam(k, P1, true, H1)).toMatchObject({ mantap: 1, hariLancar: H1, goyah: false });
    // Potongan yang dihafal hari ini belum masuk daftar pemantapan.
    expect(daftarPemantapan(k.hafalan, H1)).toHaveLength(0);

    const h2 = daftarPemantapan(k.hafalan, H2);
    expect(h2).toHaveLength(1);
    expect(h2[0]).toMatchObject({ ke: 2, sudahHariIni: false, goyah: false, tuntas: false });
    rekam(k, P1, true, H2);
    expect(k.hafalan.get(kunciPotongan(P1))!.mantap).toBe(2);
    expect(daftarPemantapan(k.hafalan, H2)[0]).toMatchObject({ ke: 2, sudahHariIni: true });

    rekam(k, P1, true, H3);
    // Mantap tepat hari ini: masih tampil sebagai umpan balik, tidak lagi tertunda.
    expect(daftarPemantapan(k.hafalan, H3)[0]).toMatchObject({ ke: 3, tuntas: true });
    expect(pemantapanTertunda(k.hafalan, H3)).toHaveLength(0);
    expect(daftarPemantapan(k.hafalan, H4)).toHaveLength(0);
  });

  it('salah: hitungan tidak naik dan tidak kembali ke nol; diulang hari itu juga lalu lancar → naik', () => {
    const k = kosong();
    rekam(k, P1, true, H1);
    expect(rekam(k, P1, false, H2)).toMatchObject({ mantap: 1, goyah: true });
    expect(daftarPemantapan(k.hafalan, H2)[0]).toMatchObject({ ke: 2, goyah: true, sudahHariIni: false });
    expect(rekam(k, P1, true, H2)).toMatchObject({ mantap: 2, goyah: false, hariLancar: H2 });
  });

  it('satu hari dihitung paling banyak sekali', () => {
    const k = kosong();
    rekam(k, P1, true, H1);
    rekam(k, P1, true, H1);
    expect(k.hafalan.get(kunciPotongan(P1))!.mantap).toBe(1);
    rekam(k, P1, true, H2);
    rekam(k, P1, true, H2);
    expect(k.hafalan.get(kunciPotongan(P1))!.mantap).toBe(2);
  });

  it('belum lancar di hari pertama (P-06): mantap 0, hari lancar pertama menjadi ke-1', () => {
    const k = kosong();
    expect(rekam(k, P1, false, H1)).toMatchObject({ mantap: 0, sabaqLancar: false });
    expect(pilihHafalanBaru(k.hafalan, H2).status).toBe('ulang');
    expect(rekam(k, P1, true, H2)).toMatchObject({ mantap: 1, hariLancar: H2, sabaqLancar: true });
  });

  it('hafalan baru sebelum K-88 (tanpa hitungan) dianggap mantap dan tidak menahan', () => {
    const k = kosong();
    const e = rekam(k, P1, true, H1);
    const { mantap: _m, hariLancar: _h, goyah: _g, ...lama } = e;
    k.hafalan.set(e.kunci, lama);
    expect(daftarPemantapan(k.hafalan, H2)).toHaveLength(0);
    expect(pilihHafalanBaru(k.hafalan, H2)).toEqual({ status: 'baru', potongan: P2 });
    // Diulang lagi pun tidak mulai dihitung.
    expect(rekam(k, P1, true, H2).mantap).toBeUndefined();
  });

  it('salah saat pemantapan tetap menurunkan jadwal rukuk seperti sebelumnya', () => {
    const k = kosong();
    rekam(k, P1, true, H1);
    const r = rukukAyat(P1.surah, P1.ayatAwal)!.nomor;
    const u = setelahKoreksiPotongan(k.hafalan, k.jadwal, P1, false, H2);
    expect(u.jadwal.map((j) => j.nomor)).toEqual([r]);
  });
});

describe('gerbang adaptif (K-88 D1)', () => {
  it('potongan baru terbuka setelah semua pemantapan hari ini lancar; saat lancar tetap satu per hari', () => {
    const k = kosong();
    expect(pilihHafalanBaru(k.hafalan, H1)).toEqual({ status: 'baru', potongan: P1 });
    rekam(k, P1, true, H1);
    expect(pilihHafalanBaru(k.hafalan, H1).status).toBe('selesai');

    // Hari 2: P1 harus dimantapkan dulu.
    expect(pilihHafalanBaru(k.hafalan, H2)).toEqual({ status: 'mantapkan', potongan: P2 });
    rekam(k, P1, true, H2);
    expect(pilihHafalanBaru(k.hafalan, H2)).toEqual({ status: 'baru', potongan: P2 });
    rekam(k, P2, true, H2);

    // Hari 3: dua pemantapan (P1 ke-3, P2 ke-2).
    expect(pemantapanTertunda(k.hafalan, H3).map((x) => [x.entri.kunci, x.ke])).toEqual([
      [kunciPotongan(P1), 3],
      [kunciPotongan(P2), 2],
    ]);
    rekam(k, P1, true, H3);
    expect(pilihHafalanBaru(k.hafalan, H3).status).toBe('mantapkan');
    rekam(k, P2, true, H3);
    expect(pilihHafalanBaru(k.hafalan, H3)).toEqual({ status: 'baru', potongan: P3 });
  });

  it('pemantapan yang goyah menahan potongan baru sampai lancar', () => {
    const k = kosong();
    rekam(k, P1, true, H1);
    rekam(k, P1, false, H2);
    expect(pilihHafalanBaru(k.hafalan, H2).status).toBe('mantapkan');
    // Hari berikutnya pun masih tertahan.
    expect(pilihHafalanBaru(k.hafalan, H3).status).toBe('mantapkan');
    rekam(k, P1, true, H3);
    expect(pilihHafalanBaru(k.hafalan, H3)).toEqual({ status: 'baru', potongan: P2 });
  });

  it('syarat 1 = perilaku lama (tanpa pemantapan)', () => {
    const k = kosong();
    rekam(k, P1, true, H1);
    expect(pilihHafalanBaru(k.hafalan, H2, undefined, 1)).toEqual({ status: 'baru', potongan: P2 });
    expect(daftarPemantapan(k.hafalan, H2, 1)).toHaveLength(0);
  });

  it('syarat 5: lima hari lancar', () => {
    const k = kosong();
    let hari = H1;
    for (let i = 0; i < 5; i++) {
      rekam(k, P1, true, hari);
      hari = tambahHari(hari, 1);
    }
    expect(k.hafalan.get(kunciPotongan(P1))!.mantap).toBe(5);
    expect(pemantapanTertunda(k.hafalan, hari, 5)).toHaveLength(0);
    expect(pemantapanTertunda(k.hafalan, hari, 3)).toHaveLength(0);
  });
});

describe('kembalikan ke belum hafal (K-88 A)', () => {
  it('satu-satunya potongan di rukuk: entri & jadwal rukuk dihapus, potongan kembali jadi hafalan baru', () => {
    const k = kosong();
    rekam(k, P1, true, H1);
    const r = rukukAyat(P1.surah, P1.ayatAwal)!.nomor;
    expect(k.jadwal.has(r)).toBe(true);
    const b = batalkanBaru(kunciPotongan(P1), k.hafalan, k.jadwal, H2)!;
    expect(b.hapusHafalan).toEqual([kunciPotongan(P1)]);
    expect(b.hapusJadwal).toEqual([r]);
    expect(b.ayatLepas).toEqual(Array.from({ length: P1.ayatAkhir - P1.ayatAwal + 1 }, (_, i) => P1.ayatAwal + i));
    k.hafalan.delete(kunciPotongan(P1));
    k.jadwal.delete(r);
    expect(pilihHafalanBaru(k.hafalan, H2)).toEqual({ status: 'baru', potongan: P1 });
  });

  it('potongan yang dibatalkan di tengah jalur didahulukan sebelum melanjutkan', () => {
    const k = kosong();
    rekam(k, P1, true, H1);
    rekam(k, P2, true, H2);
    const b = batalkanBaru(kunciPotongan(P1), k.hafalan, k.jadwal, H3)!;
    for (const x of b.hapusHafalan) k.hafalan.delete(x);
    for (const j of b.jadwal) k.jadwal.set(j.nomor, j);
    for (const n of b.hapusJadwal) k.jadwal.delete(n);
    // P2 masih dimantapkan (ke-3), lalu P1 menjadi hafalan baru berikutnya.
    expect(pilihHafalanBaru(k.hafalan, H3)).toEqual({ status: 'mantapkan', potongan: P1 });
    rekam(k, P2, true, H3);
    expect(pilihHafalanBaru(k.hafalan, H3)).toEqual({ status: 'baru', potongan: P1 });
  });

  it('rukuk lengkap menjadi tidak lengkap → diulang harian (masih ada hafalan baru)', () => {
    const k = kosong();
    const r = cariRukuk(rukukAyat(P1.surah, P1.ayatAwal)!.nomor)!;
    const potongan = jalurHafalan().filter(
      (p) => p.surah === r.surah && p.ayatAwal >= r.ayatAwal && p.ayatAkhir <= r.ayatAkhir,
    );
    expect(potongan.length).toBeGreaterThan(1);
    let hari = H1;
    for (const p of potongan) {
      rekam(k, p, true, hari);
      hari = tambahHari(hari, 1);
    }
    k.jadwal.set(r.nomor, { ...k.jadwal.get(r.nomor)!, tingkat: 3, jatuhTempo: tambahHari(hari, 14) });
    expect(k.jadwal.get(r.nomor)!.lengkap).toBe(true);
    const b = batalkanBaru(kunciPotongan(potongan[1]), k.hafalan, k.jadwal, hari)!;
    expect(b.hapusJadwal).toEqual([]);
    expect(b.jadwal).toEqual([
      expect.objectContaining({
        nomor: r.nomor,
        lengkap: false,
        sebagian: false,
        tingkat: 0,
        jatuhTempo: tambahHari(hari, 1),
      }),
    ]);
  });

  it('sisanya hanya hafalan lama → rukuk berjarak "sebagian"', () => {
    const k = kosong();
    const t = tandaiAyatLama([{ surah: P1.surah, ayat: P1.ayatAwal }], k.hafalan, k.jadwal, H1);
    for (const e of t.hafalan) k.hafalan.set(e.kunci, e);
    for (const j of t.jadwal) k.jadwal.set(j.nomor, j);
    // Hafalan baru berikutnya: potongan pertama yang masih punya ayat belum tercatat.
    const hb = pilihHafalanBaru(k.hafalan, H2);
    expect(hb.status).toBe('baru');
    const p = (hb as { potongan: Potongan }).potongan;
    rekam(k, p, true, H2);
    const r = rukukAyat(p.surah, p.ayatAwal)!.nomor;
    expect(k.jadwal.get(r)).toMatchObject({ sebagian: false });
    const b = batalkanBaru(kunciPotongan(p), k.hafalan, k.jadwal, H3)!;
    expect(b.jadwal).toEqual([expect.objectContaining({ nomor: r, lengkap: false, sebagian: true })]);
    // Ayat yang juga tercatat sebagai hafalan lama tidak ikut dilepas.
    expect(b.ayatLepas).not.toContain(P1.ayatAwal);
  });

  it('hafalan lama dan potongan yang belum lancar tidak bisa dibatalkan lewat jalur ini', () => {
    const k = kosong();
    const t = tandaiAyatLama([{ surah: 1, ayat: 1 }], k.hafalan, k.jadwal, H1);
    for (const e of t.hafalan) k.hafalan.set(e.kunci, e);
    expect(batalkanBaru(t.hafalan[0].kunci, k.hafalan, k.jadwal, H1)).toBeNull();
    rekam(k, P2, false, H1);
    expect(batalkanBaru(kunciPotongan(P2), k.hafalan, k.jadwal, H1)).toBeNull();
    expect(batalkanBaru('1:99-99', k.hafalan, k.jadwal, H1)).toBeNull();
  });

  it('potongan terakhir yang lancar dipilih untuk tombol di Hari ini', () => {
    const k = kosong();
    rekam(k, P1, true, H1);
    rekam(k, P2, true, H2);
    rekam(k, P3, false, H3);
    expect(hafalanBaruTerakhir(k.hafalan)?.kunci).toBe(kunciPotongan(P2));
    expect(ayatHafal(k.hafalan).size).toBeGreaterThan(0);
  });
});

describe('perkiraan selesai target (K-88 E)', () => {
  // Al-Ikhlas (4 ayat) sebagai target 10 hari.
  const t = { jenis: 'surah' as const, nomor: 112, mulai: H1, hari: 10 };
  const entri = (awal: number, akhir: number, mulai: string, lama = false): EntriHafalan => ({
    kunci: `112:${awal}-${akhir}`,
    surah: 112,
    ayatAwal: awal,
    ayatAkhir: akhir,
    mulai,
    terakhir: mulai,
    sabaqLancar: true,
    ...(lama ? { lama: true } : { mantap: 1, hariLancar: mulai }),
  });

  it('belum tampil sebelum hari ke-3 atau bila belum ada hafalan baru di target', () => {
    const h = new Map([['112:1-1', entri(1, 1, H1)]]);
    expect(perkiraanSelesai(t, h, H2)).toBeNull();
    expect(perkiraanSelesai(t, new Map(), H3)).toBeNull();
  });

  it('kecepatan nyata = ayat target dari hafalan baru ÷ hari berjalan', () => {
    // 1 ayat dalam 4 hari → 0,25 ayat/hari; sisa 3 ayat → 12 hari lagi.
    const h = new Map([['112:1-1', entri(1, 1, H1)]]);
    const p = perkiraanSelesai(t, h, H4)!;
    expect(p.laju).toBeCloseTo(0.25);
    expect(p.tanggal).toBe(tambahHari(H4, 12));
    expect(p.lamaHari).toBe(16);
  });

  it('hafalan lama dan hafalan sebelum target dimulai tidak dihitung sebagai kecepatan', () => {
    const h = new Map([
      ['112:1-1', entri(1, 1, tambahHari(H1, -5))],
      ['112:2-2', entri(2, 2, H1, true)],
      ['112:3-3', entri(3, 3, H2)],
    ]);
    const p = perkiraanSelesai(t, h, H4)!;
    expect(p.laju).toBeCloseTo(0.25); // hanya ayat 3
    expect(p.tanggal).toBe(tambahHari(H4, 4)); // sisa 1 ayat ÷ 0,25
  });

  it('target sudah selesai → tidak ada perkiraan', () => {
    const h = new Map([['112:1-4', entri(1, 4, H1)]]);
    expect(perkiraanSelesai(t, h, H4)).toBeNull();
  });
});
