import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

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
                Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges
                Anliegen. In dieser Datenschutzerklärung informieren wir Sie
                darüber, wie wir personenbezogene Daten im Rahmen dieser Website
                bearbeiten.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Verantwortliche Stelle</h3>
              <p className="text-muted-foreground">
                Verantwortlich für die Datenbearbeitung auf dieser Website ist:
              </p>
              <p className="mt-2">
                Jogge di Balla
                <br />
                Martisackerweg 18
                <br />
                4203 Grellingen, Schweiz
                <br />
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
                  Diese Daten werden nicht mit anderen Datenquellen
                  zusammengeführt und nach angemessener Zeit automatisch
                  gelöscht.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">5. Kontaktformular</h3>
              <p className="text-muted-foreground">
                Wenn Sie uns per Kontaktformular kontaktieren, werden die von
                Ihnen angegebenen Daten (z. B. Name, E-Mail-Adresse, Nachricht)
                zur Bearbeitung Ihrer Anfrage gespeichert. Diese Daten werden
                nicht an Dritte weitergegeben und ausschliesslich zur
                Bearbeitung Ihres Anliegens verwendet.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">6. Ihre Rechte</h3>
              <p className="text-muted-foreground">
                Sie haben im Rahmen der geltenden Datenschutzgesetze das Recht
                auf Auskunft über die zu Ihrer Person gespeicherten Daten sowie
                auf Berichtigung oder Löschung dieser Daten. Anfragen richten
                Sie bitte an die oben angegebene Kontaktadresse.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                7. Fotografie an Veranstaltungen
              </h3>
              <p className="text-muted-foreground">
                An unseren Veranstaltungen werden Fotos und Videos erstellt,
                welche für unsere Website, Social Media sowie
                Vereinskommunikation verwendet werden. Die Veröffentlichung
                erfolgt auf Grundlage unseres berechtigten Interesses an der
                Öffentlichkeitsarbeit gemäss Art. 6 Abs. 1 lit. f DSGVO bzw.
                Art. 13 DSG (Schweiz).
              </p>
              <p className="text-muted-foreground mt-2">
                Personen, die nicht fotografiert werden möchten oder mit einer
                Veröffentlichung nicht einverstanden sind, können dies jederzeit
                unserem Team vor Ort mitteilen oder nachträglich eine Entfernung
                der Aufnahmen verlangen. Wenden Sie sich hierzu bitte an die
                oben angegebene Kontaktadresse.
              </p>
              <p className="text-muted-foreground mt-2">
                <span className="font-semibold text-foreground">
                  Live-Diashow (Foto-Uploads durch Gäste):
                </span>{' '}
                An einzelnen Veranstaltungen können Gäste über einen QR-Code
                eigene Fotos hochladen, die anschliessend öffentlich auf der
                Event-Leinwand angezeigt werden. Mit dem Hochladen bestätigt die
                hochladende Person, dass sie zur Veröffentlichung der Bilder
                berechtigt ist. Zur Verhinderung von Missbrauch wird beim Upload
                die IP-Adresse der hochladenden Person gespeichert. Die
                Live-Diashow wird nach der Veranstaltung beendet; die
                hochgeladenen Fotos bewahren wir als Andenken auf und können
                jederzeit auf Anfrage über die oben angegebene Kontaktadresse
                entfernt werden.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">8. Schriftarten</h3>
              <p className="text-muted-foreground">
                Diese Website verwendet die Schriftart «Inter», die direkt vom
                eigenen Server ausgeliefert wird. Es findet kein Abruf von
                externen Schriftarten-Diensten (z.&nbsp;B. Google Fonts) statt;
                Ihre IP-Adresse wird dafür nicht an Dritte übermittelt.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">9. Google Analytics</h3>
              <p className="text-muted-foreground">
                Diese Website verwendet Google Analytics, einen Webanalysedienst
                der Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA
                94043, USA. Google Analytics verwendet Cookies und ähnliche
                Technologien, um die Nutzung der Website zu analysieren und
                Berichte über die Websiteaktivität zu erstellen. Die dabei
                erhobenen Daten (u.a. IP-Adresse, aufgerufene Seiten,
                Verweildauer, Geräteinformationen) werden an Server von Google
                in den USA übertragen.
              </p>
              <p className="text-muted-foreground mt-2">
                Wir haben die IP-Anonymisierung aktiviert, sodass Ihre
                IP-Adresse vor der Übermittlung an Google gekürzt wird. Die
                Verarbeitung erfolgt auf Grundlage unseres berechtigten
                Interesses an der statistischen Auswertung der Websitenutzung
                zur Verbesserung unseres Angebots (Art. 6 Abs. 1 lit. f DSGVO
                bzw. Art. 13 DSG). Google LLC ist unter dem EU-US Data Privacy
                Framework zertifiziert.
              </p>
              <p className="text-muted-foreground mt-2">
                Sie können die Erfassung durch Google Analytics verhindern,
                indem Sie das Browser-Add-on zur Deaktivierung von Google
                Analytics installieren:{' '}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  tools.google.com/dlpage/gaoptout
                </a>
              </p>
              <p className="text-muted-foreground mt-2">
                Weitere Informationen zum Datenschutz bei Google finden Sie
                unter:{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  policies.google.com/privacy
                </a>
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">10. Bildrechte</h3>
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
