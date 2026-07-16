import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import { useLocation } from 'wouter';
import { Clock } from 'lucide-react';

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
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.5]"
        style={{
          backgroundImage: 'url(/joggediballa-pattern.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: '1129px 610px',
        }}
      />
      <div className="relative z-10 text-center space-y-6 max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Clock className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black gradient-text">
          Anmeldefrist vorbei
        </h1>
        <p className="text-lg text-muted-foreground">
          Die Anmeldung für den Harassenlauf ist leider bereits geschlossen.
        </p>
        <Button size="lg" className="btn-animate" onClick={() => navigate('/')}>
          Zurück zur Homepage
        </Button>
      </div>
    </div>
  );
}
