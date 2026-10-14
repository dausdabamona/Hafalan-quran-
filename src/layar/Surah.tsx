import { useCallback, useEffect, useState } from 'react';
import { ayatPotongan, bagiPotongan, labelPotongan, teksBasmalah, type Ayat, type Kata, type Surah } from '../data';
import {
  ambilKeteranganSurah,
  ambilRekamanSurah,
  ambilTandaSurah,
  hapusTandaSalah,
  hapusTandaTertukar,
  kunciAyat,
  kunciKata,
  kunciKeterangan,
  simpanKeterangan,
  type Keterangan,
  type Rekaman,
  type TandaSalah,
  type TandaSurah,
  type TandaTertukar,
} from '../db';
import { hashPotongan, pergi } from '../navigasi';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';
import TombolPutar from '../komponen/TombolPutar';

type Pilihan = { ayat: Ayat; kata: Kata | null }; // kata null = keterangan ayat

export function tanggalPendek(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LayarSurah({ surah, aturUkuran }: { surah: Surah; aturUkuran: (s: number) => void }) {
  const [keterangan, setKeterangan] = useState<Map<string, Keterangan>>(new Map());
  const [rekaman, setRekaman] = useState<Map<string, Rekaman>>(new Map());
  const [tanda, setTanda] = useState<TandaSurah>({ salah: new Map(), tertukar: new Map() });
  const [pilihan, setPilihan] = useState<Pilihan | null>(null);

  const muat = useCallback(async () => {
    const [k, r, t] = await Promise.all([
      ambilKeteranganSurah(surah.nomor),
      ambilRekamanSurah(surah.nomor),
      ambilTandaSurah(surah.nomor),
    ]);
    setKeterangan(k);
    setRekaman(r);
    setTanda(t);
  }, [surah.nomor]);

  useEffect(() => {
    muat();
  }, [muat]);

  const basmalah = surah.ayat[0] ? teksBasmalah(surah.ayat[0]) : null;

  const kelasKata = (a: Ayat) => (k: Kata) => {
    const kelas: string[] = [];
    if (keterangan.has(kunciKeterangan(surah.nomor, a.ayat, k.urutan))) kelas.push('ada-catatan');
    if (tanda.salah.has(kunciKata(surah.nomor, a.ayat, k.urutan))) kelas.push('tanda-lama');
    return kelas.join(' ');
  };

  const hapusTertukar = async (t: TandaTertukar) => {
    if (!window.confirm(`Hapus tanda sambungan ayat ${t.ayatAsal} → ${t.ayatAsal + 1}?`)) return;
    await hapusTandaTertukar(t.kunci);
    await muat();
  };

  return (
    <>
      <Kepala
        judul={surah.nama}
        sub={`${surah.arti} · ${surah.jumlahAyat} ayat`}
        kanan={
          <div className="atur-huruf">
            <button className="tombol-ikon kecil" onClick={() => aturUkuran(-2)} aria-label="Perkecil huruf">
              A−
            </button>
            <button className="tombol-ikon kecil" onClick={() => aturUkuran(2)} aria-label="Perbesar huruf">
              A+
            </button>
          </div>
        }
      />

      {basmalah && (
        <p className="basmalah" lang="ar" dir="rtl">
          {basmalah}
        </p>
      )}

      {bagiPotongan(surah).map((p) => {
        const daftarAyat = ayatPotongan(surah, p);
        const lengkap = daftarAyat.every((a) => rekaman.has(kunciAyat(surah.nomor, a.ayat)));
        return (
          <section key={p.ayatAwal} className="potongan">
            <div className="kepala-potongan">
              <span className="label-potongan">Potongan {labelPotongan(p)}</span>
              <div className="aksi-potongan">
                <button className="tombol kecil sekunder" onClick={() => pergi(hashPotongan('rekam', p))}>
                  🎙 Rekam
                </button>
                <button
                  className="tombol kecil sekunder"
                  onClick={() => pergi(hashPotongan('koreksi', p))}
                  disabled={!lengkap}
                >
                  ✓ Koreksi
                </button>
              </div>
            </div>
            <ol className="daftar-ayat">
              {daftarAyat.map((a) => {
                const ketAyat = keterangan.get(kunciKeterangan(surah.nomor, a.ayat, 0));
                const rek = rekaman.get(kunciAyat(surah.nomor, a.ayat));
                const tertukar = tanda.tertukar.get(kunciAyat(surah.nomor, a.ayat));
                return (
                  <li key={a.ayat}>
                    <div className="ayat">
                      <TeksAyat ayat={a} kelasKata={kelasKata(a)} ketukKata={(k) => setPilihan({ ayat: a, kata: k })} />
                      <div className="kaki-ayat">
                        <button className="tautan" onClick={() => setPilihan({ ayat: a, kata: null })}>
                          {ketAyat ? 'Keterangan ayat ✎' : '+ Keterangan ayat'}
                        </button>
                        {rek && <TombolPutar audio={rek.audio} label="Rekaman saya" />}
                      </div>
                      {ketAyat && <p className="catatan-ayat">{ketAyat.isi}</p>}
                    </div>
                    {tertukar && (
                      <div className="sambungan-bertanda">
                        <span>
                          ⚠ Sambungan ke ayat {tertukar.ayatAsal + 1} pernah tertukar {tertukar.jumlah}× (terbaca{' '}
                          {tertukar.ayatKeliru ? `ayat ${tertukar.ayatKeliru}` : 'ayat lain'})
                        </span>
                        <button className="tautan kecil" onClick={() => hapusTertukar(tertukar)}>
                          Hapus tanda
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {pilihan && (
        <LembarKata
          surah={surah}
          pilihan={pilihan}
          keterangan={keterangan}
          tandaSalah={pilihan.kata ? tanda.salah.get(kunciKata(surah.nomor, pilihan.ayat.ayat, pilihan.kata.urutan)) : undefined}
          tutup={() => setPilihan(null)}
          sesudahSimpan={muat}
        />
      )}
    </>
  );
}

// ---------- Lembar bawah: arti kata, tanda salah, keterangan pribadi ----------

function LembarKata({
  surah,
  pilihan,
  keterangan,
  tandaSalah,
  tutup,
  sesudahSimpan,
}: {
  surah: Surah;
  pilihan: Pilihan;
  keterangan: Map<string, Keterangan>;
  tandaSalah?: TandaSalah;
  tutup: () => void;
  sesudahSimpan: () => Promise<void>;
}) {
  const urutan = pilihan.kata?.urutan ?? 0;
  const kunci = kunciKeterangan(surah.nomor, pilihan.ayat.ayat, urutan);
  const [isi, setIsi] = useState(keterangan.get(kunci)?.isi ?? '');
  const [menyimpan, setMenyimpan] = useState(false);

  const simpan = async () => {
    setMenyimpan(true);
    await simpanKeterangan(surah.nomor, pilihan.ayat.ayat, urutan, isi);
    await sesudahSimpan();
    setMenyimpan(false);
    tutup();
  };

  const hapusTanda = async () => {
    if (!tandaSalah || !window.confirm('Hapus tanda salah pada kata ini?')) return;
    await hapusTandaSalah(tandaSalah.kunci);
    await sesudahSimpan();
    tutup();
  };

  return (
    <div className="latar-lembar" onClick={tutup}>
      <div className="lembar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">
          {surah.nama} · ayat {pilihan.ayat.ayat}
          {pilihan.kata ? ` · kata ke-${pilihan.kata.urutan}` : ''}
        </p>
        {pilihan.kata && (
          <>
            <p className="kata-besar" lang="ar" dir="rtl">
              {pilihan.kata.teks}
            </p>
            <p className="arti">{pilihan.kata.arti}</p>
          </>
        )}
        {tandaSalah && (
          <div className="info-tanda">
            <span>
              Pernah salah {tandaSalah.jumlah}× · terakhir {tanggalPendek(tandaSalah.terakhir)}
            </span>
            <button className="tautan kecil" onClick={hapusTanda}>
              Hapus tanda
            </button>
          </div>
        )}
        <label className="label-catatan" htmlFor="catatan">
          {pilihan.kata ? 'Keterangan kata' : 'Keterangan ayat'}
        </label>
        <textarea
          id="catatan"
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          placeholder="Tulis catatan pribadi Anda di sini"
          rows={4}
        />
        <div className="aksi-lembar">
          <button className="tombol sekunder" onClick={tutup}>
            Tutup
          </button>
          <button className="tombol utama" onClick={simpan} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
