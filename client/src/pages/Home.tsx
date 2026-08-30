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
  Gift,
  Twitch,
  Zap,
  MapPin,
  Projector,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { SEO } from '@/components/SEO';
import { BrandPattern } from '@/components/BrandPattern';
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

  const { data: featureToggles = [] } = trpc.features.list.useQuery(undefined, {
    staleTime: 30000,
  });

  // Temp button — a configurable promo CTA. URL + text are set in the admin
  // dashboard; only shown when enabled and both are set. URL may be an internal
  // route ("/foo") or an external link ("https://…").
  const tempButtonToggle = featureToggles.find(
    f => f.featureName === 'temp_button',
  );
  const tempButtonUrl = tempButtonToggle?.linkUrl ?? '';
  const tempButtonText = tempButtonToggle?.linkText ?? '';
  const showTempButton =
    (tempButtonToggle?.isEnabled ?? false) &&
    !!tempButtonUrl &&
    !!tempButtonText;
  const tempButtonIsExternal = /^https?:\/\//i.test(tempButtonUrl);

  // Feature toggle for the live-diashow button. The live URL needs the current
  // upload token, fetched only while the button is actually enabled.
  const diashowButtonEnabled =
    featureToggles.find(f => f.featureName === 'diashow_button')?.isEnabled ??
    false;
  const { data: diashowLink } = trpc.slideshow.liveLink.useQuery(undefined, {
    enabled: diashowButtonEnabled,
    staleTime: 30000,
  });

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
        description="Event- und Kulturverein aus Brislach, seit 2022. Anlässe an ungewöhnlichen Orten, Shotcounter, Gönnermitgliedschaft, DJ und Fotografie."
        keywords="Jogge di Balla, Verein, Events, Brislach, Baselland, Laufental, Shotcounter, Party, Community, DJ, Fotografie, Vermietung, Beerpong"
        ogUrl="https://joggediballa.ch/"
        ogImage="https://joggediballa.ch/JoggediBalla-Logo.PNG"
      />
      {/* Hero Section - Bold and Modern */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-20 md:pt-0">
        {/* Animated Background */}
        <div className="absolute inset-0 hero-gradient" />
        {/* Pattern Overlay - only over gradient */}
        <div className="brand-pattern pattern-drift absolute inset-0 opacity-[0.03] dark:opacity-[0.5]" />
        <div className="absolute inset-0 hero-radials" />

        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <MotionDiv
              initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
              className="space-y-6 text-center lg:text-left"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.1] tracking-tight">
                Willkommen bei{' '}
                <span className="gradient-text whitespace-nowrap">
                  Jogge di Balla
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
                Event- und Kulturverein aus Brislach, seit 2022. Wir machen
                Anlässe, auf die sonst niemand kommt.
              </p>

              <div className="flex flex-col gap-3 justify-center lg:justify-start">
                {/* Temp Button — configurable promo CTA (URL + text set in the
                    admin dashboard), only shown when enabled, on its own row. */}
                {showTempButton && (
                  <div className="flex justify-center lg:justify-start">
                    <Button
                      asChild
                      size="lg"
                      className="group btn-animate text-base h-14 px-10 w-full sm:w-auto font-bold bg-coral text-white hover:bg-coral/90 border-0"
                    >
                      {tempButtonIsExternal ? (
                        <a
                          href={tempButtonUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Zap className="h-5 w-5 mr-2" />
                          {tempButtonText}
                          <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </a>
                      ) : (
                        <Link href={tempButtonUrl}>
                          <Zap className="h-5 w-5 mr-2" />
                          {tempButtonText}
                          <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </Link>
                      )}
                    </Button>
                  </div>
                )}
                {/* Live-Diashow Button — only shown when feature toggle is
                    enabled (i.e. during a fest), on its own row above the
                    Shotcounter/Events row. */}
                {diashowButtonEnabled && diashowLink?.token && (
                  <div className="flex justify-center lg:justify-start">
                    <Button
                      size="lg"
                      className="group btn-animate text-base h-12 px-8 w-full sm:w-auto bg-coral text-white hover:bg-coral/90"
                      onClick={() => navigate(`/diashow/${diashowLink.token}`)}
                    >
                      <Projector className="h-5 w-5 mr-2" />
                      Zur Live-Diashow
                      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                )}
                {/* Shotcounter and Events on same row */}
                <div className="flex flex-row gap-3 justify-center lg:justify-start flex-wrap">
                  <Button
                    size="lg"
                    className="group btn-animate text-base h-12 px-8 flex-1 sm:flex-none"
                    onClick={() => navigate('/shotcounter')}
                  >
                    <Trophy className="h-5 w-5 mr-2" />
                    Zum Shotcounter
                    <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                  {isEventsVisible && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="btn-animate text-base h-12 px-8 bg-background/50 backdrop-blur-sm flex-1 sm:flex-none"
                      onClick={() => navigate('/events')}
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
              transition={{
                duration: shouldReduceMotion ? 0 : 0.6,
                delay: shouldReduceMotion ? 0 : 0.2,
              }}
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
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="mb-10 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Was bei uns abgeht
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground text-lg">
              Kein langer Pitch. Das Wichtigste auf einen Blick.
            </p>
          </div>

          <div
            className={`grid gap-6 ${
              isEventsVisible
                ? 'md:grid-cols-3 md:auto-rows-fr'
                : 'md:grid-cols-2'
            }`}
          >
            {/* Hero feature: Events & Fotos — big image card (when visible) */}
            {isEventsVisible && (
              <div className="group md:col-span-2 md:row-span-2">
                <Link
                  href="/events"
                  className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Card className="relative h-full min-h-[22rem] card-hover border-2 group-hover:border-primary/50 bg-card overflow-hidden">
                    {/* Event photo fills the card; gradient keeps the copy legible */}
                    <img
                      src="/images/fotografie.JPEG"
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
                    <div className="relative z-10 flex h-full flex-col justify-end p-6 md:p-8">
                      <CardTitle className="flex items-center gap-3 text-3xl md:text-4xl font-black tracking-tight">
                        <Calendar
                          className="h-7 w-7 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        Events & Fotos
                      </CardTitle>
                      <CardDescription className="text-lg max-w-md mt-2">
                        Was wir veranstaltet haben. Mit Bildern, falls du nicht
                        dabei warst.
                      </CardDescription>
                      <span className="mt-5 flex items-center gap-2 font-semibold text-primary text-base">
                        Zu den Events
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Card>
                </Link>
              </div>
            )}

            {/* Secondary: Shotcounter (the hero already carries the big CTA) */}
            <div className="group">
              <Link
                href="/shotcounter"
                className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="h-full card-hover border-2 group-hover:border-primary/50 bg-card">
                  <CardHeader>
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <Trophy className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl">Shotcounter</CardTitle>
                    <CardDescription>
                      Welches Team wird der Shotmeister? Live-Ranking, kein
                      Pardon.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="flex items-center gap-2 font-semibold text-primary text-sm">
                      Zu den Shots
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Secondary: Team */}
            <div className="group">
              <Link
                href="/team"
                className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="h-full card-hover border-2 group-hover:border-coral/50 bg-card">
                  <CardHeader>
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-coral/10 text-coral transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <Users className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl">Unser Team</CardTitle>
                    <CardDescription>
                      Das stattliche und äusserst attraktive Team hinter dem
                      Verein.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="flex items-center gap-2 font-semibold text-coral text-sm">
                      Zum Team
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Next Event Section */}
      {nextEvent && isEventsVisible && (
        <section className="py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <h2 className="mb-8 text-center text-3xl md:text-4xl font-bold">
                Bald ist's wieder soweit
              </h2>

              <Card className="border-2 border-primary/30 bg-card overflow-hidden">
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
                      <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {nextEvent.location}
                    </p>
                  )}
                  <Button
                    size="lg"
                    className="group btn-animate mt-4"
                    onClick={() => navigate('/events#event-cards')}
                  >
                    Zum Event
                    <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-coral/10 text-coral">
              <Heart className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">Wer wir sind</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Event- und Kulturverein aus Brislach. Unsere Anlässe leben von
              kuriosen, lustigen und kreativen Ideen, von ungewöhnlichen Orten
              und von Leuten, die du sonst nie getroffen hättest. Das gibt's bei
              keinem anderen Verein.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="group btn-animate"
              onClick={() => navigate('/contact')}
            >
              Schreib uns
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* Gönnermitgliedschaft Section */}
      <section className="py-16 bg-coral/5">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <Card className="relative overflow-hidden border-2 border-primary/30">
              <BrandPattern />
              <CardHeader className="relative items-center pb-4 text-center">
                <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Gift className="h-7 w-7" aria-hidden="true" />
                </div>
                <CardTitle className="text-2xl md:text-3xl">
                  Werde Gönnermitglied
                </CardTitle>
                <CardDescription className="text-lg">
                  <span className="text-3xl font-black text-primary">
                    CHF 20.-
                  </span>{' '}
                  pro Jahr. Wenig Aufwand, viel Wirkung.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative space-y-6 text-center">
                <ul className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium">
                  <li className="flex items-center gap-2">
                    <Gift
                      className="h-5 w-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    Giveaways nur für Gönner
                  </li>
                  <li className="flex items-center gap-2">
                    <Trophy
                      className="h-5 w-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    Reduzierte Preise
                  </li>
                  <li className="flex items-center gap-2">
                    <Heart
                      className="h-5 w-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    Du machst's möglich
                  </li>
                </ul>
                <Button
                  size="lg"
                  className="group btn-animate"
                  onClick={() => navigate('/contact')}
                >
                  Ich bin dabei
                  <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Media Section */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="space-y-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold">Social Media</h2>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              Falls du nichts verpassen willst. Falls doch, auch okay.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {/* Instagram */}
              <a
                href="https://instagram.com/joggediballa"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="btn-animate social-instagram">
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
          </div>
        </div>
      </section>
    </div>
  );
}
