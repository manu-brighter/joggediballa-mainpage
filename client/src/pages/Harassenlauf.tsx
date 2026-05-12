import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SEO } from '@/components/SEO';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trophy,
  MapPin,
  Utensils,
  Info,
  Send,
  ArrowRight,
  FileText,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const MotionDiv = motion.div;

const RULES_BASIC = [
  { icon: '👥', text: 'Max. 5er Teams' },
  { icon: '💰', text: 'CHF 75.– Startgeld pro Team' },
  { icon: '🍺', text: '1 Harasse pro Team' },
  { icon: '🍗', text: 'Eine Wurst pro Teammitglied inkludiert' },
];

const RULES_DETAILED = [
  'Die zum Eventstart gegebene Route muss von allen Teilnehmern vollständig abgelaufen werden.',
  'Es darf nichts ausgelehrt werden – auch kein Spuckschluck!',
  'Es sind keine Hilfsmittel für den Transport der Harasse/Bier erlaubt.',
  'Gruppenbild muss bei jedem Posten gemacht werden.',
  'Wenn die Organisatoren einen Verstoss sehen, wird das gesamte Team disqualifiziert!',
  'Littering ist verboten.',
  'Pro verlorenen Bierdeckel: 5 Minuten Strafe.',
  'Pro verlorene Bierflasche: 10 Minuten Strafe.',
];

export default function Harassenlauf() {
  const shouldReduceMotion = useReducedMotion();
  const [rulesOpen, setRulesOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [notRobot, setNotRobot] = useState(false);

  // Form state
  const [form, setForm] = useState({
    teamName: '',
    memberCount: '',
    captainFirstName: '',
    captainLastName: '',
    captainPhone: '',
    // Wurst fields stored as strings so the user can clear them while typing
    wurstKalb: '0',
    wurstKloepfer: '0',
    wurstVegi: '0',
    additionalInfo: '',
  });

  const [memberCountError, setMemberCountError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Validates Swiss and international phone numbers
  const validatePhone = (phone: string): boolean => {
    // Remove all spaces, dashes, dots, parentheses
    const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    // Swiss: 07x, 0800, 0900, +41, 0041
    // International: +XX... or 00XX...
    const swissLocal = /^0[0-9]{9}$/;
    const swissIntl = /^(\+41|0041)[0-9]{9}$/;
    const international = /^(\+|00)[1-9][0-9]{7,14}$/;
    return (
      swissLocal.test(cleaned) ||
      swissIntl.test(cleaned) ||
      international.test(cleaned)
    );
  };

  const handlePhoneChange = (val: string) => {
    setForm({ ...form, captainPhone: val });
    // Clear error while typing so it doesn't persist after correction
    if (phoneError && validatePhone(val)) {
      setPhoneError('');
    }
  };

  const handlePhoneBlur = (val: string) => {
    if (val.trim() === '') {
      setPhoneError('');
      return;
    }
    if (!validatePhone(val)) {
      setPhoneError(
        'Ungültige Telefonnummer – z.B. 079 123 45 67 oder +41 79 123 45 67',
      );
    } else {
      setPhoneError('');
    }
  };

  const memberCountNum = parseInt(form.memberCount) || 0;
  const wurstKalbNum = parseInt(form.wurstKalb) || 0;
  const wurstKloepferNum = parseInt(form.wurstKloepfer) || 0;
  const wurstVegiNum = parseInt(form.wurstVegi) || 0;
  const wurstTotal = wurstKalbNum + wurstKloepferNum + wurstVegiNum;
  const wurstMax = memberCountNum;
  const showWurstSection = memberCountNum >= 1 && memberCountNum <= 5;

  const submitMutation = trpc.harassenlauf.register.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: err => {
      toast.error('Fehler beim Senden: ' + err.message);
    },
  });

  const handleMemberCountChange = (val: string) => {
    setMemberCountError('');
    if (val === '') {
      setForm({
        ...form,
        memberCount: '',
        wurstKalb: '0',
        wurstKloepfer: '0',
        wurstVegi: '0',
      });
      return;
    }
    const num = parseInt(val);
    if (isNaN(num) || num < 1 || num > 5) {
      setMemberCountError(
        'Ungültige Mitgliederzahl – bitte eine Zahl zwischen 1 und 5 eingeben.',
      );
      setForm({ ...form, memberCount: val });
      return;
    }
    // Reduce wurst if total exceeds new memberCount
    const newTotal = wurstKalbNum + wurstKloepferNum + wurstVegiNum;
    if (newTotal > num) {
      setForm({
        ...form,
        memberCount: val,
        wurstKalb: '0',
        wurstKloepfer: '0',
        wurstVegi: '0',
      });
    } else {
      setForm({ ...form, memberCount: val });
    }
  };

  // While typing: allow any string (including empty) so the user can clear the field
  const handleWurstChange = (
    key: 'wurstKalb' | 'wurstKloepfer' | 'wurstVegi',
    val: string,
  ) => {
    setForm({ ...form, [key]: val });
  };

  // On blur: clamp to valid range and fall back to 0 if empty/invalid
  const handleWurstBlur = (
    key: 'wurstKalb' | 'wurstKloepfer' | 'wurstVegi',
  ) => {
    const parsed = parseInt(form[key]);
    const current = isNaN(parsed) ? 0 : parsed;
    const others =
      key === 'wurstKalb'
        ? wurstKloepferNum + wurstVegiNum
        : key === 'wurstKloepfer'
          ? wurstKalbNum + wurstVegiNum
          : wurstKalbNum + wurstKloepferNum;
    const maxForThis = Math.max(0, wurstMax - others);
    const clamped = Math.max(0, Math.min(current, maxForThis));
    setForm({ ...form, [key]: String(clamped) });
  };

  const isFormValid =
    form.teamName.trim() &&
    memberCountNum >= 1 &&
    memberCountNum <= 5 &&
    !memberCountError &&
    form.captainFirstName.trim() &&
    form.captainLastName.trim() &&
    form.captainPhone.trim() &&
    validatePhone(form.captainPhone) &&
    !phoneError &&
    notRobot;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      if (!notRobot) toast.error('Bitte bestätige, dass du kein Roboter bist!');
      return;
    }
    submitMutation.mutate({
      teamName: form.teamName,
      memberCount: memberCountNum,
      captainFirstName: form.captainFirstName,
      captainLastName: form.captainLastName,
      captainPhone: form.captainPhone,
      wurstKalb: wurstKalbNum,
      wurstKloepfer: wurstKloepferNum,
      wurstVegi: wurstVegiNum,
      additionalInfo: form.additionalInfo || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        {/* Full page gradient background */}
        <div className="absolute inset-0 hero-gradient" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.5]"
          style={{
            backgroundImage: 'url(/joggediballa-pattern.png)',
            backgroundRepeat: 'repeat',
            backgroundSize: '1129px 610px',
          }}
        />
        <MotionDiv
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center space-y-6 max-w-md"
        >
          <div className="text-8xl">🍺🎉🏆</div>
          <h1 className="text-3xl font-black gradient-text">
            Anmeldung erhalten!
          </h1>
          <p className="text-lg text-muted-foreground">
            Team{' '}
            <span className="font-bold text-foreground">«{form.teamName}»</span>{' '}
            ist dabei! Wir melden uns bei{' '}
            <span className="font-bold text-foreground">
              {form.captainFirstName} {form.captainLastName}
            </span>
            .
          </p>
          <Button
            size="lg"
            className="btn-animate"
            onClick={() => (window.location.href = '/')}
          >
            Zurück zur Homepage
          </Button>
        </MotionDiv>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <SEO
        title="Harassenlauf Anmeldung – Jogge di Balla"
        description="Melde dein Team für den Harassenlauf an! Max. 5er Teams, CHF 75.– Startgeld pro Team."
        noIndex
      />
      {/* Full page gradient background */}
      <div className="absolute inset-0 hero-gradient" />
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.5]"
        style={{
          backgroundImage: 'url(/joggediballa-pattern.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: '1129px 610px',
        }}
      />
      <div className="absolute inset-0 hero-radials" />

      <div className="relative z-10" translate="no">
        {/* Hero Banner */}
        <div className="pt-28 pb-10">
          <div className="container text-center space-y-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3">
              <MotionDiv
                initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold"
              >
                Jogge di Balla präsentiert
              </MotionDiv>
              {/* Date Badge — on mobile+landscape: next to badge; on md+: hidden here (shown near title) */}
              <MotionDiv
                initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 6 }}
                transition={{
                  delay: 0.35,
                  type: 'spring',
                  stiffness: 200,
                  damping: 12,
                }}
                className="md:hidden"
              >
                <div className="bg-primary text-primary-foreground rounded-xl px-2.5 py-1.5 shadow-lg shadow-primary/30 rotate-6 flex flex-col items-center leading-tight">
                  <span className="text-[8px] font-semibold uppercase tracking-widest opacity-80">
                    Save the date
                  </span>
                  <span className="text-sm font-black">18. Juli</span>
                  <span className="text-[8px] font-bold opacity-80">2026</span>
                </div>
              </MotionDiv>
            </div>

            <MotionDiv
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: shouldReduceMotion ? 0 : 0.1 }}
              className="relative md:inline-block"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                <span className="gradient-text">Harassenlauf Anmeldung</span>
              </h1>
              {/* Date Badge — on md+: tilted top-right; on mobile+landscape: hidden here (shown above) */}
              <MotionDiv
                initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 6 }}
                transition={{
                  delay: 0.35,
                  type: 'spring',
                  stiffness: 200,
                  damping: 12,
                }}
                className="hidden md:block md:absolute md:-top-6 md:-right-8 z-10"
              >
                <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 shadow-lg shadow-primary/30 rotate-6 flex flex-col items-center leading-tight">
                  <span className="text-xs font-semibold uppercase tracking-widest opacity-80">
                    Save the date
                  </span>
                  <span className="text-xl font-black">18. Juli</span>
                  <span className="text-xs font-bold opacity-80">2026</span>
                </div>
              </MotionDiv>
            </MotionDiv>

            <MotionDiv
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: shouldReduceMotion ? 0 : 0.2 }}
              className="text-lg text-muted-foreground max-w-xl mx-auto"
            >
              Schnapp dir dein Team, schultert die Harasse und zeigt was ihr
              drauf habt!
            </MotionDiv>
          </div>
        </div>

        <div className="container pb-16 space-y-6 max-w-3xl mx-auto">
          {/* Quick Info Cards */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {RULES_BASIC.map((rule, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card/80 backdrop-blur-sm border text-center hover:border-primary/40 transition-colors"
              >
                <span className="text-3xl">{rule.icon}</span>
                <span className="text-xs font-semibold text-muted-foreground leading-tight">
                  {rule.text}
                </span>
              </div>
            ))}
          </MotionDiv>

          {/* Detailed Rules Accordion */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <button
              type="button"
              onClick={() => setRulesOpen(!rulesOpen)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-card/80 backdrop-blur-sm border hover:border-primary/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-pending/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-pending" />
                </div>
                <div>
                  <p className="font-bold text-sm">Regeln</p>
                  <p className="text-xs text-muted-foreground">
                    Kein Kindergarten – Gentleman Agreement
                  </p>
                </div>
              </div>
              {rulesOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            <AnimatePresence>
              {rulesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-4 rounded-2xl bg-pending/5 border border-pending/20 space-y-2">
                    {RULES_DETAILED.map((rule, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-pending font-bold text-sm mt-0.5 shrink-0">
                          {i + 1}.
                        </span>
                        <p className="text-sm text-foreground/80">{rule}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </MotionDiv>

          {/* Registration Form */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="border-2 border-primary/20 shadow-xl shadow-primary/5 bg-card/90 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  Team Anmeldung
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Team Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wide">
                      <Users className="h-4 w-4" />
                      Team-Infos
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="teamName">
                          Teamname <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="teamName"
                          placeholder="z.B. Die Harassen-Helden"
                          value={form.teamName}
                          onChange={e =>
                            setForm({ ...form, teamName: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="memberCount">
                          Anzahl Teilnehmer{' '}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="memberCount"
                          type="number"
                          min="1"
                          max="5"
                          placeholder="1–5"
                          value={form.memberCount}
                          onChange={e =>
                            handleMemberCountChange(e.target.value)
                          }
                          className={cn(
                            memberCountError &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                        />
                        {memberCountError && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {memberCountError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Captain Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wide">
                      <MapPin className="h-4 w-4" />
                      Teamchef
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="captainFirstName">
                          Vorname <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="captainFirstName"
                          placeholder="Max"
                          value={form.captainFirstName}
                          onChange={e =>
                            setForm({
                              ...form,
                              captainFirstName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="captainLastName">
                          Nachname <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="captainLastName"
                          placeholder="Mustermann"
                          value={form.captainLastName}
                          onChange={e =>
                            setForm({
                              ...form,
                              captainLastName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="captainPhone">
                          Tel. Mobile{' '}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="captainPhone"
                          type="tel"
                          placeholder="+41 79 123 45 67"
                          value={form.captainPhone}
                          onChange={e => handlePhoneChange(e.target.value)}
                          onBlur={e => handlePhoneBlur(e.target.value)}
                          className={cn(
                            phoneError &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                          required
                        />
                        {phoneError && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {phoneError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Wurst Selection - only shown when member count is valid */}
                  <AnimatePresence>
                    {showWurstSection && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wide">
                            <Utensils className="h-4 w-4" />
                            Wurstbestellung
                          </div>

                          <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                {
                                  key: 'wurstKalb' as const,
                                  label: 'Kalbsbratwurst',
                                },
                                {
                                  key: 'wurstKloepfer' as const,
                                  label: 'Klöpfer',
                                },
                                { key: 'wurstVegi' as const, label: 'Vegi' },
                              ].map(({ key, label }) => (
                                <div
                                  key={key}
                                  className="space-y-2 text-center"
                                >
                                  <Label
                                    htmlFor={key}
                                    className="text-xs font-semibold block"
                                  >
                                    {label}
                                  </Label>
                                  <Input
                                    id={key}
                                    type="number"
                                    min="0"
                                    max={wurstMax}
                                    value={form[key]}
                                    onChange={e =>
                                      handleWurstChange(key, e.target.value)
                                    }
                                    onBlur={() => handleWurstBlur(key)}
                                    onFocus={e => {
                                      // Select all text on focus so the user can immediately type a new value
                                      e.target.select();
                                    }}
                                    className="text-center"
                                  />
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Anzahl Würste entspricht Anzahl Teilnehmer. Noch
                              verfügbar:{' '}
                              <strong>{wurstMax - wurstTotal}</strong>
                            </p>

                            {wurstTotal > 0 && (
                              <div className="flex items-center justify-center gap-2 pt-2 border-t text-sm">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <span className="font-medium">
                                  Total: {wurstTotal} Würste bestellt
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Additional Info */}
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="additionalInfo">
                      Zusätzliche Angaben / Wünsche / Infos
                    </Label>
                    <Textarea
                      id="additionalInfo"
                      placeholder="Allergien, besondere Wünsche, Fragen, ..."
                      value={form.additionalInfo}
                      onChange={e =>
                        setForm({ ...form, additionalInfo: e.target.value })
                      }
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Not a Robot Checkbox */}
                  <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/20">
                    <Checkbox
                      id="notRobot"
                      checked={notRobot}
                      onCheckedChange={checked => setNotRobot(checked === true)}
                      className="h-5 w-5"
                    />
                    <label
                      htmlFor="notRobot"
                      className="text-sm font-medium cursor-pointer select-none flex items-center gap-2"
                    >
                      Ich bin kein Roboter 🤖
                    </label>
                  </div>

                  {/* Cancellation policy notice */}
                  <div className="flex gap-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-warning/70" />
                    <p>
                      <span className="font-medium text-foreground">
                        Stornierungs&shy;hinweis:
                      </span>{' '}
                      Bei einer Abmeldung weniger als 14 Tage vor dem Event
                      können die Teilnahmekosten nicht mehr erstattet werden, da
                      die Anmeldung zu diesem Zeitpunkt bereits verbindlich beim
                      Veranstalter eingereicht wurde.
                    </p>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitMutation.isPending || !isFormValid}
                    className="w-full h-14 text-base font-bold btn-animate bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Team anmelden!
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    <Info className="h-3 w-3 inline mr-1" />
                    Wir melden uns nach der Anmeldung beim Teamchef.
                  </p>
                </form>
              </CardContent>
            </Card>
          </MotionDiv>

          {/* Flyer Section */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="overflow-hidden border bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  Event-Flyer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Schnapp dir den Flyer, schick ihn deinen Freunden und stell
                  das stärkste Harassenlauf-Team im Laufental auf!
                </p>
                <div className="rounded-xl overflow-hidden border">
                  <img
                    src="/HarassenlaufFlyer2026.png"
                    alt="Harassenlauf 2026 Flyer"
                    className="w-full h-auto object-contain"
                  />
                </div>
                <a
                  href="/HarassenlaufFlyer2026.png"
                  download="HarassenlaufFlyer2026.png"
                  className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Flyer herunterladen
                </a>
              </CardContent>
            </Card>
          </MotionDiv>
        </div>
      </div>
    </div>
  );
}
