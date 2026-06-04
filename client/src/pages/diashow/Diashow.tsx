import { useParams } from 'wouter';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { buildSlides, shuffle, type LayoutPhoto } from '@/lib/slideshow-layout';

function useScreenAR(): number {
  const [ar, setAr] = useState(
    typeof window !== 'undefined'
      ? window.innerWidth / window.innerHeight
      : 16 / 9,
  );
  useEffect(() => {
    const onResize = () => setAr(window.innerWidth / window.innerHeight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return ar;
}

function PhotoTile({
  photo,
  kenburns,
}: {
  photo: LayoutPhoto;
  kenburns: boolean;
}) {
  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <img
        src={photo.displayUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-50"
      />
      {kenburns ? (
        <motion.img
          src={photo.displayUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          initial={{ scale: 1.05, x: '-1%', y: '-1%' }}
          animate={{ scale: 1.15, x: '1%', y: '1%' }}
          transition={{ duration: 12, ease: 'linear' }}
        />
      ) : (
        <img
          src={photo.displayUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}
    </div>
  );
}

export default function Diashow() {
  const { token } = useParams<{ token: string }>();
  const screenAR = useScreenAR();

  const { data: state } = trpc.slideshow.publicState.useQuery(
    { token: token ?? '' },
    { refetchInterval: 3000, refetchIntervalInBackground: true, enabled: !!token },
  );

  const utils = trpc.useUtils();
  const { data: photos = [] } = trpc.slideshow.listApproved.useQuery(
    { token: token ?? '' },
    { enabled: !!token, refetchInterval: 60000 },
  );

  // Bei photoVersion-Änderung listApproved neu laden.
  const lastVersion = useRef<number>(-1);
  useEffect(() => {
    if (!state?.valid) return;
    if (state.photoVersion !== lastVersion.current) {
      lastVersion.current = state.photoVersion;
      utils.slideshow.listApproved.invalidate();
    }
  }, [state?.valid, state?.photoVersion, utils]);

  // Slide-Reihenfolge: gemischt, bei Bestandsänderung neu gemischt.
  const slides = useMemo(() => {
    if (photos.length === 0) return [];
    return buildSlides(shuffle(photos as LayoutPhoto[]), screenAR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length, screenAR]);

  const [index, setIndex] = useState(0);

  // Neu-Highlight: ein gerade dazugekommenes Bild bevorzugt als nächstes zeigen.
  const seenIds = useRef<Set<number>>(new Set());
  const [featured, setFeatured] = useState<LayoutPhoto | null>(null);
  useEffect(() => {
    if (photos.length === 0) return;
    const known = seenIds.current;
    const fresh = (photos as LayoutPhoto[]).filter(p => !known.has(p.id));
    photos.forEach(p => known.add(p.id));
    // Beim ersten Laden nicht highlighten (alles ist „neu").
    if (known.size === photos.length && fresh.length === photos.length) return;
    if (fresh.length > 0) setFeatured(fresh[fresh.length - 1]);
  }, [photos]);

  const durationMs = state?.valid ? state.slideDurationMs : 6000;
  const kenburns = state?.valid ? state.transition === 'kenburns' : true;

  // Timer für Slide-Wechsel.
  useEffect(() => {
    if (featured) {
      const t = setTimeout(() => setFeatured(null), Math.max(3500, durationMs));
      return () => clearTimeout(t);
    }
    if (slides.length === 0) return;
    const t = setTimeout(
      () => setIndex(i => (i + 1) % slides.length),
      durationMs,
    );
    return () => clearTimeout(t);
  }, [featured, index, slides.length, durationMs]);

  const uploadUrl =
    typeof window !== 'undefined' && token
      ? `${window.location.origin}/diashow/${token}/upload`
      : '';

  const showIdle =
    !state?.valid || !state.isVisible || (slides.length === 0 && !featured);

  const currentSlide = featured
    ? ({ kind: 'solo', photos: [featured] } as const)
    : slides[index % Math.max(1, slides.length)];

  const slideKey = featured
    ? `featured-${featured.id}`
    : `slide-${index}-${currentSlide?.photos.map(p => p.id).join('_')}`;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <SEO title="Diashow" noIndex />

      <AnimatePresence mode="wait">
        {showIdle ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-white gap-6"
          >
            <h1 className="text-4xl font-bold">
              {state?.valid && state.eventTitle ? state.eventTitle : 'Live-Diashow'}
            </h1>
            {uploadUrl && (
              <>
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG value={uploadUrl} size={220} />
                </div>
                <p className="text-xl opacity-80">Scan & lade deine Fotos hoch</p>
              </>
            )}
          </motion.div>
        ) : currentSlide ? (
          <motion.div
            key={slideKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 flex gap-1"
          >
            {currentSlide.photos.map(p => (
              <PhotoTile key={p.id} photo={p} kenburns={kenburns} />
            ))}
            {featured && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 bg-coral text-white px-4 py-2 rounded-full text-lg font-semibold shadow-lg"
              >
                ✨ Gerade hochgeladen
              </motion.div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* QR-Overlay unten im Eck */}
      {state?.valid && state.showQr && !showIdle && uploadUrl && (
        <div className="absolute bottom-5 right-5 bg-white/95 rounded-lg p-2 flex items-center gap-2 shadow-lg">
          <QRCodeSVG value={uploadUrl} size={84} />
          <span className="text-black text-xs max-w-[90px] leading-tight pr-1">
            Scan & lade dein Foto hoch
          </span>
        </div>
      )}
    </div>
  );
}
