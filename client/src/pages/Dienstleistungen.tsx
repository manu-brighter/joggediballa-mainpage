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

const MotionDiv = motion.div;

type ExternalLinkItem = {
  href: string;
  label: string;
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
  delay?: number;
}

function ServiceCard({
  icon,
  title,
  description,
  person,
  image,
  externalLinks,
  delay = 0,
}: ServiceCardProps) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <Card className="h-full overflow-hidden group hover:border-primary/30 transition-all duration-300">
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
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
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
  const services = [
    {
      icon: <Package className="h-6 w-6" />,
      title: 'Vermietung',
      description:
        'Wir vermieten hochwertiges Equipment für deine Events!\n\u2022 Sound-Equipment & Zubehör\n\u2022 Beerpong-Tische & Zubehör\n\u2022 Verschiedene Elektronikartikel',
      image: '/images/vermietung.JPEG',
    },
    {
      icon: <Music className="h-6 w-6" />,
      title: 'DJ',
      description:
        'Professionelle DJ-Services für jeden Anlass. Unser Revisor Jan legt an unseren Events Musik auf bis die Bude bebt.\n\ \n\Ausserhalb des Vereins selbstständig nebenbei als DJ tätig und offen für Anfragen.',
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
    },
    {
      icon: <Camera className="h-6 w-6" />,
      title: 'Fotografie',
      description:
        "Professionelle Event-Fotografie, die deine besonderen Momente festhält. Schau dir gerne den 'Events & Fotos'-Tab oder mein persönliches Portfolio an, um dir ein Eindruck zu verschaffen.\n\ \n\Ausserhalb des Vereins selbstständig nebenbei als Fotograf tätig und offen für Anfragen.",
      person: {
        role: 'Social Media & Vize',
        name: 'Manu',
        profileImage: '/images/manu_dienstleistungen_small.jpg',
      },
      externalLinks: [
        {
          href: 'https://manuelheller.myportfolio.com',
          label: 'Portfolio ansehen',
        },
      ],
      image: '/images/fotografie.JPEG',
    },
  ];

  return (
    <div className="container py-12 space-y-12">
      {/* Header */}
      <MotionDiv
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Package className="h-4 w-4" />
          Unsere Services
        </div>
        <h1 className="text-4xl md:text-5xl font-black">
          <span className="gradient-text">Dienstleistungen</span>
        </h1>
      </MotionDiv>

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
        <Card className="bg-gradient-to-br from-primary/5 to-coral/5 border-primary/20">
          <CardContent className="py-12 space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold">
              Interesse an unseren Dienstleistungen?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Kontaktiere uns für ein unverbindliches Angebot. Wir freuen uns
              auf deine Anfrage!
            </p>
            <Button asChild size="lg" className="btn-animate gap-2">
              <Link href="/contact">
                <Mail className="h-5 w-5" />
                Jetzt Kontakt aufnehmen
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </MotionDiv>
    </div>
  );
}
