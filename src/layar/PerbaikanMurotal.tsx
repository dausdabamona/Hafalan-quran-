import { useEffect, useState } from 'react';
import { cariAyat, cariSurah } from '../data';
import { ambilJadwal, ambilRekamanSurah, kunciAyat, simpanKoreksi, simpanRekaman, type Rekaman } from '../db';
import { tujuanPerbaikan } from '../murotal';
import { usePerekam } from '../perekam';
import TeksAyat from '../komponen/TeksAyat';
import TombolPutar from '../komponen/TombolPutar';

// K-31: koreksi dan rekam ulang satu ayat langsung dari murotal.
// Kesalahan dihitung seperti murojaah: rukuknya kembali diulang besok (P-03).

type Tahap = 'tandai' | 'rekam' | 'koreksi-baru' | 'bersih' | 'masih-salah';

export default function PerbaikanMurotal({
  surah,
  ayat,
  tutup,
}: {
  surah: number;
  ayat: number;
  tutup: (lanjut: boolean) => void;
}) {
  const a = cariAyat(surah, ayat)!;
  const nama = cariSurah(surah)?.nama ?? String(surah);
  const [tahap, setTahap] = useState<Tahap>('tandai');
  const [rekaman, setRekaman] = useState<Rekaman | undefined>();
  const [salah, setSalah] = useState<Set<number>>(new Set());
  const [tertukar, setTertukar] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [tampilTeks, setTampilTeks] = useState(false);
  const { status, mulai, selesai, lepas } = usePerekam();
  const merekam = status === 'merekam';

  const muatRekaman = () =>
    ambilRekamanSurah(surah).then((m) => setRekaman(m.get(kunciAyat(surah, ayat))));

  useEffect(() => {
    muatRekaman();
    return () => lepas();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ketuk = (urutan: number) =>
    setSalah((lama) => {
      const baru = new Set(lama);
      if (baru.has(urutan)) baru.delete(urutan);
      else baru.add(urutan);
      return baru;
    });

  const simpan = async (): Promise<boolean> => {
    setMenyimpan(true);
    const t = tujuanPerbaikan(surah, ayat, await ambilJadwal());
    await simpanKoreksi({
      surah,
      ayatAwal: t.potongan.ayatAwal,
      ayatAkhir: t.potongan.ayatAkhir,
      ayat: [ayat],
      rukuk: t.rukuk,
      kataSalah: [...salah].map((urutan) => ({ ayat, urutan })),
      tertukar: tertukar && ayat > 1 ? [{ ayatAsal: ayat - 1, ayatKeliru: 0 }] : [],
    });
    setMenyimpan(false);
    const bersih = salah.size === 0 && !tertukar;
    setSalah(new Set());
    setTertukar(false);
    return bersih;
  };

  const rekamUlang = async () => {
    setTahap('rekam');
    await mulai();
  };

  const selesaiRekam = async () => {
    setMenyimpan(true);
    const hasil = await selesai();
    lepas();
    if (hasil) await simpanRekaman(surah, ayat, hasil.audio, hasil.durasiMs);
    await muatRekaman();
    setMenyimpan(false);
    setTahap('koreksi-baru');
  };

  const teksDitandai = (
    <TeksAyat
      ayat={a}
      ketukKata={(k) => ketuk(k.urutan)}
      kelasKata={(k) => (salah.has(k.urutan) ? 'salah-sesi' : '')}
    />
  );

  return (
    <div className="latar-lembar">
      <div className="lembar lembar-perbaikan" role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">
          Perbaiki · {nama} · ayat {ayat}
        </p>

        {tahap === 'tandai' && (
          <>
            <p className="kosong">Ketuk kata yang salah dibaca. Murotal berhenti sementara.</p>
            {rekaman && <TombolPutar audio={rekaman.audio} label="Dengar rekaman" />}
            {teksDitandai}
            {ayat > 1 && (
              <label className="saklar">
                <input type="checkbox" checked={tertukar} onChange={(e) => setTertukar(e.target.checked)} />
                <span>Yang terbaca justru ayat lain (urutan tertukar)</span>
              </label>
            )}
            <div className="aksi-lembar">
              <button className="tombol sekunder" onClick={() => tutup(false)}>
                Batal
              </button>
              <button
                className="tombol utama"
                disabled={menyimpan || (salah.size === 0 && !tertukar)}
                onClick={async () => {
                  await simpan();
                  await rekamUlang();
                }}
              >
                Simpan & rekam ulang
              </button>
            </div>
          </>
        )}

        {tahap === 'rekam' && (
          <>
            <label className="saklar">
              <input type="checkbox" checked={tampilTeks} onChange={(e) => setTampilTeks(e.target.checked)} />
              <span>Tampilkan teks</span>
            </label>
            {tampilTeks ? <TeksAyat ayat={a} /> : <div className="teks-tertutup">Teks tertutup — bacalah dari hafalan</div>}
            {status === 'ditolak' && <p className="pesan-galat">Izin mikrofon belum diberikan.</p>}
            <div className="aksi-lembar">
              {merekam ? (
                <button className="tombol utama besar" onClick={selesaiRekam} disabled={menyimpan}>
                  {menyimpan ? 'Menyimpan…' : '● Selesai rekam'}
                </button>
              ) : (
                <button className="tombol utama besar" onClick={() => mulai()} disabled={status === 'meminta-izin'}>
                  🎙 Mulai rekam ayat {ayat}
                </button>
              )}
            </div>
          </>
        )}

        {tahap === 'koreksi-baru' && (
          <>
            <p className="kosong">Dengarkan rekaman baru. Ketuk kata yang masih salah; bila semua benar, langsung simpan.</p>
            {rekaman && <TombolPutar audio={rekaman.audio} label="Dengar rekaman baru" />}
            {teksDitandai}
            {ayat > 1 && (
              <label className="saklar">
                <input type="checkbox" checked={tertukar} onChange={(e) => setTertukar(e.target.checked)} />
                <span>Yang terbaca justru ayat lain (urutan tertukar)</span>
              </label>
            )}
            <div className="aksi-lembar">
              <button
                className="tombol utama"
                disabled={menyimpan}
                onClick={async () => setTahap((await simpan()) ? 'bersih' : 'masih-salah')}
              >
                {salah.size === 0 && !tertukar ? '✓ Benar semua, simpan' : 'Simpan koreksi'}
              </button>
            </div>
          </>
        )}

        {tahap === 'bersih' && (
          <>
            <p className="hasil-besar">Alhamdulillah, sudah benar</p>
            <p className="kosong">Rekaman baru ayat {ayat} masuk murotal. Rukuknya diulang lagi besok.</p>
            <div className="aksi-lembar">
              <button className="tombol utama" onClick={() => tutup(true)}>
                ▶ Lanjutkan murotal
              </button>
            </div>
          </>
        )}

        {tahap === 'masih-salah' && (
          <>
            <p className="hasil-besar">Masih ada yang salah</p>
            <p className="kosong">Rekam ulang sekarang, atau perbaiki nanti lewat daftar Belum masuk murotal.</p>
            <div className="aksi-lembar">
              <button className="tombol sekunder" onClick={() => tutup(true)}>
                Nanti saja
              </button>
              <button className="tombol utama" onClick={rekamUlang}>
                🎙 Rekam ulang
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
