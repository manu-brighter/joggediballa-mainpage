import { useParams } from 'wouter';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { StyledQr } from '@/components/StyledQr';
import { buildSlides, shuffle, type LayoutPhoto } from '@/lib/slideshow-layout';
import { QrCode } from 'lucide-react';

// QR styling for the dark beamer stage: dark teal-tinted modules on a warm
// off-white (never pure #000/#fff). The high lightness contrast keeps it
// reliably scannable from across a room; the teal tint ties it to the brand.
const QR_FG = 'oklch(0.22 0.05 200)';
const QR_BG = 'oklch(0.98 0.004 250)';

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
  const { data: photos = [], isLoading: photosLoading } =
    trpc.slideshow.listApproved.useQuery(
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
  // Signatur über die IDs (nicht nur die Länge), damit ein gelöschtes Foto auch
  // dann von der Bühne verschwindet, wenn die Anzahl gleich bleibt (z.B. Löschen
  // + Freigabe zwischen zwei Polls).
  const photoSig = photos.map(p => p.id).join(',');
  // Random order is computed ONCE per photo set — NOT re-randomized on viewport
  // changes. (Shuffling inside the AR-keyed memo jumped the deck mid-cycle every
  // time the AR flickered — e.g. a mobile address bar showing/hiding — which read
  // as "the slideshow switches far too fast".)
  const shuffledPhotos = useMemo(() => {
    return shuffle(photos as LayoutPhoto[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoSig]);
  // Layout (portrait grouping) depends on the viewport. Recomputing it on an AR
  // change keeps the same order, so the slide at the current index only changes
  // when the grouping genuinely changes (a real orientation change), not on flicker.
  const slides = useMemo(() => {
    return buildSlides(shuffledPhotos, screenAR);
  }, [shuffledPhotos, screenAR]);

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

  // While the queries are still loading the data needed to decide what to show,
  // render the bare black stage — never flash the idle/welcome screen before the
  // slideshow appears when the show is set visible.
  const initialLoading =
    !state || (state.valid && state.isVisible && photosLoading);
  const showIdle =
    !initialLoading &&
    (!state?.valid || !state.isVisible || (slides.length === 0 && !featured));

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
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
          >
            {/* Ambient brand glow so the stage isn't a flat black void. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 85% at 50% 16%, oklch(0.55 0.14 195 / 0.20), transparent 55%), radial-gradient(90% 70% at 50% 102%, oklch(0.68 0.18 18 / 0.13), transparent 60%)',
              }}
            />

            <div className="relative flex flex-col items-center gap-7">
              <img
                src="/JoggediBalla-Logo.PNG"
                alt=""
                className="h-20 w-auto drop-shadow-2xl"
                onError={e => (e.currentTarget.style.display = 'none')}
              />

              <div className="flex items-center gap-2.5 text-primary">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
                <span className="text-sm font-semibold uppercase tracking-[0.3em]">
                  Live
                </span>
              </div>

              <motion.h1
                animate={{
                  textShadow: [
                    '0 0 18px oklch(0.55 0.14 195 / 0.25)',
                    '0 0 38px oklch(0.55 0.14 195 / 0.55)',
                    '0 0 18px oklch(0.55 0.14 195 / 0.25)',
                  ],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-7xl"
              >
                {state?.valid && state.eventTitle
                  ? state.eventTitle
                  : 'Live-Diashow'}
              </motion.h1>

              {uploadUrl && (
                <div className="mt-1 flex flex-col items-center gap-5">
                  {/* QR stays pixel-stable (no scaling) so even slower phone
                      cameras lock focus and scan reliably. */}
                  <div
                    className="rounded-[2rem] p-5 ring-1 ring-primary/30"
                    style={{
                      backgroundColor: QR_BG,
                      boxShadow: '0 24px 80px -16px oklch(0.55 0.14 195 / 0.5)',
                    }}
                  >
                    <StyledQr
                      value={uploadUrl}
                      size={260}
                      fgColor={QR_FG}
                      bgColor={QR_BG}
                    />
                  </div>
                  <p className="flex items-center gap-2.5 text-lg font-medium text-white/85">
                    <QrCode className="size-5 text-primary" />
                    Scan & lade deine Fotos hoch
                  </p>
                </div>
              )}
            </div>
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

      {/* QR-Overlay unten im Eck — themed dark chip, not a stark white box. */}
      {state?.valid && state.showQr && !showIdle && uploadUrl && (
        <div
          className="absolute bottom-6 right-6 flex items-center gap-3 rounded-2xl p-3 pr-4 ring-1 ring-white/10"
          style={{
            backgroundColor: 'oklch(0.16 0.015 260 / 0.92)',
            boxShadow: '0 16px 50px -12px oklch(0.10 0.02 260 / 0.7)',
          }}
        >
          <div className="rounded-xl p-2" style={{ backgroundColor: QR_BG }}>
            <StyledQr
              value={uploadUrl}
              size={74}
              fgColor={QR_FG}
              bgColor={QR_BG}
            />
          </div>
          <div className="max-w-[130px] leading-tight">
            <p className="text-sm font-semibold text-white">
              Dein Foto auf die Leinwand
            </p>
            <p className="text-xs font-medium text-primary">Scan & lade hoch</p>
          </div>
        </div>
      )}
    </div>
  );
}
