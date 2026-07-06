import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const MotionDiv = motion.div;
const MotionSpan = motion.span;
const MotionH1 = motion.h1;
const MotionP = motion.p;

// Staggered entrance: kicker -> title -> lead -> actions. Final state is
// identical to the unanimated layout, so visual baselines stay stable.
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] },
  },
};

/**
 * Brand page header for public surfaces (Team, Events, Sponsors, ...).
 *
 * Vocabulary (see docs/superpowers/specs/2026-07-06-brand-page-headers-design.md):
 * - Kicker pill reuses the Home-hero badge pattern; color follows the
 *   surface voice (two-voice rule: one accent per surface).
 * - Accent words inside `title` use SOLID accent color
 *   (`<span className="text-primary">` / `text-coral`) — `gradient-text`
 *   stays reserved for brand words in bespoke heroes.
 * - Bespoke heroes (Home, Harassenlauf, Shotcounter) do not use this
 *   component.
 */
interface PageHeaderProps {
  /** Short factual label shown in the kicker pill, e.g. "Der Verein". */
  kicker: string;
  kickerIcon?: LucideIcon;
  title: ReactNode;
  lead?: ReactNode;
  /** Surface accent voice — one per surface. Defaults to primary (teal). */
  voice?: 'primary' | 'coral';
  /** Optional right-aligned slot for admin actions (dialog triggers etc.). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  kicker,
  kickerIcon: KickerIcon,
  title,
  lead,
  voice = 'primary',
  actions,
  className,
}: PageHeaderProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <MotionDiv
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
      variants={stagger}
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="space-y-4 text-center md:text-left">
        <MotionSpan
          variants={rise}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold',
            voice === 'coral'
              ? 'bg-coral/10 text-coral'
              : 'bg-primary/10 text-primary',
          )}
        >
          {KickerIcon && <KickerIcon className="h-4 w-4" aria-hidden="true" />}
          {kicker}
        </MotionSpan>
        <MotionH1
          variants={rise}
          className="text-4xl md:text-5xl font-black tracking-tight text-balance"
        >
          {title}
        </MotionH1>
        {lead && (
          <MotionP
            variants={rise}
            className="text-lg text-muted-foreground max-w-2xl mx-auto md:mx-0"
          >
            {lead}
          </MotionP>
        )}
      </div>
      {actions && (
        <MotionDiv
          variants={rise}
          className="flex shrink-0 justify-center md:justify-end"
        >
          {actions}
        </MotionDiv>
      )}
    </MotionDiv>
  );
}
