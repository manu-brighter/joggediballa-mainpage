import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Home } from 'lucide-react';
import { useLocation } from 'wouter';

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg fade-in motion-reduce:animate-none">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="absolute inset-0 bg-destructive/10 rounded-full animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
              <AlertCircle
                className="relative h-16 w-16 text-destructive"
                aria-hidden="true"
              />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>

          <h2 className="text-xl font-semibold text-foreground mb-4">
            Diese Seite gibt's nicht
          </h2>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            Kein Plan was hier mal stand. Vielleicht wurde die Seite verschoben
            oder existiert nicht mehr. ¯\_(ツ)_/¯
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button onClick={handleGoHome}>
              <Home className="w-4 h-4 mr-2" aria-hidden="true" />
              Zurück zur Startseite
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
