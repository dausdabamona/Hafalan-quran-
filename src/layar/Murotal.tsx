import { useEffect, useMemo, useRef, useState } from 'react';
import { gulirDalam, gulirKe } from '../komponen/gulir';
import { cariAyat, cariSurah, daftarJuz, daftarSurah } from '../data';
import { ambilBahanMurotal, ambilHafalan, ambilJadwal, kunciAyat, type BahanSurah } from '../db';
import { ayatHafal, type EntriJadwal } from '../jadwal';
import {
  daftarAyatRentang,
  hashMurotal,
  judulRentang,
  statusRekaman,
  tujuanPerbaikan,
  type LetakAyat,
  type Rentang,
  type StatusRekaman,
} from '../murotal';
import { hashPotongan, pergi } from '../navigasi';
import {
  aturKecepatan,
  berhenti,
  dengarkan,
  keadaanPemutar,
  lompat,
  mulai,
  pilihAyat,
  putarJeda,
  type ItemMurotal,
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

function namaAyat(l: LetakAyat): string {
  return `${cariSurah(l.surah)?.nama ?? l.surah} · ayat ${l.ayat}`;
}

// ---------- Pilihan rentang ----------

export function LayarPilihMurotal() {
  const [surah, setSurah] = useState(1);
  return (
    <>
      <Kepala judul="Murotal" sub="Dari rekaman murojaah Anda sendiri" />
      <section className="kartu">
        <p className="kosong">
          Hanya ayat yang rekamannya sudah dikoreksi dan bersih dari kesalahan yang diputar. Murotal tetap berputar
          saat layar dimatikan.
        </p>
        <button className="tombol utama lebar" onClick={() => pergi(hashMurotal({ jenis: 'hafalan' }))}>
          ▶ Semua hafalan
        </button>
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
        <p className="kosong">Murotal per rukuk: buka surahnya, lalu ketuk ▶ Murotal di kepala rukuk.</p>
      </section>
      <section className="kartu">
        <h2>Per juz</h2>
        <div className="kisi-juz">
          {daftarJuz.map((j) => (
            <button key={j.nomor} className="tombol sekunder" onClick={() => pergi(hashMurotal({ jenis: 'juz', nomor: j.nomor }))}>
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
  perbaiki: '⚠ Perlu diperbaiki',
  'belum-koreksi': '○ Belum dikoreksi',
  'belum-rekam': '– Belum direkam',
};

interface Hasil {
  siap: ItemMurotal[];
  lain: { letak: LetakAyat; status: Exclude<StatusRekaman, 'siap'> }[];
  jadwal: Map<number, EntriJadwal>;
}

export default function LayarMurotal({ rentang }: { rentang: Rentang }) {
  const hash = hashMurotal(rentang);
  const judul = judulRentang(rentang);
  const pemutar = usePemutar();
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [tutupTeks, setTutupTeks] = useState(false);
  const [lihatSemua, setLihatSemua] = useState(false);
  const [versi, setVersi] = useState(0);
  const [perbaikan, setPerbaikan] = useState<LetakAyat | null>(null);
  const refPemutar = useRef<HTMLElement>(null);
  const refDaftar = useRef<HTMLOListElement>(null);
  const [lanjutDari, setLanjutDari] = useState<LetakAyat | null>(null);

  useEffect(() => {
    let batal = false;
    (async () => {
      const [hafalan, jadwal] = await Promise.all([ambilHafalan(), ambilJadwal()]);
      const daftar = daftarAyatRentang(rentang, ayatHafal(hafalan));
      const bahan: Map<number, BahanSurah> = await ambilBahanMurotal(daftar.map((l) => l.surah));
      const siap: ItemMurotal[] = [];
      const lain: Hasil['lain'] = [];
      for (const l of daftar) {
        const b = bahan.get(l.surah)!;
        const rekaman = b.rekaman.get(kunciAyat(l.surah, l.ayat));
        const status = statusRekaman(l.ayat, {
          rekaman,
          sesi: b.sesi,
          tandaSalah: b.tandaSalah.filter((t) => t.ayat === l.ayat),
          tertukar: b.tertukar.get(kunciAyat(l.surah, l.ayat - 1)),
        });
        if (status === 'siap') siap.push({ surah: l.surah, ayat: l.ayat, audio: rekaman!.audio });
        else lain.push({ letak: l, status });
      }
      if (!batal) setHasil({ siap, lain, jadwal });
    })();
    return () => {
      batal = true;
    };
  }, [hash, versi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sesudah perbaikan (K-31): daftar putar disusun ulang lalu berlanjut dari ayat sesudahnya.
  useEffect(() => {
    if (!hasil || !lanjutDari) return;
    const l = lanjutDari;
    setLanjutDari(null);
    const i = hasil.siap.findIndex((x) => x.surah > l.surah || (x.surah === l.surah && x.ayat > l.ayat));
    if (i >= 0) mulai(judul, hasil.siap, hash, i);
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
            <button className="tombol utama lebar" onClick={() => mulai(judul, hasil.siap, hash)}>
              ▶ Putar murotal
            </button>
          )
        )}
      </section>

      {aktif && kini && ayatKini && (
        <section className="kartu pemutar" ref={refPemutar}>
          <p className="lokasi-putar">
            {namaAyat(kini)} <span className="redup">({aktif.indeks + 1} dari {aktif.daftar.length})</span>
          </p>
          {tutupTeks ? (
            <div className="teks-tertutup">Teks tertutup — simak dan ikuti dari hafalan</div>
          ) : (
            <TeksAyat ayat={ayatKini} />
          )}
          <div className="kendali-putar">
            {/* Arah mengikuti mushaf: ayat berikutnya di kiri. */}
            <button className="tombol-nav" onClick={() => lompat(1)} disabled={aktif.indeks >= aktif.daftar.length - 1} aria-label="Ayat berikutnya">
              ‹ Berikutnya
            </button>
            <button className="tombol utama bulat" onClick={putarJeda} aria-label={aktif.main ? 'Jeda' : 'Putar'}>
              {aktif.main ? '❚❚' : '▶'}
            </button>
            <button className="tombol-nav" onClick={() => lompat(-1)} disabled={aktif.indeks === 0} aria-label="Ayat sebelumnya">
              Sebelumnya ›
            </button>
          </div>
          <button className="tombol sekunder lebar ada-salah" onClick={() => bukaPerbaikan({ surah: kini.surah, ayat: kini.ayat })}>
            ⚠ Ada salah di ayat ini
          </button>
          {aktif.selesai && <p className="kosong">Murotal selesai. Ketuk ▶ untuk mengulang dari awal.</p>}
          <div className="pilihan-putar">
            <label className="saklar">
              <input type="checkbox" checked={tutupTeks} onChange={(e) => setTutupTeks(e.target.checked)} />
              <span>Tutup teks</span>
            </label>
            <div className="kecepatan">
              {[0.75, 1, 1.25].map((k) => (
                <button key={k} className={'chip' + (aktif.kecepatan === k ? ' aktif' : '')} onClick={() => aturKecepatan(k)}>
                  {String(k).replace('.', ',')}×
                </button>
              ))}
            </div>
          </div>
          <button className="tautan" onClick={berhenti}>
            ■ Hentikan murotal
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
                  onClick={() => (aktif ? pilihAyat(i) : mulai(judul, hasil.siap, hash, i))}
                >
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
                  {status === 'belum-koreksi' ? '✓ Koreksi' : '🎙 Rekam ulang'}
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
        {k.main ? '❚❚' : '▶'}
      </button>
      <button className="tombol-ikon" onClick={berhenti} aria-label="Hentikan murotal">
        ✕
      </button>
    </div>
  );
}
