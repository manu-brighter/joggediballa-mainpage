import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Wrench, LogIn } from 'lucide-react';
import { getLoginUrl } from '@/const';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/Jogge_Di_Balla_Final_Transparent.png"
            alt="Jogge di Balla Logo"
            className="h-24 w-auto"
          />
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
              <Wrench className="h-8 w-8 text-orange-500" />
            </div>
            <CardTitle className="text-2xl">Wartungsmodus</CardTitle>
            <CardDescription className="text-base">
              Wir arbeiten gerade an Verbesserungen für euch!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">
              Die Website ist vorübergehend nicht verfügbar. Bitte versuche es
              später erneut oder melde dich an, um auf die Website zuzugreifen.
            </p>

            <div className="flex flex-col gap-3">
              <a href={getLoginUrl()} className="w-full">
                <Button className="w-full gap-2" size="lg">
                  <LogIn className="h-4 w-4" />
                  Anmelden
                </Button>
              </a>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Nur für Mitglieder und Administratoren zugänglich
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          © {new Date().getFullYear()} Jogge di Balla
        </p>
      </MotionDiv>
    </div>
  );
}
