// Pintasan keyboard untuk laptop (K-43): Spasi menekan tombol utama di bilah bawah
// (mulai rekam, selesai ayat, simpan koreksi, benar, dan seterusnya). Diabaikan saat
// mengetik di kotak isian atau saat lembar/dialog terbuka.
export function pasangPapanKetik() {
  window.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const sasaran = e.target as HTMLElement | null;
    if (sasaran?.closest('input, textarea, select, [contenteditable="true"], button')) return;
    if (document.querySelector('.latar-lembar')) return;
    const tombol = document.querySelector<HTMLButtonElement>('.bilah-aksi .tombol.utama:not(:disabled)');
    if (!tombol) return;
    e.preventDefault();
    tombol.click();
  });
}
