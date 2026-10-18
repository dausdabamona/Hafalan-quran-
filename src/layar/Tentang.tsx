import { sumberData } from '../data';
import Kepala from '../komponen/Kepala';

export default function LayarTentang() {
  return (
    <>
      <Kepala judul="Tentang" sub="Sumber data dan lisensi" />
      <section className="tentang">
        <h2>Saku Hati</h2>
        <p>
          <strong>S</strong>edikit <strong>A</strong>yat, <strong>K</strong>uat <strong>U</strong>langnya ·{' '}
          <strong>H</strong>afalkan <strong>A</strong>rti, <strong>T</strong>ekun <strong>I</strong>ngat. Aplikasi
          pribadi untuk menghafal dan merawat hafalan Al-Qur'an 30 juz, berjalan tanpa internet. Semua catatan, makna
          yang Anda edit, tanda, dan rekaman tersimpan di HP ini.
        </p>
        <h2>Teks Al-Qur'an</h2>
        <p>
          Teks Utsmani Mushaf Madinah dari Tanzil Project, dipakai tanpa perubahan di bawah lisensi Creative Commons
          Attribution 3.0. Pembaruan teks dapat dipantau di <a href="https://tanzil.net">tanzil.net</a>.
          Al-Fatihah diberi nomor menurut hitungan Madinah: Alhamdulillah ayat 1, basmalah sebagai pembuka, dan
          ayat 6 berakhir pada <span lang="ar">أَنْعَمْتَ عَلَيْهِمْ</span>. Hurufnya tetap sama.
        </p>
        <h2>Arti per kata</h2>
        <p>
          Terjemahan per kata bahasa Indonesia dari <a href="https://quran.com">Quran.com</a>, untuk pemakaian pribadi.
          Makna per potongan waqaf disusun dari gabungan arti per kata dan dapat Anda sunting sendiri; makna ini bukan
          terjemahan resmi.
        </p>
        <h2>Pembagian rukuk dan juz</h2>
        <p>
          Riwayat Hafs, dari paket <a href="https://github.com/quran-center/quran-meta">quran-meta</a> (lisensi MIT).
        </p>
        <h2>Catatan lisensi Tanzil</h2>
        <pre className="lisensi">{sumberData.lisensiTanzil}</pre>
      </section>
    </>
  );
}
