import { dataJuz30 } from '../data';
import Kepala from '../komponen/Kepala';

export default function LayarTentang() {
  return (
    <>
      <Kepala judul="Tentang" sub="Sumber data dan lisensi" />
      <section className="tentang">
        <h2>Saku Hati</h2>
        <p>
          <strong>S</strong>edikit <strong>A</strong>yat, <strong>K</strong>uat <strong>U</strong>langnya. Aplikasi
          pribadi untuk menghafal dan merawat hafalan Al-Qur'an, berjalan tanpa internet. Semua catatan, tanda, dan
          rekaman tersimpan di HP ini.
        </p>
        <h2>Teks Al-Qur'an</h2>
        <p>
          Teks Utsmani Mushaf Madinah dari Tanzil Project, dipakai tanpa perubahan di bawah lisensi Creative Commons
          Attribution 3.0. Pembaruan teks dapat dipantau di <a href="https://tanzil.net">tanzil.net</a>.
        </p>
        <h2>Arti per kata</h2>
        <p>
          Terjemahan per kata bahasa Indonesia dari <a href="https://quran.com">Quran.com</a>, untuk pemakaian pribadi.
        </p>
        <h2>Pembagian rukuk</h2>
        <p>
          Daftar rukuk riwayat Hafs dari paket <a href="https://github.com/quran-center/quran-meta">quran-meta</a>{' '}
          (lisensi MIT).
        </p>
        <h2>Catatan lisensi Tanzil</h2>
        <pre className="lisensi">{dataJuz30.sumber.lisensiTanzil}</pre>
      </section>
    </>
  );
}
