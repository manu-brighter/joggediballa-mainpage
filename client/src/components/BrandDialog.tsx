import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';

interface BrandDialogProps {
  title?: string;
  description?: string;
  logo?: string;
  open?: boolean;
  onConfirm: () => void;
  confirmLabel?: string;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

/** Branded confirmation dialog using semantic tokens (dark-mode aware). */
export function BrandDialog({
  title,
  description,
  logo,
  open = false,
  onConfirm,
  confirmLabel = 'Bestätigen',
  onOpenChange,
  onClose,
}: BrandDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open);

  useEffect(() => {
    if (!onOpenChange) {
      setInternalOpen(open);
    }
  }, [open, onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      onClose?.();
    }
  };

  return (
    <Dialog
      open={onOpenChange ? open : internalOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="py-5 bg-card text-card-foreground rounded-[20px] w-[400px] shadow-lg border backdrop-blur-2xl p-0 gap-0 text-center">
        <div className="flex flex-col items-center gap-2 p-5 pt-12">
          {logo ? (
            <div className="w-16 h-16 bg-background rounded-xl border flex items-center justify-center">
              <img
                src={logo}
                alt=""
                aria-hidden="true"
                className="w-10 h-10 rounded-md"
              />
            </div>
          ) : null}

          <DialogTitle
            className={
              title
                ? 'text-xl font-semibold text-foreground leading-[26px] tracking-[-0.44px]'
                : 'sr-only'
            }
          >
            {title || 'Dialog'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-5 tracking-[-0.154px]">
            {description}
          </DialogDescription>
        </div>

        <DialogFooter className="px-5 py-5">
          <Button
            onClick={onConfirm}
            className="w-full h-10 rounded-[10px] text-sm font-medium leading-5 tracking-[-0.154px]"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
