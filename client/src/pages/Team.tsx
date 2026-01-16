import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Upload, X, Loader2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

const MotionDiv = motion.div;

interface MemberFormData {
  name: string;
  nickname: string;
  role: string;
  bio: string;
}

// Helper function to create centered aspect crop
function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      { unit: "%", width: 90 },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export default function Team() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: members = [], isLoading } = trpc.team.list.useQuery();

  // Member management state
  const [createMemberOpen, setCreateMemberOpen] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [deleteMemberOpen, setDeleteMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string } | null>(null);
  const [memberForm, setMemberForm] = useState<MemberFormData>({
    name: "",
    nickname: "",
    role: "",
    bio: ""
  });
  
  // Photo upload state with cropping
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const isLoggedIn = !!user;
  const canManageTeam = user && ["admin", "maintainer"].includes(user.role);

  // Mutations
  const createMemberMutation = trpc.team.create.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      toast.success("Mitglied erfolgreich hinzugefügt!");
      setCreateMemberOpen(false);
      resetMemberForm();
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const updateMemberMutation = trpc.team.update.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      toast.success("Mitglied aktualisiert!");
      setEditMemberOpen(false);
      resetMemberForm();
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const deleteMemberMutation = trpc.team.delete.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      toast.success("Mitglied entfernt!");
      setDeleteMemberOpen(false);
      setSelectedMember(null);
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const reorderMemberMutation = trpc.team.reorder.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const resetMemberForm = () => {
    setMemberForm({ name: "", nickname: "", role: "", bio: "" });
    setSelectedMember(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setOriginalImage(null);
    setShowCropper(false);
    setCrop(undefined);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wähle eine Bilddatei aus");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Das Bild ist zu groß (max. 25MB)");
      return;
    }

    // Show original image for cropping
    const reader = new FileReader();
    reader.onload = () => {
      setOriginalImage(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1)); // 1:1 aspect ratio
  }, []);

  const getCroppedImg = async (): Promise<Blob | null> => {
    if (!imgRef.current || !crop) return null;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const pixelCrop = {
      x: (crop.x / 100) * image.width * scaleX,
      y: (crop.y / 100) * image.height * scaleY,
      width: (crop.width / 100) * image.width * scaleX,
      height: (crop.height / 100) * image.height * scaleY,
    };

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  };

  const handleCropComplete = async () => {
    const croppedBlob = await getCroppedImg();
    if (croppedBlob) {
      const file = new File([croppedBlob], "cropped-photo.jpg", { type: "image/jpeg" });
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(croppedBlob));
    }
    setShowCropper(false);
    setOriginalImage(null);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setOriginalImage(null);
    setShowCropper(false);
    setCrop(undefined);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handleCreateMember = async () => {
    if (!memberForm.name.trim()) {
      toast.error("Bitte gib einen Namen ein");
      return;
    }

    try {
      setUploading(true);

      let photoUrl: string | undefined;
      let photoKey: string | undefined;

      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);

        const response = await fetch("/api/upload/team-member-photo", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          throw new Error("Foto-Upload fehlgeschlagen");
        }

        const data = await response.json();
        photoUrl = data.url;
        photoKey = data.key;
      }

      await createMemberMutation.mutateAsync({
        name: memberForm.name.trim(),
        nickname: memberForm.nickname.trim() || undefined,
        role: memberForm.role.trim() || undefined,
        bio: memberForm.bio.trim() || undefined,
        photoUrl,
        photoKey
      });
    } catch (error) {
      console.error("Error creating member:", error);
      toast.error("Fehler beim Erstellen des Mitglieds");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateMember = async () => {
    if (!selectedMember || !memberForm.name.trim()) {
      toast.error("Bitte gib einen Namen ein");
      return;
    }

    try {
      setUploading(true);

      let photoUrl: string | undefined;
      let photoKey: string | undefined;

      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);

        const response = await fetch("/api/upload/team-member-photo", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          throw new Error("Foto-Upload fehlgeschlagen");
        }

        const data = await response.json();
        photoUrl = data.url;
        photoKey = data.key;
      }

      await updateMemberMutation.mutateAsync({
        memberId: selectedMember.id,
        name: memberForm.name.trim(),
        nickname: memberForm.nickname.trim() || undefined,
        role: memberForm.role.trim() || undefined,
        bio: memberForm.bio.trim() || undefined,
        ...(photoUrl && { photoUrl, photoKey })
      });
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error("Fehler beim Aktualisieren des Mitglieds");
    } finally {
      setUploading(false);
    }
  };

  const openEditMember = (member: typeof members[0]) => {
    setSelectedMember({ id: member.id, name: member.name });
    setMemberForm({
      name: member.name,
      nickname: member.nickname || "",
      role: member.role || "",
      bio: member.bio || ""
    });
    // Set photo preview if member has a photo
    if (member.photoUrl) {
      setPhotoPreview(member.photoUrl);
    } else {
      setPhotoPreview(null);
    }
    setPhotoFile(null); // Reset file selection
    setEditMemberOpen(true);
  };

  const openDeleteMember = (member: { id: number; name: string }) => {
    setSelectedMember(member);
    setDeleteMemberOpen(true);
  };

  // Reorder member
  const moveMember = (memberId: number, direction: "up" | "down") => {
    const currentIndex = members.findIndex(m => m.id === memberId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= members.length) return;

    const newOrder = members.map(m => m.id);
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    
    reorderMemberMutation.mutate({ memberIds: newOrder });
  };

  // Photo upload button component - modern, clean design
  const PhotoUploadButton = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Foto</Label>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />
      {photoPreview && !showCropper ? (
        <div className="space-y-3">
          {/* Preview card */}
          <div className="relative group rounded-xl overflow-hidden border border-border bg-muted/30">
            <div className="aspect-square max-w-[280px] mx-auto">
              <img
                src={photoPreview}
                alt="Vorschau"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Ändern
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={clearPhoto}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Entfernen
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Hover über das Bild um es zu ändern
          </p>
        </div>
      ) : showCropper && originalImage ? (
        <div className="space-y-4">
          {/* Modern cropper container */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Ziehe den Rahmen um den gewünschten Bildausschnitt
            </p>
            <div className="flex justify-center">
              <div className="relative max-w-full max-h-[400px] overflow-hidden rounded-lg">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop: Crop) => setCrop(percentCrop)}
                  aspect={1}
                  circularCrop={false}
                  className="rounded-lg"
                >
                  <img
                    ref={imgRef}
                    src={originalImage}
                    alt="Zu beschneiden"
                    onLoad={onImageLoad}
                    style={{ maxHeight: '400px', width: 'auto' }}
                    className="rounded-lg"
                  />
                </ReactCrop>
              </div>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCropper(false);
                setOriginalImage(null);
              }}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={handleCropComplete}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Zuschneiden & Verwenden
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => photoInputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-all duration-200 p-8"
        >
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Foto hochladen</p>
              <p className="text-xs mt-1">Klicke hier oder ziehe ein Bild</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="container py-12 space-y-8">
      {/* Header */}
      <MotionDiv
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
          <Users className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black">
          <span className="gradient-text">Unser Team</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Lerne die Menschen kennen, die Jogge di Balla zu dem machen, was es ist – 
          ein Ort voller Action, Kreativität und unvergesslicher Momente.
        </p>
      </MotionDiv>

      {/* Add Member Button */}
      {canManageTeam && (
        <div className="flex justify-center">
          <Dialog open={createMemberOpen} onOpenChange={(open) => {
            setCreateMemberOpen(open);
            if (!open) resetMemberForm();
          }}>
            <DialogTrigger asChild>
              <Button size="lg" className="btn-animate gap-2">
                <Plus className="h-5 w-5" />
                Mitglied hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neues Mitglied hinzufügen</DialogTitle>
                <DialogDescription>
                  Füge ein neues Team-Mitglied mit Foto und Beschreibung hinzu.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <PhotoUploadButton />

                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={memberForm.name}
                    onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                    placeholder="Vollständiger Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nickname">Spitzname</Label>
                  <Input
                    id="nickname"
                    value={memberForm.nickname}
                    onChange={(e) => setMemberForm({ ...memberForm, nickname: e.target.value })}
                    placeholder="Spitzname"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rolle</Label>
                  <Input
                    id="role"
                    value={memberForm.role}
                    onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                    placeholder="z.B. Gründer, DJ, Organisator"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Beschreibung</Label>
                  <Textarea
                    id="bio"
                    value={memberForm.bio}
                    onChange={(e) => setMemberForm({ ...memberForm, bio: e.target.value })}
                    placeholder="Kurze Beschreibung..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setCreateMemberOpen(false)}>
                  Abbrechen
                </Button>
                <Button
                  onClick={handleCreateMember}
                  disabled={uploading || createMemberMutation.isPending || !memberForm.name.trim()}
                  className="gap-2"
                >
                  {uploading || createMemberMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Lädt...</>
                  ) : "Hinzufügen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Team Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              Noch keine Team-Mitglieder vorhanden.
            </p>
            {canManageTeam && (
              <p className="text-sm text-muted-foreground mt-2">
                Füge das erste Mitglied hinzu!
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {members.map((member, index) => (
              <MotionDiv
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className="overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300 group">
                  {/* Member Photo - no padding, full bleed */}
                  <div className="aspect-square overflow-hidden bg-gradient-to-br from-muted to-muted/50 relative">
                    {member.photoUrl ? (
                      <img
                        src={member.photoUrl}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-4xl font-bold text-primary">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Edit/Delete Buttons - visible styling for all backgrounds */}
                    {canManageTeam && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 text-gray-900 dark:text-white shadow-md"
                          onClick={() => openEditMember(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 shadow-md"
                          onClick={() => openDeleteMember({ id: member.id, name: member.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Reorder buttons - only for logged in users */}
                    {isLoggedIn && (
                      <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 text-gray-900 dark:text-white shadow-md"
                          onClick={() => moveMember(member.id, "up")}
                          disabled={index === 0 || reorderMemberMutation.isPending}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 text-gray-900 dark:text-white shadow-md"
                          onClick={() => moveMember(member.id, "down")}
                          disabled={index === members.length - 1 || reorderMemberMutation.isPending}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      {member.name}
                      {member.nickname && (
                        <span className="text-sm font-normal text-muted-foreground">
                          "{member.nickname}"
                        </span>
                      )}
                    </CardTitle>
                    {member.role && (
                      <CardDescription className="text-primary font-medium">
                        {member.role}
                      </CardDescription>
                    )}
                  </CardHeader>
                  
                  {member.bio && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-3">{member.bio}</p>
                    </CardContent>
                  )}
                </Card>
              </MotionDiv>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Member Dialog */}
      <Dialog open={editMemberOpen} onOpenChange={(open) => {
        setEditMemberOpen(open);
        if (!open) resetMemberForm();
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mitglied bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Informationen des Team-Mitglieds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <PhotoUploadButton isEdit />

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                placeholder="Vollständiger Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-nickname">Spitzname</Label>
              <Input
                id="edit-nickname"
                value={memberForm.nickname}
                onChange={(e) => setMemberForm({ ...memberForm, nickname: e.target.value })}
                placeholder="Spitzname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Rolle</Label>
              <Input
                id="edit-role"
                value={memberForm.role}
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                placeholder="z.B. Gründer, DJ, Organisator"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bio">Beschreibung</Label>
              <Textarea
                id="edit-bio"
                value={memberForm.bio}
                onChange={(e) => setMemberForm({ ...memberForm, bio: e.target.value })}
                placeholder="Kurze Beschreibung..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditMemberOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleUpdateMember}
              disabled={uploading || updateMemberMutation.isPending || !memberForm.name.trim()}
              className="gap-2"
            >
              {uploading || updateMemberMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Lädt...</>
              ) : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Dialog */}
      <AlertDialog open={deleteMemberOpen} onOpenChange={setDeleteMemberOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du "{selectedMember?.name}" wirklich aus dem Team entfernen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMember && deleteMemberMutation.mutate({ memberId: selectedMember.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMemberMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Entfernen...</>
              ) : "Entfernen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
