import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Link, useLocation } from 'wouter';
import {
  Calendar,
  Trophy,
  Users,
  Heart,
  ArrowRight,
  Instagram,
  Sparkles,
  Gift,
  Twitch,
  Zap,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { SEO } from '@/components/SEO';
import { useNavVisibility } from '@/hooks/useNavVisibility';

const MotionDiv = motion.div;

export default function Home() {
  const { data: events = [] } = trpc.events.list.useQuery();
  const [, navigate] = useLocation();
  const { theme, resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  const nextEvent = [...events]
    .sort(
      (a, b) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
    )
    .find(event => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDay = new Date(event.eventDate);
      eventDay.setHours(0, 0, 0, 0);
      return eventDay >= today;
    });

  // Check navigation visibility
  const isEventsVisible = useNavVisibility('/events');

  // Feature toggle for temp button
  const { data: featureToggles = [] } = trpc.features.list.useQuery(undefined, {
    staleTime: 30000,
  });
  const tempButtonEnabled =
    featureToggles.find(f => f.featureName === 'temp_button')?.isEnabled ??
    false;
  const TEMP_BUTTON_URL = '/harassenlauf';
  const TEMP_BUTTON_TEXT = 'Harassenlauf Anmeldung';

  // Determine which logo to show based on theme
  const isDark =
    resolvedTheme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const logoSrc = isDark
    ? '/JoggediBalla-Logo.PNG'
    : '/Jogge_Di_Balla_Final_Transparent.png';

  return (
    <div className="space-y-0">
      <SEO
        title="Jogge di Balla - Event- und Kulturverein seit 2022"
        description="Event- und Kulturverein aus Brislach. Wir bringen Menschen zusammen für unvergessliche Momente, grossartige Events und jede Menge Spass! Shotcounter, Gönnermitglieder, DJ & Fotografie Services."
        keywords="Jogge di Balla, Verein, Events, Brislach, Baselland, Laufental, Shotcounter, Party, Community, DJ, Fotografie, Vermietung, Beerpong"
        ogUrl="https://joggediballa.ch/"
        ogImage="https://joggediballa.ch/JoggediBalla-Logo.PNG"
      />
      {/* Hero Section - Bold and Modern */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-20 md:pt-0">
        {/* Animated Background */}
        <div className="absolute inset-0 hero-gradient" />
        {/* Pattern Overlay - only over gradient */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.5]"
          style={{
            backgroundImage: 'url(/joggediballa-pattern.png)',
            backgroundRepeat: 'repeat',
            backgroundSize: '1129px 610px',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.55_0.14_195_/_0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,oklch(0.68_0.18_18_/_0.1),transparent_50%)]" />

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <MotionDiv
              initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
              className="space-y-6 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                Since 2022
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.1] tracking-tight">
                Willkommen bei{' '}
                <span className="gradient-text whitespace-nowrap">
                  Jogge di Balla
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
                Event- und Kulturverein. Wir bringen Menschen zusammen für
                unvergessliche Momente, grossartige Events und jede Menge Spass!
              </p>

              <div className="flex flex-col gap-3 justify-center lg:justify-start">
                {/* Temp Button - only shown when feature toggle is enabled, on its own row */}
                {tempButtonEnabled && (
                  <div className="flex justify-center lg:justify-start">
                    <Button
                      size="lg"
                      className="btn-animate text-base h-14 px-10 w-full sm:w-auto font-bold bg-gradient-to-r from-secondary to-orange-500 hover:from-secondary/90 hover:to-orange-500/90 text-white shadow-lg shadow-secondary/30 hover:shadow-secondary/50 border-0 animate-pulse hover:animate-none"
                      onClick={() => navigate(TEMP_BUTTON_URL)}
                    >
                      <Zap className="h-5 w-5 mr-2" />
                      {TEMP_BUTTON_TEXT}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
                {/* Shotcounter and Events on same row */}
                <div className="flex flex-row gap-3 justify-center lg:justify-start flex-wrap">
                  <Button
                    size="lg"
                    className="btn-animate text-base h-12 px-8 flex-1 sm:flex-none"
                    onClick={() => navigate('/shotcounter')}
                  >
                    <Trophy className="h-5 w-5 mr-2" />
                    Zum Shotcounter
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  {isEventsVisible && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="btn-animate text-base h-12 px-8 bg-background/50 backdrop-blur-sm flex-1 sm:flex-none"
                      onClick={() =>
                        navigate(nextEvent ? `/events` : '/events')
                      }
                    >
                      <Calendar className="h-5 w-5 mr-2" />
                      {nextEvent ? 'Nächstes Event' : 'Unsere Events'}
                    </Button>
                  )}
                </div>
              </div>
            </MotionDiv>

            <MotionDiv
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.6, delay: shouldReduceMotion ? 0 : 0.2 }}
              className="flex justify-center lg:justify-end"
            >
              <div className="relative">
                {/* Glow effect behind logo */}
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl scale-75" />
                <img
                  src={logoSrc}
                  loading="eager"
                  alt="Jogge di Balla Logo"
                  className="relative w-56 sm:w-72 md:w-96 lg:w-[28rem] xl:w-[32rem] drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                />
              </div>
            </MotionDiv>
          </div>
        </div>

        {/* Scroll indicator - hidden on mobile to avoid logo overlap */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden md:block">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-muted-foreground/50 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Was uns ausmacht
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Entdecke, was Jogge di Balla so besonders macht
            </p>
          </MotionDiv>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Trophy,
                title: 'Shotcounter',
                description:
                  'Welches Team trinkt die meisten Jogge di Balla Shots? Live Wettbewerb!',
                href: '/shotcounter',
                delay: 0,
              },
              {
                icon: Calendar,
                title: 'Events & Fotos',
                description:
                  'Erlebe unsere unvergesslichen Events und entdecke die besten Momente.',
                href: '/events',
                delay: 0.1,
              },
              {
                icon: Users,
                title: 'Unser Team',
                description:
                  'Lerne das stattliche und äusserst attraktive Team hinter Jogge di Balla kennen!',
                href: '/team',
                delay: 0.2,
              },
            ]
              .filter(feature => {
                // Filter out features that are not visible
                if (feature.href === '/events') return isEventsVisible;
                // Add more filters here if needed
                return true;
              })
              .map(feature => (
                <MotionDiv
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: feature.delay }}
                >
                  <Card
                    className="h-full card-hover border-2 hover:border-primary/50 bg-card/50 backdrop-blur-sm cursor-pointer"
                    onClick={() => navigate(feature.href)}
                  >
                    <CardHeader>
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <feature.icon className="h-7 w-7 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="flex items-center gap-2 font-semibold text-primary group">
                        Mehr erfahren
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </CardContent>
                  </Card>
                </MotionDiv>
              ))}
          </div>
        </div>
      </section>

      {/* Next Event Section */}
      {nextEvent && isEventsVisible && (
        <section className="py-20">
          <div className="container">
            <MotionDiv
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-8">
                <span className="inline-block px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
                  Kommendes Event
                </span>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Nächstes Event
                </h2>
              </div>

              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl md:text-3xl">
                    {nextEvent.title}
                  </CardTitle>
                  <CardDescription className="text-lg font-medium text-primary">
                    {new Date(nextEvent.eventDate).toLocaleDateString('de-DE', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {nextEvent.description && (
                    <p className="text-muted-foreground text-lg">
                      {nextEvent.description}
                    </p>
                  )}
                  {nextEvent.location && (
                    <p className="text-muted-foreground flex items-center gap-2">
                      <span className="text-xl">📍</span> {nextEvent.location}
                    </p>
                  )}
                  <Button
                    size="lg"
                    className="btn-animate mt-4"
                    onClick={() => navigate('/events#event-cards')}
                  >
                    Mehr erfahren
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </MotionDiv>
          </div>
        </section>
      )}

      {/* About Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center space-y-6"
          >
            <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
              <Heart className="h-10 w-10 text-secondary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">Über uns</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Jogge di Balla ist mehr als nur ein Verein! Jedes Jahr
              organisieren wir besondere Events, die durch ihre einzigartige
              Atmosphäre, interessante Locations und unvergessliche Erlebnisse
              begeistern. Unsere Veranstaltungen sind kreativ und
              abwechslungsreich und bieten immer wieder neue Highlights für
              alle, die etwas Aussergewöhnliches suchen.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="btn-animate"
              onClick={() => navigate('/contact')}
            >
              Kontakt aufnehmen
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </MotionDiv>
        </div>
      </section>

      {/* Gönnermitgliedschaft Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container">
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto"
          >
            <Card className="border-2 border-primary/30 overflow-hidden">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Gift className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl md:text-3xl">
                  Werde Gönnermitglied!
                </CardTitle>
                <CardDescription className="text-lg">
                  Unterstütze Jogge di Balla und profitiere von exklusiven
                  Vorteilen
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <div className="inline-block px-6 py-3 rounded-full bg-primary/10 border border-primary/20">
                  <span className="text-3xl font-bold text-primary">
                    CHF 20.-
                  </span>
                  <span className="text-muted-foreground ml-2">pro Jahr</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <Gift className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="font-medium">Exklusive Giveaways</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <Trophy className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="font-medium">Reduzierte Preise</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <Heart className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="font-medium">Verein unterstützen</p>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="btn-animate"
                  onClick={() => navigate('/contact')}
                >
                  Jetzt Gönner werden, schreib uns!
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </MotionDiv>
        </div>
      </section>

      {/* Social Media Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-background to-primary/10" />
        <div className="container relative z-10">
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-6"
          >
            <h2 className="text-3xl md:text-4xl font-bold">Folge uns</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Bleib auf dem Laufenden und verpasse keine Updates!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {/* Instagram */}
              <a
                href="https://instagram.com/joggediballa"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  className="btn-animate bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                >
                  <Instagram className="h-5 w-5 mr-2" />
                  @joggediballa
                </Button>
              </a>
              {/* Twitch */}
              <a
                href="https://twitch.tv/joggediballa"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="btn-animate bg-twitch/10 border-twitch/30 hover:bg-twitch/20 text-twitch"
                >
                  <Twitch className="h-5 w-5 mr-2" />
                  Twitch
                </Button>
              </a>
              {/* Add more social links here easily */}
            </div>
          </MotionDiv>
        </div>
      </section>
    </div>
  );
}
