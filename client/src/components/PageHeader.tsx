import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Brand page header for public surfaces (Team, Events, Sponsors, ...).
 *
 * Deliberately plain: title, lead, optional admin actions. The header used to
 * carry a coloured kicker pill above the H1 plus a staggered entrance — both
 * are stock "AI landing page" signals and were removed. Hierarchy now comes
 * from type size alone.
 *
 * Accent words inside `title` use a solid accent colour
 * (`<span className="text-primary">` / `text-coral`); `gradient-text` stays
 * reserved for brand words in bespoke heroes (Home, Harassenlauf,
 * Shotcounter), which do not use this component.
 */
interface PageHeaderProps {
  title: ReactNode;
  lead?: ReactNode;
  /** Optional right-aligned slot for admin actions (dialog triggers etc.). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  lead,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="space-y-3">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-balance">
          {title}
        </h1>
        {lead && (
          <p className="text-lg text-muted-foreground max-w-2xl">{lead}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 md:justify-end">{actions}</div>}
    </div>
  );
}
