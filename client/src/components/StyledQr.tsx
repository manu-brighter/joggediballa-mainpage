import { useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';

type StyledQrProps = {
  value: string;
  size: number;
  /** Module / corner color (high contrast vs bgColor for scannability). */
  fgColor: string;
  bgColor: string;
};

/**
 * Branded QR with rounded modules + rounded finder corners (qr-code-styling).
 * Error-correction level Q + high colour contrast keep it reliably scannable
 * despite the rounding, including on slower phone cameras.
 */
function buildOptions({ value, size, fgColor, bgColor }: StyledQrProps) {
  return {
    width: size,
    height: size,
    type: 'svg' as const,
    data: value,
    margin: 0,
    qrOptions: { errorCorrectionLevel: 'Q' as const },
    backgroundOptions: { color: bgColor },
    dotsOptions: { color: fgColor, type: 'rounded' as const },
    cornersSquareOptions: { color: fgColor, type: 'extra-rounded' as const },
    cornersDotOptions: { color: fgColor, type: 'dot' as const },
  };
}

export function StyledQr(props: StyledQrProps) {
  const container = useRef<HTMLDivElement>(null);
  const qr = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!container.current) return;
    qr.current = new QRCodeStyling(buildOptions(props));
    container.current.innerHTML = '';
    qr.current.append(container.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    qr.current?.update(buildOptions(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, props.size, props.fgColor, props.bgColor]);

  return (
    <div
      ref={container}
      aria-hidden
      style={{ width: props.size, height: props.size, lineHeight: 0 }}
    />
  );
}
