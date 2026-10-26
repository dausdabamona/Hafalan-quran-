import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, CaretLeft, CaretRight, NotePencil, Scroll } from '@phosphor-icons/react';
import { cariSurah } from '../data';
import type { Hadits, HaditsBagian, HaditsKait } from '../db';
import {
  ambilBagian,
  ambilKait,
  ambilSatuHadits,
  ambilSuntingan,
  daftarBagian,
  haditsBagian,
  infoDataHadits,
  namaKitab,
  simpanSuntingan,
  type InfoDataHadits,
} from '../hadits';
import Kepala from '../komponen/Kepala';
import { pergi } from '../navigasi';

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

// #/hadits — daftar 9 kitab.
export function LayarKitabHadits() {
  const info = useInfo();
  if (info === undefined) return <Kepala judul="Hadits" />;
  if (!info || info.jenis !== 'lengkap')
    return (
      <>
        <Kepala judul="Hadits" sub="Kitab hadits" />
        <BelumAdaData info={info} />
      </>
    );
  return (
    <>
      <Kepala judul="Hadits" sub={`${angka(info.jumlahHadits)} hadits · ${info.kitab.length} kitab`} />
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
            {(i === 0 || hadits[i - 1].babId !== h.babId) && h.bab && <h3 className="judul-bab-hadits">{h.bab}</h3>}
            <button className="ringkas-hadits" onClick={() => pergi(`#/hadits/${kitab}/${h.nomor}`)}>
              <span className="nomor-hadits">No. {angka(h.nomor)}</span>
              <span className="cuplikan-hadits">{sunting.get(h.kunci) ?? h.terjemah}</span>
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
  const info = useInfo();
  const [hadits, setHadits] = useState<Hadits | null | undefined>(undefined);
  const [kait, setKait] = useState<HaditsKait>();
  const [bagian, setBagian] = useState<HaditsBagian>();
  const [ada, setAda] = useState({ sebelum: false, sesudah: false });
  const [suntingan, setSuntingan] = useState<string>();
  const [menyunting, setMenyunting] = useState(false);
  const kunci = `${kitab}:${nomor}`;

  useEffect(() => {
    setHadits(undefined);
    setKait(undefined);
    setSuntingan(undefined);
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
        {hadits.bab && <p className="bab-hadits">{hadits.bab}</p>}
        <p className="arab-hadits besar" lang="ar" dir="rtl">
          {hadits.arab}
        </p>
        <div className="blok-terjemah">
          <p className="terjemah-hadits">{suntingan ?? hadits.terjemah}</p>
          <div className="aksi-terjemah">
            {suntingan && <span className="tanda-suntingan">Suntingan sendiri</span>}
            <button type="button" className="tautan" onClick={() => setMenyunting(true)}>
              <NotePencil weight="duotone" /> Sunting terjemah
            </button>
          </div>
        </div>

        {!!kait?.ayat.length && (
          <section className="kait-hadits">
            <h2>Ayat terkait</h2>
            <div className="chip-kait">
              {kait.ayat.map((a) => {
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
