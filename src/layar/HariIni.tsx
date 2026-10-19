import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowsClockwise,
  BellRinging,
  BookOpen,
  CheckCircle,
  Headphones,
  Info,
  Link,
  ListChecks,
  Microphone,
  MoonStars,
  SunHorizon,
} from '@phosphor-icons/react';
import {
  angkaArab,
  cariAyat,
  cariRukuk,
  cariSurah,
  daftarSurah,
  juzAyat,
  JUMLAH_AYAT,
  labelPotongan,
  rukukSurah,
  segmenAyat,
  susunToken,
  type Potongan,
  type Rukuk,
} from '../data';
import { ambilHafalan, ambilJadwal, ambilMaknaSurah, type Makna } from '../db';
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
import { pengingatTersedia } from '../pengingat';
import { peranSinkron } from '../sinkron/peran';
import Plat from '../komponen/Plat';

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
const KELAS_TAG = { berjalan: 'tag tag-accent', dekat: 'tag tag-neutral', lama: 'tag tag-outline' } as const;
const JARAK = [1, 3, 7, 14, 30];

// Jumlah ayat per juz (untuk strip 30 juz), dihitung sekali.
let ayatPerJuz: number[] | null = null;
function totalAyatJuz(): number[] {
  if (!ayatPerJuz) {
    ayatPerJuz = Array(31).fill(0);
    for (const s of daftarSurah) for (let a = 1; a <= s.jumlahAyat; a++) ayatPerJuz[juzAyat(s.nomor, a)]++;
  }
  return ayatPerJuz;
}

function tanggalHijriah(d: Date): string {
  try {
    return new Intl.DateTimeFormat('id-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' })
      .format(d)
      .replace(/\s*(AH|H)$/, '');
  } catch {
    return '';
  }
}

// Tahap jarak murojaah: 0..4 untuk 1·3·7·14·30 hari; rukuk berjalan = tahap 0.
function tahapJarak(j: EntriJadwal): number {
  if (!j.lengkap && !j.sebagian) return 0;
  return Math.min(Math.max(j.tingkat, 0), JARAK.length - 1);
}

export default function LayarHariIni() {
  const hari = hariIni();
  const [hafalan, setHafalan] = useState<Map<string, EntriHafalan> | null>(null);
  const [jadwal, setJadwal] = useState<Map<number, EntriJadwal>>(new Map());
  const [lihatSemua, setLihatSemua] = useState(false);

  useEffect(() => {
    ambilHafalan().then(setHafalan);
    ambilJadwal().then(setJadwal);
  }, []);

  const hafal = useMemo(() => ayatHafal(hafalan ?? new Map()), [hafalan]);

  if (!hafalan) return null;

  const baru = pilihHafalanBaru(hafalan, hari);
  const ulang = daftarUlangHafalan(jadwal, hari);
  const selesai = selesaiHariIni(jadwal, hari);
  const tampil = lihatSemua ? ulang : ulang.slice(0, BATAS_ULANG_MALAM);
  const jumlahHafal = hafal.size;
  const sekarang = new Date();

  // Strip 30 juz: persen ayat hafal per juz.
  const total = totalAyatJuz();
  const hafalJuz = Array(31).fill(0);
  for (const k of hafal) {
    const [s, a] = k.split(':').map(Number);
    hafalJuz[juzAyat(s, a)]++;
  }
  const juzBerjalan = baru.status === 'tamat' ? 0 : juzAyat(baru.potongan.surah, baru.potongan.ayatAwal);
  const persen = ((jumlahHafal / JUMLAH_AYAT) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 });

  const menu = [
    {
      judul: 'Latihan sambung ayat',
      isi: 'Satu ayat tampil, Anda melanjutkan ayat sesudahnya. Sambungan yang pernah tertukar didahulukan.',
      ikon: <Link size={34} weight="duotone" className="ikon" />,
      buka: () => pergi('#/sambung'),
      mati: jumlahHafal < 2,
    },
    {
      judul: 'Murotal',
      isi: 'Dengarkan rekaman murojaah Anda sendiri yang sudah dikoreksi dan bersih dari kesalahan.',
      ikon: <Headphones size={34} weight="duotone" className="ikon" />,
      buka: () => pergi('#/murotal'),
    },
    ...(pengingatTersedia()
      ? [
          {
            judul: 'Pengingat ayat',
            isi: 'Ayat hafalan tampil sebagai kartu kecil saat Anda membuka media sosial.',
            ikon: <BellRinging size={34} weight="duotone" className="ikon" />,
            buka: () => pergi('#/pengingat'),
          },
        ]
      : []),
    ...(peranSinkron()
      ? [
          {
            judul: 'Sinkron HP ↔ Laptop',
            isi:
              peranSinkron() === 'pusat'
                ? 'Pasangkan Saku Hati di laptop lewat kode QR; data saling sinkron di Wi-Fi yang sama.'
                : 'Pasangkan dengan Saku Hati di HP lewat kode QR; data saling sinkron di Wi-Fi yang sama.',
            ikon: <ArrowsClockwise size={34} weight="duotone" className="ikon" />,
            buka: () => pergi('#/sinkron'),
          },
        ]
      : []),
    {
      judul: 'Jelajah mushaf',
      isi: 'Semua surah, 30 juz, Al-Fatihah sampai An-Nas. Tandai ayat yang sudah hafal.',
      ikon: <BookOpen size={34} weight="duotone" className="ikon" />,
      buka: () => pergi('#/semua'),
    },
    {
      judul: 'Rukuk yang dihafal',
      isi: 'Semua rukuk yang sudah masuk hafalan, untuk murojaah di luar jadwal.',
      ikon: <ListChecks size={34} weight="duotone" className="ikon" />,
      buka: () => pergi('#/rukuk'),
    },
  ];

  const barisUlang = (j: EntriJadwal, sudah: boolean) => {
    const r = cariRukuk(j.nomor)!;
    const rentang = rentangMurojaah(j, hafalan);
    const telat = selisihHari(j.jatuhTempo, hari);
    const k = kelompok(j);
    const tahap = tahapJarak(j);
    return (
      <li key={j.nomor}>
        <button
          className={'baris-koran' + (sudah ? ' sudah' : '')}
          disabled={!rentang || sudah}
          onClick={() => rentang && pergi(hashPotongan('rekam', rentang, j.nomor))}
        >
          <span className="isi">
            <span className="judul">
              <span className="nama">{namaRukuk(r)}</span>
              <span className={KELAS_TAG[k]}>{LABEL_KELOMPOK[k]}</span>
            </span>
            <span className="detail">
              {sudah
                ? 'sudah diulang hari ini'
                : `${rentang && !j.lengkap ? `hafal ${labelAyatHafal(j.nomor, hafalan)} dari ` : ''}ayat ${r.ayatAwal}–${r.ayatAkhir} · Juz ${juzAyat(r.surah, r.ayatAwal)}${k !== 'berjalan' ? ` · jarak ${JARAK[tahap]} hari` : ''}`}
            </span>
            <span className="tangga-jarak">
              <span className="anak" aria-label={`Tahap jarak ${JARAK[tahap]} hari`}>
                {JARAK.map((h, i) => (
                  <span key={h}>
                    <i className={i < tahap ? 'lewat' : i === tahap ? 'kini' : ''} />
                    {h}
                  </span>
                ))}
              </span>
              {!sudah && telat > 0 && <span className="telat">terlambat {telat} hari</span>}
            </span>
          </span>
          <span className="bulat-ikon">
            {sudah ? <CheckCircle weight="duotone" /> : <Microphone weight="duotone" />}
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <header className="koran">
        <div className="garis-tebal">
          <div />
        </div>
        <div className="koran-baris">
          <div className="koran-merek">
            <img src="./ikon.png" alt="" />
            <div>
              <Plat as="h1" jenis="head" teks="Saku Hati" />
              <p>Sedikit Ayat, Kuat Ulangnya</p>
            </div>
          </div>
          <button className="tombol-ikon" onClick={() => pergi('#/tentang')} aria-label="Tentang">
            <Info weight="duotone" />
          </button>
        </div>
        <div className="garis-tipis" />
        <div className="koran-tanggal">
          <span>
            {sekarang.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span style={{ fontStyle: 'italic' }}>{tanggalHijriah(sekarang)}</span>
        </div>
        <div className="garis-tutup" />
        <div />
      </header>

      <main className="koran-isi">
        <section className="bagian" style={{ gap: 'var(--space-4)' }}>
          <div className="kemajuan-angka">
            <Plat teks={jumlahHafal.toLocaleString('id-ID')} />
            <p>
              ayat sudah dihafal
              <br />
              <span style={{ fontStyle: 'italic' }}>
                dari {JUMLAH_AYAT.toLocaleString('id-ID')} · {persen}%
              </span>
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div className="strip-juz">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                <div
                  key={n}
                  className={n === juzBerjalan ? 'berjalan' : ''}
                  title={`Juz ${n}: ${hafalJuz[n]} dari ${total[n]} ayat`}
                >
                  <div style={{ height: `${total[n] ? (hafalJuz[n] / total[n]) * 100 : 0}%` }} />
                </div>
              ))}
            </div>
            <div className="label-strip">
              <span>Juz 1</span>
              <span>15</span>
              <span>30</span>
            </div>
          </div>
        </section>

        <HafalanBaru baru={baru} hari={hari} />

        <section className="bagian">
          <p className="kicker">
            <MoonStars size={18} weight="duotone" className="ikon" /> Ulang hafalan
            <span className="istilah">Sabqi &amp; Manzil · sebelum tidur</span>
          </p>
          <div className="ulang-angka">
            <Plat teks={String(ulang.length)} />
            <h2>
              {ulang.length
                ? 'rukuk jatuh tempo malam ini'
                : selesai.length
                  ? 'Alhamdulillah, semua rukuk sudah diulang'
                  : 'belum ada rukuk yang jatuh tempo'}
            </h2>
          </div>
          {(tampil.length > 0 || selesai.length > 0) && (
            <ul className="daftar-koran">
              {tampil.map((j) => barisUlang(j, false))}
              {selesai.slice(0, BATAS_ULANG_MALAM).map((j) => barisUlang(j, true))}
            </ul>
          )}
          {ulang.length > BATAS_ULANG_MALAM && (
            <button className="tautan" onClick={() => setLihatSemua((v) => !v)}>
              {lihatSemua ? `Tampilkan ${BATAS_ULANG_MALAM} saja` : `Tampilkan semua (${ulang.length})`}
            </button>
          )}
        </section>

        <section className="bagian" style={{ gap: 'var(--space-4)' }}>
          <p className="kicker">Juga di Saku Hati</p>
          <div className="menu-koran">
            {menu.map((m) => (
              <button key={m.judul} onClick={m.buka} disabled={'mati' in m && m.mati}>
                {m.ikon}
                <span className="judul">{m.judul}</span>
                <span className="isi">{m.isi}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function HafalanBaru({ baru, hari }: { baru: ReturnType<typeof pilihHafalanBaru>; hari: string }) {
  const kunciSimai = baru.status === 'tamat' ? '' : `simai:${hari}:${baru.potongan.surah}:${baru.potongan.ayatAwal}`;
  const [simai, setSimai] = useState(() => (kunciSimai ? baca(kunciSimai) === '1' : false));
  const [makna, setMakna] = useState<Map<string, Makna>>(new Map());
  const surahPotongan = baru.status === 'tamat' ? 0 : baru.potongan.surah;

  useEffect(() => {
    if (surahPotongan) ambilMaknaSurah(surahPotongan).then(setMakna);
  }, [surahPotongan]);

  const kepala = (
    <p className="kicker">
      <SunHorizon size={18} weight="duotone" className="ikon" /> Hafalan baru
      <span className="istilah">Sabaq · setelah Subuh</span>
    </p>
  );

  if (baru.status === 'tamat') {
    return (
      <section className="bagian">
        {kepala}
        <p className="selesai-hari-ini">Masya Allah, seluruh Al-Qur'an sudah masuk hafalan.</p>
      </section>
    );
  }

  const p = baru.potongan;
  const ayat = cariAyat(p.surah, p.ayatAwal);
  const jumlahAyat = p.ayatAkhir - p.ayatAwal + 1;

  return (
    <section className="bagian">
      {kepala}
      <h2 className="judul-sabaq">
        {cariSurah(p.surah)?.nama}, {labelPotongan(p)}
      </h2>
      <p style={{ margin: 0, fontSize: 15 }}>
        Juz {juzAyat(p.surah, p.ayatAwal)} · {jumlahAyat === 1 ? 'satu ayat' : `${jumlahAyat} ayat`}
        {baru.status === 'ulang' && ' · diulang sampai lancar sebelum menambah yang baru'}
      </p>
      {ayat && (
        <div className="pita-ayat">
          <p className="arab" dir="rtl" lang="ar">
            {susunToken(ayat)
              .map((t) => t.teks)
              .join(' ')}{' '}
            <span>﴿{angkaArab(ayat.ayat)}﴾</span>
          </p>
          <p className="makna-pita">
            {segmenAyat(ayat)
              .map((g) => makna.get(`${p.surah}:${ayat.ayat}:${g.indeks}`)?.isi ?? g.maknaBawaan)
              .join(' ')}
          </p>
        </div>
      )}
      {baru.status === 'selesai' ? (
        <p className="selesai-hari-ini">
          <CheckCircle size={24} weight="duotone" className="ikon" /> Sudah dihafal hari ini. Potongan berikutnya besok
          pagi, insya Allah.
        </p>
      ) : (
        <>
          <ol className="langkah-koran">
            <li>
              <span className="no">1</span>
              <button
                className="tautan"
                style={{ justifySelf: 'start', paddingLeft: 0, fontSize: 16 }}
                onClick={() => pergi(`#/surah/${p.surah}/${p.ayatAwal}`)}
              >
                Baca makna per kata <ArrowRight weight="duotone" />
              </button>
            </li>
            <li>
              <span className={'no' + (simai ? ' aktif' : '')}>2</span>
              <label>
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
            <li>
              <span className="no">3</span>
              <span>Baca sambil melihat, lalu coba tanpa melihat.</span>
            </li>
          </ol>
          <button className="tombol utama aksi-utama" onClick={() => pergi(hashPotongan('rekam', p))}>
            <Microphone weight="duotone" /> Rekam &amp; koreksi
          </button>
        </>
      )}
    </section>
  );
}
