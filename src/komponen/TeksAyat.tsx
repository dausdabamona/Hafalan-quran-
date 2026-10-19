import { angkaArab, susunToken, type Ayat, type Kata } from '../data';

// Menampilkan teks ayat per kata. Kelas tambahan per kata ditentukan pemanggil
// (mis. ada keterangan, tanda salah lama, salah pada sesi ini).
export default function TeksAyat({
  ayat,
  kelasKata,
  ketukKata,
}: {
  ayat: Ayat;
  kelasKata?: (k: Kata) => string;
  ketukKata?: (k: Kata) => void;
}) {
  return (
    <div className="teks-ayat" lang="ar" dir="rtl">
      {susunToken(ayat).map((t, i) =>
        t.kata ? (
          <button
            key={i}
            className={'kata ' + (kelasKata?.(t.kata) ?? '')}
            onClick={() => ketukKata?.(t.kata!)}
            disabled={!ketukKata}
          >
            {t.teks}
          </button>
        ) : (
          <span key={i} className="tanda">
            {t.teks}
          </span>
        ),
      )}
      <span className="nomor-ayat">﴿{angkaArab(ayat.ayat)}﴾</span>
    </div>
  );
}
