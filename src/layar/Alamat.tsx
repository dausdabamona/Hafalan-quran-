import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Copy, MapTrifold, Sparkle } from '@phosphor-icons/react';
import {
  JUZ_TATA_ALAMAT,
  MAKS_JEMBATAN,
  MAKS_JUDUL,
  ambilAlamatSurah,
  kunciAlamat,
  labelJembatan,
  permintaanClaude,
  ringkasanRukuk,
  rukukJuz,
  simpanAlamat,
  usulanAlamatSurah,
  type RingkasanAlamat,
} from '../alamat';
import { cariAyat, cariRukuk, cariSurah, daftarRukuk, segmenAyat, susunToken, type Ayat } from '../data';
import { ambilMaknaSurah, db, type AlamatAyat, type JenisAlamat, type Makna, type UsulanClaude } from '../db';
import Kepala from '../komponen/Kepala';
import { statusEfektif, terimaUsulan, tolakUsulan } from '../mcp/usulan';
import { ganti, pergi } from '../navigasi';

// K-97: Tata Alamat — membangun alamat makna di atas hafalan lama yang tersimpan sebagai bunyi.

// ---------- Daftar rukuk Juz 30 ----------

export function LayarDaftarAlamat() {
  const daftar = useMemo(() => rukukJuz(JUZ_TATA_ALAMAT), []);
  const [ringkas, setRingkas] = useState<Map<number, RingkasanAlamat> | null>(null);
  useEffect(() => {
    ringkasanRukuk(daftar).then(setRingkas);
  }, [daftar]);

  let totalAyat = 0;
  let totalJudul = 0;
  let rukukTertata = 0;
  for (const h of ringkas?.values() ?? []) {
    totalAyat += h.jumlahAyat;
    totalJudul += h.judul;
    if (h.judul === h.jumlahAyat && h.jembatan === h.jumlahJembatan) rukukTertata++;
  }

  return (
    <>
      <Kepala judul="Tata Alamat" sub={`Juz ${JUZ_TATA_ALAMAT} · judul ayat & jembatan`} />
      <section className="kartu alamat-pengantar">
        <p>
          Beri setiap ayat <strong>judul makna 2–5 kata</strong> dan setiap sambungan satu <strong>jembatan</strong>{' '}
          (alasan ayat berikutnya datang). Judul menjadi alamat: nomor ayat ↔ isinya.
        </p>
        {ringkas && (
          <p className="alamat-ringkas">
            {totalJudul} dari {totalAyat} ayat berjudul · {rukukTertata} dari {daftar.length} rukuk tertata
          </p>
        )}
      </section>
      <ul className="daftar-alamat">
        {daftar.map((r) => {
          const s = cariSurah(r.surah)!;
          const h = ringkas?.get(r.nomor);
          const tertata = !!h && h.judul === h.jumlahAyat && h.jembatan === h.jumlahJembatan;
          const satuRukuk = s.jumlahAyat === r.ayatAkhir - r.ayatAwal + 1;
          return (
            <li key={r.nomor}>
              <button className={tertata ? 'tertata' : ''} onClick={() => pergi(`#/alamat/r${r.nomor}`)}>
                <span className="nama">
                  {r.surah}. {s.nama}
                  {!satuRukuk && (
                    <span className="rentang">
                      {' '}
                      · {r.ayatAwal}–{r.ayatAkhir}
                    </span>
                  )}
                </span>
                <span className="hitung">
                  {h ? `${h.judul}/${h.jumlahAyat} judul · ${h.jembatan}/${h.jumlahJembatan} jembatan` : '…'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ---------- Satu rukuk ----------

function artiAyat(a: Ayat, surah: number, makna: Map<string, Makna>): string {
  return segmenAyat(a)
    .filter(Boolean)
    .map((g) => makna.get(`${surah}:${a.ayat}:${g.indeks}`)?.isi || g.maknaBawaan)
    .filter(Boolean)
    .join(' · ');
}

export function LayarTataAlamat({ rukuk }: { rukuk: number }) {
  const r = cariRukuk(rukuk);
  const s = r ? cariSurah(r.surah) : undefined;
  const [alamat, setAlamat] = useState<Map<string, AlamatAyat>>(new Map());
  const [makna, setMakna] = useState<Map<string, Makna>>(new Map());
  const [usulan, setUsulan] = useState<Map<string, UsulanClaude>>(new Map());
  const [draf, setDraf] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState('');

  const muat = useCallback(async () => {
    if (!r) return;
    const [a, m, u] = await Promise.all([
      ambilAlamatSurah(r.surah),
      ambilMaknaSurah(r.surah),
      usulanAlamatSurah(r.surah),
    ]);
    setAlamat(a);
    setMakna(m);
    setUsulan(u);
  }, [r]);

  useEffect(() => {
    setDraf({});
    setPesan('');
    muat();
  }, [muat]);

  if (!r || !s) return null;
  const daftarAyat: Ayat[] = [];
  for (let n = r.ayatAwal; n <= r.ayatAkhir; n++) {
    const a = cariAyat(r.surah, n);
    if (a) daftarAyat.push(a);
  }
  const indeks = daftarRukuk.findIndex((x) => x.nomor === r.nomor);
  const sebelum = indeks > 0 ? daftarRukuk[indeks - 1] : undefined;
  const sesudah = indeks < daftarRukuk.length - 1 ? daftarRukuk[indeks + 1] : undefined;

  const isi = (ayat: number, jenis: JenisAlamat) => {
    const k = kunciAlamat(r.surah, ayat, jenis);
    return draf[k] ?? alamat.get(k)?.isi ?? '';
  };
  const ubahDraf = (ayat: number, jenis: JenisAlamat, nilai: string) =>
    setDraf((d) => ({ ...d, [kunciAlamat(r.surah, ayat, jenis)]: nilai }));
  const simpan = async (ayat: number, jenis: JenisAlamat) => {
    const k = kunciAlamat(r.surah, ayat, jenis);
    if (draf[k] === undefined) return;
    await simpanAlamat(r.surah, ayat, jenis, draf[k]);
    await muat();
    setDraf((d) => {
      const baru = { ...d };
      delete baru[k];
      return baru;
    });
  };

  const jumlahJudul = daftarAyat.filter((a) => isi(a.ayat, 'judul').trim()).length;
  const sambungan = daftarAyat.filter((a) => labelJembatan(r.surah, a.ayat));
  const jumlahJembatan = sambungan.filter((a) => isi(a.ayat, 'jembatan').trim()).length;

  const mintaClaude = async () => {
    const teks = permintaanClaude(r.nomor, alamat);
    if (!teks) {
      setPesan('Semua judul dan jembatan rukuk ini sudah terisi.');
      return;
    }
    try {
      await navigator.clipboard.writeText(teks);
      setPesan('Permintaan disalin. Tempel di Claude desktop pada komputer yang memasang ekstensi Saku Hati.');
    } catch {
      setPesan(teks);
    }
  };

  const kotakUsulan = (ayat: number, jenis: JenisAlamat) => {
    const k = kunciAlamat(r.surah, ayat, jenis);
    const u = usulan.get(k);
    if (!u) return null;
    const bentrok = statusEfektif(u, alamat.get(k)) === 'bentrok';
    return (
      <div className="usulan-alamat">
        <span className="kicker">
          <Sparkle size={14} weight="duotone" /> Usulan Claude
        </span>
        <p>{u.isiBaru}</p>
        {u.catatan && <p className="catatan">{u.catatan}</p>}
        <div className="aksi">
          <button
            className="chip"
            onClick={async () => {
              await terimaUsulan(db, u.kunci, { isi: u.isiBaru, paksa: bentrok });
              await muat();
            }}
          >
            Pakai
          </button>
          <button className="chip" onClick={() => ubahDraf(ayat, jenis, u.isiBaru)}>
            Sunting dulu
          </button>
          <button
            className="chip"
            onClick={async () => {
              await tolakUsulan(db, u.kunci);
              await muat();
            }}
          >
            Tolak
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Kepala
        judul={`Tata Alamat · ${s.nama}`}
        sub={
          r.ayatAwal === 1 && r.ayatAkhir === s.jumlahAyat
            ? `${s.jumlahAyat} ayat`
            : `Ayat ${r.ayatAwal}–${r.ayatAkhir}`
        }
      />

      {/* Peta rukuk bernomor: alamat seluruh rukuk sekaligus. */}
      <details className="kartu peta-alamat" aria-label="Peta rukuk" open={jumlahJudul > 0}>
        <summary className="kicker">
          <MapTrifold size={16} weight="duotone" /> Peta · {jumlahJudul}/{daftarAyat.length} judul · {jumlahJembatan}/
          {sambungan.length} jembatan
        </summary>
        <ol>
          {daftarAyat.map((a) => {
            const j = isi(a.ayat, 'judul').trim();
            return (
              <li key={a.ayat}>
                <a
                  href={`#alamat-${a.ayat}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(`alamat-${a.ayat}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <span className="no">{a.ayat}</span>
                  <span className={j ? '' : 'kosong'}>{j || 'belum berjudul'}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </details>

      <div className="isi-alamat">
        {daftarAyat.map((a) => {
          const tuju = labelJembatan(r.surah, a.ayat);
          return (
            <div key={a.ayat}>
              <section className="kartu kartu-alamat" id={`alamat-${a.ayat}`}>
                <div className="kepala-alamat">
                  <span className="nomor-alamat">{a.ayat}</span>
                  <p className="arab teks-alamat" dir="rtl" lang="ar">
                    {susunToken(a)
                      .map((t) => t.teks)
                      .join(' ')}
                  </p>
                </div>
                <p className="arti-alamat">{artiAyat(a, r.surah, makna)}</p>
                <label className="kolom-alamat">
                  <span>Judul ayat {a.ayat}</span>
                  <input
                    type="text"
                    maxLength={MAKS_JUDUL}
                    value={isi(a.ayat, 'judul')}
                    placeholder="2–5 kata makna inti"
                    onChange={(e) => ubahDraf(a.ayat, 'judul', e.target.value)}
                    onBlur={() => simpan(a.ayat, 'judul')}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                </label>
                {kotakUsulan(a.ayat, 'judul')}
              </section>
              {tuju && (
                <div className="jembatan-alamat">
                  <label className="kolom-alamat">
                    <span>
                      Jembatan {a.ayat} → {tuju}
                    </span>
                    <textarea
                      rows={2}
                      maxLength={MAKS_JEMBATAN}
                      value={isi(a.ayat, 'jembatan')}
                      placeholder="Mengapa yang berikutnya datang? Satu kalimat."
                      onChange={(e) => ubahDraf(a.ayat, 'jembatan', e.target.value)}
                      onBlur={() => simpan(a.ayat, 'jembatan')}
                    />
                  </label>
                  {kotakUsulan(a.ayat, 'jembatan')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="kartu aksi-alamat">
        <p className="keterangan-kecil">
          Tulis sendiri lebih dulu. Bila buntu, minta usulan Claude untuk yang masih kosong; usulan muncul di sini dan
          di layar Usulan Claude setelah sinkron.
        </p>
        <button className="tombol sekunder lebar" onClick={mintaClaude}>
          <Copy weight="duotone" /> Salin permintaan untuk Claude
        </button>
        {pesan && <p className="pesan-alamat">{pesan}</p>}
        <div className="nav-alamat">
          {sebelum ? (
            <button className="tautan" onClick={() => ganti(`#/alamat/r${sebelum.nomor}`)}>
              <ArrowLeft weight="bold" /> {cariSurah(sebelum.surah)!.nama}
              {sebelum.surah === r.surah ? ` ${sebelum.ayatAwal}–${sebelum.ayatAkhir}` : ''}
            </button>
          ) : (
            <span />
          )}
          {sesudah && (
            <button className="tautan" onClick={() => ganti(`#/alamat/r${sesudah.nomor}`)}>
              {cariSurah(sesudah.surah)!.nama}
              {sesudah.surah === r.surah ? ` ${sesudah.ayatAwal}–${sesudah.ayatAkhir}` : ''}{' '}
              <ArrowRight weight="bold" />
            </button>
          )}
        </div>
      </section>
    </>
  );
}
