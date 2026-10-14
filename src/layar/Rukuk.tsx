import { useEffect, useState } from 'react';
import { cariSurah, labelPotongan } from '../data';
import { ambilCatatanDeres, ambilJadwal } from '../db';
import { hariIni, selisihHari, type EntriJadwal } from '../jadwal';
import { hashPotongan, pergi } from '../navigasi';
import {
  ayatHafal,
  daftarRukuk,
  jumlahRukukSurah,
  lengkap,
  rentangDeres,
  urutanDalamSurah,
  type CatatanDeres,
  type Rukuk,
} from '../rukuk';
import Kepala from '../komponen/Kepala';

export function namaRukuk(r: Rukuk): string {
  const nama = cariSurah(r.surah)?.nama ?? String(r.surah);
  return jumlahRukukSurah(r.surah) > 1 ? `${nama} · rukuk ${urutanDalamSurah(r)}` : nama;
}

export function keteranganTerakhir(c: CatatanDeres | undefined, hari: string): string {
  if (!c) return 'belum pernah dideres';
  const n = selisihHari(c.terakhir, hari);
  return n === 0 ? 'dideres hari ini' : `terakhir dideres ${n} hari lalu`;
}

// Daftar semua rukuk Juz 30 untuk deres manual di luar giliran harian.
export default function LayarRukuk() {
  const hari = hariIni();
  const [jadwal, setJadwal] = useState<Map<string, EntriJadwal> | null>(null);
  const [catatan, setCatatan] = useState<Map<number, CatatanDeres>>(new Map());

  useEffect(() => {
    ambilJadwal().then(setJadwal);
    ambilCatatanDeres().then(setCatatan);
  }, []);

  if (!jadwal) return null;
  const hafal = ayatHafal(jadwal);

  return (
    <>
      <Kepala judul="Deres per rukuk" sub={`Juz 30 · ${daftarRukuk.length} rukuk`} />
      <ul className="daftar-ulang daftar-rukuk">
        {daftarRukuk.map((r) => {
          const rentang = rentangDeres(r, hafal);
          const bisa = !!rentang && rentang.ayatAkhir > rentang.ayatAwal;
          return (
            <li key={r.nomor}>
              <button
                className="baris-ulang"
                disabled={!bisa}
                onClick={() => rentang && pergi(hashPotongan('rekam', rentang, r.nomor))}
              >
                <span className="info">
                  <span className="nama">{namaRukuk(r)}</span>
                  <span className="redup">
                    ayat {r.ayatAwal}–{r.ayatAkhir}
                    {rentang && !lengkap(r, rentang) && ` · hafal ${labelPotongan(rentang)}`}
                    {!rentang && ' · belum dihafal'}
                  </span>
                  {rentang && <span className="redup">{keteranganTerakhir(catatan.get(r.nomor), hari)}</span>}
                </span>
                {bisa && <span className="panah">🎙</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
