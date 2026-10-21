// Angka atau judul besar. Efek pelat cetak Broadsheet (K-38) dihapus pada tampilan
// Kartu Modern (K-48); komponen tetap dipakai agar pemanggilnya tidak berubah.
export default function Plat({
  teks,
  jenis = 'num',
  as: Tag = 'div',
  className = '',
  style,
}: {
  teks: string;
  jenis?: 'num' | 'head';
  as?: 'div' | 'h1' | 'h2' | 'p' | 'span';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Tag className={`${jenis === 'num' ? 'angka-besar' : 'judul-besar'} ${className}`} style={style}>
      {teks}
    </Tag>
  );
}
