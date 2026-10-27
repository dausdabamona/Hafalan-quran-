import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsClockwise,
  Check,
  DeviceMobile,
  Flag,
  Microphone,
  Pause,
  Play,
  Stop,
  Warning,
} from '@phosphor-icons/react';
import { gulirDalam, gulirKe } from '../komponen/gulir';
import { cariAyat, cariSurah, daftarJuz, daftarSurah, segmenAyat } from '../data';
import { ambilMaknaSurah, type Makna } from '../db';
import { adaPutaranTarget, susunMurotal, type DaftarMurotal } from '../murotalData';
import { ambilTarget, namaTarget } from '../target';
import {
  hashMurotal,
  judulRentang,
  tujuanPerbaikan,
  type LetakAyat,
  type Rentang,
  type StatusRekaman,
} from '../murotal';
import { ganti, hashPotongan, pergi } from '../navigasi';
import { pasangIkonMurotal, pintasanTersedia } from '../pintasan';
import {
  aturKecepatan,
  berhenti,
  dengarkan,
  keadaanPemutar,
  lompat,
  mulai,
  pilihAyat,
  putarJeda,
  type KeadaanPemutar,
} from '../pemutar';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';
import PerbaikanMurotal from './PerbaikanMurotal';

function keadaanMain(): boolean {
  return !!keadaanPemutar()?.main;
}

export function usePemutar(): KeadaanPemutar | null {
  const [k, setK] = useState<KeadaanPemutar | null>(null);
  useEffect(() => dengarkan(setK), []);
  return k;
}

type Tampilan = 'ayat' | 'arti' | 'tutup';

function bacaTampilan(): Tampilan {
  try {
    const t = localStorage.getItem('tampilanMurotal');
    if (t === 'ayat' || t === 'arti' || t === 'tutup') return t;
  } catch {
    // abaikan
  }
  return 'ayat';
}

function namaAyat(l: LetakAyat): string {
  return `${cariSurah(l.surah)?.nama ?? l.surah} · ayat ${l.ayat}`;
}

// ---------- Pilihan rentang ----------

export function LayarPilihMurotal({ tanpaAlih }: { tanpaAlih?: boolean }) {
  const [surah, setSurah] = useState(1);
  const [pesanIkon, setPesanIkon] = useState('');
  // K-82: selama ada target dengan putaran berisi, Murotal langsung masuk ke target.
  const [target, setTarget] = useState<{ nama: string; putaran: boolean } | null>(null);
  useEffect(() => {
    (async () => {
      const t = await ambilTarget();
      if (!t) return;
      const putaran = await adaPutaranTarget();
      if (putaran && !tanpaAlih) {
        ganti('#/murotal/target');
        return;
      }
      setTarget({ nama: namaTarget(t), putaran });
    })();
  }, [tanpaAlih]);
  return (
    <>
      <Kepala judul="Murotal" sub="Dari rekaman murojaah Anda sendiri" />
      <section className="kartu">
        {target?.putaran ? (
          <>
            <button className="tombol utama lebar" onClick={() => pergi('#/murotal/target')}>
              <Flag weight="duotone" /> Target: {target.nama} (berulang)
            </button>
            <button className="tombol sekunder lebar" onClick={() => pergi(hashMurotal({ jenis: 'selain-target' }))}>
              <Play weight="duotone" /> Selain target
            </button>
          </>
        ) : (
          <>
            {target && (
              <p className="kosong">
                Target {target.nama}: belum ada ayat yang direkam, atau semuanya sudah sangat lancar — murotal kembali
                seperti biasa.
              </p>
            )}
            <p className="kosong">
              Hanya ayat yang rekamannya sudah dikoreksi dan bersih dari kesalahan yang diputar. Murotal tetap berputar
              saat layar dimatikan.
            </p>
            <button className="tombol utama lebar" onClick={() => pergi(hashMurotal({ jenis: 'hafalan' }))}>
              <Play weight="duotone" /> Semua hafalan
            </button>
          </>
        )}
        {pintasanTersedia() && (
          <>
            <button className="tombol sekunder lebar" onClick={async () => setPesanIkon(await pasangIkonMurotal())}>
              <DeviceMobile weight="duotone" /> Pasang ikon Murotal di layar utama
            </button>
            <p className="kosong">
              {pesanIkon ||
                'Sekali ketuk ikon itu, murotal semua hafalan langsung berputar. Bisa juga: tekan lama ikon Saku Hati → Murotal.'}
            </p>
          </>
        )}
      </section>
      <section className="kartu">
        <h2>Per surah</h2>
        <select className="pilih-surah" value={surah} onChange={(e) => setSurah(Number(e.target.value))}>
          {daftarSurah.map((s) => (
            <option key={s.nomor} value={s.nomor}>
              {s.nomor}. {s.nama}
            </option>
          ))}
        </select>
        <button
          className="tombol sekunder lebar"
          onClick={() =>
            pergi(hashMurotal({ jenis: 'ayat', surah, ayatAwal: 1, ayatAkhir: cariSurah(surah)!.jumlahAyat }))
          }
        >
          Buka murotal surah ini
        </button>
        <p className="kosong">Murotal per rukuk: buka surahnya, lalu ketuk Murotal di kepala rukuk.</p>
      </section>
      <section className="kartu">
        <h2>Per juz</h2>
        <div className="kisi-juz">
          {daftarJuz.map((j) => (
            <button
              key={j.nomor}
              className="tombol sekunder"
              onClick={() => pergi(hashMurotal({ jenis: 'juz', nomor: j.nomor }))}
            >
              {j.nomor}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------- Murotal satu rentang ----------

const LABEL: Record<Exclude<StatusRekaman, 'siap'>, string> = {
  perbaiki: 'Perlu diperbaiki',
  'belum-koreksi': '○ Belum dikoreksi',
  'belum-rekam': '– Belum direkam',
};

type Hasil = DaftarMurotal;

export default function LayarMurotal({ rentang, putar }: { rentang: Rentang; putar?: boolean }) {
  const hash = hashMurotal(rentang);
  const modeTarget = rentang.jenis === 'target';
  const pemutar = usePemutar();
  const [hasil, setHasil] = useState<Hasil | null>(null);
  // K-35: saat diputar, tampil ayat (teks Arab), arti (makna per waqaf), atau tertutup.
  const [tampilan, setTampilan] = useState<Tampilan>(bacaTampilan);
  const [maknaEdit, setMaknaEdit] = useState<Map<string, Makna>>(new Map());
  const pilihTampilan = (t: Tampilan) => {
    setTampilan(t);
    try {
      localStorage.setItem('tampilanMurotal', t);
    } catch {
      // abaikan
    }
  };
  const surahDiputar = pemutar && pemutar.asal === hash ? pemutar.daftar[pemutar.indeks]?.surah : undefined;
  useEffect(() => {
    if (surahDiputar) ambilMaknaSurah(surahDiputar).then(setMaknaEdit);
  }, [surahDiputar]);
  const [lihatSemua, setLihatSemua] = useState(false);
  const [versi, setVersi] = useState(0);
  const [perbaikan, setPerbaikan] = useState<LetakAyat | null>(null);
  const refPemutar = useRef<HTMLElement>(null);
  const refDaftar = useRef<HTMLOListElement>(null);
  const [lanjutDari, setLanjutDari] = useState<LetakAyat | null>(null);
  const judulPutar = () => (modeTarget ? `Target · ${hasil?.namaTarget ?? 'belum ada target'}` : judulRentang(rentang));

  // K-82: "semua hafalan" (termasuk ikon layar utama) otomatis masuk ke target bila putarannya berisi.
  useEffect(() => {
    if (rentang.jenis !== 'hafalan') return;
    adaPutaranTarget().then((ada) => {
      if (ada) ganti(putar ? '#/murotal/target/putar' : '#/murotal/target');
    });
  }, [hash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let batal = false;
    (async () => {
      const h = await susunMurotal(rentang);
      if (!batal) setHasil(h);
    })();
    return () => {
      batal = true;
    };
  }, [hash, versi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dibuka dari shortcut layar utama (K-42): langsung diputar, lalu alamat dikembalikan
  // ke layar murotal biasa agar tidak terputar ulang. Bila sudah berputar, tidak diulang.
  useEffect(() => {
    if (!hasil || !putar) return;
    if (hasil.siap.length > 0 && keadaanPemutar()?.asal !== hash) mulai(judulPutar(), hasil.siap, hash, 0, modeTarget);
    ganti(hash);
  }, [hasil, putar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sesudah perbaikan (K-31): daftar putar disusun ulang lalu berlanjut dari ayat sesudahnya.
  useEffect(() => {
    if (!hasil || !lanjutDari) return;
    const l = lanjutDari;
    setLanjutDari(null);
    const i = hasil.siap.findIndex((x) => x.surah > l.surah || (x.surah === l.surah && x.ayat > l.ayat));
    if (i >= 0) mulai(judulPutar(), hasil.siap, hash, i, modeTarget);
    else if (modeTarget && hasil.siap.length) mulai(judulPutar(), hasil.siap, hash, 0, true);
    else berhenti();
  }, [hasil]); // eslint-disable-line react-hooks/exhaustive-deps

  const bukaPerbaikan = (l: LetakAyat) => {
    if (keadaanMain()) putarJeda();
    setPerbaikan(l);
  };

  // Gulir otomatis: kartu pemutar tampil saat murotal dimulai, dan baris daftar putar
  // mengikuti ayat yang sedang diputar.
  const indeksDiputar = pemutar && pemutar.asal === hash ? pemutar.indeks : -1;
  const sedangAktif = indeksDiputar >= 0;
  useEffect(() => {
    if (sedangAktif) gulirKe(refPemutar.current, 'start');
  }, [sedangAktif]);
  useEffect(() => {
    if (indeksDiputar < 0) return;
    const item = refDaftar.current?.children[indeksDiputar] as HTMLElement | undefined;
    gulirDalam(refDaftar.current, item ?? null);
  }, [indeksDiputar]);

  const jumlah = useMemo(() => {
    const n = { perbaiki: 0, 'belum-koreksi': 0, 'belum-rekam': 0 };
    for (const x of hasil?.lain ?? []) n[x.status]++;
    return n;
  }, [hasil]);

  const judul = modeTarget ? `Target · ${hasil?.namaTarget ?? 'belum ada target'}` : judulRentang(rentang);
  if (!hasil) return <Kepala judul="Murotal" sub={judul} />;

  const aktif = pemutar && pemutar.asal === hash ? pemutar : null;
  const kini = aktif ? aktif.daftar[aktif.indeks] : null;
  const ayatKini = kini ? cariAyat(kini.surah, kini.ayat) : null;
  // Ayat yang belum direkam sama sekali tidak perlu dirinci untuk rentang besar.
  const perluTindakan = hasil.lain.filter((x) => x.status !== 'belum-rekam');
  const tampilTindakan = lihatSemua ? perluTindakan : perluTindakan.slice(0, 20);

  const perbaiki = (l: LetakAyat, status: StatusRekaman) => {
    const t = tujuanPerbaikan(l.surah, l.ayat, hasil.jadwal);
    pergi(hashPotongan(status === 'belum-koreksi' ? 'koreksi' : 'rekam', t.potongan, t.rukuk));
  };

  return (
    <>
      <Kepala judul="Murotal" sub={judul} />

      {modeTarget && (
        <section className="kartu ringkas-murotal">
          <p>
            <strong>{hasil.siap.length} ayat target diputar berulang</strong>
            {hasil.lancar.length > 0 && ` · ${hasil.lancar.length} sudah sangat lancar`}
            {jumlah['belum-rekam'] > 0 && ` · ${jumlah['belum-rekam']} belum direkam`}
          </p>
          <p className="kosong">
            <ArrowsClockwise weight="bold" /> Semua ayat target yang sudah direkam, benar maupun salah, diputar terus
            sampai dihentikan. Ayat keluar dari putaran setelah rukuknya mencapai jadwal 14 hari tanpa tanda salah.
          </p>
          {hasil.siap.length === 0 ? (
            <p className="kosong">Belum ada ayat target yang direkam, atau semuanya sudah sangat lancar.</p>
          ) : (
            !aktif && (
              <button className="tombol utama lebar" onClick={() => mulai(judul, hasil.siap, hash, 0, true)}>
                <Play weight="duotone" /> Putar target
              </button>
            )
          )}
          <div className="tautan-murotal">
            <button className="tautan" onClick={() => pergi(hashMurotal({ jenis: 'selain-target' }))}>
              Selain target
            </button>
            <button className="tautan" onClick={() => pergi('#/murotal/pilih')}>
              Pilihan lain (surah, juz)
            </button>
          </div>
        </section>
      )}
      {!modeTarget && (
        <section className="kartu ringkas-murotal">
          <p>
            <strong>{hasil.siap.length} ayat siap diputar</strong>
            {jumlah.perbaiki > 0 && ` · ${jumlah.perbaiki} perlu diperbaiki`}
            {jumlah['belum-koreksi'] > 0 && ` · ${jumlah['belum-koreksi']} belum dikoreksi`}
            {jumlah['belum-rekam'] > 0 && ` · ${jumlah['belum-rekam']} belum direkam`}
          </p>
          {hasil.siap.length === 0 ? (
            <p className="kosong">
              Belum ada rekaman yang siap. Rekam lalu koreksi ayatnya dulu; rekaman yang bersih otomatis masuk murotal.
            </p>
          ) : (
            !aktif && (
              <button className="tombol utama lebar" onClick={() => mulai(judul, hasil.siap, hash, 0, modeTarget)}>
                <Play weight="duotone" /> Putar murotal
              </button>
            )
          )}
        </section>
      )}

      {aktif && kini && ayatKini && (
        <section className="kartu pemutar" ref={refPemutar}>
          {kini.salah && (
            <p className="tanda-rekaman-salah">
              <Warning weight="fill" /> Rekaman ini masih ada kesalahan — rekam ulang bila sempat
            </p>
          )}
          <p className="lokasi-putar">
            {namaAyat(kini)}{' '}
            <span className="redup">
              ({aktif.indeks + 1} dari {aktif.daftar.length})
            </span>
          </p>
          <div className="pilih-tampilan" role="group" aria-label="Tampilan saat diputar">
            {(['ayat', 'arti', 'tutup'] as Tampilan[]).map((t) => (
              <button key={t} className={'chip' + (tampilan === t ? ' aktif' : '')} onClick={() => pilihTampilan(t)}>
                {t === 'ayat' ? 'Ayat' : t === 'arti' ? 'Arti' : 'Tertutup'}
              </button>
            ))}
          </div>
          {tampilan === 'ayat' && <TeksAyat ayat={ayatKini} />}
          {tampilan === 'arti' && (
            <ol className="daftar-makna arti-putar">
              {segmenAyat(ayatKini).map((g) => (
                <li key={g.indeks} className="makna">
                  {maknaEdit.get(`${kini.surah}:${kini.ayat}:${g.indeks}`)?.isi ?? g.maknaBawaan}
                </li>
              ))}
            </ol>
          )}
          {tampilan === 'tutup' && <div className="teks-tertutup">Teks tertutup — simak dan ikuti dari hafalan</div>}
          <div className="kendali-putar">
            {/* Arah mengikuti mushaf: ayat berikutnya di kiri. */}
            <button
              className="tombol-nav"
              onClick={() => lompat(1)}
              disabled={aktif.indeks >= aktif.daftar.length - 1 && !aktif.ulang}
              aria-label="Ayat berikutnya"
            >
              ‹ Berikutnya
            </button>
            <button className="tombol utama bulat" onClick={putarJeda} aria-label={aktif.main ? 'Jeda' : 'Putar'}>
              {aktif.main ? <Pause weight="duotone" /> : <Play weight="duotone" />}
            </button>
            <button
              className="tombol-nav"
              onClick={() => lompat(-1)}
              disabled={aktif.indeks === 0}
              aria-label="Ayat sebelumnya"
            >
              Sebelumnya ›
            </button>
          </div>
          <button
            className="tombol sekunder lebar ada-salah"
            onClick={() => bukaPerbaikan({ surah: kini.surah, ayat: kini.ayat })}
          >
            <Warning weight="duotone" /> Ada salah di ayat ini
          </button>
          {aktif.selesai && <p className="kosong">Murotal selesai. Ketuk putar untuk mengulang dari awal.</p>}
          <div className="pilihan-putar">
            <div className="kecepatan">
              {[0.75, 1, 1.25].map((k) => (
                <button
                  key={k}
                  className={'chip' + (aktif.kecepatan === k ? ' aktif' : '')}
                  onClick={() => aturKecepatan(k)}
                >
                  {String(k).replace('.', ',')}×
                </button>
              ))}
            </div>
          </div>
          <button className="tautan" onClick={berhenti}>
            <Stop weight="duotone" /> Hentikan murotal
          </button>
        </section>
      )}

      {hasil.siap.length > 0 && (
        <section className="kartu">
          <h2>Daftar putar</h2>
          <ol className="daftar-putar" ref={refDaftar}>
            {hasil.siap.map((x, i) => (
              <li key={`${x.surah}:${x.ayat}`}>
                <button
                  className={'baris-putar' + (aktif && aktif.indeks === i ? ' kini' : '')}
                  onClick={() => (aktif ? pilihAyat(i) : mulai(judul, hasil.siap, hash, i, modeTarget))}
                >
                  {x.salah && <span className="titik-salah" role="img" aria-label="Rekaman masih ada kesalahan" />}
                  {namaAyat(x)}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {perbaikan && (
        <PerbaikanMurotal
          surah={perbaikan.surah}
          ayat={perbaikan.ayat}
          tutup={(lanjut) => {
            setPerbaikan(null);
            if (lanjut) {
              // Ada perubahan: daftar putar disusun ulang, berlanjut dari ayat sesudahnya.
              setLanjutDari(perbaikan);
              setVersi((v) => v + 1);
            } else if (!keadaanMain()) putarJeda(); // batal: lanjut dari posisi semula
          }}
        />
      )}

      {perluTindakan.length > 0 && (
        <section className="kartu">
          <h2>Belum masuk murotal</h2>
          <ul className="daftar-tindakan">
            {tampilTindakan.map(({ letak, status }) => (
              <li key={`${letak.surah}:${letak.ayat}`}>
                <span>
                  <span className={'status ' + status}>{LABEL[status]}</span> {namaAyat(letak)}
                </span>
                <button className="tombol kecil sekunder" onClick={() => perbaiki(letak, status)}>
                  {status === 'belum-koreksi' ? (
                    <>
                      <Check weight="duotone" /> Koreksi
                    </>
                  ) : (
                    <>
                      <Microphone weight="duotone" /> Rekam ulang
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {perluTindakan.length > 20 && (
            <button className="tautan" onClick={() => setLihatSemua((v) => !v)}>
              {lihatSemua ? 'Tampilkan 20 saja' : `Tampilkan semua (${perluTindakan.length})`}
            </button>
          )}
        </section>
      )}
    </>
  );
}

// ---------- Bilah pemutar kecil di layar lain ----------

export function BilahPemutar({ layarHash }: { layarHash: string }) {
  const k = usePemutar();
  if (!k || k.asal === layarHash) return null;
  const kini = k.daftar[k.indeks];
  return (
    <div className="bilah-pemutar">
      <button className="info-putar" onClick={() => pergi(k.asal)}>
        <span className="redup">Murotal · {k.judul}</span>
        <span>{namaAyat(kini)}</span>
      </button>
      <button className="tombol-ikon" onClick={putarJeda} aria-label={k.main ? 'Jeda' : 'Putar'}>
        {k.main ? <Pause weight="duotone" /> : <Play weight="duotone" />}
      </button>
      <button className="tombol-ikon" onClick={berhenti} aria-label="Hentikan murotal">
        ✕
      </button>
    </div>
  );
}
