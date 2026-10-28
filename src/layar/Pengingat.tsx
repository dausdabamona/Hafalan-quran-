import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Circle } from '@phosphor-icons/react';
import Kepala from '../komponen/Kepala';
import {
  APLIKASI_PEMICU,
  type AturPengingat,
  PAKET_BAWAAN,
  PAKET_CLAUDE,
  Pengingat,
  pengingatTersedia,
  sinkronAyatKartu,
} from '../pengingat';

interface Keadaan {
  overlay: boolean;
  penggunaan: boolean;
  aktif: boolean;
  jedaMenit: number;
  paket: Set<string>;
  batasMenit: number; // K-87: 0 = mati
  ulangMenit: number;
  kartuBuka: boolean;
}

function keAtur(k: Keadaan): AturPengingat {
  return {
    aktif: k.aktif,
    jedaMenit: k.jedaMenit,
    paket: [...k.paket].join(','),
    batasMenit: k.batasMenit,
    ulangMenit: k.ulangMenit,
    kartuBuka: k.kartuBuka,
  };
}

// K-87: pilihan menit cepat ditambah isian bebas 1–180 menit.
function PilihMenit({ nilai, pilihan, ubah }: { nilai: number; pilihan: number[]; ubah: (m: number) => void }) {
  const [isian, setIsian] = useState('');
  const lain = !pilihan.includes(nilai);
  const pakai = () => {
    const m = Math.round(Number(isian));
    if (m >= 1 && m <= 180) ubah(m);
    setIsian('');
  };
  return (
    <div className="kecepatan pilih-menit">
      {pilihan.map((m) => (
        <button key={m} className={'chip' + (nilai === m ? ' aktif' : '')} onClick={() => ubah(m)}>
          {m} menit
        </button>
      ))}
      <input
        className={'isi-menit' + (lain ? ' aktif' : '')}
        type="number"
        inputMode="numeric"
        min={1}
        max={180}
        placeholder={lain ? `${nilai} menit` : 'Lain…'}
        value={isian}
        onChange={(e) => setIsian(e.target.value)}
        onBlur={pakai}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Menit lainnya"
      />
    </div>
  );
}

// Pengaturan pengingat ayat (K-32).
export default function LayarPengingat() {
  const [k, setK] = useState<Keadaan | null>(null);
  const [pesan, setPesan] = useState('');

  const muat = useCallback(async () => {
    if (!pengingatTersedia()) return;
    const s = await Pengingat.cekIzin();
    // K-44: Claude ditambahkan sekali ke daftar yang sudah tersimpan; sesudahnya pilihan pengguna dihormati.
    try {
      if (s.paket && !s.paket.split(',').includes(PAKET_CLAUDE) && !localStorage.getItem('pemicuClaude')) {
        s.paket = `${s.paket},${PAKET_CLAUDE}`;
        await Pengingat.atur({
          aktif: s.aktif,
          jedaMenit: s.jedaMenit || 15,
          paket: s.paket,
          batasMenit: s.batasMenit ?? 10,
          ulangMenit: s.ulangMenit ?? 5,
          kartuBuka: s.kartuBuka ?? true,
        });
      }
      localStorage.setItem('pemicuClaude', '1');
    } catch {
      // abaikan
    }
    setK({
      overlay: s.overlay,
      penggunaan: s.penggunaan,
      aktif: s.aktif,
      jedaMenit: s.jedaMenit || 15,
      paket: new Set((s.paket || PAKET_BAWAAN).split(',').filter(Boolean)),
      batasMenit: s.batasMenit ?? 10,
      ulangMenit: s.ulangMenit ?? 5,
      kartuBuka: s.kartuBuka ?? true,
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
    await Pengingat.atur(keAtur(baru));
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

  const coba = async (teguran: boolean) => {
    try {
      await sinkronAyatKartu();
      await Pengingat.coba({ teguran });
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
          beserta maknanya. Bila Anda berlama-lama di aplikasi itu, kartu ayat datang lagi sebagai teguran dengan tombol{' '}
          <strong>Cukup, keluar</strong>. Ayat yang pernah salah lebih sering muncul. Kartu tertutup sendiri setelah 45
          detik.
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
      </section>

      <section className="kartu">
        <h2>3. Batas pemakaian</h2>
        <label className="saklar baris-aplikasi">
          <input
            type="checkbox"
            checked={k.batasMenit > 0}
            onChange={(e) => simpan({ ...k, batasMenit: e.target.checked ? 10 : 0 })}
          />
          <span>Tegur bila terlalu lama</span>
        </label>
        {k.batasMenit > 0 && (
          <>
            <p className="kosong">Teguran pertama sesudah</p>
            <PilihMenit
              nilai={k.batasMenit}
              pilihan={[5, 10, 15, 20, 30]}
              ubah={(m) => simpan({ ...k, batasMenit: m })}
            />
            <p className="kosong">Lalu diulang tiap</p>
            <PilihMenit
              nilai={k.ulangMenit}
              pilihan={[2, 3, 5, 10, 15]}
              ubah={(m) => simpan({ ...k, ulangMenit: m })}
            />
            <p className="kosong">
              Waktu di semua aplikasi pemicu dijumlahkan. Bila Anda keluar lalu kembali dalam 2 menit, hitungan
              berlanjut; lebih lama dari itu, hitungan mulai dari nol.
            </p>
          </>
        )}
      </section>

      <section className="kartu">
        <h2>4. Kartu saat aplikasi dibuka</h2>
        <label className="saklar baris-aplikasi">
          <input
            type="checkbox"
            checked={k.kartuBuka}
            onChange={(e) => simpan({ ...k, kartuBuka: e.target.checked })}
          />
          <span>Tampilkan ayat saat aplikasi pemicu dibuka</span>
        </label>
        {k.kartuBuka && (
          <>
            <p className="kosong">Jeda minimal antarkartu</p>
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
          </>
        )}
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
        <button className="tombol sekunder lebar" onClick={() => coba(false)} disabled={!k.overlay}>
          Coba tampilkan kartu
        </button>
        <button className="tombol sekunder lebar" onClick={() => coba(true)} disabled={!k.overlay}>
          Coba kartu teguran
        </button>
      </section>
    </>
  );
}
