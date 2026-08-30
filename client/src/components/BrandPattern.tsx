import { cn } from '@/lib/utils';

/**
 * The club's doodle pattern (palms, fireworks, cocktails, cards) as a quiet
 * surface texture. It already carried the Home hero; reusing it on invitation
 * surfaces — the Gönner card, the services CTA — is what keeps those blocks
 * from reading as plain bordered boxes.
 *
 * Two things keep it from fighting the copy: it stays far below text contrast
 * (much fainter than the hero's own overlay), and it fades out toward the
 * bottom so the reading area stays clean. Decorative only, so it is hidden
 * from assistive tech and sits behind content via a negative z-index.
 */
export function BrandPattern({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'brand-pattern-sm pointer-events-none absolute inset-0 z-0 opacity-[0.04] dark:opacity-[0.14]',
        className,
      )}
      style={{
        maskImage:
          'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
      }}
    />
  );
}
