import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import { Clock } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Harassenlauf() {
  const [, navigate] = useLocation();

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <SEO
        title="Harassenlauf – Anmeldefrist vorbei | Jogge di Balla"
        description="Die Anmeldefrist für den Harassenlauf ist abgelaufen."
        noIndex
      />
      <div className="absolute inset-0 hero-gradient" />
      <div className="brand-pattern pattern-drift absolute inset-0 opacity-[0.03] dark:opacity-[0.5]" />
      <div className="relative z-10 text-center space-y-6 max-w-md">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black gradient-text">
          Anmeldefrist vorbei
        </h1>
        <p className="text-lg text-muted-foreground">
          Die Anmeldung für den Harassenlauf ist geschlossen.
        </p>
        <Button size="lg" className="btn-animate" onClick={() => navigate('/')}>
          Zurück zur Homepage
        </Button>
      </div>
    </div>
  );
}
