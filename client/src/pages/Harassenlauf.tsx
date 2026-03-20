import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Beer,
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  Trophy,
  MapPin,
  Clock,
  Info,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div;

// Fun captcha questions
const CAPTCHA_QUESTIONS = [
  {
    question: "Wie viele Bier passen in eine Harasse?",
    answer: "24",
    hint: "Eine Harasse hat genau so viele Bier wie Stunden am Tag 🍺",
  },
  {
    question: "Was ist 6 × 4? (Tipp: Das ist auch die Anzahl Bier in einer Harasse)",
    answer: "24",
    hint: "Rechne mal nach... 6 × 4 = ? 🧮",
  },
  {
    question: "Vervollständige: 'Jogge di ___'",
    answer: "balla",
    hint: "Der Name des besten Vereins im Laufental 😎",
  },
];

const RULES_BASIC = [
  { icon: "👥", text: "Max. 5er Teams" },
  { icon: "💰", text: "Pro Team CHF 75.–" },
  { icon: "🍺", text: "1 Harasse pro Team" },
  { icon: "🌭", text: "Für jede Person im Team eine Wurst" },
];

const RULES_DETAILED = [
  "Die eingezeichnete Route muss von allen Teilnehmern abgelaufen werden.",
  "Es darf nichts ausgelehrt werden – auch kein Spuckschluck!",
  "Es sind keine Hilfsmittel für den Transport der Harasse/Bier erlaubt.",
  "Gruppenbild muss bei jedem Posten gemacht werden.",
  "Wenn die Organisatoren einen Verstoss sehen, wird das Team disqualifiziert!",
  "Kein Kindergarten – Gentleman Agreement.",
  "Littering ist verboten.",
  "Pro Bierdeckel: 5 Minuten Strafe.",
  "Pro Bierflasche: 10 Minuten Strafe.",
];

export default function Harassenlauf() {
  useSEO({
    title: "Harassenlauf Anmeldung – Jogge di Balla",
    description: "Melde dein Team für den Harassenlauf an! Max. 5er Teams, CHF 75.– pro Team, 1 Harasse und Würste inklusive.",
  });

  const [rulesOpen, setRulesOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [form, setForm] = useState({
    teamName: "",
    memberCount: "",
    captainName: "",
    captainPhone: "",
    wurstKalb: "0",
    wurstKloepfer: "0",
    wurstVegi: "0",
  });

  // Captcha state
  const [captchaIdx] = useState(() => Math.floor(Math.random() * CAPTCHA_QUESTIONS.length));
  const captcha = CAPTCHA_QUESTIONS[captchaIdx];
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaShaking, setCaptchaShaking] = useState(false);

  const submitMutation = trpc.contact.send.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error("Fehler beim Senden: " + err.message);
    },
  });

  const handleCaptchaCheck = () => {
    const correct = captchaInput.trim().toLowerCase() === captcha.answer.toLowerCase();
    if (correct) {
      setCaptchaVerified(true);
      setCaptchaError(false);
      toast.success("✅ Kein Roboter erkannt! Du bist ein echter Mensch 🎉");
    } else {
      setCaptchaError(true);
      setCaptchaShaking(true);
      setTimeout(() => setCaptchaShaking(false), 600);
      toast.error("❌ Falsch! Bist du etwa doch ein Roboter? 🤖");
    }
  };

  const totalWurste =
    parseInt(form.wurstKalb || "0") +
    parseInt(form.wurstKloepfer || "0") +
    parseInt(form.wurstVegi || "0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.teamName.trim()) return toast.error("Teamname fehlt!");
    if (!form.memberCount || parseInt(form.memberCount) < 1 || parseInt(form.memberCount) > 5)
      return toast.error("Anzahl Teilnehmer muss zwischen 1 und 5 sein!");
    if (!form.captainName.trim()) return toast.error("Name des Teamchefs fehlt!");
    if (!form.captainPhone.trim()) return toast.error("Telefonnummer fehlt!");
    if (!captchaVerified) return toast.error("Bitte zuerst beweisen dass du kein Roboter bist! 🤖");

    const message = `
🏃 HARASSENLAUF ANMELDUNG 🍺

Team: ${form.teamName}
Anzahl Teilnehmer: ${form.memberCount}
Teamchef: ${form.captainName}
Tel. Mobile: ${form.captainPhone}

🌭 Wurstbestellung:
- Kalbsbratwurst: ${form.wurstKalb}
- Klöpfer: ${form.wurstKloepfer}
- Vegi: ${form.wurstVegi}
- Total Würste: ${totalWurste}
    `.trim();

    submitMutation.mutate({
      name: form.captainName,
      email: "anmeldung@joggediballa.ch",
      subject: `Harassenlauf Anmeldung: ${form.teamName}`,
      message,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <MotionDiv
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="text-8xl">🍺🎉🏆</div>
          <h1 className="text-3xl font-black gradient-text">Anmeldung erhalten!</h1>
          <p className="text-lg text-muted-foreground">
            Team <span className="font-bold text-foreground">«{form.teamName}»</span> ist dabei!
            Wir melden uns bei <span className="font-bold text-foreground">{form.captainName}</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Denkt daran: Kein Spuckschluck, kein Littering, kein Kindergarten. 😤
          </p>
          <Button
            size="lg"
            className="btn-animate"
            onClick={() => window.location.href = "/"}
          >
            Zurück zur Homepage
          </Button>
        </MotionDiv>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-background to-secondary/20 pt-24 pb-12">
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.4]"
          style={{ backgroundImage: 'url(/joggediballa-pattern.png)', backgroundRepeat: 'repeat', backgroundSize: '800px' }}
        />
        <div className="absolute top-10 left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-10 w-56 h-56 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-700" />

        <div className="container relative z-10 text-center space-y-4">
          <MotionDiv
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/15 text-secondary text-sm font-bold"
          >
            <Beer className="h-4 w-4" />
            Jogge di Balla präsentiert
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
              🍺 Harassenlauf{" "}
              <span className="gradient-text">Anmeldung</span>
            </h1>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto"
          >
            Schnapp dir dein Team, schultert die Harasse und zeigt was ihr drauf habt!
          </MotionDiv>
        </div>
      </div>

      <div className="container py-10 space-y-8 max-w-3xl mx-auto">

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
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-card border text-center hover:border-primary/40 transition-colors"
            >
              <span className="text-3xl">{rule.icon}</span>
              <span className="text-xs font-semibold text-muted-foreground leading-tight">{rule.text}</span>
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
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-card border hover:border-primary/40 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="font-bold text-sm">Regeln & Strafen</p>
                <p className="text-xs text-muted-foreground">Kein Kindergarten – Gentleman Agreement</p>
              </div>
            </div>
            {rulesOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {rulesOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 space-y-2">
                  {RULES_DETAILED.map((rule, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-orange-500 font-bold text-sm mt-0.5 shrink-0">
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
          <Card className="border-2 border-primary/20 shadow-xl shadow-primary/5">
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
                        placeholder="z.B. Die Harassen-Helden 🦸"
                        value={form.teamName}
                        onChange={(e) => setForm({ ...form, teamName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="memberCount">
                        Anzahl Teilnehmer <span className="text-destructive">*</span>
                        <span className="text-xs text-muted-foreground ml-1">(max. 5)</span>
                      </Label>
                      <Input
                        id="memberCount"
                        type="number"
                        min="1"
                        max="5"
                        placeholder="1–5"
                        value={form.memberCount}
                        onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
                        required
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
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
                      <Label htmlFor="captainName">
                        Vor- und Nachname <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="captainName"
                        placeholder="Max Mustermann"
                        value={form.captainName}
                        onChange={(e) => setForm({ ...form, captainName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="captainPhone">
                        Tel. Mobile <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="captainPhone"
                        type="tel"
                        placeholder="+41 79 123 45 67"
                        value={form.captainPhone}
                        onChange={(e) => setForm({ ...form, captainPhone: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Wurst Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wide">
                    <span className="text-base">🌭</span>
                    Wurstbestellung
                  </div>

                  <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: "wurstKalb", label: "Kalbsbratwurst", emoji: "🥩" },
                        { key: "wurstKloepfer", label: "Klöpfer", emoji: "🌭" },
                        { key: "wurstVegi", label: "Vegi", emoji: "🥦" },
                      ].map(({ key, label, emoji }) => (
                        <div key={key} className="space-y-2 text-center">
                          <div className="text-2xl">{emoji}</div>
                          <Label htmlFor={key} className="text-xs font-semibold block">{label}</Label>
                          <Input
                            id={key}
                            type="number"
                            min="0"
                            max="10"
                            value={form[key as keyof typeof form]}
                            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            className="text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      ))}
                    </div>

                    {totalWurste > 0 && (
                      <div className="flex items-center justify-center gap-2 pt-2 border-t text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Total: {totalWurste} Würste bestellt</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fun Captcha */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wide">
                    <span className="text-base">🤖</span>
                    Ich bin kein Roboter
                  </div>

                  <motion.div
                    animate={captchaShaking ? { x: [-8, 8, -8, 8, -4, 4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-colors",
                      captchaVerified
                        ? "border-green-500/50 bg-green-500/5"
                        : captchaError
                        ? "border-destructive/50 bg-destructive/5"
                        : "border-dashed border-muted-foreground/30 bg-muted/20"
                    )}
                  >
                    {captchaVerified ? (
                      <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-8 w-8" />
                        <div>
                          <p className="font-bold">Mensch bestätigt! 🎉</p>
                          <p className="text-sm opacity-80">Du bist definitiv kein Roboter. Gut gemacht!</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="text-3xl">🤔</span>
                          <div>
                            <p className="font-semibold text-sm">{captcha.question}</p>
                            <p className="text-xs text-muted-foreground mt-1">{captcha.hint}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Deine Antwort..."
                            value={captchaInput}
                            onChange={(e) => {
                              setCaptchaInput(e.target.value);
                              setCaptchaError(false);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCaptchaCheck())}
                            className={cn(captchaError && "border-destructive")}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCaptchaCheck}
                            className="shrink-0"
                          >
                            Prüfen
                          </Button>
                        </div>
                        {captchaError && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Falsche Antwort! Versuch's nochmal, Roboter 🤖
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitMutation.isPending || !captchaVerified}
                  className="w-full h-14 text-base font-bold btn-animate bg-gradient-to-r from-primary to-teal-400 hover:from-primary/90 hover:to-teal-400/90 shadow-lg shadow-primary/20"
                >
                  {submitMutation.isPending ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Wird gesendet...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Team anmelden! 🍺
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

        {/* Placeholder for Flyer */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-12 text-center text-muted-foreground space-y-2"
        >
          <div className="text-4xl">🖼️</div>
          <p className="font-semibold">Flyer kommt bald</p>
          <p className="text-sm">Der offizielle Event-Flyer wird hier angezeigt sobald er fertig ist.</p>
        </MotionDiv>

      </div>
    </div>
  );
}
