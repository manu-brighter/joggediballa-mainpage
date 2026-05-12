import { z } from 'zod';

/**
 * Canonical Contact form schema, shared between the client (RHF + zodResolver)
 * and the server tRPC `contact.send` procedure.
 *
 * Mirrors the inline schema currently defined in `server/routers.ts`:
 *  - A-P0-02: reject any value containing CR/LF that could end up in an SMTP
 *    header (reply-to / subject).
 *  - Min/max lengths match what the DB column allows.
 *
 * Keep client- and server-side validation in lockstep by importing this schema
 * on both sides. The server still re-validates defensively in the email module
 * before passing to nodemailer (A-P0-02).
 */

const noCrlf = (v: string) => !/[\r\n]/.test(v);
const noCrlfMessage = 'Ungültige Zeichen';

export const contactFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen lang sein')
    .refine(noCrlf, noCrlfMessage),
  email: z
    .string()
    .email('Ungültige E-Mail-Adresse')
    .max(320, 'E-Mail darf maximal 320 Zeichen lang sein')
    .refine(noCrlf, noCrlfMessage),
  subject: z
    .string()
    .min(1, 'Betreff ist erforderlich')
    .max(200, 'Betreff darf maximal 200 Zeichen lang sein')
    .refine(noCrlf, noCrlfMessage),
  message: z
    .string()
    .min(10, 'Nachricht muss mindestens 10 Zeichen lang sein')
    .max(5000, 'Nachricht darf maximal 5000 Zeichen lang sein'),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
