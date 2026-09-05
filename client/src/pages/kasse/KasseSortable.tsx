import type { ReactNode } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/**
 * Anfasser fürs Sortieren. Bewusst eine eigene kleine Fläche statt der ganzen
 * Zeile: die Verwaltung läuft auch auf dem Handy, wo eine ziehbare Zeile beim
 * Scrollen ständig Produkte verschöbe. `touch-none` ist Pflicht — ohne
 * `touch-action: none` nimmt der Browser die Geste als Scroll und der Zug
 * kommt nie beim Sortieren an.
 */
export type DragHandleProps = {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
};

export function DragHandle({
  label,
  handle,
  className = '',
}: {
  label: string;
  handle: DragHandleProps;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing ${className}`}
      {...handle.attributes}
      {...handle.listeners}
    >
      <GripVertical className="h-5 w-5" />
    </button>
  );
}

/**
 * Sortierbare Zeile. Gibt den Anfasser als Render-Prop heraus, damit der
 * Inhalt dort stehen bleibt, wo er hingehört (in KasseControl), statt in einer
 * Komponente mit fünfzehn Props zu landen.
 */
export function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: DragHandleProps) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // Beim Ziehen nach vorn holen, sonst schiebt sich die Zeile unter die
      // nächste; leicht transparent, damit man das Ziel darunter noch sieht.
      className={isDragging ? 'relative z-10 opacity-80' : undefined}
    >
      {children({ attributes, listeners })}
    </div>
  );
}
