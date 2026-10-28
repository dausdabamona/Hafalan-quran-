import { useEffect, useMemo, useState } from 'react';
import { Flame } from '@phosphor-icons/react';
import { cariSurah, daftarJuz, juzAyat } from '../data';
import { ambilHafalan, db, type Sesi, type TandaSalah, type TandaTertukar } from '../db';
import { ayatHafal, hariIni } from '../jadwal';
import { akurasiKata, hariLokal, kataSeringSalah, petaJuz, rentetanHari, type Kekuatan } from '../kemajuan';
import Kepala from '../komponen/Kepala';
import { kelasJenis, LABEL_JENIS } from '../komponen/PilihJenisSalah';
import { pergi } from '../navigasi';
import { namaRukuk } from './HariIni';

const LABEL: Record<Kekuatan, string> = { kuat: 'kuat', sedang: 'sedang', lemah: 'lemah', belum: 'belum hafal' };

interface Data {
  hafal: Set<string>;
  sesi: Sesi[];
  tandaSalah: TandaSalah[];
  tertukar: TandaTertukar[];
}

// Layar Kemajuan (K-49): ringkasan angka, peta kekuatan per rukuk dalam satu juz,
// dan kata yang paling sering salah.
export default function LayarKemajuan() {
  const [data, setData] = useState<Data | null>(null);
  const [juz, setJuz] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [hafalan, sesi, tandaSalah, tertukar] = await Promise.all([
        ambilHafalan(),
        db.sesi.toArray(),
        db.tandaSalah.toArray(),
        db.tandaTertukar.toArray(),
      ]);
      const hafal = ayatHafal(hafalan);
      setData({ hafal, sesi, tandaSalah, tertukar });
      // Juz yang paling banyak hafalannya tampil lebih dulu.
      const perJuz = Array(31).fill(0);
      for (const k of hafal) {
        const [s, a] = k.split(':').map(Number);
        perJuz[juzAyat(s, a)]++;
      }
      const terbanyak = perJuz.indexOf(Math.max(...perJuz));
      setJuz(perJuz[terbanyak] > 0 ? terbanyak : 30);
    })();
  }, []);

  const peta = useMemo(
    () => (data && juz ? petaJuz(juz, data.hafal, data.tandaSalah, data.tertukar) : []),
    [data, juz],
  );

  if (!data || !juz) return <Kepala judul="Kemajuan" kembali={false} />;

  const sejak = new Date(Date.now() - 30 * 86400000).toISOString();
  const akurasi = akurasiKata(data.sesi, sejak);
  const rentetan = rentetanHari(
    data.sesi.map((s) => hariLokal(s.tanggal)),
    hariIni(),
  );
  const kata = kataSeringSalah(data.tandaSalah);

  return (
    <>
      <Kepala judul="Kemajuan" sub="Kata benar dihitung dari 30 hari terakhir" kembali={false} />
      <div className="isi-kemajuan">
        <div className="ringkas-kemajuan">
          <div>
            <strong>{data.hafal.size.toLocaleString('id-ID')}</strong>
            <span>ayat hafal</span>
          </div>
          <div>
            <strong className="hijau">{akurasi === null ? '–' : `${akurasi}%`}</strong>
            <span>kata benar</span>
          </div>
          <div>
            <strong className="api">
              <Flame size={20} weight="fill" /> {rentetan}
            </strong>
            <span>hari berturut</span>
          </div>
        </div>

        <section className="kartu-kemajuan">
          <div className="kepala-kartu">
            <h2>Peta per rukuk</h2>
            <label className="pilih-juz">
              <span className="sr-only">Juz</span>
              <select value={juz} onChange={(e) => setJuz(Number(e.target.value))}>
                {daftarJuz.map((j) => (
                  <option key={j.nomor} value={j.nomor}>
                    Juz {j.nomor}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="keterangan-kecil">
            Warna menunjukkan banyaknya kata salah dan sambungan tertukar. Ketuk untuk membuka.
          </p>
          <ul className="peta-rukuk">
            {peta.map((p) => (
              <li key={p.rukuk.nomor}>
                <button
                  className={'sel-peta ' + p.kekuatan}
                  onClick={() => pergi(`#/surah/${p.rukuk.surah}/${p.rukuk.ayatAwal}`)}
                  title={`${namaRukuk(p.rukuk)}: ${LABEL[p.kekuatan]}`}
                >
                  <span className="nama">{namaRukuk(p.rukuk)}</span>
                  <span className="rinci">
                    {p.kekuatan === 'belum' ? 'belum hafal' : `${p.ayatHafal} ayat · ${p.salah} salah`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="legenda-peta">
            {(['kuat', 'sedang', 'lemah', 'belum'] as Kekuatan[]).map((k) => (
              <span key={k}>
                <span className={'titik-legenda ' + k} />
                {LABEL[k]}
              </span>
            ))}
          </div>
        </section>

        <section className="kartu-kemajuan">
          <h2>Kata yang paling sering salah</h2>
          <p className="legenda-jenis">
            {(Object.keys(LABEL_JENIS) as (keyof typeof LABEL_JENIS)[]).map((j) => (
              <span key={j} className={kelasJenis(j)}>
                <span className="titik-jenis" /> {LABEL_JENIS[j]}
              </span>
            ))}
          </p>
          {kata.length === 0 ? (
            <p className="keterangan-kecil">Belum ada kata yang ditandai salah. Alhamdulillah.</p>
          ) : (
            <ul className="daftar-kata-salah">
              {kata.map((k) => (
                <li key={`${k.surah}:${k.ayat}:${k.urutan}`}>
                  <button className={kelasJenis(k.jenis)} onClick={() => pergi(`#/surah/${k.surah}/${k.ayat}`)}>
                    <span className="arab-salah" lang="ar" dir="rtl">
                      {k.teks}
                    </span>
                    <span className="letak">
                      {cariSurah(k.surah)?.nama} {k.ayat}
                    </span>
                    <strong>{k.jumlah}×</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
