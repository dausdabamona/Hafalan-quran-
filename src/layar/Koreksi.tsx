import { useEffect, useMemo, useRef, useState } from 'react';
import { gulirKe } from '../komponen/gulir';
import { cariSurah, labelPotongan, type Potongan } from '../data';
import { labelDaftarAyat, useAyatMurojaah } from '../komponen/useAyatMurojaah';
import {
  ambilRekamanSurah,
  ambilTandaSurah,
  kunciAyat,
  kunciKata,
  simpanKoreksi,
  type Rekaman,
  type Sesi,
  type TandaSurah,
} from '../db';
import { ganti, hashPotongan } from '../navigasi';
import Kepala from '../komponen/Kepala';
import TeksAyat from '../komponen/TeksAyat';
import TombolPutar from '../komponen/TombolPutar';

// Koreksi mandiri (F-03, F-06): dengarkan rekaman sambil melihat ayat, ketuk
// kata yang salah, tandai sambungan yang tertukar, lalu simpan sebagai satu sesi.
export default function LayarKoreksi({ potongan, rukuk }: { potongan: Potongan; rukuk?: number }) {
  const surah = cariSurah(potongan.surah)!;
  const daftarMuat = useAyatMurojaah(potongan, rukuk);
  const daftarAyat = daftarMuat ?? [];
  const [rekaman, setRekaman] = useState<Map<string, Rekaman>>(new Map());
  const [tanda, setTanda] = useState<TandaSurah>({ salah: new Map(), tertukar: new Map() });
  const [salahSesi, setSalahSesi] = useState<Set<string>>(new Set()); // "ayat:urutan"
  const [tertukarSesi, setTertukarSesi] = useState<Map<number, number>>(new Map()); // ayatAsal → ayatKeliru
  const [hasil, setHasil] = useState<Sesi | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [diputar, setDiputar] = useState<number | null>(null); // nomor ayat yang sedang diputar

  useEffect(() => {
    ambilRekamanSurah(surah.nomor).then(setRekaman);
    ambilTandaSurah(surah.nomor).then(setTanda);
  }, [surah.nomor]);

  const ketukKata = (ayat: number, urutan: number) => {
    const k = `${ayat}:${urutan}`;
    setSalahSesi((lama) => {
      const baru = new Set(lama);
      if (baru.has(k)) baru.delete(k);
      else baru.add(k);
      return baru;
    });
  };

  const aturTertukar = (ayatAsal: number, ayatKeliru: number | null) => {
    setTertukarSesi((lama) => {
      const baru = new Map(lama);
      if (ayatKeliru === null) baru.delete(ayatAsal);
      else baru.set(ayatAsal, ayatKeliru);
      return baru;
    });
  };

  const audioSemua = useMemo(
    () => daftarAyat.map((a) => rekaman.get(kunciAyat(surah.nomor, a.ayat))?.audio),
    // daftarAyat ditentukan oleh potongan dan ayat hafal yang dimuat
    [rekaman, daftarMuat],
  );

  const simpan = async () => {
    setMenyimpan(true);
    const isi = {
      surah: surah.nomor,
      ayatAwal: potongan.ayatAwal,
      ayatAkhir: potongan.ayatAkhir,
      kataSalah: [...salahSesi].map((k) => {
        const [ayat, urutan] = k.split(':').map(Number);
        return { ayat, urutan };
      }),
      tertukar: [...tertukarSesi].map(([ayatAsal, ayatKeliru]) => ({ ayatAsal, ayatKeliru })),
      // Ayat tidak berurutan (hafalan lama per ayat): catat ayat yang benar-benar dikoreksi.
      ...(daftarAyat.length !== potongan.ayatAkhir - potongan.ayatAwal + 1 ? { ayat: daftarAyat.map((a) => a.ayat) } : {}),
    };
    // Murojaah rukuk memperbarui jadwal rukuk, bukan jadwal potongan (K-23).
    const sesi = await simpanKoreksi({ ...isi, rukuk });
    setMenyimpan(false);
    setHasil(sesi);
    window.scrollTo(0, 0);
  };

  if (hasil) {
    return (
      <>
        <Kepala judul={`Koreksi · ${surah.nama}`} sub={`${rukuk ? 'Murojaah rukuk' : 'Potongan'} ${rukuk && daftarAyat.length ? labelDaftarAyat(daftarAyat) : labelPotongan(potongan)}`} />
        <div className="hasil-koreksi">
          {hasil.lancar ? (
            <>
              <p className="hasil-besar">Lancar, alhamdulillah</p>
              <p>Tidak ada kesalahan baru pada sesi ini.</p>
            </>
          ) : (
            <>
              <p className="hasil-besar">Koreksi tersimpan</p>
              <p>
                {hasil.kataSalah} kata dan {hasil.sambunganTertukar} sambungan ditandai. Tandanya akan tetap tersorot
                sebagai pengingat di sesi berikutnya
                {rukuk ? ', dan rukuk ini diulang lagi besok.' : '.'}
              </p>
            </>
          )}
          <div className="aksi-lembar">
            <button className="tombol sekunder" onClick={() => ganti(hashPotongan('rekam', potongan, rukuk))}>
              Rekam ulang
            </button>
            <button className="tombol utama" onClick={() => history.back()}>
              Kembali
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!daftarMuat) return null;

  return (
    <>
      <Kepala judul={`Koreksi · ${surah.nama}`} sub={`${rukuk ? 'Murojaah rukuk' : 'Potongan'} ${rukuk && daftarAyat.length ? labelDaftarAyat(daftarAyat) : labelPotongan(potongan)}`} />
      <p className="petunjuk">
        Putar rekaman sambil melihat ayat. Ketuk kata yang salah; ketuk lagi untuk membatalkan. Bila urutan ayat
        tertukar, tandai pada sambungannya.
      </p>

      <ol className="daftar-ayat koreksi">
        {daftarAyat.map((a, i) => {
          const rek = rekaman.get(kunciAyat(surah.nomor, a.ayat));
          const berikut = daftarAyat[i + 1];
          return (
            <li key={a.ayat} id={`koreksi-${a.ayat}`}>
              <div className={'ayat' + (diputar === a.ayat ? ' diputar' : '')}>
                <div className="kepala-ayat">
                  <span>Ayat {a.ayat}</span>
                  {rek ? <TombolPutar audio={rek.audio} /> : <span className="redup">Belum ada rekaman</span>}
                </div>
                <TeksAyat
                  ayat={a}
                  ketukKata={(k) => ketukKata(a.ayat, k.urutan)}
                  kelasKata={(k) => {
                    const kelas: string[] = [];
                    if (tanda.salah.has(kunciKata(surah.nomor, a.ayat, k.urutan))) kelas.push('tanda-lama');
                    if (salahSesi.has(`${a.ayat}:${k.urutan}`)) kelas.push('salah-sesi');
                    return kelas.join(' ');
                  }}
                />
              </div>
              {berikut && berikut.ayat === a.ayat + 1 && (
                <Sambungan
                  ayatAsal={a.ayat}
                  jumlahAyatSurah={surah.jumlahAyat}
                  pernah={tanda.tertukar.get(kunciAyat(surah.nomor, a.ayat))?.jumlah ?? 0}
                  keliru={tertukarSesi.get(a.ayat) ?? null}
                  atur={(n) => aturTertukar(a.ayat, n)}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="bilah-aksi">
        <PutarSemua
          daftar={audioSemua}
          ayat={daftarAyat.map((a) => a.ayat)}
          saatPutar={(n) => {
            setDiputar(n);
            if (n !== null) gulirKe(document.getElementById(`koreksi-${n}`));
          }}
        />
        <button className="tombol utama besar" onClick={simpan} disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : 'Simpan koreksi'}
        </button>
      </div>
    </>
  );
}

// Penanda sambungan antar-ayat (K-15): lancar, atau tertukar dengan ayat tertentu.
function Sambungan({
  ayatAsal,
  jumlahAyatSurah,
  pernah,
  keliru,
  atur,
}: {
  ayatAsal: number;
  jumlahAyatSurah: number;
  pernah: number;
  keliru: number | null;
  atur: (n: number | null) => void;
}) {
  const seharusnya = ayatAsal + 1;
  const pilihan = Array.from({ length: jumlahAyatSurah }, (_, i) => i + 1).filter(
    (n) => n !== seharusnya && n !== ayatAsal,
  );
  return (
    <div className={'sambungan' + (keliru !== null ? ' tertukar' : '')}>
      <span className="label-sambungan">
        Sambungan {ayatAsal} → {seharusnya}
        {pernah > 0 && <span className="redup"> · pernah tertukar {pernah}×</span>}
      </span>
      {keliru === null ? (
        <button className="tautan kecil" onClick={() => atur(pilihan[0] ?? null)}>
          Tandai tertukar
        </button>
      ) : (
        <span className="pilih-keliru">
          terbaca ayat
          <select value={keliru} onChange={(e) => atur(Number(e.target.value))}>
            {pilihan.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button className="tautan kecil" onClick={() => atur(null)}>
            Batal
          </button>
        </span>
      )}
    </div>
  );
}

// Memutar rekaman semua ayat potongan secara berurutan (F-02).
function PutarSemua({
  daftar,
  ayat,
  saatPutar,
}: {
  daftar: (Blob | undefined)[];
  ayat: number[];
  saatPutar: (ayat: number | null) => void;
}) {
  const el = useRef<HTMLAudioElement>(null);
  const urutan = useRef<string[]>([]);
  const nomor = useRef<number[]>([]); // nomor ayat untuk tiap rekaman di urutan
  const [main, setMain] = useState(false);

  useEffect(() => {
    urutan.current = daftar.filter((b): b is Blob => !!b).map((b) => URL.createObjectURL(b));
    nomor.current = ayat.filter((_, i) => !!daftar[i]);
    return () => urutan.current.forEach((u) => URL.revokeObjectURL(u));
  }, [daftar]); // eslint-disable-line react-hooks/exhaustive-deps

  const putarDari = (i: number) => {
    const a = el.current;
    if (!a || i >= urutan.current.length) {
      setMain(false);
      saatPutar(null);
      return;
    }
    saatPutar(nomor.current[i]);
    a.src = urutan.current[i];
    a.onended = () => putarDari(i + 1);
    a.play().catch(() => setMain(false));
  };

  const tekan = () => {
    if (main) {
      el.current?.pause();
      setMain(false);
      saatPutar(null);
    } else {
      setMain(true);
      putarDari(0);
    }
  };

  if (daftar.filter(Boolean).length < 2) return null;
  return (
    <>
      <audio ref={el} />
      <button className="tombol sekunder" onClick={tekan}>
        {main ? '■ Berhenti' : '▶ Putar semua'}
      </button>
    </>
  );
}
