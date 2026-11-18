import { useEffect, useState } from 'react';
import QR from 'qrcode';

export function QrCode({ text, className = 'size-[150px]' }: { text: string; className?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QR.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0F1A19', light: '#FFFFFF' } }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [text]);
  return (
    <div
      className={`rounded-2xl bg-white p-2.5 [&>svg]:size-full ${className}`}
      role="img"
      aria-label={`Kod QR: ${text}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
