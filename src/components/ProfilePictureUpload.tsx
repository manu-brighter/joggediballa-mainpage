import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Upload, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfilePictureUploadProps {
  currentPictureUrl?: string | null;
  userName?: string | null;
  onUploadComplete?: () => void;
  size?: "sm" | "md" | "lg";
}

export function ProfilePictureUpload({ 
  currentPictureUrl, 
  userName,
  onUploadComplete,
  size = "md"
}: ProfilePictureUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const updatePictureMutation = trpc.profile.updatePicture.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("Profilbild erfolgreich aktualisiert!");
      setIsOpen(false);
      setPreviewUrl(null);
      setSelectedFile(null);
      onUploadComplete?.();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16"
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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
      toast.error("Das Bild darf maximal 5MB groß sein.");
      return;
    }

    setSelectedFile(file);
    
    // Create preview
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
      // Upload to S3 via backend
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

      // Update user profile
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="relative group cursor-pointer">
          <Avatar className={cn(sizeClasses[size], "ring-2 ring-border group-hover:ring-primary transition-all")}>
            <AvatarImage src={currentPictureUrl || undefined} alt={userName || "Profilbild"} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-4 w-4 text-white" />
          </div>
        </button>
      </DialogTrigger>
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
                src={previewUrl || currentPictureUrl || undefined} 
                alt="Vorschau" 
              />
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                {getInitials(userName)}
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
          <Button variant="outline" onClick={() => setIsOpen(false)}>
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
  );
}
