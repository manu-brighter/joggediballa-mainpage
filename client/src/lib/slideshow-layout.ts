export type LayoutPhoto = {
  id: number;
  displayUrl: string;
  width: number;
  height: number;
};

export type Slide =
  | { kind: 'solo'; photos: [LayoutPhoto] }
  | { kind: 'portrait-row'; photos: LayoutPhoto[] };

const PORTRAIT_THRESHOLD = 1.2; // height/width >= 1.2 → Hochformat

function isPortrait(p: LayoutPhoto): boolean {
  return p.width > 0 && p.height / p.width >= PORTRAIT_THRESHOLD;
}

/**
 * Baut aus der (bereits geordneten/gemischten) Foto-Liste „Slides".
 * Querformat/Quadrat → solo. Aufeinanderfolgende Hochformate werden zu
 * k nebeneinander gruppiert (k passend zum Screen-Seitenverhältnis, 1–3),
 * damit sie die Breite füllen statt schwarzer Balken.
 */
export function buildSlides(photos: LayoutPhoto[], screenAR: number): Slide[] {
  const slides: Slide[] = [];
  let i = 0;
  while (i < photos.length) {
    const p = photos[i];
    if (isPortrait(p)) {
      const singleAR = p.width / p.height; // < 1 bei Hochformat
      let k = Math.round(screenAR / singleAR);
      k = Math.max(1, Math.min(3, k));
      const group: LayoutPhoto[] = [];
      while (group.length < k && i < photos.length && isPortrait(photos[i])) {
        group.push(photos[i]);
        i++;
      }
      slides.push({ kind: 'portrait-row', photos: group });
    } else {
      slides.push({ kind: 'solo', photos: [p] });
      i++;
    }
  }
  return slides;
}

/** Fisher-Yates mit injizierbarem RNG (für Determinismus testbar). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(rng() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}
