import { useEffect, useRef, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { cadanganTerakhir, imporCadangan, ringkasData, simpanCadangan, type RingkasCadangan } from '../cadangan';
import Kepala from '../komponen/Kepala';

const tanggal = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Layar Cadangan (F-05, K-67): simpan semua data ke satu berkas, dan pulihkan dari berkas itu.
export default function LayarCadangan() {
  const [ringkas, setRingkas] = useState<RingkasCadangan>();
  const [terakhir, setTerakhir] = useState(cadanganTerakhir);
  const [sibuk, setSibuk] = useState<'' | 'simpan' | 'impor'>('');
  const [pesan, setPesan] = useState<{ jenis: 'baik' | 'galat'; teks: string }>();
  const refBerkas = useRef<HTMLInputElement>(null);

  const muat = () => ringkasData().then(setRingkas);
  useEffect(() => {
    muat();
  }, []);

  const simpan = async () => {
    setSibuk('simpan');
    setPesan(undefined);
    try {
      if (await simpanCadangan()) {
        setTerakhir(cadanganTerakhir());
        setPesan({
          jenis: 'baik',
          teks: 'Cadangan tersimpan. Simpan juga salinannya di tempat lain, mis. Google Drive.',
        });
      } else setPesan({ jenis: 'galat', teks: 'Penyimpanan dibatalkan.' });
    } catch (e) {
      setPesan({ jenis: 'galat', teks: e instanceof Error ? e.message : 'Cadangan gagal disimpan.' });
    }
    setSibuk('');
  };

  const impor = async (berkas: File | undefined) => {
    if (!berkas) return;
    setSibuk('impor');
    setPesan(undefined);
    try {
      const h = await imporCadangan(await berkas.text());
      await muat();
      setPesan({
        jenis: 'baik',
        teks:
          `Cadangan${h.dibuat ? ` tanggal ${tanggal(h.dibuat)}` : ''} sudah dipulihkan: ` +
          (h.diterima > 0 ? `${h.diterima.toLocaleString('id-ID')} data masuk.` : 'semua datanya sudah ada di sini.'),
      });
    } catch (e) {
      setPesan({ jenis: 'galat', teks: e instanceof Error ? e.message : 'Cadangan gagal dipulihkan.' });
    }
    if (refBerkas.current) refBerkas.current.value = '';
    setSibuk('');
  };

  return (
    <>
      <Kepala judul="Cadangan" sub="Simpan dan pulihkan semua data" />
      <div className="isi-kemajuan isi-cadangan">
        <section className="kartu-kemajuan">
          <h2>Simpan cadangan</h2>
          <p className="keterangan-kecil">
            Satu berkas berisi hafalan, jadwal murojaah, tanda salah, makna suntingan, riwayat, rekaman suara, dan
            target. Data Saku Hati hanya ada di perangkat ini dan ikut terhapus bila aplikasi dihapus — simpan cadangan
            secara rutin.
          </p>
          {ringkas && (
            <p className="ringkas-cadangan">
              {ringkas.ayatHafal.toLocaleString('id-ID')} ayat hafal · {ringkas.rekaman.toLocaleString('id-ID')} rekaman
              · {ringkas.sesi.toLocaleString('id-ID')} sesi
            </p>
          )}
          <p className="keterangan-kecil">
            {terakhir ? `Cadangan terakhir: ${tanggal(terakhir)}` : 'Belum pernah membuat cadangan di perangkat ini.'}
          </p>
          <button className="tombol utama" onClick={simpan} disabled={!!sibuk}>
            <DownloadSimple size={20} weight="bold" /> {sibuk === 'simpan' ? 'Menyusun cadangan…' : 'Simpan cadangan'}
          </button>
        </section>

        <section className="kartu-kemajuan">
          <h2>Pulihkan dari cadangan</h2>
          <p className="keterangan-kecil">
            Pilih berkas <code>saku-hati-cadangan-….json</code>. Data digabung dengan yang sudah ada di sini — tidak ada
            yang terhapus, dan catatan yang lebih baru di sini tetap dipakai.
          </p>
          <button className="tombol" onClick={() => refBerkas.current?.click()} disabled={!!sibuk}>
            <UploadSimple size={20} weight="bold" /> {sibuk === 'impor' ? 'Memulihkan…' : 'Pilih berkas cadangan'}
          </button>
          <input
            ref={refBerkas}
            type="file"
            hidden
            onChange={(e) => impor(e.target.files?.[0])}
            aria-label="Berkas cadangan"
          />
        </section>

        {pesan && (
          <p className={pesan.jenis === 'galat' ? 'pesan-galat' : 'pesan-baik'} role="status">
            {pesan.teks}
          </p>
        )}
      </div>
    </>
  );
}
