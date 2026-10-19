import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, Camera } from '@phosphor-icons/react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { db } from '../db';
import Kepala from '../komponen/Kepala';
import { bacaMeta } from '../sinkron/mesin';
import {
  buatKodePasang,
  daftarAnggota,
  lepasAnggota,
  type Anggota,
  type HasilSinkron,
  type Pusat,
} from '../sinkron/protokol';
import {
  amatiPusat,
  amatiSinkron,
  bacaQr,
  lepasPusat,
  matikanPusat,
  nyalakanPusat,
  pasangKePusat,
  peranSinkron,
  pusatDiingat,
  pusatTersimpan,
  sinkronSekarang,
  teksQr,
} from '../sinkron/peran';

function waktuPendek(iso?: string): string {
  if (!iso) return 'belum pernah';
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Sinkron HP ↔ Windows lewat Wi-Fi yang sama (K-37).
export default function LayarSinkron() {
  const peran = peranSinkron();
  return (
    <>
      <Kepala judul="Sinkron" sub="HP ↔ Laptop di Wi-Fi yang sama" />
      {peran === 'pusat' && <SisiPusat />}
      {peran === 'anggota' && <SisiAnggota />}
      {!peran && <p className="petunjuk">Sinkron tersedia di aplikasi Saku Hati untuk HP Android dan Windows.</p>}
    </>
  );
}

// ---------- HP: pusat sinkron, menampilkan kode QR ----------

function SisiPusat() {
  const [aktif, setAktif] = useState(pusatDiingat);
  const [alamat, setAlamat] = useState<{ alamat: string; port: number } | null>(null);
  const [kode, setKode] = useState('');
  const [qr, setQr] = useState('');
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [galat, setGalat] = useState('');

  const muatAnggota = useCallback(() => daftarAnggota(db).then(setAnggota), []);

  const kodeBaru = useCallback(async (a: { alamat: string; port: number }) => {
    const k = buatKodePasang(10);
    setKode(k.kode);
    setQr(a.alamat ? await QRCode.toDataURL(teksQr(a.alamat, a.port, k.kode), { margin: 1, width: 280 }) : '');
  }, []);

  useEffect(() => {
    muatAnggota();
    return amatiPusat(muatAnggota);
  }, [muatAnggota]);

  useEffect(() => {
    if (!aktif) return;
    nyalakanPusat()
      .then(async (a) => {
        setAlamat(a);
        setGalat('');
        await kodeBaru(a);
      })
      .catch((e) => setGalat((e as Error).message));
  }, [aktif, kodeBaru]);

  const ubahAktif = async (v: boolean) => {
    setAktif(v);
    if (!v) {
      await matikanPusat();
      setAlamat(null);
    }
  };

  return (
    <>
      <section className="kartu">
        <label className="saklar sakelar-besar">
          <input type="checkbox" checked={aktif} onChange={(e) => ubahAktif(e.target.checked)} />
          <span>HP ini sebagai pusat sinkron {aktif ? 'aktif' : 'mati'}</span>
        </label>
        <p className="kosong">
          Laptop menyambung ke HP ini lewat Wi-Fi yang sama, tanpa internet. Biarkan Saku Hati terbuka di HP selama
          sinkron berlangsung.
        </p>
        {galat && <p className="pesan-galat">{galat}</p>}
      </section>

      {aktif && alamat && (
        <section className="kartu kartu-qr">
          <h2>Pasangkan laptop</h2>
          {alamat.alamat ? (
            <>
              <p className="kosong">Di Saku Hati Windows, buka Sinkron lalu pindai kode ini dengan kamera laptop.</p>
              {qr && <img className="gambar-qr" src={qr} alt="Kode QR pemasangan" />}
              <p className="kosong">Tanpa kamera? Ketik di laptop:</p>
              <p className="data-pasang">
                Alamat{' '}
                <strong>
                  {alamat.alamat}:{alamat.port}
                </strong>
                <br />
                Kode <strong>{kode}</strong>
              </p>
              <p className="kosong">Kode berlaku 10 menit.</p>
              <button className="tombol sekunder lebar" onClick={() => kodeBaru(alamat)}>
                Buat kode baru
              </button>
            </>
          ) : (
            <p className="pesan-galat">HP belum tersambung ke Wi-Fi. Sambungkan ke Wi-Fi yang sama dengan laptop.</p>
          )}
        </section>
      )}

      <section className="kartu">
        <h2>Laptop yang dipasangkan</h2>
        {anggota.length === 0 ? (
          <p className="kosong">Belum ada.</p>
        ) : (
          <ul className="daftar-tindakan">
            {anggota.map((a) => (
              <li key={a.id}>
                <span>
                  <strong>{a.nama}</strong>
                  <br />
                  <span className="redup">Sinkron terakhir: {waktuPendek(a.terakhir)}</span>
                </span>
                <button
                  className="tombol kecil sekunder"
                  onClick={async () => {
                    if (!window.confirm(`Lepas ${a.nama}? Laptop itu perlu dipasangkan ulang untuk sinkron.`)) return;
                    await lepasAnggota(db, a.id);
                    muatAnggota();
                  }}
                >
                  Lepas
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ---------- Windows: anggota, memindai kode QR dari HP ----------

function SisiAnggota() {
  const [pusat, setPusat] = useState<Pusat | null | undefined>(undefined);
  const [terakhir, setTerakhir] = useState<HasilSinkron | undefined>();
  const [status, setStatus] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pindai, setPindai] = useState(false);
  const [alamat, setAlamat] = useState('');
  const [kode, setKode] = useState('');

  const muat = useCallback(async () => {
    setPusat((await pusatTersimpan()) ?? null);
    setTerakhir(await bacaMeta<HasilSinkron>(db, 'sinkronTerakhir'));
  }, []);

  useEffect(() => {
    muat();
    return amatiSinkron((s) => {
      setStatus(s);
      muat();
    });
  }, [muat]);

  const pasangkan = async (a: string, k: string) => {
    setSibuk(true);
    setStatus('Memasangkan dengan HP…');
    try {
      await pasangKePusat(a.trim(), k.trim());
      setPindai(false);
      await muat();
      await sinkronSekarang();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSibuk(false);
      muat();
    }
  };

  const sinkron = async () => {
    setSibuk(true);
    try {
      await sinkronSekarang();
    } catch {
      // pesan sudah dikabarkan
    } finally {
      setSibuk(false);
      muat();
    }
  };

  if (pusat === undefined) return null;

  if (!pusat) {
    return (
      <>
        <section className="kartu">
          <h2>Pasangkan dengan HP</h2>
          <p className="kosong">
            Di HP, buka Saku Hati → <strong>Sinkron</strong>. Pastikan HP dan laptop memakai Wi-Fi yang sama.
          </p>
          {pindai ? (
            <PemindaiQr
              saatTerbaca={(t) => {
                const q = bacaQr(t);
                if (q) pasangkan(q.alamat, q.kode);
                else setStatus('Kode QR itu bukan kode Saku Hati.');
              }}
              tutup={() => setPindai(false)}
            />
          ) : (
            <button className="tombol utama lebar" onClick={() => setPindai(true)} disabled={sibuk}>
              <Camera weight="duotone" /> Pindai kode QR dari HP
            </button>
          )}
        </section>
        <section className="kartu">
          <h2>Atau ketik manual</h2>
          <label className="label-catatan" htmlFor="alamat-hp">
            Alamat HP
          </label>
          <input
            id="alamat-hp"
            className="isian"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            placeholder="192.168.1.5:47310"
            inputMode="decimal"
          />
          <label className="label-catatan" htmlFor="kode-hp">
            Kode 6 angka
          </label>
          <input
            id="kode-hp"
            className="isian"
            value={kode}
            onChange={(e) => setKode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
          />
          <button
            className="tombol sekunder lebar"
            onClick={() => pasangkan(alamat, kode)}
            disabled={sibuk || !alamat || kode.length !== 6}
          >
            Pasangkan
          </button>
        </section>
        {status && <p className="pesan-tandai tengah">{status}</p>}
      </>
    );
  }

  return (
    <>
      <section className="kartu">
        <h2>Terpasang dengan HP</h2>
        <p className="kosong">
          Alamat HP: <strong>{pusat.alamat}</strong>
          <br />
          Sinkron otomatis saat aplikasi dibuka, ditinggalkan, dan setiap 2 menit selama HP terjangkau.
        </p>
        <button className="tombol utama lebar" onClick={sinkron} disabled={sibuk}>
          {sibuk ? (
            'Menyinkronkan…'
          ) : (
            <>
              <ArrowsClockwise weight="duotone" /> Sinkron sekarang
            </>
          )}
        </button>
        {status && <p className="pesan-tandai">{status}</p>}
        <p className="kosong">
          Sinkron terakhir: {waktuPendek(terakhir?.waktu)}
          {terakhir && ` · ${terakhir.dikirim} dikirim, ${terakhir.diterima} diterima`}
        </p>
      </section>
      <section className="kartu">
        <button
          className="tautan"
          onClick={async () => {
            if (!window.confirm('Lepas pasangan dengan HP? Data di laptop ini tetap ada.')) return;
            await lepasPusat();
            setStatus('');
            muat();
          }}
        >
          Lepas pasangan dengan HP
        </button>
      </section>
    </>
  );
}

function PemindaiQr({ saatTerbaca, tutup }: { saatTerbaca: (teks: string) => void; tutup: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let aliran: MediaStream | null = null;
    let jalan = true;
    let bingkai = 0;
    (async () => {
      try {
        aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = aliran;
        await video.current.play();
        const pindai = () => {
          if (!jalan) return;
          const v = video.current;
          const k = kanvas.current;
          if (v && k && v.videoWidth) {
            k.width = v.videoWidth;
            k.height = v.videoHeight;
            const ctx = k.getContext('2d', { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const data = ctx.getImageData(0, 0, k.width, k.height);
            const hasil = jsQR(data.data, data.width, data.height);
            if (hasil?.data) {
              jalan = false;
              saatTerbaca(hasil.data);
              return;
            }
          }
          bingkai = requestAnimationFrame(pindai);
        };
        pindai();
      } catch {
        setGalat('Kamera tidak bisa dibuka. Pakai cara ketik manual di bawah.');
      }
    })();
    return () => {
      jalan = false;
      cancelAnimationFrame(bingkai);
      aliran?.getTracks().forEach((t) => t.stop());
    };
  }, [saatTerbaca]);

  return (
    <div className="pemindai">
      {galat ? (
        <p className="pesan-galat">{galat}</p>
      ) : (
        <video ref={video} muted playsInline className="video-pindai" />
      )}
      <canvas ref={kanvas} hidden />
      <p className="kosong">Arahkan kode QR di layar HP ke kamera laptop.</p>
      <button className="tombol sekunder lebar" onClick={tutup}>
        Batal
      </button>
    </div>
  );
}
