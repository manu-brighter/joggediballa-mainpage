import { useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';

// Brand QR colours for the dark stage: dark teal-tinted modules on a warm
// off-white (never pure #000/#fff). High lightness contrast keeps it scannable.
export const QR_FG = 'oklch(0.22 0.05 200)';
export const QR_BG = 'oklch(0.98 0.004 250)';

type StyledQrProps = {
  value: string;
  size: number;
  fgColor?: string;
  bgColor?: string;
};

/**
 * Branded QR with rounded modules + rounded finder corners (qr-code-styling).
 * Error-correction level Q + high colour contrast keep it reliably scannable
 * despite the rounding, including on slower phone cameras.
 */
function buildOptions(value: string, size: number, fg: string, bg: string) {
  return {
    width: size,
    height: size,
    type: 'svg' as const,
    data: value,
    margin: 0,
    qrOptions: { errorCorrectionLevel: 'Q' as const },
    backgroundOptions: { color: bg },
    dotsOptions: { color: fg, type: 'rounded' as const },
    cornersSquareOptions: { color: fg, type: 'extra-rounded' as const },
    cornersDotOptions: { color: fg, type: 'dot' as const },
  };
}

export function StyledQr({
  value,
  size,
  fgColor = QR_FG,
  bgColor = QR_BG,
}: StyledQrProps) {
  const container = useRef<HTMLDivElement>(null);
  const qr = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!container.current) return;
    qr.current = new QRCodeStyling(buildOptions(value, size, fgColor, bgColor));
    container.current.innerHTML = '';
    qr.current.append(container.current);
    return () => {
      if (container.current) container.current.innerHTML = '';
      qr.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    qr.current?.update(buildOptions(value, size, fgColor, bgColor));
  }, [value, size, fgColor, bgColor]);

  return (
    <div
      ref={container}
      aria-hidden
      style={{ width: size, height: size, lineHeight: 0 }}
    />
  );
}
