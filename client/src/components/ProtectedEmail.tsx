import { type ReactNode, useEffect, useState } from 'react';

/**
 * Club contact address, stored as separate parts so it never appears as one
 * literal in the HTML or JS bundle that primitive mail harvesters regex over.
 * Server-side code (e.g. nodemailer recipients) may use the full address.
 */
export const CLUB_EMAIL_USER = 'joggediballa';
export const CLUB_EMAIL_DOMAIN = 'gmail.com';

interface ProtectedEmailProps {
  user?: string;
  domain?: string;
  /** Optional visible text; defaults to the address itself. */
  children?: ReactNode;
  className?: string;
}

/**
 * Renders a `mailto:` link that is only assembled in the browser after mount.
 * Before hydration (and without JS) it shows a readable but invalid
 * "user [at] domain" placeholder instead of a harvestable address.
 */
export function ProtectedEmail({
  user = CLUB_EMAIL_USER,
  domain = CLUB_EMAIL_DOMAIN,
  children,
  className,
}: ProtectedEmailProps) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    // `join` instead of a template literal so the minifier cannot fold the
    // parts back into one string constant.
    setAddress([user, domain].join('@'));
  }, [user, domain]);

  if (!address) {
    return (
      <span className={className}>
        {user} [at] {domain}
      </span>
    );
  }

  return (
    <a href={`mailto:${address}`} className={className}>
      {children ?? address}
    </a>
  );
}
