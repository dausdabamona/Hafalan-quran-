import { useEffect, useState } from 'react';
import { cariRukuk, cariSurah, juzAyat, JUMLAH_AYAT, labelPotongan, rukukSurah, type Potongan, type Rukuk } from '../data';
import { ambilHafalan, ambilJadwal } from '../db';
import {
  ayatHafal,
  BATAS_ULANG_MALAM,
  daftarUlangHafalan,
  hariIni,
  kelompok,
  labelAyatHafal,
  pilihHafalanBaru,
  rentangMurojaah,
  selesaiHariIni,
  selisihHari,
  type EntriHafalan,
  type EntriJadwal,
} from '../jadwal';
import { hashPotongan, pergi } from '../navigasi';

export function namaPotongan(p: Potongan): string {
  return `${cariSurah(p.surah)?.nama ?? p.surah} · ${labelPotongan(p)}`;
}

export function namaRukuk(r: Rukuk): string {
  const nama = cariSurah(r.surah)?.nama ?? String(r.surah);
  const semua = rukukSurah(r.surah);
  return semua.length > 1 ? `${nama} · rukuk ${semua.findIndex((x) => x.nomor === r.nomor) + 1}` : nama;
}

function baca(kunci: string): string | null {
  try {
    return localStorage.getItem(kunci);
  } catch {
    return null;
  }
}

function tulis(kunci: string, nilai: string | null) {
  try {
    if (nilai === null) localStorage.removeItem(kunci);
    else localStorage.setItem(kunci, nilai);
  } catch {
    // abaikan
  }
}

const LABEL_KELOMPOK = { berjalan: 'Berjalan', dekat: 'Dekat', lama: 'Lama' } as const;

export default function LayarHariIni() {
  const hari = hariIni();
  const [hafalan, setHafalan] = useState<Map<string, EntriHafalan> | null>(null);
  const [jadwal, setJadwal] = useState<Map<number, EntriJadwal>>(new Map());
  const [lihatSemua, setLihatSemua] = useState(false);

  useEffect(() => {
    ambilHafalan().then(setHafalan);
    ambilJadwal().then(setJadwal);
  }, []);

  if (!hafalan) return null;

  const baru = pilihHafalanBaru(hafalan, hari);
  const ulang = daftarUlangHafalan(jadwal, hari);
  const selesai = selesaiHariIni(jadwal, hari);
  const tampil = lihatSemua ? ulang : ulang.slice(0, BATAS_ULANG_MALAM);
  const jumlahHafal = ayatHafal(hafalan).size;
  const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <header className="kepala">
        <div className="judul-surah">
          <h1>Saku Hati</h1>
          <p className="sub">Sedikit Ayat, Kuat Ulangnya</p>
        </div>
        <button className="tombol-ikon" onClick={() => pergi('#/tentang')} aria-label="Tentang">
          i
        </button>
      </header>

      <p className="keterangan-daftar">
        {tanggal} · {jumlahHafal} dari {JUMLAH_AYAT} ayat sudah dihafal
      </p>

      <KartuHafalanBaru baru={baru} hari={hari} />

      <section className="kartu">
        <h2>
          Ulang hafalan per rukuk <span className="istilah">Sabqi & Manzil · sebelum tidur</span>
        </h2>
        {ulang.length === 0 ? (
          <p className="kosong">
            {selesai.length > 0
              ? `Alhamdulillah, ${selesai.length} rukuk sudah diulang hari ini.`
              : 'Belum ada rukuk yang jatuh tempo hari ini.'}
          </p>
        ) : (
          <>
            <ul className="daftar-ulang">
              {tampil.map((j) => {
                const r = cariRukuk(j.nomor)!;
                const rentang = rentangMurojaah(j, hafalan);
                const telat = selisihHari(j.jatuhTempo, hari);
                const k = kelompok(j);
                return (
                  <li key={j.nomor}>
                    <button
                      className="baris-ulang"
                      disabled={!rentang}
                      onClick={() => rentang && pergi(hashPotongan('rekam', rentang, j.nomor))}
                    >
                      <span className={'label-kelompok ' + k}>{LABEL_KELOMPOK[k]}</span>
                      <span className="info">
                        <span className="nama">{namaRukuk(r)}</span>
                        <span className="redup">
                          {rentang && !j.lengkap ? `hafal ${labelAyatHafal(j.nomor, hafalan)} dari ` : ''}
                          ayat {r.ayatAwal}–{r.ayatAkhir} · Juz {juzAyat(r.surah, r.ayatAwal)}
                        </span>
                        {telat > 0 && <span className="telat">terlambat {telat} hari</span>}
                      </span>
                      <span className="panah">🎙</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {ulang.length > BATAS_ULANG_MALAM && (
              <button className="tautan" onClick={() => setLihatSemua((v) => !v)}>
                {lihatSemua ? `Tampilkan ${BATAS_ULANG_MALAM} saja` : `Tampilkan semua (${ulang.length})`}
              </button>
            )}
            {selesai.length > 0 && <p className="kosong">✓ {selesai.length} rukuk sudah diulang hari ini.</p>}
          </>
        )}
      </section>

      <section className="kartu">
        <h2>Latihan sambung ayat</h2>
        <p className="kosong">Satu ayat tampil, Anda melanjutkan ayat sesudahnya. Sambungan yang pernah tertukar didahulukan.</p>
        <button className="tombol sekunder lebar" onClick={() => pergi('#/sambung')} disabled={jumlahHafal < 2}>
          Mulai latihan
        </button>
      </section>

      <section className="kartu">
        <h2>Murotal</h2>
        <p className="kosong">Dengarkan rekaman murojaah Anda sendiri yang sudah dikoreksi dan bersih dari kesalahan.</p>
        <button className="tombol sekunder lebar" onClick={() => pergi('#/murotal')}>
          ▶ Buka murotal
        </button>
      </section>

      <section className="kartu">
        <h2>Jelajah mushaf</h2>
        <p className="kosong">Urutan hafalan: Al-Fatihah → An-Nas.</p>
        <button className="tombol sekunder lebar" onClick={() => pergi('#/semua')}>
          Semua surah (30 juz)
        </button>
        <button className="tombol sekunder lebar" onClick={() => pergi('#/rukuk')}>
          Semua rukuk yang sudah dihafal
        </button>
      </section>
    </>
  );
}

function KartuHafalanBaru({ baru, hari }: { baru: ReturnType<typeof pilihHafalanBaru>; hari: string }) {
  const kunciSimai = baru.status === 'tamat' ? '' : `simai:${hari}:${baru.potongan.surah}:${baru.potongan.ayatAwal}`;
  const [simai, setSimai] = useState(() => (kunciSimai ? baca(kunciSimai) === '1' : false));

  return (
    <section className="kartu utama">
      <h2>
        Hafalan baru <span className="istilah">Sabaq · setelah Subuh</span>
      </h2>
      {baru.status === 'tamat' && <p className="kosong">Masya Allah, seluruh Al-Qur'an sudah masuk hafalan.</p>}
      {baru.status === 'selesai' && (
        <p className="kosong">
          ✓ {namaPotongan(baru.potongan)} sudah dihafal hari ini. Potongan berikutnya besok pagi, insya Allah.
        </p>
      )}
      {(baru.status === 'baru' || baru.status === 'ulang') && (
        <>
          <p className="potongan-hari-ini">{namaPotongan(baru.potongan)}</p>
          <p className="kosong">Juz {juzAyat(baru.potongan.surah, baru.potongan.ayatAwal)}</p>
          {baru.status === 'ulang' && (
            <p className="kosong">Potongan ini diulang dulu sampai lancar sebelum menambah yang baru.</p>
          )}
          <ol className="langkah">
            <li>
              <button
                className="tautan"
                onClick={() => pergi(`#/surah/${baru.potongan.surah}/${baru.potongan.ayatAwal}`)}
              >
                Baca makna →
              </button>
            </li>
            <li>
              <label className="saklar">
                <input
                  type="checkbox"
                  checked={simai}
                  onChange={(e) => {
                    setSimai(e.target.checked);
                    tulis(kunciSimai, e.target.checked ? '1' : null);
                  }}
                />
                <span>Sudah mendengar bacaan guru/qari (sima'i)</span>
              </label>
            </li>
            <li>Baca sambil melihat, lalu coba tanpa melihat.</li>
            <li>
              <button className="tombol utama lebar" onClick={() => pergi(hashPotongan('rekam', baru.potongan))}>
                🎙 Rekam & koreksi
              </button>
            </li>
          </ol>
        </>
      )}
    </section>
  );
}
