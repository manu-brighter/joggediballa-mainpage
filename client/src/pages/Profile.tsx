import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Mail, Shield, Calendar, Camera, ArrowLeft, Upload, Loader2, ZoomIn, Move, Pencil, Save, X } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { motion } from "framer-motion";
import { toast } from "sonner";

const MotionDiv = motion.div;

export default function Profile() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editMemberSince, setEditMemberSince] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Crop state
  const [cropScale, setCropScale] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });
  const cropContainerRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const updatePictureMutation = trpc.profile.updatePicture.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("Profilbild erfolgreich aktualisiert!");
      setIsUploadDialogOpen(false);
      resetCropState();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const updateProfileMutation = trpc.profile.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("Profil erfolgreich aktualisiert!");
      setIsEditingProfile(false);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  useEffect(() => {
    if (user && isEditingProfile) {
      setEditDisplayName(user.displayName || user.name || "");
      setEditMemberSince(user.memberSince ? new Date(user.memberSince).toISOString().split("T")[0] : "");
    }
  }, [user, isEditingProfile]);

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      displayName: editDisplayName || undefined,
      memberSince: editMemberSince ? new Date(editMemberSince) : undefined,
    });
  };

  const resetCropState = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setCropScale(1);
    setCropPosition({ x: 0, y: 0 });
    setOriginalImageSize({ width: 0, height: 0 });
  };

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
    setCropScale(1);
    setCropPosition({ x: 0, y: 0 });
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      
      // Get original image dimensions
      const img = new Image();
      img.onload = () => {
        setOriginalImageSize({ width: img.width, height: img.height });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y });
  }, [cropPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const containerSize = 192; // 12rem = 192px
    const maxOffset = (containerSize * (cropScale - 1)) / 2;
    
    const newX = Math.max(-maxOffset, Math.min(maxOffset, e.clientX - dragStart.x));
    const newY = Math.max(-maxOffset, Math.min(maxOffset, e.clientY - dragStart.y));
    
    setCropPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, cropScale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - cropPosition.x, y: touch.clientY - cropPosition.y });
  }, [cropPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const containerSize = 192;
    const maxOffset = (containerSize * (cropScale - 1)) / 2;
    
    const newX = Math.max(-maxOffset, Math.min(maxOffset, touch.clientX - dragStart.x));
    const newY = Math.max(-maxOffset, Math.min(maxOffset, touch.clientY - dragStart.y));
    
    setCropPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, cropScale]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Create cropped image
  const createCroppedImage = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!previewUrl) {
        reject(new Error("No image to crop"));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Output size (square)
        const outputSize = 512;
        canvas.width = outputSize;
        canvas.height = outputSize;

        // Calculate crop area based on scale and position
        const containerSize = 192;
        const scaledSize = containerSize * cropScale;
        
        // The visible area in the container (always 192x192)
        // Position is the offset of the image from center
        const centerX = img.width / 2;
        const centerY = img.height / 2;
        
        // Calculate the source rectangle
        const sourceSize = Math.min(img.width, img.height) / cropScale;
        const sourceX = centerX - sourceSize / 2 - (cropPosition.x / containerSize) * sourceSize;
        const sourceY = centerY - sourceSize / 2 - (cropPosition.y / containerSize) * sourceSize;

        // Draw the cropped image
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          outputSize,
          outputSize
        );

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Could not create blob"));
            }
          },
          "image/jpeg",
          0.9
        );
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = previewUrl;
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Create cropped image
      const croppedBlob = await createCroppedImage();
      const croppedFile = new File([croppedBlob], "profile.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", croppedFile);

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
        <Button 
          variant="ghost" 
          className="mb-6 -ml-2"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zur Startseite
        </Button>

        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            {/* Profile Picture with Hover Edit */}
            <div className="relative mx-auto mb-4">
              <button
                onClick={() => setIsUploadDialogOpen(true)}
                className="relative group cursor-pointer block"
              >
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl transition-all group-hover:border-primary/30">
                  <AvatarImage 
                    src={user.profilePictureUrl || undefined} 
                    alt={user.name || "Profil"} 
                    className="object-cover"
                  />
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Profil-Informationen
                </h3>
                {!isEditingProfile ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProfile(true)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Bearbeiten
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingProfile(false)}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Abbrechen
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveProfile}
                      disabled={updateProfileMutation.isPending}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {updateProfileMutation.isPending ? "Speichert..." : "Speichern"}
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="grid gap-4">
                {/* Display Name */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Anzeigename</p>
                    {isEditingProfile ? (
                      <Input
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder="Dein Anzeigename"
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{user.displayName || user.name || "Nicht gesetzt"}</p>
                    )}
                  </div>
                </div>
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

                {/* Member Since */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Mitglied seit</p>
                    {isEditingProfile ? (
                      <Input
                        type="date"
                        value={editMemberSince}
                        onChange={(e) => setEditMemberSince(e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">
                        {user.memberSince
                          ? new Date(user.memberSince).toLocaleDateString("de-DE", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("de-DE", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : "Nicht gesetzt"}
                      </p>
                    )}
                  </div>
                </div>
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
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate("/admin")}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Admin-Dashboard
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => navigate("/goennermitglieder")}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Gönnermitglieder
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Profile Picture Upload Dialog with Crop */}
      <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
        setIsUploadDialogOpen(open);
        if (!open) resetCropState();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profilbild ändern</DialogTitle>
            <DialogDescription>
              {previewUrl 
                ? "Passe den Bildausschnitt an. Ziehe das Bild oder nutze den Zoom-Regler."
                : "Lade ein neues Profilbild hoch. Unterstützte Formate: JPG, PNG, GIF (max. 5MB)"
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-6 py-6">
            {/* Preview with Crop */}
            <div 
              ref={cropContainerRef}
              className="relative w-48 h-48 rounded-full overflow-hidden ring-4 ring-border cursor-move select-none"
              onMouseDown={previewUrl ? handleMouseDown : undefined}
              onMouseMove={previewUrl ? handleMouseMove : undefined}
              onMouseUp={previewUrl ? handleMouseUp : undefined}
              onMouseLeave={previewUrl ? handleMouseUp : undefined}
              onTouchStart={previewUrl ? handleTouchStart : undefined}
              onTouchMove={previewUrl ? handleTouchMove : undefined}
              onTouchEnd={previewUrl ? handleTouchEnd : undefined}
            >
              {previewUrl ? (
                <img 
                  src={previewUrl}
                  alt="Vorschau"
                  className="absolute w-full h-full object-cover pointer-events-none"
                  style={{
                    transform: `scale(${cropScale}) translate(${cropPosition.x / cropScale}px, ${cropPosition.y / cropScale}px)`,
                    transformOrigin: 'center',
                  }}
                  draggable={false}
                />
              ) : (
                <Avatar className="h-48 w-48">
                  <AvatarImage 
                    src={user.profilePictureUrl || undefined} 
                    alt="Aktuelles Bild"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              )}
              
              {/* Drag hint overlay */}
              {previewUrl && !isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                  <Move className="h-8 w-8 text-white drop-shadow-lg" />
                </div>
              )}
            </div>

            {/* Zoom Slider */}
            {previewUrl && (
              <div className="w-full max-w-[200px] space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <ZoomIn className="h-4 w-4" />
                  <span>Zoom: {Math.round(cropScale * 100)}%</span>
                </div>
                <Slider
                  value={[cropScale]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={([value]) => {
                    setCropScale(value);
                    // Reset position when zooming out to prevent image going out of bounds
                    const containerSize = 192;
                    const maxOffset = (containerSize * (value - 1)) / 2;
                    setCropPosition({
                      x: Math.max(-maxOffset, Math.min(maxOffset, cropPosition.x)),
                      y: Math.max(-maxOffset, Math.min(maxOffset, cropPosition.y)),
                    });
                  }}
                />
              </div>
            )}

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
              {previewUrl ? "Anderes Bild wählen" : "Bild auswählen"}
            </Button>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setIsUploadDialogOpen(false);
              resetCropState();
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
