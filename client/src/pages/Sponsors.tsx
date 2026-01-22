import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Heart, Gift, Trophy, ArrowRight, Plus, Trash2, ExternalLink, Upload, Image, X, Loader2, Star, Crown, Mail } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MotionDiv = motion.div;

export default function Sponsors() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSponsor, setSelectedSponsor] = useState<{ id: number; name: string } | null>(null);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: sponsors = [], isLoading } = trpc.sponsors.list.useQuery();

  const createSponsorMutation = trpc.sponsors.create.useMutation({
    onSuccess: () => {
      utils.sponsors.list.invalidate();
      toast.success("Sponsor erfolgreich hinzugefügt!");
      resetForm();
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const deleteSponsorMutation = trpc.sponsors.delete.useMutation({
    onSuccess: () => {
      utils.sponsors.list.invalidate();
      toast.success("Sponsor gelöscht!");
      setDeleteDialogOpen(false);
      setSelectedSponsor(null);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const isMaintainerOrAdmin = user && ["admin", "maintainer"].includes(user.role);

  const resetForm = () => {
    setName("");
    setWebsiteUrl("");
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wähle eine Bilddatei aus.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Das Bild darf maximal 5MB gross sein.");
      return;
    }

    setLogoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreateSponsor = async () => {
    if (!name.trim()) {
      toast.error("Bitte gib einen Namen ein");
      return;
    }

    try {
      setUploading(true);

      let logoUrl: string | undefined;
      let logoKey: string | undefined;

      // Upload logo if provided
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        formData.append("type", "sponsor");

        const response = await fetch("/api/upload/sponsor-logo", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Logo-Upload fehlgeschlagen");
        }

        const data = await response.json();
        logoUrl = data.url;
        logoKey = data.key;
      }

      // Create sponsor
      await createSponsorMutation.mutateAsync({
        name: name.trim(),
        websiteUrl: websiteUrl.trim() || undefined,
        logoUrl,
        logoKey,
      });
    } catch (error) {
      console.error("Error creating sponsor:", error);
      toast.error("Fehler beim Erstellen des Sponsors");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSponsor = () => {
    if (selectedSponsor) {
      deleteSponsorMutation.mutate({ sponsorId: selectedSponsor.id });
    }
  };

  const openDeleteDialog = (sponsor: { id: number; name: string }) => {
    setSelectedSponsor(sponsor);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="container py-12 space-y-8">
      {/* Header */}
      <MotionDiv
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/5 mb-4">
          <Heart className="h-10 w-10 text-secondary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black">
          <span className="gradient-text">Unsere Sponsoren</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Ein grosses Dankeschön an alle, die uns unterstützen und unsere Events möglich machen!
        </p>
      </MotionDiv>

      {/* Add Sponsor Button */}
      {isMaintainerOrAdmin && (
        <div className="flex justify-center">
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="lg" className="btn-animate gap-2">
                <Plus className="h-5 w-5" />
                Sponsor hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Neuen Sponsor hinzufügen</DialogTitle>
                <DialogDescription>
                  Füge einen neuen Sponsor mit optionalem Logo und Website-Link hinzu.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sponsor-Name"
                  />
                </div>

                {/* Website Input */}
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>

                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    PNG mit transparentem Hintergrund empfohlen. Max. 5MB.
                  </p>
                  
                  {logoPreview ? (
                    <div className="relative">
                      <div className="border-2 border-dashed border-border rounded-xl p-4 bg-muted/30">
                        <div className="flex items-center justify-center">
                          <div className="relative w-32 h-32 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImNoZWNrZXJib2FyZCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlZWUiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2VlZSIvPjxyZWN0IHg9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmZmYiLz48cmVjdCB5PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZmZmIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2NoZWNrZXJib2FyZCkiLz48L3N2Zz4=')] rounded-lg flex items-center justify-center">
                            <img
                              src={logoPreview}
                              alt="Logo Vorschau"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        </div>
                        <p className="text-center text-sm text-muted-foreground mt-2">
                          {logoFile?.name}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
                        onClick={clearLogo}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="p-3 rounded-full bg-muted">
                          <Upload className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-medium">Klicken zum Hochladen</span>
                        <span className="text-xs">PNG, JPG, SVG (max. 5MB)</span>
                      </div>
                    </button>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button
                  onClick={handleCreateSponsor}
                  disabled={uploading || createSponsorMutation.isPending || !name.trim()}
                  className="gap-2"
                >
                  {uploading || createSponsorMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Lädt...
                    </>
                  ) : (
                    "Hinzufügen"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Sponsors Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sponsors.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <Image className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              Noch keine Sponsoren vorhanden.
            </p>
            {isMaintainerOrAdmin && (
              <p className="text-sm text-muted-foreground mt-2">
                Füge den ersten Sponsor hinzu!
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <AnimatePresence>
            {sponsors.map((sponsor, index) => (
              <MotionDiv
                key={sponsor.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="group relative overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                  <CardHeader className="p-4">
                    <div className="aspect-square flex items-center justify-center bg-muted/50 rounded-xl overflow-hidden">
                      {sponsor.logoUrl ? (
                        <img
                          src={sponsor.logoUrl}
                          alt={sponsor.name}
                          className="max-w-full max-h-full object-contain p-4"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Heart className="h-12 w-12 mb-2" />
                          <span className="text-xs">Kein Logo</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <CardTitle className="text-center text-sm truncate">{sponsor.name}</CardTitle>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      {sponsor.websiteUrl && (
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <a
                            href={sponsor.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Website
                          </a>
                        </Button>
                      )}
                      {isMaintainerOrAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog({ id: sponsor.id, name: sponsor.name })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </MotionDiv>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Become a Sponsor CTA */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-12"
      >
        <Card className="bg-gradient-to-br from-primary/5 via-secondary/5 to-primary/5 border-primary/20 overflow-hidden">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">Werde Sponsor von Jogge di Balla</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                  Unterstütze unseren Verein und profitiere von unseren Werbe-Vorteilen!
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Standard Package */}
                <div className="bg-background/50 backdrop-blur-sm rounded-xl p-6 border border-border hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-bold">Standard Paket | CHF 50.-</h3>
                    <span className="text-muted-foreground sl-2">pro Jahr</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      Logo und Name auf unserer Website
                    </li>
                  </ul>
                </div>
                
                {/* Premium Package */}
                <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-6 border-2 border-primary/30 hover:border-primary/50 transition-all relative">
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                    Empfohlen
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-bold">Premium Paket | CHF 100.-</h3>
                    <span className="text-muted-foreground sl-2">pro Jahr</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      Alles aus Standard
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      Social Media Shoutout
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      Erwähnung und Werbung an unseren Events
                    </li>
                  </ul>
                </div>
              </div>
              
              <Button asChild size="lg" className="btn-animate gap-2">
                <Link href="/contact">
                  <Mail className="h-5 w-5" />
                  Jetzt Kontakt aufnehmen
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Werde Gönnermitglied Section */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="max-w-3xl mx-auto mt-20"
      >
        <Card className="border-2 border-primary/30 overflow-hidden">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Gift className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl md:text-3xl">Werde Gönnermitglied!</CardTitle>
            <CardDescription className="text-lg">
              Unterstütze Jogge di Balla und profitiere von exklusiven Vorteilen
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="inline-block px-6 py-3 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-3xl font-bold text-primary">CHF 20.-</span>
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
              onClick={() => navigate("/contact")}
            >
              Jetzt Gönner werden, schreib uns!
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sponsor löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du den Sponsor "{selectedSponsor?.name}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSponsor}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSponsorMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Löschen...
                </>
              ) : (
                "Löschen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
