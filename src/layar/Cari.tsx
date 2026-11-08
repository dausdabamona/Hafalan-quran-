import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenText, MagnifyingGlass, X } from '@phosphor-icons/react';
import { cariLompatan, cariQuran, LABEL_SUMBER, type CatatanSendiri } from '../cari';
import { cariSurah } from '../data';
import { db } from '../db';
import { cuplikan, infoDataHadits, type InfoDataHadits } from '../hadits';
import Kepala from '../komponen/Kepala';
import { ganti, pergi } from '../navigasi';
import { HasilCariHadits } from './Hadits';

// K-98 (B): pencarian umum — Al-Qur'an dan Hadits dalam satu kotak.

const PER_TAMPIL = 15;

export default function LayarCari({ awal = '' }: { awal?: string }) {
  const [teks, setTeks] = useState(awal);
  const [q, setQ] = useState(awal.trim());
  const [catatan, setCatatan] = useState<CatatanSendiri | null>(null);
  const [info, setInfo] = useState<InfoDataHadits | null | undefined>(undefined);
  const [tampil, setTampil] = useState(PER_TAMPIL);

  useEffect(() => {
    Promise.all([db.makna.toArray(), db.keterangan.toArray(), db.alamatAyat.toArray()]).then(
      ([makna, keterangan, alamat]) => setCatatan({ makna, keterangan, alamat }),
    );
    infoDataHadits()
      .then((x) => setInfo(x ?? null))
      .catch(() => setInfo(null));
  }, []);

  // Kata kunci disimpan di alamat agar tombol Kembali dari hasil kembali ke pencarian yang sama.
  useEffect(() => {
    const t = setTimeout(() => {
      const bersih = teks.trim();
      setQ(bersih);
      setTampil(PER_TAMPIL);
      const tujuan = bersih ? `#/cari?q=${encodeURIComponent(bersih)}` : '#/cari';
      if (window.location.hash !== tujuan) ganti(tujuan);
    }, 300);
    return () => clearTimeout(t);
  }, [teks]);

  const lompat = useMemo(() => (q ? cariLompatan(q) : []), [q]);
  const quran = useMemo(() => (q && catatan ? cariQuran(q, catatan) : null), [q, catatan]);

  return (
    <>
      <Kepala judul="Cari" sub="Al-Qur'an & Hadits" />
      <div className="kotak-cari-hadits kotak-cari-umum">
        <label className="kolom-cari">
          <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
          <input
            type="search"
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="Kata, teks Arab, nama surah, atau 67:1"
            aria-label="Cari di Al-Qur'an dan Hadits"
            enterKeyHint="search"
            autoFocus={!awal}
          />
          {teks && (
            <button type="button" className="hapus-cari" onClick={() => setTeks('')} aria-label="Hapus kata kunci">
              <X size={18} weight="bold" />
            </button>
          )}
        </label>
      </div>

      {!q && (
        <section className="kartu petunjuk-cari">
          <p>Contoh pencarian:</p>
          <ul>
            <li>
              <strong>sabar</strong>, <strong>hari kiamat</strong> — di arti per kata, makna, keterangan, dan judul
              alamat Anda
            </li>
            <li>
              <strong dir="rtl">رحمة</strong> — teks Arab, tanpa harakat
            </li>
            <li>
              <strong>67:1</strong>, <strong>al mulk</strong>, <strong>mulk 3</strong> — langsung ke surah/ayat
            </li>
          </ul>
          <p className="keterangan-kecil">
            Terjemah Al-Qur'an utuh tidak ada di Saku Hati, jadi kata Indonesia dicari di arti per kata dan catatan Anda
            sendiri.
          </p>
        </section>
      )}

      {lompat.length > 0 && (
        <section className="bagian-cari">
          <h2 className="kicker">Langsung ke</h2>
          <ul className="daftar-lompat">
            {lompat.map((l) => (
              <li key={l.surah.nomor}>
                <button onClick={() => pergi(`#/surah/${l.surah.nomor}${l.ayat ? `/${l.ayat}` : ''}`)}>
                  <span>
                    {l.surah.nomor}. {l.surah.nama}
                    {l.ayat ? ` · ayat ${l.ayat}` : ` · ${l.surah.jumlahAyat} ayat`}
                  </span>
                  <ArrowRight weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {quran && (
        <section className="bagian-cari">
          <h2 className="kicker">Al-Qur'an · {quran.hasil.length >= 300 ? '300+' : quran.hasil.length} ayat</h2>
          {quran.hasil.length === 0 && quran.kata.length > 0 && (
            <p className="keterangan-kecil">Tidak ditemukan di Al-Qur'an. Coba kata lain atau bentuk dasarnya.</p>
          )}
          {quran.hasil.slice(0, tampil).map((h) => {
            const s = cariSurah(h.surah)!;
            return (
              <button
                key={`${h.surah}:${h.ayat}`}
                className="ringkas-hadits"
                onClick={() => pergi(`#/surah/${h.surah}/${h.ayat}`)}
              >
                <span className="nomor-hadits">
                  {s.nama} {h.ayat} · {LABEL_SUMBER[h.sumber]}
                </span>
                <span
                  className={'cuplikan-hadits' + (quran.arab ? ' arab-cuplikan' : '')}
                  dir={quran.arab ? 'rtl' : undefined}
                >
                  {cuplikan(h.teks, quran.kata).map((p, i) =>
                    p.tebal ? <mark key={i}>{p.teks}</mark> : <span key={i}>{p.teks}</span>,
                  )}
                </span>
              </button>
            );
          })}
          {quran.hasil.length > tampil && (
            <button className="tombol sekunder lebar" onClick={() => setTampil((n) => n + 30)}>
              Tampilkan lebih banyak ({quran.hasil.length - tampil} lagi)
            </button>
          )}
        </section>
      )}

      {q && (
        <section className="bagian-cari bagian-cari-hadits">
          <h2 className="kicker">
            <BookOpenText size={16} weight="duotone" /> Hadits
          </h2>
          {info === undefined ? null : info ? (
            <HasilCariHadits teks={q} kitab={null} info={info} />
          ) : (
            <p className="keterangan-kecil">
              Data hadits belum dimuat di perangkat ini.{' '}
              <button className="tautan kecil" onClick={() => pergi('#/data-hadits')}>
                Muat data hadits
              </button>
            </p>
          )}
        </section>
      )}
    </>
  );
}
