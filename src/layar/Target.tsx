import { useEffect, useState } from 'react';
import { daftarJuz, daftarSurah } from '../data';
import { ambilHafalan } from '../db';
import { ayatHafal, hariIni } from '../jadwal';
import Kepala from '../komponen/Kepala';
import { ambilTarget, ayatTarget, namaTarget, simpanTarget, type Target } from '../target';

// Membuat atau mengubah target hafalan (K-50): rentang (juz atau surah) + lama hari.
export default function LayarTarget() {
  const [jenis, setJenis] = useState<Target['jenis']>('juz');
  const [nomor, setNomor] = useState(30);
  const [hari, setHari] = useState(60);
  const [lama, setLama] = useState<Target | null>(null);
  const [hafal, setHafal] = useState<Set<string>>(new Set());

  useEffect(() => {
    ambilTarget().then((t) => {
      if (!t) return;
      setLama(t);
      setJenis(t.jenis);
      setNomor(t.nomor);
      setHari(t.hari);
    });
    ambilHafalan().then((h) => setHafal(ayatHafal(h)));
  }, []);

  const calon: Target = { jenis, nomor, hari, mulai: lama?.mulai ?? hariIni() };
  const ayat = ayatTarget(calon);
  const sisa = ayat.filter((k) => !hafal.has(k)).length;
  const perHari = Math.ceil(sisa / Math.max(1, hari));
  const hariValid = Number.isFinite(hari) && hari >= 7 && hari <= 730;

  const simpan = async (mulaiBaru: boolean) => {
    await simpanTarget({ ...calon, mulai: mulaiBaru || !lama ? hariIni() : lama.mulai });
    history.back();
  };

  return (
    <>
      <Kepala judul={lama ? 'Ubah target' : 'Buat target'} sub="Rentang hafalan dan lama waktunya" />
      <div className="isi-kemajuan">
        <section className="kartu-kemajuan form-target">
          <fieldset className="pilih-jenis">
            <legend>Rentang</legend>
            <label>
              <input
                type="radio"
                name="jenis"
                checked={jenis === 'juz'}
                onChange={() => (setJenis('juz'), setNomor(30))}
              />
              Juz
            </label>
            <label>
              <input
                type="radio"
                name="jenis"
                checked={jenis === 'surah'}
                onChange={() => (setJenis('surah'), setNomor(67))}
              />
              Surah
            </label>
          </fieldset>
          <label className="label-catatan" htmlFor="nomor-target">
            {jenis === 'juz' ? 'Juz' : 'Surah'}
          </label>
          <select id="nomor-target" className="isian" value={nomor} onChange={(e) => setNomor(Number(e.target.value))}>
            {jenis === 'juz'
              ? daftarJuz.map((j) => (
                  <option key={j.nomor} value={j.nomor}>
                    Juz {j.nomor}
                  </option>
                ))
              : daftarSurah.map((s) => (
                  <option key={s.nomor} value={s.nomor}>
                    {s.nomor}. {s.nama} ({s.jumlahAyat} ayat)
                  </option>
                ))}
          </select>
          <label className="label-catatan" htmlFor="hari-target">
            Selesai dalam (hari)
          </label>
          <input
            id="hari-target"
            className="isian"
            type="number"
            inputMode="numeric"
            min={7}
            max={730}
            value={Number.isFinite(hari) ? hari : ''}
            onChange={(e) => setHari(parseInt(e.target.value, 10))}
          />
          <p className="ringkas-target">
            {namaTarget(calon)}: {ayat.length.toLocaleString('id-ID')} ayat, {sisa.toLocaleString('id-ID')} belum hafal.
            {hariValid && sisa > 0 && (
              <>
                {' '}
                Perlu sekitar <strong>{perHari} ayat per hari</strong>.
              </>
            )}
          </p>
          {!hariValid && <p className="pesan-galat">Isi antara 7 dan 730 hari.</p>}
          <p className="keterangan-kecil">
            Selama target berjalan, hafalan baru diambil dari rentang ini lebih dulu. Target tersimpan di perangkat ini.
          </p>
          <button className="tombol utama lebar" disabled={!hariValid} onClick={() => simpan(false)}>
            Simpan target
          </button>
          {lama && (
            <>
              <button className="tombol sekunder lebar" disabled={!hariValid} onClick={() => simpan(true)}>
                Simpan dan mulai hitung dari hari ini
              </button>
              <button
                className="tautan"
                onClick={async () => {
                  await simpanTarget(null);
                  history.back();
                }}
              >
                Hapus target
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
