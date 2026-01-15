import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";

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
            <CardTitle>Angaben gemäß § 5 TMG</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Verein</h3>
              <p>Jogge di Balla</p>
              <p>Since 2022</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Vertreten durch</h3>
              <p>[Name des Vorstands/Verantwortlichen]</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Kontakt</h3>
              <p>E-Mail: [kontakt@joggediballa.de]</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Registereintrag</h3>
              <p>[Falls eingetragen: Vereinsregister-Nummer]</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h3>
              <p>[Name und Anschrift des Verantwortlichen]</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Haftungsausschluss</h3>
              <div className="space-y-3 text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground">Haftung für Inhalte</h4>
                  <p>
                    Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, 
                    Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. 
                    Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten 
                    nach den allgemeinen Gesetzen verantwortlich.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">Haftung für Links</h4>
                  <p>
                    Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen 
                    Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. 
                    Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der 
                    Seiten verantwortlich.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">Urheberrecht</h4>
                  <p>
                    Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen 
                    dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art 
                    der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen 
                    Zustimmung des jeweiligen Autors bzw. Erstellers.
                  </p>
                  <p className="mt-2">
                    <strong>Fotos:</strong> Alle Fotos auf dieser Website sind urheberrechtlich geschützt 
                    und © Manuel Heller. Jegliche Verwendung bedarf der ausdrücklichen Genehmigung.
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
