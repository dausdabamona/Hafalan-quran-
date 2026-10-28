import { useState } from 'react';
import type { Ayat, Segmen, Surah } from '../data';
import { simpanMakna } from '../db';

// ---------- Lembar edit makna potongan waqaf (K-25) ----------

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
  const simpan = async () => {
    // Bila sama dengan gabungan arti per kata, tidak perlu disimpan sebagai suntingan.
    await simpanMakna(surah.nomor, ayat.ayat, segmen.indeks, isi.trim() === segmen.maknaBawaan ? '' : isi);
    await sesudahSimpan();
    tutup();
  };
  const kembalikan = async () => {
    await simpanMakna(surah.nomor, ayat.ayat, segmen.indeks, '');
    await sesudahSimpan();
    tutup();
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
        <label className="label-catatan" htmlFor="makna">
          Makna (boleh disusun ulang agar mudah dipahami)
        </label>
        <textarea id="makna" value={isi} onChange={(e) => setIsi(e.target.value)} rows={3} />
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
