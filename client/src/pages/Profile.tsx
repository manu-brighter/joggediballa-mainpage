import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Mail, Shield, Calendar, Camera, ArrowLeft, Upload, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { motion } from "framer-motion";
import { toast } from "sonner";

const MotionDiv = motion.div;

export default function Profile() {
  const { user, loading, isAuthenticated } = useAuth();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const updatePictureMutation = trpc.profile.updatePicture.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("Profilbild erfolgreich aktualisiert!");
      setIsUploadDialogOpen(false);
      setPreviewUrl(null);
      setSelectedFile(null);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wähle eine Bilddatei aus.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Das Bild darf maximal 5MB groß sein.");
      return;
    }

    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/upload/profile-picture", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload fehlgeschlagen");
      }

      const { url, key } = await response.json();

      await updatePictureMutation.mutateAsync({
        profilePictureUrl: url,
        profilePictureKey: key,
      });
    } catch (error) {
      toast.error("Fehler beim Hochladen des Bildes");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>Anmeldung erforderlich</CardTitle>
            <CardDescription>
              Bitte melde dich an, um dein Profil zu sehen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={getLoginUrl()}>
              <Button className="w-full">Jetzt anmelden</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500 hover:bg-red-600">Admin</Badge>;
      case "maintainer":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Maintainer</Badge>;
      case "editor":
        return <Badge className="bg-green-500 hover:bg-green-600">Editor</Badge>;
      default:
        return <Badge variant="secondary">Mitglied</Badge>;
    }
  };

  return (
    <div className="container py-8 max-w-2xl">
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Back Button */}
        <Link href="/">
          <Button variant="ghost" className="mb-6 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Startseite
          </Button>
        </Link>

        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            {/* Profile Picture with Hover Edit */}
            <div className="relative mx-auto mb-4">
              <button
                onClick={() => setIsUploadDialogOpen(true)}
                className="relative group cursor-pointer block"
              >
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl transition-all group-hover:border-primary/30">
                  <AvatarImage src={user.profilePictureUrl || undefined} alt={user.name || "Profil"} />
                  <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                {/* Hover Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <Camera className="h-6 w-6 text-white mb-1" />
                  <span className="text-white text-xs font-medium">Bild ändern</span>
                </div>
              </button>
            </div>
            <CardTitle className="text-2xl">{user.name || "Unbekannter Benutzer"}</CardTitle>
            <div className="flex justify-center mt-2">
              {getRoleBadge(user.role)}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <Separator />

            {/* User Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profil-Informationen
              </h3>
              
              <div className="grid gap-4">
                {user.email && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">E-Mail</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Rolle</p>
                    <p className="font-medium capitalize">{user.role}</p>
                  </div>
                </div>

                {user.createdAt && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Mitglied seit</p>
                      <p className="font-medium">
                        {new Date(user.createdAt).toLocaleDateString("de-DE", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Links for Admins/Maintainers */}
            {(user.role === "admin" || user.role === "maintainer") && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Schnellzugriff</h3>
                  <div className="grid gap-2">
                    {user.role === "admin" && (
                      <Link href="/admin">
                        <Button variant="outline" className="w-full justify-start">
                          <Shield className="h-4 w-4 mr-2" />
                          Admin-Dashboard
                        </Button>
                      </Link>
                    )}
                    <Link href="/goennermitglieder">
                      <Button variant="outline" className="w-full justify-start">
                        <User className="h-4 w-4 mr-2" />
                        Gönnermitglieder
                      </Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Profile Picture Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profilbild ändern</DialogTitle>
            <DialogDescription>
              Lade ein neues Profilbild hoch. Unterstützte Formate: JPG, PNG, GIF (max. 5MB)
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-6 py-6">
            {/* Preview */}
            <div className="relative">
              <Avatar className="h-32 w-32 ring-4 ring-border">
                <AvatarImage 
                  src={previewUrl || user.profilePictureUrl || undefined} 
                  alt="Vorschau" 
                />
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Bild auswählen
            </Button>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setIsUploadDialogOpen(false);
              setPreviewUrl(null);
              setSelectedFile(null);
            }}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || isUploading}
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Hochladen...
                </>
              ) : (
                "Speichern"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
