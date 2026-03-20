import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trophy,
  MapPin,
  Info,
  Send,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div;

const RULES_BASIC = [
  { icon: "👥", text: "Max. 5er Teams" },
  { icon: "💰", text: "CHF 75.– Startgeld pro Team" },
  { icon: "🍺", text: "1 Harasse pro Team" },
  { icon: "🥩", text: "Für jede Person im Team eine Bratwurst" },
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
    description: "Melde dein Team für den Harassenlauf an! Max. 5er Teams, CHF 75.– Startgeld pro Team.",
  });

  const [rulesOpen, setRulesOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notRobot, setNotRobot] = useState(false);

  // Form state
  const [form, setForm] = useState({
    teamName: "",
    memberCount: "",
    captainFirstName: "",
    captainLastName: "",
    captainPhone: "",
    wurstKalb: 0,
    wurstKloepfer: 0,
    wurstVegi: 0,
    additionalInfo: "",
  });

  const [memberCountError, setMemberCountError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Validates Swiss and international phone numbers
  const validatePhone = (phone: string): boolean => {
    // Remove all spaces, dashes, dots, parentheses
    const cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
    // Swiss: 07x, 0800, 0900, +41, 0041
    // International: +XX... or 00XX...
    const swissLocal = /^0[0-9]{9}$/;
    const swissIntl = /^(\+41|0041)[0-9]{9}$/;
    const international = /^(\+|00)[1-9][0-9]{7,14}$/;
    return swissLocal.test(cleaned) || swissIntl.test(cleaned) || international.test(cleaned);
  };

  const handlePhoneChange = (val: string) => {
    setForm({ ...form, captainPhone: val });
    // Clear error while typing so it doesn't persist after correction
    if (phoneError && validatePhone(val)) {
      setPhoneError("");
    }
  };

  const handlePhoneBlur = (val: string) => {
    if (val.trim() === "") {
      setPhoneError("");
      return;
    }
    if (!validatePhone(val)) {
      setPhoneError("Ungültige Telefonnummer – z.B. 079 123 45 67 oder +41 79 123 45 67");
    } else {
      setPhoneError("");
    }
  };

  const memberCountNum = parseInt(form.memberCount) || 0;
  const wurstTotal = form.wurstKalb + form.wurstKloepfer + form.wurstVegi;
  const wurstMax = memberCountNum;
  const showWurstSection = memberCountNum >= 1 && memberCountNum <= 5;

  const submitMutation = trpc.harassenlauf.register.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error("Fehler beim Senden: " + err.message);
    },
  });

  const handleMemberCountChange = (val: string) => {
    setMemberCountError("");
    if (val === "") {
      setForm({ ...form, memberCount: "", wurstKalb: 0, wurstKloepfer: 0, wurstVegi: 0 });
      return;
    }
    const num = parseInt(val);
    if (isNaN(num) || num < 1 || num > 5) {
      setMemberCountError("Ungültige Mitgliederzahl – bitte eine Zahl zwischen 1 und 5 eingeben.");
      setForm({ ...form, memberCount: val });
      return;
    }
    // Reduce wurst if total exceeds new memberCount
    const newTotal = form.wurstKalb + form.wurstKloepfer + form.wurstVegi;
    if (newTotal > num) {
      setForm({ ...form, memberCount: val, wurstKalb: 0, wurstKloepfer: 0, wurstVegi: 0 });
    } else {
      setForm({ ...form, memberCount: val });
    }
  };

  const handleWurstChange = (key: "wurstKalb" | "wurstKloepfer" | "wurstVegi", val: number) => {
    const others = Object.entries({ wurstKalb: form.wurstKalb, wurstKloepfer: form.wurstKloepfer, wurstVegi: form.wurstVegi })
      .filter(([k]) => k !== key)
      .reduce((sum, [, v]) => sum + v, 0);
    const maxForThis = wurstMax - others;
    const clamped = Math.max(0, Math.min(val, maxForThis));
    setForm({ ...form, [key]: clamped });
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
      if (!notRobot) toast.error("Bitte bestätige, dass du kein Roboter bist!");
      return;
    }
    submitMutation.mutate({
      teamName: form.teamName,
      memberCount: memberCountNum,
      captainFirstName: form.captainFirstName,
      captainLastName: form.captainLastName,
      captainPhone: form.captainPhone,
      wurstKalb: form.wurstKalb,
      wurstKloepfer: form.wurstKloepfer,
      wurstVegi: form.wurstVegi,
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
          style={{ backgroundImage: "url(/joggediballa-pattern.png)", backgroundRepeat: "repeat", backgroundSize: "1129px 610px" }}
        />
        <MotionDiv
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center space-y-6 max-w-md"
        >
          <div className="text-8xl">🍺🎉🏆</div>
          <h1 className="text-3xl font-black gradient-text">Anmeldung erhalten!</h1>
          <p className="text-lg text-muted-foreground">
            Team <span className="font-bold text-foreground">«{form.teamName}»</span> ist dabei!
            Wir melden uns bei <span className="font-bold text-foreground">{form.captainFirstName} {form.captainLastName}</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Denkt daran: Kein Spuckschluck, kein Littering, kein Kindergarten. 😤
          </p>
          <Button size="lg" className="btn-animate" onClick={() => window.location.href = "/"}>
            Zurück zur Homepage
          </Button>
        </MotionDiv>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Full page gradient background */}
      <div className="absolute inset-0 hero-gradient" />
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.5]"
        style={{ backgroundImage: "url(/joggediballa-pattern.png)", backgroundRepeat: "repeat", backgroundSize: "1129px 610px" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.55_0.14_195_/_0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,oklch(0.68_0.18_18_/_0.1),transparent_50%)]" />
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10">
        {/* Hero Banner */}
        <div className="pt-28 pb-10">
          <div className="container text-center space-y-4 max-w-3xl mx-auto">
            <MotionDiv
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold"
            >
              Jogge di Balla präsentiert
            </MotionDiv>

            <MotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                <span className="gradient-text">Harassenlauf Anmeldung</span>
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
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-card/80 backdrop-blur-sm border hover:border-primary/40 transition-colors text-left"
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
                        <span className="text-orange-500 font-bold text-sm mt-0.5 shrink-0">{i + 1}.</span>
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
                          onChange={(e) => setForm({ ...form, teamName: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="memberCount">
                          Anzahl Teilnehmer <span className="text-destructive">*</span>
                          <span className="text-xs text-muted-foreground ml-1">(1–5)</span>
                        </Label>
                        <Input
                          id="memberCount"
                          type="number"
                          min="1"
                          max="5"
                          placeholder="1–5"
                          value={form.memberCount}
                          onChange={(e) => handleMemberCountChange(e.target.value)}
                          className={cn(memberCountError && "border-destructive focus-visible:ring-destructive")}
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
                          onChange={(e) => setForm({ ...form, captainFirstName: e.target.value })}
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
                          onChange={(e) => setForm({ ...form, captainLastName: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="captainPhone">
                          Tel. Mobile <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="captainPhone"
                          type="tel"
                          placeholder="+41 79 123 45 67"
                          value={form.captainPhone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          onBlur={(e) => handlePhoneBlur(e.target.value)}
                          className={cn(phoneError && "border-destructive focus-visible:ring-destructive")}
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
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wide">
                            <span className="text-base">🥩</span>
                            Wurstbestellung
                          </div>

                          <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Total max. <strong>{wurstMax}</strong> Würste (entspricht Anzahl Teilnehmer).
                              Noch verfügbar: <strong>{wurstMax - wurstTotal}</strong>
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { key: "wurstKalb" as const, label: "Kalbsbratwurst" },
                                { key: "wurstKloepfer" as const, label: "Klöpfer" },
                                { key: "wurstVegi" as const, label: "Vegi" },
                              ].map(({ key, label }) => (
                                <div key={key} className="space-y-2 text-center">
                                  <Label htmlFor={key} className="text-xs font-semibold block">{label}</Label>
                                  <Input
                                    id={key}
                                    type="number"
                                    min="0"
                                    max={wurstMax}
                                    value={form[key]}
                                    onChange={(e) => handleWurstChange(key, parseInt(e.target.value) || 0)}
                                    className="text-center"
                                  />
                                </div>
                              ))}
                            </div>

                            {wurstTotal > 0 && (
                              <div className="flex items-center justify-center gap-2 pt-2 border-t text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium">Total: {wurstTotal} Würste bestellt</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Additional Info */}
                  <div className="space-y-2">
                    <Label htmlFor="additionalInfo">
                      Zusätzliche Angaben / Wünsche / Infos
                      <span className="text-xs text-muted-foreground ml-2">(optional)</span>
                    </Label>
                    <Textarea
                      id="additionalInfo"
                      placeholder="Allergien, besondere Wünsche, Fragen, ..."
                      value={form.additionalInfo}
                      onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Not a Robot Checkbox */}
                  <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/20">
                    <Checkbox
                      id="notRobot"
                      checked={notRobot}
                      onCheckedChange={(checked) => setNotRobot(checked === true)}
                      className="h-5 w-5"
                    />
                    <label
                      htmlFor="notRobot"
                      className="text-sm font-medium cursor-pointer select-none flex items-center gap-2"
                    >
                      Ich bin kein Roboter 🤖
                    </label>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitMutation.isPending || !isFormValid}
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

        </div>
      </div>
    </div>
  );
}
