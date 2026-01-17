import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function Datenschutz() {
  return (
    <div className="container py-12 space-y-8">
      <div className="text-center space-y-4">
        <Shield className="h-16 w-16 text-primary mx-auto" />
        <h1 className="text-4xl md:text-5xl font-bold">Datenschutzerklärung</h1>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Datenschutz</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2">1. Allgemeine Hinweise</h3>
              <p className="text-muted-foreground">
                Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges Anliegen.
                In dieser Datenschutzerklärung informieren wir Sie darüber, wie wir
                personenbezogene Daten im Rahmen dieser Website bearbeiten.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Verantwortliche Stelle</h3>
              <p className="text-muted-foreground">
                Verantwortlich für die Datenbearbeitung auf dieser Website ist:
              </p>
              <p className="mt-2">
                Jogge di Balla<br />
                Martisackerweg 18<br />
                4203 Grellingen, Schweiz<br />
                E-Mail: joggediballa@gmail.com
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Hosting</h3>
              <p className="text-muted-foreground">
                Diese Website wird auf einem selbst gehosteten Server betrieben.
                Beim Besuch der Website können technische Daten wie IP-Adresse,
                Zeitpunkt des Zugriffs, Browsertyp und Betriebssystem erfasst
                werden. Diese Daten dienen ausschliesslich dem sicheren und
                stabilen Betrieb der Website.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">4. Server-Log-Dateien</h3>
              <div className="text-muted-foreground space-y-2">
                <p>
                  Der Server erhebt und speichert automatisch Informationen in
                  sogenannten Server-Log-Dateien. Dies sind insbesondere:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>IP-Adresse</li>
                  <li>Datum und Uhrzeit der Anfrage</li>
                  <li>Browsertyp und -version</li>
                  <li>Betriebssystem</li>
                  <li>Referrer URL</li>
                </ul>
                <p>
                  Diese Daten werden nicht mit anderen Datenquellen zusammengeführt
                  und nach angemessener Zeit automatisch gelöscht.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">5. Kontaktformular</h3>
              <p className="text-muted-foreground">
                Wenn Sie uns per Kontaktformular kontaktieren, werden die von Ihnen
                angegebenen Daten (z. B. Name, E-Mail-Adresse, Nachricht) zur
                Bearbeitung Ihrer Anfrage gespeichert. Diese Daten werden nicht
                an Dritte weitergegeben und ausschliesslich zur Bearbeitung Ihres
                Anliegens verwendet.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">6. Ihre Rechte</h3>
              <p className="text-muted-foreground">
                Sie haben im Rahmen der geltenden Datenschutzgesetze das Recht auf
                Auskunft über die zu Ihrer Person gespeicherten Daten sowie auf
                Berichtigung oder Löschung dieser Daten. Anfragen richten Sie
                bitte an die oben angegebene Kontaktadresse.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">7. Bildrechte</h3>
              <p className="text-muted-foreground">
                Eigene Fotos auf dieser Website sind urheberrechtlich geschützt
                und © Manuel Heller. Die Verwendung von Bildern Dritter erfolgt
                mit entsprechender Lizenz oder Genehmigung.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
