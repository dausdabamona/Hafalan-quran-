import { useEffect, useMemo, useState } from 'react';
import {
  BookmarkSimple,
  BookOpenText,
  CaretDown,
  CaretLeft,
  CaretRight,
  LinkSimple,
  MagnifyingGlass,
  Note,
  NotePencil,
  Scroll,
  Sun,
  X,
} from '@phosphor-icons/react';
import { daftarSurah } from '../data';
import { cariSurah } from '../data';
import type { Hadits, HaditsBagian, HaditsKait } from '../db';
import {
  ambilBagian,
  ambilKait,
  ambilSatuHadits,
  ambilSuntingan,
  ambilCatatanHadits,
  apakahDisimpan,
  daftarTersimpan,
  hapusKaitan,
  haditsHariIni,
  kaitanManual,
  simpanCatatanHadits,
  tambahKaitan,
  ubahSimpan,
  adaArab,
  cariHadits,
  cuplikan,
  daftarBagian,
  haditsBagian,
  haditsMenurutUrut,
  infoDataHadits,
  namaKitab,
  simpanSuntingan,
  type ButirTersimpan,
  type HasilCari,
  type InfoDataHadits,
} from '../hadits';
import Kepala from '../komponen/Kepala';
import { useEjaan } from '../komponen/useEjaan';
import { matanAtauUtuh, pisahArab, pisahTerjemah } from '../matan';
import { ganti, pergi } from '../navigasi';

const angka = (n: number) => n.toLocaleString('id-ID');
const PER_HALAMAN = 40;

// K-77: ukuran huruf hadits memakai pengaturan yang sama dengan mushaf.
function TombolUkuran({ aturUkuran }: { aturUkuran: (s: number) => void }) {
  return (
    <div className="atur-huruf">
      <button className="tombol-ikon kecil" onClick={() => aturUkuran(-4)} aria-label="Perkecil huruf">
        A−
      </button>
      <button className="tombol-ikon kecil" onClick={() => aturUkuran(4)} aria-label="Perbesar huruf">
        A+
      </button>
    </div>
  );
}

function useInfo() {
  const [info, setInfo] = useState<InfoDataHadits | null | undefined>(undefined);
  useEffect(() => {
    infoDataHadits().then((i) => setInfo(i ?? null));
  }, []);
  return info;
}

function BelumAdaData({ info }: { info: InfoDataHadits | null }) {
  return (
    <div className="isi-kemajuan isi-cadangan">
      <section className="kartu-kemajuan">
        <h2>{info ? 'Baru hadits terkait ayat' : 'Belum ada data hadits'}</h2>
        <p className="keterangan-kecil">
          Untuk membaca seluruh kitab, muat berkas <code>saku-hati-hadits-lengkap.jsonl.gz</code> lewat Data hadits.
          Data hanya tersimpan di perangkat ini.
        </p>
        <button className="tombol utama" onClick={() => pergi('#/data-hadits')}>
          <Scroll size={20} weight="bold" /> Buka Data hadits
        </button>
      </section>
    </div>
  );
}

// #/hadits — kolom cari (K-78) dan daftar 9 kitab.
export function LayarKitabHadits({ cariAwal = '', kitabAwal }: { cariAwal?: string; kitabAwal?: string }) {
  const info = useInfo();
  const [teks, setTeks] = useState(cariAwal);
  const [kitab, setKitab] = useState<string | null>(kitabAwal ?? null);

  // Kata kunci disimpan di alamat (tanpa menambah riwayat) agar kembali dari halaman hadits tetap di hasil.
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (teks.trim()) p.set('q', teks.trim());
      if (kitab) p.set('k', kitab);
      const tujuan = p.toString() ? `#/hadits?${p}` : '#/hadits';
      if (window.location.hash !== tujuan) ganti(tujuan);
    }, 400);
    return () => clearTimeout(t);
  }, [teks, kitab]);

  if (info === undefined) return <Kepala judul="Hadits" />;
  if (!info || info.jenis !== 'lengkap')
    return (
      <>
        <Kepala judul="Hadits" sub="Kitab hadits" />
        <BelumAdaData info={info} />
      </>
    );
  const mencari = teks.trim().length > 0;
  return (
    <>
      <Kepala judul="Hadits" sub={`${angka(info.jumlahHadits)} hadits · ${info.kitab.length} kitab`} />
      <div className="kotak-cari-hadits">
        <label className="kolom-cari">
          <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
          <input
            type="search"
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="Cari terjemah atau Arab…"
            aria-label="Cari hadits"
            enterKeyHint="search"
          />
          {teks && (
            <button type="button" className="hapus-cari" onClick={() => setTeks('')} aria-label="Hapus kata kunci">
              <X size={18} weight="bold" />
            </button>
          )}
        </label>
        {mencari && (
          <div className="pilih-kitab-cari" role="radiogroup" aria-label="Saring kitab">
            {[{ kode: '', nama: 'Semua' }, ...info.kitab].map((k) => (
              <button
                key={k.kode || 'semua'}
                type="button"
                role="radio"
                aria-checked={(kitab ?? '') === k.kode}
                className={'chip' + ((kitab ?? '') === k.kode ? ' aktif' : '')}
                onClick={() => setKitab(k.kode || null)}
              >
                {k.nama.replace(/^(Shahih|Sunan|Musnad) /, '')}
              </button>
            ))}
          </div>
        )}
      </div>
      {mencari ? (
        <HasilCariHadits teks={teks} kitab={kitab} info={info} />
      ) : (
        <>
          <div className="atas-hadits">
            <KartuHaditsHariIni info={info} />
            <button className="baris-tersimpan" onClick={() => pergi('#/hadits/tersimpan')}>
              <BookmarkSimple weight="duotone" /> Hadits tersimpan & catatan
              <CaretRight weight="bold" />
            </button>
          </div>
          <ul className="daftar-lainnya daftar-kitab-hadits">
            {info.kitab.map((k) => (
              <li key={k.kode}>
                <button onClick={() => pergi(`#/hadits/${k.kode}`)}>
                  <span className="ikon-kotak">
                    <BookOpenText size={24} weight="duotone" />
                  </span>
                  <span className="teks">
                    <strong>{k.nama}</strong>
                    <span>{angka(k.jumlah ?? 0)} hadits</span>
                  </span>
                  <span className="arab-kitab" lang="ar" dir="rtl">
                    {k.namaArab}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

const PER_HASIL = 30;

function HasilCariHadits({ teks, kitab, info }: { teks: string; kitab: string | null; info: InfoDataHadits }) {
  const eja = useEjaan();
  const [hasil, setHasil] = useState<HasilCari | null>(null);
  const [hadits, setHadits] = useState<Hadits[]>([]);
  const [sunting, setSunting] = useState<Map<string, string>>(new Map());
  const [mencari, setMencari] = useState(false);

  useEffect(() => {
    if (!info.indeks) return;
    let batal = false;
    setMencari(true);
    const t = setTimeout(async () => {
      const h = await cariHadits(teks, kitab, info);
      if (batal) return;
      const awal = await haditsMenurutUrut(h.urut.slice(0, PER_HASIL));
      const s = await ambilSuntingan(awal.map((x) => x.kunci));
      if (batal) return;
      setHasil(h);
      setHadits(awal);
      setSunting(s);
      setMencari(false);
    }, 300);
    return () => {
      batal = true;
      clearTimeout(t);
    };
  }, [teks, kitab, info]);

  const muatLagi = async () => {
    if (!hasil) return;
    const lagi = await haditsMenurutUrut(hasil.urut.slice(hadits.length, hadits.length + PER_HASIL));
    const s = await ambilSuntingan(lagi.map((x) => x.kunci));
    setHadits((lama) => [...lama, ...lagi]);
    setSunting((lama) => new Map([...lama, ...s]));
  };

  if (!info.indeks)
    return (
      <p className="petunjuk">
        Pencarian membutuhkan indeks. Buka <strong>Data hadits</strong> lalu muat ulang berkas data hadits sekali.
      </p>
    );
  if (!hasil) return <p className="keterangan-kecil hasil-cari-info">Mencari…</p>;

  const arab = hasil.kataDipakai.some(adaArab);
  return (
    <div className="hasil-cari-hadits">
      <p className="keterangan-kecil hasil-cari-info">
        {mencari
          ? 'Mencari…'
          : hasil.kataDipakai.length
            ? `${angka(hasil.urut.length)} hadits`
            : 'Tambahkan kata yang lebih khusus.'}
        {hasil.kataDiabaikan.length > 0 && ` · kata umum diabaikan: ${hasil.kataDiabaikan.join(', ')}`}
      </p>
      {hadits.map((h) => (
        <button key={h.kunci} className="ringkas-hadits" onClick={() => pergi(`#/hadits/${h.kitab}/${h.nomor}`)}>
          <span className="nomor-hadits">
            {namaKitab(info, h.kitab)} no. {angka(h.nomor)}
            {sunting.has(h.kunci) && ' · suntingan sendiri'}
          </span>
          <span className={'cuplikan-hadits' + (arab ? ' arab-cuplikan' : '')} dir={arab ? 'rtl' : undefined}>
            {cuplikan(arab ? h.arab : (sunting.get(h.kunci) ?? eja(h.terjemah)), hasil.kataSorot).map((p, i) =>
              p.tebal ? <mark key={i}>{p.teks}</mark> : <span key={i}>{p.teks}</span>,
            )}
          </span>
        </button>
      ))}
      {hadits.length < hasil.urut.length && (
        <button className="tombol" onClick={muatLagi}>
          Tampilkan {angka(Math.min(PER_HASIL, hasil.urut.length - hadits.length))} hasil berikutnya
        </button>
      )}
    </div>
  );
}

// #/hadits/bukhari — daftar bagian dalam satu kitab.
export function LayarBagianHadits({ kitab }: { kitab: string }) {
  const info = useInfo();
  const [bagian, setBagian] = useState<HaditsBagian[] | null>(null);
  useEffect(() => {
    daftarBagian(kitab).then(setBagian);
  }, [kitab]);
  return (
    <>
      <Kepala judul={namaKitab(info, kitab)} sub={bagian ? `${bagian.length} bagian` : undefined} />
      <ol className="daftar-bagian-hadits">
        {bagian?.map((b) => (
          <li key={b.kunci}>
            <button onClick={() => pergi(`#/hadits/${kitab}/g${b.id}`)}>
              <span className="nomor-bagian">{b.id}</span>
              <span className="teks">
                <strong>{b.judul}</strong>
                <span>{angka(b.jumlah)} hadits</span>
              </span>
              <span className="arab-kitab" lang="ar" dir="rtl">
                {b.judulArab}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

// #/hadits/bukhari/g2 — hadits dalam satu bagian, dikelompokkan per bab, dimuat per halaman.
export function LayarDaftarHadits({
  kitab,
  bagian,
  aturUkuran,
}: {
  kitab: string;
  bagian: number;
  aturUkuran: (s: number) => void;
}) {
  const eja = useEjaan();
  const info = useInfo();
  const [judul, setJudul] = useState<HaditsBagian>();
  const [hadits, setHadits] = useState<Hadits[]>([]);
  const [habis, setHabis] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [sunting, setSunting] = useState<Map<string, string>>(new Map());

  const muatLagi = async (mulai: number) => {
    setMemuat(true);
    const baru = await haditsBagian(kitab, bagian, mulai, PER_HALAMAN);
    const s = await ambilSuntingan(baru.map((h) => h.kunci));
    setSunting((lama) => new Map([...(mulai === 0 ? [] : lama), ...s]));
    setHadits((lama) => (mulai === 0 ? baru : [...lama, ...baru]));
    setHabis(baru.length < PER_HALAMAN);
    setMemuat(false);
  };

  useEffect(() => {
    ambilBagian(kitab, bagian).then(setJudul);
    muatLagi(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitab, bagian]);

  return (
    <>
      <Kepala
        judul={judul?.judul ?? 'Bagian'}
        sub={`${namaKitab(info, kitab)}${judul ? ` · ${angka(judul.jumlah)} hadits` : ''}`}
        kanan={<TombolUkuran aturUkuran={aturUkuran} />}
      />
      <div className="daftar-hadits-bagian">
        {hadits.map((h, i) => (
          <div key={h.kunci}>
            {(i === 0 || hadits[i - 1].babId !== h.babId) && h.bab && (
              <h3 className="judul-bab-hadits">{eja(h.bab)}</h3>
            )}
            <button className="ringkas-hadits" onClick={() => pergi(`#/hadits/${kitab}/${h.nomor}`)}>
              <span className="nomor-hadits">No. {angka(h.nomor)}</span>
              <span className="cuplikan-hadits">{sunting.get(h.kunci) ?? eja(matanAtauUtuh(h.terjemah))}</span>
            </button>
          </div>
        ))}
        {!habis && (
          <button className="tombol" onClick={() => muatLagi(hadits.length)} disabled={memuat}>
            {memuat ? 'Memuat…' : 'Muat hadits berikutnya'}
          </button>
        )}
      </div>
    </>
  );
}

// #/hadits/bukhari/740 — satu hadits lengkap.
export function LayarHadits({
  kitab,
  nomor,
  aturUkuran,
}: {
  kitab: string;
  nomor: number;
  aturUkuran: (s: number) => void;
}) {
  const eja = useEjaan();
  const info = useInfo();
  const [hadits, setHadits] = useState<Hadits | null | undefined>(undefined);
  const [kait, setKait] = useState<HaditsKait>();
  const [bagian, setBagian] = useState<HaditsBagian>();
  const [ada, setAda] = useState({ sebelum: false, sesudah: false });
  const [suntingan, setSuntingan] = useState<string>();
  const [menyunting, setMenyunting] = useState(false);
  const kunci = `${kitab}:${nomor}`;
  // K-79: simpan, catatan, kaitan manual.
  const [disimpan, setDisimpan] = useState(false);
  const [catatan, setCatatan] = useState<string>();
  const [manual, setManual] = useState<string[]>([]);
  const [lembar, setLembar] = useState<'catatan' | 'kaitan' | null>(null);
  // K-81: sanad disembunyikan bila awal matan dikenali.
  const [lihatSanad, setLihatSanad] = useState(false);
  const pisahAr = useMemo(() => (hadits ? pisahArab(hadits.arab) : null), [hadits]);
  const pisahId = useMemo(() => (hadits && !suntingan ? pisahTerjemah(hadits.terjemah) : null), [hadits, suntingan]);
  useEffect(() => {
    const k = `${kitab}:${nomor}`;
    apakahDisimpan(k).then(setDisimpan);
    ambilCatatanHadits(k).then(setCatatan);
    kaitanManual(k).then(setManual);
  }, [kitab, nomor]);

  useEffect(() => {
    setHadits(undefined);
    setKait(undefined);
    setSuntingan(undefined);
    setLihatSanad(false);
    ambilSuntingan([`${kitab}:${nomor}`]).then((m) => setSuntingan(m.get(`${kitab}:${nomor}`)));
    window.scrollTo({ top: 0 });
    (async () => {
      const h = await ambilSatuHadits(kitab, nomor);
      setHadits(h ?? null);
      setKait(await ambilKait(`${kitab}:${nomor}`));
      if (h?.bagian !== undefined) setBagian(await ambilBagian(kitab, h.bagian));
      const [a, b] = await Promise.all([ambilSatuHadits(kitab, nomor - 1), ambilSatuHadits(kitab, nomor + 1)]);
      setAda({ sebelum: !!a, sesudah: !!b });
    })();
  }, [kitab, nomor]);

  // Padanan dikelompokkan per kitab.
  const padanan = useMemo(() => {
    const per = new Map<string, number[]>();
    for (const k of kait?.padanan ?? []) {
      const [kb, n] = k.split(':');
      if (!per.has(kb)) per.set(kb, []);
      per.get(kb)!.push(Number(n));
    }
    return [...per.entries()];
  }, [kait]);

  const judul = `${namaKitab(info, kitab)} no. ${angka(nomor)}`;
  if (hadits === undefined) return <Kepala judul={judul} />;
  if (hadits === null)
    return (
      <>
        <Kepala judul={judul} />
        <p className="petunjuk">Hadits ini belum ada di data perangkat ini.</p>
      </>
    );

  return (
    <>
      <Kepala judul={judul} sub={bagian?.judul} kanan={<TombolUkuran aturUkuran={aturUkuran} />} />
      <article className="halaman-hadits">
        {hadits.bab && <p className="bab-hadits">{eja(hadits.bab)}</p>}
        {(pisahAr || pisahId) && (
          <button
            type="button"
            className="tautan tombol-sanad"
            aria-expanded={lihatSanad}
            onClick={() => setLihatSanad((v) => !v)}
          >
            {lihatSanad ? <CaretDown weight="bold" /> : <CaretRight weight="bold" />}{' '}
            {lihatSanad ? 'Sembunyikan sanad' : 'Sanad'}
          </button>
        )}
        <p className="arab-hadits besar" lang="ar" dir="rtl">
          {lihatSanad || !pisahAr ? hadits.arab : pisahAr.matan}
        </p>
        <div className="blok-terjemah">
          <p className="terjemah-hadits">
            {suntingan ?? eja(lihatSanad || !pisahId ? hadits.terjemah : pisahId.matan)}
          </p>
          <div className="aksi-terjemah">
            {suntingan && <span className="tanda-suntingan">Suntingan sendiri</span>}
            <button type="button" className="tautan" onClick={() => setMenyunting(true)}>
              <NotePencil weight="duotone" /> Sunting terjemah
            </button>
          </div>
        </div>

        <div className="aksi-hadits">
          <button
            type="button"
            className={'chip' + (disimpan ? ' aktif' : '')}
            aria-pressed={disimpan}
            onClick={async () => setDisimpan(await ubahSimpan(kunci))}
          >
            <BookmarkSimple weight={disimpan ? 'fill' : 'duotone'} /> {disimpan ? 'Tersimpan' : 'Simpan'}
          </button>
          <button type="button" className="chip" onClick={() => setLembar('catatan')}>
            <Note weight="duotone" /> {catatan ? 'Ubah catatan' : 'Catatan'}
          </button>
          <button type="button" className="chip" onClick={() => setLembar('kaitan')}>
            <LinkSimple weight="bold" /> Kaitkan ke ayat
          </button>
        </div>

        {catatan && (
          <button type="button" className="catatan-hadits" onClick={() => setLembar('catatan')}>
            <span className="kicker">Catatan saya</span>
            <span>{catatan}</span>
          </button>
        )}

        {!!(kait?.ayat.length || manual.length) && (
          <section className="kait-hadits">
            <h2>Ayat terkait</h2>
            <div className="chip-kait">
              {manual.map((a) => {
                const [s, n] = a.split(':').map(Number);
                return (
                  <span key={'m' + a} className="chip chip-manual">
                    <button type="button" onClick={() => pergi(`#/surah/${s}/${n}`)}>
                      <LinkSimple weight="bold" /> {cariSurah(s)?.nama ?? s} {n}
                    </button>
                    <button
                      type="button"
                      className="lepas"
                      aria-label={`Lepas kaitan ${cariSurah(s)?.nama ?? s} ${n}`}
                      onClick={async () => {
                        await hapusKaitan(s, n, kunci);
                        setManual(await kaitanManual(kunci));
                      }}
                    >
                      <X weight="bold" />
                    </button>
                  </span>
                );
              })}
              {(kait?.ayat ?? [])
                .filter((a) => !manual.includes(a))
                .map((a) => {
                  const [s, n] = a.split(':').map(Number);
                  return (
                    <button key={a} className="chip" onClick={() => pergi(`#/surah/${s}/${n}`)}>
                      {cariSurah(s)?.nama ?? s} {n}
                    </button>
                  );
                })}
            </div>
          </section>
        )}

        {padanan.length > 0 && (
          <section className="kait-hadits">
            <h2>Padanan hadits</h2>
            {padanan.map(([kb, daftar]) => (
              <div key={kb} className="baris-padanan">
                <span className="nama-padanan">{namaKitab(info, kb)}</span>
                <div className="chip-kait">
                  {daftar.map((n) => (
                    <button key={n} className="chip" onClick={() => pergi(`#/hadits/${kb}/${n}`)}>
                      {angka(n)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </article>

      {lembar === 'catatan' && (
        <LembarCatatanHadits
          judul={judul}
          awal={catatan ?? ''}
          tutup={() => setLembar(null)}
          simpan={async (isi) => {
            await simpanCatatanHadits(kunci, isi);
            setCatatan(await ambilCatatanHadits(kunci));
            setLembar(null);
          }}
        />
      )}
      {lembar === 'kaitan' && (
        <LembarKaitanAyat
          judul={judul}
          tutup={() => setLembar(null)}
          simpan={async (s, n) => {
            await tambahKaitan(s, n, kunci);
            setManual(await kaitanManual(kunci));
            setLembar(null);
          }}
        />
      )}
      {menyunting && (
        <LembarSuntingHadits
          judul={judul}
          asli={hadits.terjemah}
          awal={suntingan ?? hadits.terjemah}
          adaSuntingan={!!suntingan}
          tutup={() => setMenyunting(false)}
          simpan={async (isi) => {
            await simpanSuntingan(kitab, nomor, isi, hadits.terjemah);
            const m = await ambilSuntingan([kunci]);
            setSuntingan(m.get(kunci));
            setMenyunting(false);
          }}
        />
      )}

      <div className="bilah-aksi bilah-ikon-ringkas">
        <button
          type="button"
          className="ikon-aksi"
          disabled={!ada.sebelum}
          onClick={() => pergi(`#/hadits/${kitab}/${nomor - 1}`)}
          aria-label="Hadits sebelumnya"
          title="Hadits sebelumnya"
        >
          <span className="bulat">
            <CaretLeft weight="bold" />
          </span>
        </button>
        <button
          type="button"
          className="ikon-aksi"
          onClick={() => hadits.bagian !== undefined && pergi(`#/hadits/${kitab}/g${hadits.bagian}`)}
          aria-label="Daftar hadits bagian ini"
          title="Daftar hadits bagian ini"
        >
          <span className="bulat">
            <BookOpenText weight="duotone" />
          </span>
        </button>
        <button
          type="button"
          className="ikon-aksi"
          disabled={!ada.sesudah}
          onClick={() => pergi(`#/hadits/${kitab}/${nomor + 1}`)}
          aria-label="Hadits sesudahnya"
          title="Hadits sesudahnya"
        >
          <span className="bulat">
            <CaretRight weight="bold" />
          </span>
        </button>
      </div>
    </>
  );
}

// K-77: sunting seluruh terjemah satu hadits dengan gaya bahasa sendiri.
function LembarSuntingHadits({
  judul,
  asli,
  awal,
  adaSuntingan,
  tutup,
  simpan,
}: {
  judul: string;
  asli: string;
  awal: string;
  adaSuntingan: boolean;
  tutup: () => void;
  simpan: (isi: string) => Promise<void>;
}) {
  const [isi, setIsi] = useState(awal);
  const [lihatAsli, setLihatAsli] = useState(false);
  return (
    <div className="latar-lembar" onClick={tutup}>
      <div
        className="lembar lembar-sunting-hadits"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="pegangan" />
        <p className="lokasi">{judul}</p>
        <label className="label-catatan" htmlFor="terjemah-hadits">
          Terjemah dengan gaya bahasa Anda
        </label>
        <textarea id="terjemah-hadits" value={isi} onChange={(e) => setIsi(e.target.value)} rows={10} />
        {adaSuntingan && (
          <button type="button" className="tautan" onClick={() => setLihatAsli((v) => !v)}>
            {lihatAsli ? 'Sembunyikan terjemah asli' : 'Lihat terjemah asli'}
          </button>
        )}
        {lihatAsli && <p className="kosong terjemah-asli">{asli}</p>}
        <div className="aksi-lembar">
          {adaSuntingan && (
            <button className="tombol sekunder" onClick={() => simpan('')}>
              Kembalikan ke asli
            </button>
          )}
          <button className="tombol sekunder" onClick={tutup}>
            Batal
          </button>
          <button className="tombol utama" onClick={() => simpan(isi)}>
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// K-79: catatan pribadi untuk satu hadits.
function LembarCatatanHadits({
  judul,
  awal,
  tutup,
  simpan,
}: {
  judul: string;
  awal: string;
  tutup: () => void;
  simpan: (isi: string) => Promise<void>;
}) {
  const [isi, setIsi] = useState(awal);
  return (
    <div className="latar-lembar" onClick={tutup}>
      <div className="lembar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">{judul}</p>
        <label className="label-catatan" htmlFor="catatan-hadits">
          Catatan saya
        </label>
        <textarea
          id="catatan-hadits"
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          rows={5}
          placeholder="Pelajaran, kaitan, atau pengingat dari hadits ini"
        />
        <div className="aksi-lembar">
          {awal && (
            <button className="tombol sekunder" onClick={() => simpan('')}>
              Hapus catatan
            </button>
          )}
          <button className="tombol sekunder" onClick={tutup}>
            Batal
          </button>
          <button className="tombol utama" onClick={() => simpan(isi)}>
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// K-79: kaitkan hadits ke satu ayat secara manual.
function LembarKaitanAyat({
  judul,
  tutup,
  simpan,
}: {
  judul: string;
  tutup: () => void;
  simpan: (surah: number, ayat: number) => Promise<void>;
}) {
  const [surah, setSurah] = useState(1);
  const [ayat, setAyat] = useState(1);
  const jumlah = cariSurah(surah)?.jumlahAyat ?? 1;
  return (
    <div className="latar-lembar" onClick={tutup}>
      <div className="lembar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pegangan" />
        <p className="lokasi">{judul} · kaitkan ke ayat</p>
        <div className="pilih-ayat-kaitan">
          <label>
            <span className="label-catatan">Surah</span>
            <select
              value={surah}
              onChange={(e) => {
                setSurah(Number(e.target.value));
                setAyat(1);
              }}
            >
              {daftarSurah.map((x) => (
                <option key={x.nomor} value={x.nomor}>
                  {x.nomor}. {x.nama}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label-catatan">Ayat (1–{jumlah})</span>
            <input
              type="number"
              min={1}
              max={jumlah}
              value={ayat}
              onChange={(e) => setAyat(Math.min(jumlah, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
        </div>
        <div className="aksi-lembar">
          <button className="tombol sekunder" onClick={tutup}>
            Batal
          </button>
          <button className="tombol utama" onClick={() => simpan(surah, ayat)}>
            Kaitkan
          </button>
        </div>
      </div>
    </div>
  );
}

// #/hadits/tersimpan — hadits yang disimpan dan yang punya catatan (K-79).
export function LayarTersimpanHadits() {
  const eja = useEjaan();
  const info = useInfo();
  const [butir, setButir] = useState<ButirTersimpan[] | null>(null);
  const [hadits, setHadits] = useState<Map<string, Hadits>>(new Map());
  useEffect(() => {
    (async () => {
      const b = await daftarTersimpan();
      const h = await Promise.all(b.map((x) => ambilSatuHadits(x.kunci.split(':')[0], Number(x.kunci.split(':')[1]))));
      setHadits(new Map(h.filter((x): x is Hadits => !!x).map((x) => [x.kunci, x])));
      setButir(b);
    })();
  }, []);
  return (
    <>
      <Kepala judul="Hadits tersimpan" sub={butir ? `${butir.length} hadits` : undefined} />
      <div className="hasil-cari-hadits">
        {butir?.length === 0 && (
          <p className="keterangan-kecil">Belum ada. Ketuk Simpan atau Catatan di halaman hadits.</p>
        )}
        {butir?.map((b) => {
          const [kb, n] = b.kunci.split(':');
          const h = hadits.get(b.kunci);
          return (
            <button key={b.kunci} className="ringkas-hadits" onClick={() => pergi(`#/hadits/${kb}/${n}`)}>
              <span className="nomor-hadits">
                {b.disimpan && <BookmarkSimple weight="fill" />} {namaKitab(info, kb)} no. {angka(Number(n))}
              </span>
              {b.catatan && <span className="catatan-ringkas">Catatan: {b.catatan}</span>}
              <span className="cuplikan-hadits">
                {h ? eja(matanAtauUtuh(h.terjemah)) : 'Data hadits belum dimuat di perangkat ini.'}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// K-79: hadits hari ini di atas daftar kitab.
function KartuHaditsHariIni({ info }: { info: InfoDataHadits }) {
  const eja = useEjaan();
  const [h, setH] = useState<Hadits>();
  const [sunting, setSunting] = useState<string>();
  useEffect(() => {
    haditsHariIni(info).then(async (x) => {
      if (!x) return;
      setSunting((await ambilSuntingan([x.kunci])).get(x.kunci));
      setH(x);
    });
  }, [info]);
  if (!h) return null;
  return (
    <button className="kartu-hadits-hari-ini" onClick={() => pergi(`#/hadits/${h.kitab}/${h.nomor}`)}>
      <span className="kicker">
        <Sun weight="duotone" /> Hadits hari ini · {namaKitab(info, h.kitab)} no. {angka(h.nomor)}
      </span>
      {h.bab && <span className="bab-hadits">{eja(h.bab)}</span>}
      <span className="cuplikan-hadits">{sunting ?? eja(matanAtauUtuh(h.terjemah))}</span>
    </button>
  );
}
