import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Stop } from '@phosphor-icons/react';
import { gulirKe } from '../komponen/gulir';
import { cariSurah, labelPotongan, type Kata, type Potongan } from '../data';
import { labelDaftarAyat, useAyatMurojaah } from '../komponen/useAyatMurojaah';
import {
  ambilRekamanSurah,
  ambilTandaSurah,
  BATAS_BENAR_OTOMATIS,
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
export default function LayarKoreksi({
  potongan,
  rukuk,
  sampai,
}: {
  potongan: Potongan;
  rukuk?: number;
  sampai?: number;
}) {
  const surah = cariSurah(potongan.surah)!;
  const daftarSemua = useAyatMurojaah(potongan, rukuk);
  // K-53: murojaah yang dihentikan hanya mengoreksi ayat sampai titik berhenti.
  const daftarMuat = useMemo(
    () => (daftarSemua && sampai ? daftarSemua.filter((a) => a.ayat <= sampai) : daftarSemua),
    [daftarSemua, sampai],
  );
  const daftarAyat = daftarMuat ?? [];
  const [rekaman, setRekaman] = useState<Map<string, Rekaman>>(new Map());
  const [tanda, setTanda] = useState<TandaSurah>({ salah: new Map(), tertukar: new Map() });
  const [salahSesi, setSalahSesi] = useState<Set<string>>(new Set()); // "ayat:urutan"
  const [sudahBenar, setSudahBenar] = useState<Set<string>>(new Set()); // tanda lama yang kini benar (K-57)
  const [tertukarSesi, setTertukarSesi] = useState<Map<number, number>>(new Map()); // ayatAsal → ayatKeliru
  const [hasil, setHasil] = useState<(Sesi & { tandaDihapus?: number }) | null>(null);
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
      ...(daftarAyat.length !== potongan.ayatAkhir - potongan.ayatAwal + 1
        ? { ayat: daftarAyat.map((a) => a.ayat) }
        : {}),
      ...(sampai ? { sebagian: true } : {}),
      sudahBenar: [...sudahBenar]
        .filter((k) => !salahSesi.has(k))
        .map((k) => {
          const [ayat, urutan] = k.split(':').map(Number);
          return { ayat, urutan };
        }),
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
        <Kepala
          judul={`Koreksi · ${surah.nama}`}
          sub={`${rukuk ? 'Murojaah rukuk' : 'Potongan'} ${rukuk && daftarAyat.length ? labelDaftarAyat(daftarAyat) : labelPotongan(potongan)}`}
        />
        <div className="hasil-koreksi">
          {!!hasil.tandaDihapus && (
            <p className="pesan-tanda-dihapus">
              {hasil.tandaDihapus} tanda kata yang sudah benar dihapus. Alhamdulillah.
            </p>
          )}
          {hasil.lancar ? (
            <>
              <p className="hasil-besar">Lancar, alhamdulillah</p>
              <p>
                Tidak ada kesalahan baru pada sesi ini.
                {rukuk && sampai
                  ? ' Murojaah baru sampai ayat ' +
                    sampai +
                    ', jadi rukuk ini tetap di daftar Ulang hafalan sampai dibaca utuh.'
                  : ''}
              </p>
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
      <Kepala
        judul={`Koreksi · ${surah.nama}`}
        sub={`${rukuk ? 'Murojaah rukuk' : 'Potongan'} ${rukuk && daftarAyat.length ? labelDaftarAyat(daftarAyat) : labelPotongan(potongan)}`}
      />
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
                <TandaLamaAyat
                  kata={a.kata.filter((k) => tanda.salah.has(kunciKata(surah.nomor, a.ayat, k.urutan)))}
                  jumlah={(k) => tanda.salah.get(kunciKata(surah.nomor, a.ayat, k.urutan))?.benarBeruntun ?? 0}
                  salahLagi={(k) => salahSesi.has(`${a.ayat}:${k.urutan}`)}
                  benar={(k) => sudahBenar.has(`${a.ayat}:${k.urutan}`)}
                  ubah={(k) =>
                    setSudahBenar((lama) => {
                      const baru = new Set(lama);
                      const kunci = `${a.ayat}:${k.urutan}`;
                      if (baru.has(kunci)) baru.delete(kunci);
                      else baru.add(kunci);
                      return baru;
                    })
                  }
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
        {main ? (
          <>
            <Stop weight="duotone" /> Berhenti
          </>
        ) : (
          <>
            <Play weight="duotone" /> Putar semua
          </>
        )}
      </button>
    </>
  );
}

// K-57: tanda kata lama di bawah ayat — ketuk "Sekarang sudah benar" untuk menghapusnya
// saat koreksi disimpan. Tanpa itu, tanda terhapus sendiri setelah 3 koreksi benar berturut-turut.
function TandaLamaAyat({
  kata,
  jumlah,
  salahLagi,
  benar,
  ubah,
}: {
  kata: Kata[];
  jumlah: (k: Kata) => number;
  salahLagi: (k: Kata) => boolean;
  benar: (k: Kata) => boolean;
  ubah: (k: Kata) => void;
}) {
  if (kata.length === 0) return null;
  return (
    <div className="tanda-lama-ayat">
      <span className="judul-tanda-lama">Pernah salah — sudah benar kali ini?</span>
      <div className="daftar-tanda-lama">
        {kata.map((k) => (
          <button
            key={k.urutan}
            type="button"
            className={'chip-tanda-lama' + (benar(k) && !salahLagi(k) ? ' benar' : '')}
            onClick={() => ubah(k)}
            disabled={salahLagi(k)}
            aria-pressed={benar(k)}
          >
            <span className="arab" lang="ar" dir="rtl">
              {k.teks}
            </span>
            <span className="ket">
              {salahLagi(k)
                ? 'salah lagi'
                : benar(k)
                  ? '✓ sudah benar'
                  : `Sekarang sudah benar · ${jumlah(k)}/${BATAS_BENAR_OTOMATIS}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
