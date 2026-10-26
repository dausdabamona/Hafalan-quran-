import { useEffect, useRef, useState } from 'react';
import { Trash, UploadSimple } from '@phosphor-icons/react';
import { hapusDataHadits, infoDataHadits, muatDataHadits, type InfoDataHadits } from '../hadits';
import Kepala from '../komponen/Kepala';

const tanggal = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Layar Data hadits (K-75): memuat hadits terkait ayat dari berkas pribadi, khusus perangkat ini.
export default function LayarDataHadits() {
  const [info, setInfo] = useState<InfoDataHadits | null | undefined>(undefined);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: 'baik' | 'galat'; teks: string }>();
  const refBerkas = useRef<HTMLInputElement>(null);

  useEffect(() => {
    infoDataHadits().then((i) => setInfo(i ?? null));
  }, []);

  const muat = async (berkas: File | undefined) => {
    if (!berkas) return;
    setSibuk(true);
    setPesan(undefined);
    try {
      const i = await muatDataHadits(berkas);
      setInfo(i);
      setPesan({
        jenis: 'baik',
        teks: `${i.jumlahHadits.toLocaleString('id-ID')} hadits untuk ${i.jumlahAyat.toLocaleString('id-ID')} ayat sudah dimuat. Buka surah mana pun, lalu ketuk "hadits" di bawah ayat.`,
      });
    } catch (e) {
      setPesan({ jenis: 'galat', teks: e instanceof Error ? e.message : 'Data hadits gagal dimuat.' });
    }
    if (refBerkas.current) refBerkas.current.value = '';
    setSibuk(false);
  };

  const hapus = async () => {
    if (!confirm('Hapus data hadits dari perangkat ini? Hafalan dan catatan Anda tidak ikut terhapus.')) return;
    await hapusDataHadits();
    setInfo(null);
    setPesan({ jenis: 'baik', teks: 'Data hadits dihapus dari perangkat ini.' });
  };

  return (
    <>
      <Kepala judul="Data hadits" sub="Hadits yang berkaitan dengan ayat" />
      <div className="isi-kemajuan isi-cadangan">
        <section className="kartu-kemajuan">
          <h2>{info ? 'Data hadits terpasang' : 'Belum ada data hadits'}</h2>
          {info ? (
            <>
              <p className="ringkas-cadangan">
                {info.jumlahHadits.toLocaleString('id-ID')} hadits · {info.jumlahAyat.toLocaleString('id-ID')} ayat ·{' '}
                {info.kitab.length} kitab
              </p>
              <p className="keterangan-kecil">{info.kitab.map((k) => k.nama).join(', ')}</p>
              <p className="keterangan-kecil">Dimuat {tanggal(info.dimuat)}.</p>
              {info.sumber && <p className="keterangan-kecil">Sumber: {info.sumber}</p>}
            </>
          ) : (
            <p className="keterangan-kecil">
              Saku Hati tidak membawa data hadits. Muat berkas <code>saku-hati-hadits.json.gz</code> yang Anda simpan
              sendiri. Data hanya tersimpan di perangkat ini, tidak ikut sinkron dan tidak ikut cadangan — muat sekali
              di HP dan sekali di laptop.
            </p>
          )}
          <button className="tombol utama" onClick={() => refBerkas.current?.click()} disabled={sibuk}>
            <UploadSimple size={20} weight="bold" />{' '}
            {sibuk ? 'Memuat…' : info ? 'Muat ulang dari berkas' : 'Muat berkas data'}
          </button>
          <input
            ref={refBerkas}
            type="file"
            hidden
            onChange={(e) => muat(e.target.files?.[0])}
            aria-label="Berkas data hadits"
          />
          {info && (
            <button className="tombol" onClick={hapus} disabled={sibuk}>
              <Trash size={20} weight="bold" /> Hapus data hadits
            </button>
          )}
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
