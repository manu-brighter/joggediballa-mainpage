import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/lib/errorMessages';
import { Mail, Send, CheckCircle } from 'lucide-react';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.contact.send.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Nachricht erfolgreich gesendet!');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    },
    onError: (error: any) => {
      toast.error(parseErrorMessage(error));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Bitte fülle alle Pflichtfelder aus');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Bitte gib eine gültige E-Mail-Adresse ein');
      return;
    }

    submitMutation.mutate({
      name,
      email,
      subject: subject || 'Kein Betreff',
      message,
    });
  };

  if (submitted) {
    return (
      <div className="container py-12">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <CheckCircle className="h-24 w-24 text-green-500 mx-auto" />
          <h1 className="text-4xl font-bold">Nachricht gesendet!</h1>
          <p className="text-lg text-muted-foreground">
            Vielen Dank für deine Nachricht. Wir werden uns so schnell wie
            möglich bei dir melden.
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
          Hast du Fragen, Anregungen oder möchtest auf eines unserer Angebote
          eingehen? Schreib uns eine Nachricht!
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
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
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
                  onChange={e => setEmail(e.target.value)}
                  placeholder="deine@email.de"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Betreff</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
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
                  onChange={e => setMessage(e.target.value)}
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
                  'Wird gesendet...'
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
      </div>
    </div>
  );
}
