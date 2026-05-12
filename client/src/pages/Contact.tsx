import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/lib/errorMessages';
import { Mail, Send, CheckCircle } from 'lucide-react';
import {
  contactFormSchema,
  type ContactFormValues,
} from '@shared/contact.schema';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
    mode: 'onBlur',
  });

  const submitMutation = trpc.contact.send.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Nachricht erfolgreich gesendet!');
      form.reset();
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const onSubmit = (values: ContactFormValues) => {
    submitMutation.mutate({
      ...values,
      subject: values.subject.trim() || 'Kein Betreff',
    });
  };

  if (submitted) {
    return (
      <div className="container py-12">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <CheckCircle className="h-24 w-24 text-success mx-auto" />
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
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Dein Name"
                          autoComplete="name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        E-Mail <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="deine@email.ch"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Betreff</FormLabel>
                      <FormControl>
                        <Input placeholder="Worum geht es?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nachricht <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Deine Nachricht an uns..."
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
