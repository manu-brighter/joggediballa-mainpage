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
import { motion } from 'framer-motion';
import { SEO } from '@/components/SEO';
import { PageHeader } from '@/components/PageHeader';

const MotionDiv = motion.div;

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
  delay?: number;
}

function ServiceCard({
  icon,
  title,
  description,
  person,
  image,
  externalLinks,
  accent = 'primary',
  delay = 0,
}: ServiceCardProps) {
  const styles = accentStyles[accent];
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
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
    </MotionDiv>
  );
}

export default function Dienstleistungen() {
  const services: Array<ServiceCardProps & { title: string }> = [
    {
      icon: <Package className="h-6 w-6" />,
      title: 'Vermietung',
      description:
        'Wir vermieten hochwertiges Equipment für deine Events!\n\u2022 Sound-Equipment & Zubehör\n\u2022 Beerpong-Tische & Zubehör\n\u2022 Verschiedene Elektronikartikel',
      image: '/images/vermietung.JPEG',
      accent: 'primary',
    },
    {
      icon: <Music className="h-6 w-6" />,
      title: 'DJ',
      description:
        'Professionelle DJ-Services für jeden Anlass. Unser Revisor Jan legt an unseren Events Musik auf, bis die Bude bebt.\n\nAusserhalb des Vereins selbstständig nebenbei als DJ tätig und offen für Anfragen.',
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
        "Professionelle Event-Fotografie, die deine besonderen Momente festhält. Schau im 'Events & Fotos'-Tab oder in mein Portfolio rein.\n\nAusserhalb des Vereins selbstständig nebenbei als Fotograf tätig und offen für Anfragen.",
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
        kicker="Vermietung · DJ · Fotografie"
        kickerIcon={Package}
        title="Dienstleistungen"
        lead="Was du bei uns buchen oder mieten kannst. Anfragen laufen direkt über den Verein."
      />

      {/* Services Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, index) => (
          <ServiceCard key={service.title} {...service} delay={index * 0.1} />
        ))}
      </div>

      {/* CTA Section */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-center"
      >
        <Card className="bg-coral/5 border-coral/20">
          <CardContent className="py-12 space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold">
              Interesse geweckt? Schreib uns.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Unverbindliche Anfrage, keine Verpflichtung. Wir freuen uns auf
              deine Anfrage!
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
      </MotionDiv>
    </div>
  );
}
