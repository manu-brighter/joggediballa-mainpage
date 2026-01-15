import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Send, CheckCircle } from "lucide-react";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Hidden field for spam protection
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.contact.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Nachricht erfolgreich gesendet!");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setHoneypot("");
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Bitte fülle alle Pflichtfelder aus");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Bitte gib eine gültige E-Mail-Adresse ein");
      return;
    }

    submitMutation.mutate({
      name,
      email,
      subject,
      message,
      honeypot, // Will be checked server-side
    });
  };

  if (submitted) {
    return (
      <div className="container py-12">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <CheckCircle className="h-24 w-24 text-green-500 mx-auto" />
          <h1 className="text-4xl font-bold">Nachricht gesendet!</h1>
          <p className="text-lg text-muted-foreground">
            Vielen Dank für deine Nachricht. Wir werden uns so schnell wie möglich bei dir melden.
          </p>
          <Button onClick={() => setSubmitted(false)} variant="outline">
            Weitere Nachricht senden
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12 space-y-8">
      <div className="text-center space-y-4">
        <Mail className="h-16 w-16 text-primary mx-auto" />
        <h1 className="text-4xl md:text-5xl font-bold">Kontakt</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Hast du Fragen, Anregungen oder möchtest du Teil von Jogge di Balla werden? 
          Schreib uns eine Nachricht!
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Kontaktformular</CardTitle>
            <CardDescription>
              Fülle das Formular aus und wir melden uns bei dir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot field - hidden from users */}
              <div className="hidden" aria-hidden="true">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="text"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dein Name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  E-Mail <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deine@email.de"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Betreff</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Worum geht es?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">
                  Nachricht <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Deine Nachricht an uns..."
                  rows={6}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  "Wird gesendet..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Nachricht senden
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Für Foto-Anfragen oder Bildrechte kontaktiere bitte direkt:{" "}
            <span className="font-medium">Manuel Heller</span>
          </p>
        </div>
      </div>
    </div>
  );
}
