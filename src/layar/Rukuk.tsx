import { useEffect, useState } from 'react';
import { cariRukuk, juzAyat, labelPotongan } from '../data';
import { ambilHafalan, ambilJadwal } from '../db';
import { hariIni, kelompok, rentangMurojaah, selisihHari, type EntriHafalan, type EntriJadwal } from '../jadwal';
import { hashPotongan, pergi } from '../navigasi';
import Kepala from '../komponen/Kepala';
import { namaRukuk } from './HariIni';

function keteranganJadwal(j: EntriJadwal, hari: string): string {
  const n = selisihHari(hari, j.jatuhTempo);
  const kapan = n <= 0 ? 'jatuh tempo hari ini' : n === 1 ? 'diulang besok' : `diulang ${n} hari lagi`;
  const k = kelompok(j);
  return `${k === 'berjalan' ? 'berjalan' : k === 'dekat' ? 'dekat' : 'lama'} · ${kapan}`;
}

// Semua rukuk yang sudah masuk hafalan, untuk murojaah manual di luar jadwal.
export default function LayarRukuk() {
  const hari = hariIni();
  const [hafalan, setHafalan] = useState<Map<string, EntriHafalan> | null>(null);
  const [jadwal, setJadwal] = useState<Map<number, EntriJadwal>>(new Map());

  useEffect(() => {
    ambilHafalan().then(setHafalan);
    ambilJadwal().then(setJadwal);
  }, []);

  if (!hafalan) return null;
  const daftar = [...jadwal.values()].sort((a, b) => a.nomor - b.nomor);

  return (
    <>
      <Kepala judul="Rukuk yang dihafal" sub={`${daftar.length} rukuk`} />
      {daftar.length === 0 && <p className="petunjuk">Belum ada rukuk yang masuk hafalan.</p>}
      <ul className="daftar-ulang daftar-rukuk">
        {daftar.map((j) => {
          const r = cariRukuk(j.nomor)!;
          const rentang = rentangMurojaah(j, hafalan);
          return (
            <li key={j.nomor}>
              <button
                className="baris-ulang"
                disabled={!rentang}
                onClick={() => rentang && pergi(hashPotongan('rekam', rentang, j.nomor))}
              >
                <span className="info">
                  <span className="nama">{namaRukuk(r)}</span>
                  <span className="redup">
                    Juz {juzAyat(r.surah, r.ayatAwal)} · ayat {r.ayatAwal}–{r.ayatAkhir}
                    {rentang && !j.lengkap && ` · hafal ${labelPotongan(rentang)}`}
                  </span>
                  <span className="redup">{keteranganJadwal(j, hari)}</span>
                </span>
                <span className="panah">🎙</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
