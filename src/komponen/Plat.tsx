// Efek "plate cetak" Broadsheet (K-38): teks dicetak sebagai tiga pelat C/M/Y yang
// sedikit bergeser. Hanya untuk angka dan judul besar berhuruf Latin, bukan teks Arab.
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
    <Tag className={`cmyk-${jenis} ${className}`} style={style}>
      <span className="paper">{teks}</span>
      <span className="plate plate-c" aria-hidden="true">
        {teks}
      </span>
      <span className="plate plate-m" aria-hidden="true">
        {teks}
      </span>
      <span className="plate plate-y" aria-hidden="true">
        {teks}
      </span>
    </Tag>
  );
}
