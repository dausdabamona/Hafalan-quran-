import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Circle } from '@phosphor-icons/react';
import Kepala from '../komponen/Kepala';
import { APLIKASI_PEMICU, PAKET_BAWAAN, Pengingat, pengingatTersedia, sinkronAyatKartu } from '../pengingat';

interface Keadaan {
  overlay: boolean;
  penggunaan: boolean;
  aktif: boolean;
  jedaMenit: number;
  paket: Set<string>;
}

// Pengaturan pengingat ayat (K-32).
export default function LayarPengingat() {
  const [k, setK] = useState<Keadaan | null>(null);
  const [pesan, setPesan] = useState('');

  const muat = useCallback(async () => {
    if (!pengingatTersedia()) return;
    const s = await Pengingat.cekIzin();
    setK({
      overlay: s.overlay,
      penggunaan: s.penggunaan,
      aktif: s.aktif,
      jedaMenit: s.jedaMenit || 15,
      paket: new Set((s.paket || PAKET_BAWAAN).split(',').filter(Boolean)),
    });
  }, []);

  useEffect(() => {
    muat();
    // Sesudah kembali dari Setelan, status izin diperbarui.
    const lihat = () => document.visibilityState === 'visible' && muat();
    document.addEventListener('visibilitychange', lihat);
    return () => document.removeEventListener('visibilitychange', lihat);
  }, [muat]);

  if (!pengingatTersedia()) {
    return (
      <>
        <Kepala judul="Pengingat ayat" sub="Ayat hafalan di atas media sosial" />
        <p className="petunjuk">Fitur ini hanya berjalan di aplikasi Android Saku Hati.</p>
      </>
    );
  }
  if (!k) return <Kepala judul="Pengingat ayat" sub="Ayat hafalan di atas media sosial" />;

  const izinLengkap = k.overlay && k.penggunaan;

  const simpan = async (baru: Keadaan) => {
    setK(baru);
    await Pengingat.atur({ aktif: baru.aktif, jedaMenit: baru.jedaMenit, paket: [...baru.paket].join(',') });
  };

  const nyalakan = async (aktif: boolean) => {
    if (aktif) {
      const jumlah = await sinkronAyatKartu();
      setPesan(
        jumlah === 0
          ? 'Belum ada ayat yang tercatat hafal. Tandai hafalan lama atau selesaikan hafalan baru dulu.'
          : `${jumlah} ayat hafalan siap ditampilkan.`,
      );
    } else setPesan('');
    await simpan({ ...k, aktif });
  };

  const ubahAplikasi = async (paket: string[], centang: boolean) => {
    const baru = new Set(k.paket);
    for (const p of paket) {
      if (centang) baru.add(p);
      else baru.delete(p);
    }
    await simpan({ ...k, paket: baru });
  };

  const coba = async () => {
    try {
      await sinkronAyatKartu();
      await Pengingat.coba();
      setPesan('Kartu contoh ditampilkan. Tutup aplikasi ini untuk melihatnya di atas layar.');
    } catch {
      setPesan('Izin tampil di atas aplikasi lain belum diberikan.');
    }
  };

  return (
    <>
      <Kepala judul="Pengingat ayat" sub="Ayat hafalan di atas media sosial" />

      <section className="kartu">
        <p className="kosong">
          Saat Anda membuka aplikasi yang dipilih di bawah, satu ayat yang sudah Anda hafal tampil sebagai kartu kecil
          beserta maknanya. Ayat yang pernah salah lebih sering muncul. Kartu tertutup sendiri setelah 45 detik.
        </p>
      </section>

      <section className="kartu">
        <h2>1. Izin</h2>
        <div className="baris-izin">
          <span>
            {k.overlay ? <CheckCircle weight="duotone" /> : <Circle weight="duotone" />} Tampil di atas aplikasi lain
          </span>
          {!k.overlay && (
            <button className="tombol kecil sekunder" onClick={() => Pengingat.bukaSetelanOverlay()}>
              Buka setelan
            </button>
          )}
        </div>
        <div className="baris-izin">
          <span>{k.penggunaan ? <CheckCircle weight="duotone" /> : <Circle weight="duotone" />} Akses penggunaan</span>
          {!k.penggunaan && (
            <button className="tombol kecil sekunder" onClick={() => Pengingat.bukaSetelanPenggunaan()}>
              Buka setelan
            </button>
          )}
        </div>
        {!izinLengkap && (
          <p className="kosong">
            Di halaman setelan, cari <strong>Saku Hati</strong> lalu aktifkan. Akses penggunaan hanya dipakai untuk
            mengetahui aplikasi yang sedang dibuka; tidak ada data yang dikirim ke mana pun.
          </p>
        )}
        <p className="kosong">
          Di HP Oppo, buka juga <strong>Setelan → Baterai → Saku Hati</strong> dan izinkan berjalan di latar belakang
          agar pengingat tidak dihentikan sistem.
        </p>
      </section>

      <section className="kartu">
        <h2>2. Aplikasi pemicu</h2>
        {APLIKASI_PEMICU.map((a) => (
          <label key={a.nama} className="saklar baris-aplikasi">
            <input
              type="checkbox"
              checked={a.paket.some((p) => k.paket.has(p))}
              onChange={(e) => ubahAplikasi(a.paket, e.target.checked)}
            />
            <span>{a.nama}</span>
          </label>
        ))}
        <h2>3. Jeda minimal antarkartu</h2>
        <div className="kecepatan">
          {[15, 30, 60].map((m) => (
            <button
              key={m}
              className={'chip' + (k.jedaMenit === m ? ' aktif' : '')}
              onClick={() => simpan({ ...k, jedaMenit: m })}
            >
              {m === 60 ? '1 jam' : `${m} menit`}
            </button>
          ))}
        </div>
      </section>

      <section className="kartu">
        <label className="saklar sakelar-besar">
          <input
            type="checkbox"
            checked={k.aktif}
            disabled={!izinLengkap}
            onChange={(e) => nyalakan(e.target.checked)}
          />
          <span>Pengingat ayat {k.aktif ? 'aktif' : 'mati'}</span>
        </label>
        {pesan && <p className="pesan-tandai">{pesan}</p>}
        <button className="tombol sekunder lebar" onClick={coba} disabled={!k.overlay}>
          Coba tampilkan kartu
        </button>
      </section>
    </>
  );
}
