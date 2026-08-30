import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Link } from 'wouter';
import {
  Package,
  Music,
  Camera,
  Mail,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { SEO } from '@/components/SEO';
import { PageHeader } from '@/components/PageHeader';
import { BrandPattern } from '@/components/BrandPattern';

type ExternalLinkItem = {
  href: string;
  label: string;
};

type Accent = 'primary' | 'coral' | 'neutral' | 'gold';

const accentStyles: Record<Accent, { icon: string; border: string }> = {
  primary: {
    icon: 'bg-primary/10 text-primary',
    border: 'hover:border-primary/30',
  },
  coral: {
    icon: 'bg-coral/15 text-coral',
    border: 'hover:border-coral/40',
  },
  neutral: {
    icon: 'bg-muted text-foreground',
    border: 'hover:border-foreground/30',
  },
  gold: {
    icon: 'bg-gold/15 text-gold',
    border: 'hover:border-gold/40',
  },
};

interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  person?: {
    role: string;
    name: string;
    profileImage?: string;
  };
  image?: string;
  externalLinks?: ExternalLinkItem[];
  accent?: Accent;
}

function ServiceCard({
  icon,
  title,
  description,
  person,
  image,
  externalLinks,
  accent = 'primary',
}: ServiceCardProps) {
  const styles = accentStyles[accent];
  return (
    <Card
      className={`h-full overflow-hidden group transition-all duration-300 ${styles.border}`}
    >
      {image && (
        <div className="aspect-video overflow-hidden bg-muted">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${styles.icon}`}>{icon}</div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
        <CardDescription className="text-base whitespace-pre-line">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {person && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            {person.profileImage ? (
              <img
                src={person.profileImage}
                alt={person.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {person.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{person.name}</p>
              <p className="text-xs text-muted-foreground">{person.role}</p>
            </div>
          </div>
        )}

        {!!externalLinks?.length && (
          <div className="flex flex-wrap gap-2">
            {externalLinks.map(linkItem => (
              <Button
                key={`${title}-${linkItem.href}`}
                asChild
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <a
                  href={linkItem.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  {linkItem.label}
                </a>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dienstleistungen() {
  const services: Array<ServiceCardProps & { title: string }> = [
    {
      icon: <Package className="h-6 w-6" />,
      title: 'Vermietung',
      description:
        'Was bei uns rumsteht und was du für deinen Anlass mieten kannst:\n\u2022 Sound-Equipment & Zubehör\n\u2022 Beerpong-Tische & Zubehör\n\u2022 Verschiedene Elektronikartikel',
      image: '/images/vermietung.JPEG',
      accent: 'primary',
    },
    {
      icon: <Music className="h-6 w-6" />,
      title: 'DJ',
      description:
        'Jan, unser Revisor, legt an unseren Events auf, bis die Bude bebt.\n\nAusserhalb des Vereins ist er selbstständig nebenbei als DJ unterwegs und offen für Anfragen.',
      person: {
        role: 'DJ & Revisor',
        name: 'Jan',
        profileImage: '/images/jan_dienstleistungen_small.jpeg',
      },
      externalLinks: [
        { href: 'https://www.instagram.com/dj_jayjay2001', label: 'Instagram' },
        { href: 'https://www.youtube.com/@djjayjay2001', label: 'Youtube' },
      ],
      image: '/images/dj.JPEG',
      accent: 'coral',
    },
    {
      icon: <Camera className="h-6 w-6" />,
      title: 'Fotografie',
      description:
        "Event-Fotografie. Wie das aussieht, siehst du unter 'Events & Fotos' oder in meinen Portfolios.\n\nAusserhalb des Vereins bin ich selbstständig nebenbei als Fotograf und Webentwickler unterwegs und offen für Anfragen.",
      person: {
        role: 'Social Media & Vize',
        name: 'Manu',
        profileImage: '/images/manu_dienstleistungen_small.jpg',
      },
      externalLinks: [
        {
          href: 'https://manuelheller.myportfolio.com',
          label: 'Fotografie-Portfolio',
        },
        {
          href: 'https://manuelheller.dev',
          label: 'Web-Portfolio',
        },
      ],
      image: '/images/fotografie.JPEG',
      accent: 'gold',
    },
  ];

  return (
    <div className="container py-12 space-y-12">
      <SEO
        title="Jogge di Balla - Dienstleistungen (Vermietung, DJ, Foto)"
        description="Vermietung von Sound- und Beerpong-Equipment, DJ-Services von Jan, Event-Fotografie von Manu. Anfragen direkt an den Verein."
        keywords="Jogge di Balla, Vermietung, DJ, Fotografie, Brislach, Event-Services"
        ogUrl="https://joggediballa.ch/dienstleistungen"
      />
      {/* Header */}
      <PageHeader
        title="Dienstleistungen"
        lead="Sound- und Beerpong-Equipment zum Mieten, DJ und Fotografie zum Buchen. Anfragen laufen direkt über den Verein."
      />

      {/* Services Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map(service => (
          <ServiceCard key={service.title} {...service} />
        ))}
      </div>

      {/* CTA Section */}
      <Card className="relative overflow-hidden border-coral/20 bg-coral/5">
        <BrandPattern />
        <CardContent className="relative space-y-5 py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold">
            Interesse geweckt? <span className="text-coral">Schreib uns.</span>
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Unverbindlich und schnell beantwortet. Wir freuen uns auf deine
            Anfrage.
          </p>
          <Button asChild size="lg" className="btn-animate gap-2">
            <Link href="/contact">
              <Mail className="h-5 w-5" />
              Anfrage starten
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
