import { useEffect, useState } from 'react';
import { cariSurah, labelPotongan, type Potongan } from '../data';
import { ambilCatatanDeres, ambilJadwal } from '../db';
import { lengkap, pilihDeresHariIni, type CatatanDeres } from '../rukuk';
import { keteranganTerakhir, namaRukuk } from './Rukuk';
import {
  BATAS_ULANG_MALAM,
  daftarUlangHafalan,
  hariIni,
  jalurUrutan,
  kelompok,
  pilihHafalanBaru,
  selesaiHariIni,
  selisihHari,
  type ArahJalur,
  type EntriJadwal,
} from '../jadwal';
import { hashPotongan, pergi } from '../navigasi';

// ---------- Pengaturan kecil yang disimpan di HP ----------

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

function namaPotongan(p: Potongan): string {
  return `${cariSurah(p.surah)?.nama ?? p.surah} · ${labelPotongan(p)}`;
}

export default function LayarHariIni() {
  const hari = hariIni();
  const [jadwal, setJadwal] = useState<Map<string, EntriJadwal> | null>(null);
  const [arah, setArah] = useState<ArahJalur>(() =>
    baca('arahJalur') === 'dari-an-naba' ? 'dari-an-naba' : 'dari-an-nas',
  );
  const [lihatSemua, setLihatSemua] = useState(false);
  const [catatanDeres, setCatatanDeres] = useState<Map<number, CatatanDeres>>(new Map());

  useEffect(() => {
    ambilJadwal().then(setJadwal);
    ambilCatatanDeres().then(setCatatanDeres);
  }, []);

  const ubahArah = (a: ArahJalur) => {
    setArah(a);
    tulis('arahJalur', a);
  };

  if (!jadwal) return null;

  const jalur = jalurUrutan(arah);
  const baru = pilihHafalanBaru(jalur, jadwal, hari);
  const ulang = daftarUlangHafalan(jadwal, hari);
  const selesai = selesaiHariIni(jadwal, hari);
  const tampil = lihatSemua ? ulang : ulang.slice(0, BATAS_ULANG_MALAM);
  const hafal = [...jadwal.values()].filter((e) => e.sabaqLancar).length;
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
        {tanggal} · {hafal} dari {jalur.length} potongan Juz 30 sudah dihafal
      </p>

      <KartuHafalanBaru baru={baru} hari={hari} />

      <section className="kartu">
        <h2>
          Ulang hafalan <span className="istilah">Sabqi & Manzil · sebelum tidur</span>
        </h2>
        {ulang.length === 0 ? (
          <p className="kosong">
            {selesai.length > 0
              ? `Alhamdulillah, ${selesai.length} potongan sudah diulang hari ini.`
              : 'Belum ada hafalan yang jatuh tempo hari ini.'}
          </p>
        ) : (
          <>
            <ul className="daftar-ulang">
              {tampil.map((e) => {
                const telat = selisihHari(e.jatuhTempo, hari);
                return (
                  <li key={e.kunci}>
                    <button className="baris-ulang" onClick={() => pergi(hashPotongan('rekam', e))}>
                      <span className={'label-kelompok ' + kelompok(e)}>
                        {kelompok(e) === 'dekat' ? 'Dekat' : 'Lama'}
                      </span>
                      <span className="info">
                        <span className="nama">{namaPotongan(e)}</span>
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
                {lihatSemua ? 'Tampilkan 10 saja' : `Tampilkan semua (${ulang.length})`}
              </button>
            )}
            {selesai.length > 0 && <p className="kosong">✓ {selesai.length} potongan sudah diulang hari ini.</p>}
          </>
        )}
      </section>

      <KartuDeresRukuk deres={pilihDeresHariIni(jadwal, catatanDeres, hari)} catatan={catatanDeres} hari={hari} />

      <section className="kartu">
        <h2>Latihan sambung ayat</h2>
        <p className="kosong">Satu ayat tampil, Anda melanjutkan ayat sesudahnya. Sambungan yang pernah tertukar didahulukan.</p>
        <button className="tombol sekunder lebar" onClick={() => pergi('#/sambung')} disabled={hafal === 0}>
          Mulai latihan
        </button>
      </section>

      <section className="kartu">
        <h2>Jalur hafalan</h2>
        <div className="pilihan-arah">
          <label>
            <input type="radio" checked={arah === 'dari-an-nas'} onChange={() => ubahArah('dari-an-nas')} />
            Urutan, mulai An-Nas
          </label>
          <label>
            <input type="radio" checked={arah === 'dari-an-naba'} onChange={() => ubahArah('dari-an-naba')} />
            Urutan, mulai An-Naba'
          </label>
        </div>
        <p className="kosong">Jalur sesuai tema menyusul setelah pengelompokan temanya disepakati.</p>
        <button className="tombol sekunder lebar" onClick={() => pergi('#/semua')}>
          Semua surah Juz 30
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
      {baru.status === 'tamat' && <p className="kosong">Masya Allah, seluruh Juz 30 sudah masuk hafalan.</p>}
      {baru.status === 'selesai' && (
        <p className="kosong">
          ✓ {namaPotongan(baru.potongan)} sudah dihafal hari ini. Potongan berikutnya besok pagi, insya Allah.
        </p>
      )}
      {(baru.status === 'baru' || baru.status === 'ulang') && (
        <>
          <p className="potongan-hari-ini">{namaPotongan(baru.potongan)}</p>
          {baru.status === 'ulang' && (
            <p className="kosong">Potongan ini diulang dulu sampai lancar sebelum menambah yang baru.</p>
          )}
          <ol className="langkah">
            <li>
              <button className="tautan" onClick={() => pergi(`#/surah/${baru.potongan.surah}`)}>
                Baca makna per kata →
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

function KartuDeresRukuk({
  deres,
  catatan,
  hari,
}: {
  deres: ReturnType<typeof pilihDeresHariIni>;
  catatan: Map<number, CatatanDeres>;
  hari: string;
}) {
  return (
    <section className="kartu">
      <h2>
        Deres per rukuk <span className="istilah">satu rukuk sehari, bergilir</span>
      </h2>
      {deres.status === 'belum-ada' && (
        <p className="kosong">Deres rukuk dimulai setelah ada minimal dua ayat berurutan yang lancar dihafal.</p>
      )}
      {deres.status === 'selesai' && <p className="kosong">✓ {namaRukuk(deres.rukuk)} sudah dideres hari ini.</p>}
      {deres.status === 'deres' && (
        <>
          <p className="potongan-hari-ini">{namaRukuk(deres.rukuk)}</p>
          <p className="kosong">
            {lengkap(deres.rukuk, deres.rentang)
              ? `Ayat ${deres.rentang.ayatAwal}–${deres.rentang.ayatAkhir}`
              : `Bagian yang sudah hafal: ayat ${deres.rentang.ayatAwal}–${deres.rentang.ayatAkhir} dari ${deres.rukuk.ayatAwal}–${deres.rukuk.ayatAkhir}`}
            {' · '}
            {keteranganTerakhir(catatan.get(deres.rukuk.nomor), hari)}
          </p>
          <button
            className="tombol utama lebar"
            onClick={() => pergi(hashPotongan('rekam', deres.rentang, deres.rukuk.nomor))}
          >
            🎙 Deres rukuk ini
          </button>
        </>
      )}
      <button className="tautan" onClick={() => pergi('#/rukuk')}>
        Pilih rukuk lain →
      </button>
    </section>
  );
}
