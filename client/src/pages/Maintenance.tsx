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
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
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
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <Wrench className="h-8 w-8 text-warning" />
            </div>
            <CardTitle className="text-2xl">Wartungsmodus</CardTitle>
            <CardDescription className="text-base">
              Die Seite ist gerade kurz offline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">
              Komm später nochmal vorbei. Mitglieder können sich anmelden und
              die internen Tools weiter nutzen.
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
