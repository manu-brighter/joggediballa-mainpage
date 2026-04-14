import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Scale } from 'lucide-react';

export default function Impressum() {
  return (
    <div className="container py-12 space-y-8">
      <div className="text-center space-y-4">
        <Scale className="h-16 w-16 text-primary mx-auto" />
        <h1 className="text-4xl md:text-5xl font-bold">Impressum</h1>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Impressum</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Verein</h3>
              <p>Jogge di Balla</p>
              <p>Event- und Kulturverein</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                Vertretungsberechtigte Person
              </h3>
              <p>Manuel Heller</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Adresse</h3>
              <p>Martisackerweg 18</p>
              <p>4203 Grellingen</p>
              <p>Schweiz</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Kontakt</h3>
              <p>E-Mail: joggediballa@gmail.com</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Vereinsregister</h3>
              <p>
                Eintrag im Vereinsregister der Gemeinde Brislach:&nbsp;
                <a
                  href="https://www.brislach.ch/vereinsliste/86332"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Zum Registereintrag
                </a>
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Haftungsausschluss</h3>
              <div className="space-y-4 text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground">
                    Haftung für Inhalte
                  </h4>
                  <p>
                    Die Inhalte dieser Website wurden mit grösstmöglicher
                    Sorgfalt erstellt. Der Verein Jogge di Balla übernimmt
                    jedoch keine Gewähr für die Richtigkeit, Vollständigkeit und
                    Aktualität der bereitgestellten Inhalte.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">
                    Haftung für Links
                  </h4>
                  <p>
                    Diese Website enthält Links zu externen Websites Dritter,
                    auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte
                    der verlinkten Seiten ist stets der jeweilige Anbieter oder
                    Betreiber verantwortlich.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">Urheberrecht</h4>
                  <p>
                    Die Inhalte und Werke auf dieser Website unterliegen dem
                    schweizerischen Urheberrecht. Jede Art der Verwertung
                    ausserhalb der Grenzen des Urheberrechts bedarf der
                    vorherigen schriftlichen Zustimmung des jeweiligen
                    Rechteinhabers.
                  </p>
                  <p className="mt-2">
                    <strong>Fotos:</strong> Eigene Fotos auf dieser Website sind
                    urheberrechtlich geschützt und © Manuel Heller. Die
                    Verwendung von Bildern Dritter erfolgt mit entsprechender
                    Lizenz oder Genehmigung.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
