import { useCallback, useEffect, useMemo, useState } from 'react';
import { daftarJuz, daftarRukuk, daftarSurah, juzAyat, rukukSurah } from '../data';
import { ambilHafalan, batalkanHafalanLama, tandaiHafalanLama } from '../db';
import { adaTandaLama, ayatHafal, rukukSudahHafal, type EntriHafalan } from '../jadwal';
import { pergi } from '../navigasi';
import Kepala from '../komponen/Kepala';

type Status = 'semua' | 'sebagian' | 'belum';

// Rukuk dikelompokkan ke juz tempat ayat pertamanya berada.
const rukukPerJuz = new Map<number, number[]>();
for (const r of daftarRukuk) {
  const j = juzAyat(r.surah, r.ayatAwal);
  rukukPerJuz.set(j, [...(rukukPerJuz.get(j) ?? []), r.nomor]);
}

// Daftar 114 surah, dengan judul juz di surah tempat juz itu dimulai.
// Mode "Tandai hafalan lama" (K-27): centang per juz atau per surah.
export default function LayarDaftar() {
  const [hafalan, setHafalan] = useState<Map<string, EntriHafalan> | null>(null);
  const [modeTandai, setModeTandai] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');

  const muat = useCallback(() => ambilHafalan().then(setHafalan), []);
  useEffect(() => {
    muat();
  }, [muat]);

  const hafal = useMemo(() => {
    const ayat = ayatHafal(hafalan ?? new Map());
    return new Set(daftarRukuk.filter((r) => rukukSudahHafal(r.nomor, ayat)).map((r) => r.nomor));
  }, [hafalan]);

  const status = (nomor: number[]): Status => {
    const n = nomor.filter((x) => hafal.has(x)).length;
    return n === 0 ? 'belum' : n === nomor.length ? 'semua' : 'sebagian';
  };

  const ubah = async (nomor: number[], nama: string) => {
    if (!hafalan || sibuk) return;
    setSibuk(true);
    try {
      if (status(nomor) === 'semua') {
        const lama = nomor.filter((n) => adaTandaLama(n, hafalan));
        if (lama.length === 0) {
          setPesan(`${nama} dihafal lewat Hafalan baru, jadi tandanya tetap.`);
          return;
        }
        if (!window.confirm(`Batalkan tanda hafalan lama ${nama}? Jadwal murojaahnya ikut dihapus.`)) return;
        await batalkanHafalanLama(lama);
        setPesan(`Tanda hafalan lama ${nama} dibatalkan.`);
      } else {
        const jumlah = await tandaiHafalanLama(nomor);
        setPesan(`${nama}: ${jumlah} rukuk masuk Ulang hafalan, dicicil paling banyak 10 rukuk per malam.`);
      }
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  return (
    <>
      <Kepala
        judul="Semua surah"
        sub={`30 juz · 114 surah · ${hafal.size} dari ${daftarRukuk.length} rukuk hafal`}
        kanan={
          <button
            className={'tombol-ikon kecil lebar-teks' + (modeTandai ? ' aktif' : '')}
            onClick={() => {
              setModeTandai((v) => !v);
              setPesan('');
            }}
          >
            {modeTandai ? 'Selesai' : 'Tandai hafal'}
          </button>
        }
      />
      {modeTandai && (
        <div className="petunjuk-tandai">
          <p>
            Centang juz atau surah yang <strong>sudah Anda hafal sebelumnya</strong>. Bagian ini langsung masuk Ulang
            hafalan, dan Hafalan baru akan melompatinya. Untuk surah yang baru hafal sebagian, buka surahnya lalu
            tandai per rukuk.
          </p>
          {pesan && <p className="pesan-tandai">{pesan}</p>}
        </div>
      )}
      <ul className="daftar-surah">
        {daftarSurah.map((s) => {
          const juzMulai = daftarJuz.filter((j) => j.surah === s.nomor);
          const rukukIni = rukukSurah(s.nomor).map((r) => r.nomor);
          const st = status(rukukIni);
          return (
            <li key={s.nomor}>
              {juzMulai.map((j) => {
                const nomorJuz = rukukPerJuz.get(j.nomor) ?? [];
                const sj = status(nomorJuz);
                return modeTandai ? (
                  <button
                    key={j.nomor}
                    className={'judul-juz tandai ' + sj}
                    onClick={() => ubah(nomorJuz, `Juz ${j.nomor}`)}
                    disabled={sibuk}
                  >
                    <span className="kotak" aria-hidden="true">
                      {sj === 'semua' ? '✓' : sj === 'sebagian' ? '–' : ''}
                    </span>
                    Juz {j.nomor}
                    {j.ayat > 1 ? ` · mulai ${s.nama} ayat ${j.ayat}` : ''}
                  </button>
                ) : (
                  <p key={j.nomor} className="judul-juz">
                    Juz {j.nomor}
                    {j.ayat > 1 ? ` · mulai ${s.nama} ayat ${j.ayat}` : ''}
                  </p>
                );
              })}
              <button
                className={'baris-surah' + (modeTandai ? ' tandai ' + st : '')}
                onClick={() => (modeTandai ? ubah(rukukIni, s.nama) : pergi(`#/surah/${s.nomor}`))}
                disabled={modeTandai && sibuk}
              >
                {modeTandai ? (
                  <span className="kotak" aria-hidden="true">
                    {st === 'semua' ? '✓' : st === 'sebagian' ? '–' : ''}
                  </span>
                ) : (
                  <span className="nomor">{s.nomor}</span>
                )}
                <span className="info">
                  <span className="nama">{s.nama}</span>
                  <span className="detail">{s.arti}</span>
                  <span className="detail">
                    {s.jumlahAyat} ayat
                    {st === 'semua' ? ' · hafal' : st === 'sebagian' ? ' · hafal sebagian' : ''}
                  </span>
                </span>
                <span className="nama-arab" lang="ar" dir="rtl">
                  {s.namaArab}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
