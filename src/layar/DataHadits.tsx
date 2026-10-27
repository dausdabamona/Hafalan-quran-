import { useEffect, useRef, useState } from 'react';
import { Trash, UploadSimple } from '@phosphor-icons/react';
import { hapusDataHadits, infoDataHadits, muatDataHadits, type InfoDataHadits, type Kemajuan } from '../hadits';
import Kepala from '../komponen/Kepala';
import { kabariEjaanBerubah } from '../komponen/useEjaan';
import { USULAN_EJAAN, daftarEjaan, hapusEjaan, simpanEjaan, type AturanEjaan } from '../hadits';

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
  const [kemajuan, setKemajuan] = useState<Kemajuan>();
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
      const i = await muatDataHadits(berkas, undefined, setKemajuan);
      setInfo(i);
      setPesan({
        jenis: 'baik',
        teks:
          i.jenis === 'lengkap'
            ? `${i.jumlahHadits.toLocaleString('id-ID')} hadits dari ${i.kitab.length} kitab sudah dimuat. Buka Lainnya → Hadits, atau ketuk "hadits" di bawah ayat.`
            : `${i.jumlahHadits.toLocaleString('id-ID')} hadits untuk ${i.jumlahAyat.toLocaleString('id-ID')} ayat sudah dimuat. Buka surah mana pun, lalu ketuk "hadits" di bawah ayat.`,
      });
    } catch (e) {
      setPesan({ jenis: 'galat', teks: e instanceof Error ? e.message : 'Data hadits gagal dimuat.' });
    }
    if (refBerkas.current) refBerkas.current.value = '';
    setKemajuan(undefined);
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
          <h2>
            {info
              ? info.jenis === 'lengkap'
                ? 'Hadits lengkap terpasang'
                : 'Hadits terkait ayat terpasang'
              : 'Belum ada data hadits'}
          </h2>
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
              Saku Hati tidak membawa data hadits. Muat berkas <code>saku-hati-hadits-lengkap.jsonl.gz</code> (9 kitab)
              atau <code>saku-hati-hadits.json.gz</code> (hanya yang terkait ayat) yang Anda simpan sendiri. Data hanya
              tersimpan di perangkat ini, tidak ikut sinkron dan tidak ikut cadangan — muat sekali di HP dan sekali di
              laptop.
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
          {sibuk && kemajuan && (
            <div
              className="kemajuan-muat"
              role="progressbar"
              aria-valuenow={kemajuan.hadits}
              aria-valuemax={kemajuan.dari}
            >
              <p className="keterangan-kecil">
                {kemajuan.tahap}: {kemajuan.hadits.toLocaleString('id-ID')}
                {kemajuan.dari ? ` dari ${kemajuan.dari.toLocaleString('id-ID')}` : ''}
              </p>
              <p className="keterangan-kecil">
                Biarkan layar ini tetap terbuka sampai selesai (di HP bisa beberapa menit).
              </p>
              {kemajuan.dari > 0 && (
                <div className="batang-muat">
                  <span style={{ width: `${Math.min(100, (kemajuan.hadits / kemajuan.dari) * 100)}%` }} />
                </div>
              )}
            </div>
          )}
          {info && (
            <button className="tombol" onClick={hapus} disabled={sibuk}>
              <Trash size={20} weight="bold" /> Hapus data hadits
            </button>
          )}
        </section>
        <EjaanPilihan />
        {pesan && (
          <p className={pesan.jenis === 'galat' ? 'pesan-galat' : 'pesan-baik'} role="status">
            {pesan.teks}
          </p>
        )}
      </div>
    </>
  );
}

// K-80 C: ejaan pilihan saat menampilkan terjemah hadits (data asli tidak diubah).
function EjaanPilihan() {
  const [aturan, setAturan] = useState<AturanEjaan[]>([]);
  const [dari, setDari] = useState('');
  const [ke, setKe] = useState('');
  const muat = async () => {
    setAturan(await daftarEjaan());
    kabariEjaanBerubah();
  };
  useEffect(() => {
    daftarEjaan().then(setAturan);
  }, []);
  const ada = new Set(aturan.map((a) => a.dari.toLowerCase()));
  const usulan = USULAN_EJAAN.filter((u) => !ada.has(u.dari.toLowerCase()));
  const tambah = async (a: string, b: string) => {
    await simpanEjaan(a, b);
    setDari('');
    setKe('');
    await muat();
  };
  return (
    <section className="kartu-kemajuan">
      <h2>Ejaan pilihan</h2>
      <p className="keterangan-kecil">
        Kata di terjemah hadits ditampilkan dengan ejaan Anda, mis. Ramadlan → Ramadhan. Data asli dan suntingan Anda
        tidak diubah. Ikut sinkron ke perangkat lain.
      </p>
      {aturan.length > 0 && (
        <ul className="daftar-ejaan">
          {aturan.map((a) => (
            <li key={a.dari}>
              <span>
                {a.dari} → <strong>{a.ke}</strong>
              </span>
              <button
                type="button"
                className="tombol-ikon kecil"
                aria-label={`Hapus ejaan ${a.dari}`}
                onClick={async () => {
                  await hapusEjaan(a.dari);
                  await muat();
                }}
              >
                <Trash size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="tambah-ejaan"
        onSubmit={(e) => {
          e.preventDefault();
          tambah(dari, ke);
        }}
      >
        <input
          value={dari}
          onChange={(e) => setDari(e.target.value)}
          placeholder="Kata di data"
          aria-label="Kata di data"
        />
        <span aria-hidden="true">→</span>
        <input value={ke} onChange={(e) => setKe(e.target.value)} placeholder="Ejaan saya" aria-label="Ejaan saya" />
        <button className="tombol" type="submit" disabled={!dari.trim() || !ke.trim()}>
          Tambah
        </button>
      </form>
      {usulan.length > 0 && (
        <>
          <p className="keterangan-kecil">Usulan (ketuk untuk menambah):</p>
          <div className="chip-kait">
            {usulan.map((u) => (
              <button key={u.dari} type="button" className="chip" onClick={() => tambah(u.dari, u.ke)}>
                {u.dari} → {u.ke}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
