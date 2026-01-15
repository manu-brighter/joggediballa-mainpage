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
              <h3 className="font-semibold mb-2">1. Datenschutz auf einen Blick</h3>
              <div className="space-y-3 text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground">Allgemeine Hinweise</h4>
                  <p>
                    Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren 
                    personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene 
                    Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">Datenerfassung auf dieser Website</h4>
                  <p>
                    <strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong>
                  </p>
                  <p>
                    Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. 
                    Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Hosting</h3>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  Diese Website wird extern gehostet. Die personenbezogenen Daten, die auf dieser 
                  Website erfasst werden, werden auf den Servern des Hosters gespeichert. Hierbei 
                  kann es sich v. a. um IP-Adressen, Kontaktanfragen, Meta- und Kommunikationsdaten, 
                  Vertragsdaten, Kontaktdaten, Namen, Websitezugriffe und sonstige Daten, die über 
                  eine Website generiert werden, handeln.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Allgemeine Hinweise und Pflichtinformationen</h3>
              <div className="space-y-3 text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground">Datenschutz</h4>
                  <p>
                    Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. 
                    Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den 
                    gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">Hinweis zur verantwortlichen Stelle</h4>
                  <p>
                    Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:
                  </p>
                  <p className="mt-2">
                    Jogge di Balla<br />
                    [Adresse]<br />
                    [E-Mail]
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">4. Datenerfassung auf dieser Website</h3>
              <div className="space-y-3 text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground">Kontaktformular</h4>
                  <p>
                    Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben 
                    aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten 
                    zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns 
                    gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
                  </p>
                  <p className="mt-2">
                    Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, 
                    sofern Ihre Anfrage mit der Erfüllung eines Vertrags zusammenhängt oder zur 
                    Durchführung vorvertraglicher Maßnahmen erforderlich ist. In allen übrigen Fällen 
                    beruht die Verarbeitung auf unserem berechtigten Interesse an der effektiven 
                    Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO).
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">Server-Log-Dateien</h4>
                  <p>
                    Der Provider der Seiten erhebt und speichert automatisch Informationen in so 
                    genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. 
                    Dies sind:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Browsertyp und Browserversion</li>
                    <li>verwendetes Betriebssystem</li>
                    <li>Referrer URL</li>
                    <li>Hostname des zugreifenden Rechners</li>
                    <li>Uhrzeit der Serveranfrage</li>
                    <li>IP-Adresse</li>
                  </ul>
                  <p className="mt-2">
                    Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">5. Ihre Rechte</h3>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten 
                  personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der 
                  Datenverarbeitung sowie ein Recht auf Berichtigung oder Löschung dieser Daten. 
                  Hierzu sowie zu weiteren Fragen zum Thema personenbezogene Daten können Sie sich 
                  jederzeit an uns wenden.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">6. Bildrechte</h3>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  Alle auf dieser Website veröffentlichten Fotos sind urheberrechtlich geschützt 
                  und © Manuel Heller. Die Verwendung, Vervielfältigung oder Weitergabe der Bilder 
                  ohne ausdrückliche Genehmigung ist nicht gestattet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
