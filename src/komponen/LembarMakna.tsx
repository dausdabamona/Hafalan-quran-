import { useState } from 'react';
import type { Ayat, Segmen, Surah } from '../data';
import { db, simpanMakna } from '../db';
import { terimaUsulan } from '../mcp/usulan';
import KotakUsulan, { useUsulanBaris } from './KotakUsulan';

// ---------- Lembar edit makna potongan waqaf (K-25) ----------
// K-96: bila ada usulan Claude yang menunggu untuk potongan ini, kotak usulan tampil di sini.

export default function LembarMakna({
  surah,
  ayat,
  segmen,
  awal,
  tutup,
  sesudahSimpan,
}: {
  surah: Surah;
  ayat: Ayat;
  segmen: Segmen;
  awal: string;
  tutup: () => void;
  sesudahSimpan: () => Promise<void>;
}) {
  const [isi, setIsi] = useState(awal || segmen.maknaBawaan);
  // Benar bila isi kolom berasal dari "Salin ke kolom": Simpan = usulan diterima dengan isi gabungan.
  const [dariUsulan, setDariUsulan] = useState(false);
  const usulan = useUsulanBaris('makna', `${surah.nomor}:${ayat.ayat}:${segmen.indeks}`);
  const [pesan, setPesan] = useState('');

  const selesai = async () => {
    await sesudahSimpan();
    tutup();
  };
  const simpan = async () => {
    try {
      if (dariUsulan && usulan.data && isi.trim()) {
        await terimaUsulan(db, usulan.data.u.kunci, { isi, paksa: true });
      } else {
        // Bila sama dengan gabungan arti per kata, tidak perlu disimpan sebagai suntingan.
        await simpanMakna(surah.nomor, ayat.ayat, segmen.indeks, isi.trim() === segmen.maknaBawaan ? '' : isi);
      }
      await selesai();
    } catch (e) {
      setPesan((e as Error).message);
    }
  };
  const kembalikan = async () => {
    await simpanMakna(surah.nomor, ayat.ayat, segmen.indeks, '');
    await selesai();
  };
  return (
    <div className="latar-lembar" onClick={tutup}>
      <div className="lembar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">
          {surah.nama} · ayat {ayat.ayat} · potongan {segmen.indeks + 1}
        </p>
        <p className="potongan-arab" lang="ar" dir="rtl">
          {segmen.kata.map((k) => k.teks).join(' ')}
        </p>
        <p className="kosong">Gabungan arti per kata: {segmen.maknaBawaan}</p>
        <KotakUsulan
          data={usulan.data}
          salin={(x) => {
            setIsi(x);
            setDariUsulan(true);
          }}
          sesudahTerima={selesai}
          sesudahTolak={async () => {
            setDariUsulan(false);
            await usulan.muat();
            await sesudahSimpan();
          }}
        />
        <label className="label-catatan" htmlFor="makna">
          Makna (boleh disusun ulang agar mudah dipahami)
        </label>
        <textarea id="makna" value={isi} onChange={(e) => setIsi(e.target.value)} rows={3} />
        {pesan && <p className="kosong">{pesan}</p>}
        <div className="aksi-lembar">
          {awal && (
            <button className="tombol sekunder" onClick={kembalikan}>
              Kembalikan
            </button>
          )}
          <button className="tombol sekunder" onClick={tutup}>
            Batal
          </button>
          <button className="tombol utama" onClick={simpan}>
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
