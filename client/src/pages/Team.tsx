import { useState, useCallback, useRef } from "react";
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
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Upload, X, Loader2, GripVertical, ArrowUp, ArrowDown, ZoomIn, ZoomOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

const MotionDiv = motion.div;

interface MemberFormData {
  name: string;
  nickname: string;
  role: string;
  bio: string;
}

// Helper function to create a cropped image
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

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

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      resolve(blob);
    }, "image/jpeg", 0.95);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}

export default function Team() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Fetch team members
  const { data: members = [], isLoading } = trpc.team.list.useQuery();

  // Mutations
  const createMutation = trpc.team.create.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      toast.success("Mitglied erfolgreich hinzugefügt");
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Fehler beim Hinzufügen: " + error.message);
    },
  });

  const updateMutation = trpc.team.update.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      toast.success("Mitglied erfolgreich aktualisiert");
      setEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Fehler beim Aktualisieren: " + error.message);
    },
  });

  const deleteMutation = trpc.team.delete.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      toast.success("Mitglied erfolgreich gelöscht");
      setDeleteDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error) => {
      toast.error("Fehler beim Löschen: " + error.message);
    },
  });

  const reorderMutation = trpc.team.reorder.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
    },
    onError: (error) => {
      toast.error("Fehler beim Sortieren: " + error.message);
    },
  });

  // Form state
  const [formData, setFormData] = useState<MemberFormData>({
    name: "",
    nickname: "",
    role: "",
    bio: "",
  });

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<typeof members[0] | null>(null);

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  
  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string>("");

  const photoInputRef = useRef<HTMLInputElement>(null);

  const isLoggedIn = !!user;
  const canManageTeam = user && ["admin", "maintainer", "editor"].includes(user.role);

  const resetForm = () => {
    setFormData({ name: "", nickname: "", role: "", bio: "" });
    setPhotoFile(null);
    setPhotoPreview("");
    setCroppedImageUrl("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Datei zu groß. Maximal 25MB erlaubt.");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilddateien sind erlaubt.");
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!photoPreview || !croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(photoPreview, croppedAreaPixels);
      const croppedUrl = URL.createObjectURL(croppedBlob);
      setCroppedImageUrl(croppedUrl);
      
      // Convert blob to file
      const croppedFile = new File([croppedBlob], photoFile?.name || "cropped.jpg", {
        type: "image/jpeg",
      });
      setPhotoFile(croppedFile);
      
      setCropperOpen(false);
      toast.success("Bild zugeschnitten");
    } catch (error) {
      console.error("Crop error:", error);
      toast.error("Fehler beim Zuschneiden");
    }
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return null;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", photoFile);

      const response = await fetch("/api/upload/team-member", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload error response:", errorText);
        throw new Error("Upload fehlgeschlagen");
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server hat keine JSON-Antwort zurückgegeben");
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Fehler beim Hochladen des Bildes");
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (isEdit: boolean) => {
    if (!formData.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }

    let photoUrl = selectedMember?.photoUrl || "";
    if (photoFile) {
      const uploadedUrl = await handlePhotoUpload();
      if (uploadedUrl) {
        photoUrl = uploadedUrl;
      }
    }

    if (isEdit && selectedMember) {
      updateMutation.mutate({
        memberId: selectedMember.id,
        name: formData.name,
        nickname: formData.nickname || undefined,
        role: formData.role || undefined,
        bio: formData.bio || undefined,
        photoUrl: photoUrl || undefined,
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        nickname: formData.nickname || undefined,
        role: formData.role || undefined,
        bio: formData.bio || undefined,
        photoUrl: photoUrl || undefined,
      });
    }
  };

  const openEditDialog = (member: typeof members[0]) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      nickname: member.nickname || "",
      role: member.role || "",
      bio: member.bio || "",
    });
    setPhotoPreview(member.photoUrl || "");
    setCroppedImageUrl(member.photoUrl || "");
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (member: typeof members[0]) => {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  };

  const moveMember = (memberId: number, direction: "up" | "down") => {
    const currentIndex = members.findIndex((m) => m.id === memberId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= members.length) return;

    const reorderedMembers = [...members];
    [reorderedMembers[currentIndex], reorderedMembers[newIndex]] = [
      reorderedMembers[newIndex],
      reorderedMembers[currentIndex],
    ];

    const newOrder = reorderedMembers.map((m) => m.id);

    reorderMutation.mutate({ memberIds: newOrder });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container py-12 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Users className="h-10 w-10 text-primary" />
              Unser Team
            </h1>
            <p className="text-lg text-muted-foreground">
              Die Köpfe hinter Jogge di Balla
            </p>
          </div>

          {canManageTeam && (
            <Dialog open={addDialogOpen} onOpenChange={(open) => {
              setAddDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Neues Mitglied
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Neues Mitglied hinzufügen</DialogTitle>
                  <DialogDescription>
                    Füge ein neues Team-Mitglied hinzu
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <Label>Foto</Label>
                    <div className="flex items-center gap-4">
                      {croppedImageUrl ? (
                        <div className="relative">
                          <img
                            src={croppedImageUrl}
                            alt="Preview"
                            className="w-24 h-24 rounded-lg object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={() => {
                              setCroppedImageUrl("");
                              setPhotoFile(null);
                              setPhotoPreview("");
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                          <Upload className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoSelect}
                        />
                        <Button
                          variant="outline"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="w-full"
                        >
                          {uploadingPhoto ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Hochladen...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Foto auswählen
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">
                          Max. 25MB, JPG/PNG
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="z.B. Max Mustermann"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nickname">Spitzname</Label>
                    <Input
                      id="nickname"
                      value={formData.nickname}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      placeholder="z.B. Maxi"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Rolle</Label>
                    <Input
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="z.B. Präsident, Kassier, DJ"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Beschreibung</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Kurze Beschreibung..."
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() => handleSubmit(false)}
                    disabled={createMutation.isPending || uploadingPhoto}
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Wird hinzugefügt...
                      </>
                    ) : (
                      "Hinzufügen"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {/* Team Members Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">Noch keine Team-Mitglieder</p>
              {canManageTeam && (
                <p className="text-sm text-muted-foreground mt-2">
                  Klicke auf "Neues Mitglied" um das erste Mitglied hinzuzufügen
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {members.map((member, index) => (
                <MotionDiv
                  key={member.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <CardHeader className="relative p-0">
                      {member.photoUrl && (
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={member.photoUrl}
                            alt={member.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      {!member.photoUrl && (
                        <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Users className="h-20 w-20 text-primary/30" />
                        </div>
                      )}

                      {/* Action Buttons */}
                      {canManageTeam && (
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {index > 0 && (
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/90 hover:bg-background"
                              onClick={() => moveMember(member.id, "up")}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                          )}
                          {index < members.length - 1 && (
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 bg-background/90 hover:bg-background"
                              onClick={() => moveMember(member.id, "down")}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 bg-card/90 hover:bg-card text-card-foreground"
                            onClick={() => openEditDialog(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDeleteDialog(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="p-6 space-y-2">
                      <div>
                        <h3 className="text-xl font-bold">{member.name}</h3>
                        {member.nickname && (
                          <p className="text-sm text-muted-foreground">
                            "{member.nickname}"
                          </p>
                        )}
                      </div>
                      {member.role && (
                        <p className="text-sm font-medium text-primary">{member.role}</p>
                      )}
                      {member.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {member.bio}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </MotionDiv>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            resetForm();
            setSelectedMember(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Mitglied bearbeiten</DialogTitle>
              <DialogDescription>
                Aktualisiere die Informationen des Team-Mitglieds
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Foto</Label>
                <div className="flex items-center gap-4">
                  {croppedImageUrl ? (
                    <div className="relative">
                      <img
                        src={croppedImageUrl}
                        alt="Preview"
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={() => {
                          setCroppedImageUrl("");
                          setPhotoFile(null);
                          setPhotoPreview("");
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <Upload className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <Button
                      variant="outline"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="w-full"
                    >
                      {uploadingPhoto ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Hochladen...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Foto ändern
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max. 25MB, JPG/PNG
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Max Mustermann"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-nickname">Spitzname</Label>
                <Input
                  id="edit-nickname"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  placeholder="z.B. Maxi"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Rolle</Label>
                <Input
                  id="edit-role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="z.B. Präsident, Kassier, DJ"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-bio">Beschreibung</Label>
                <Textarea
                  id="edit-bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Kurze Beschreibung..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  resetForm();
                  setSelectedMember(null);
                }}
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => handleSubmit(true)}
                disabled={updateMutation.isPending || uploadingPhoto}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  "Speichern"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mitglied löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchtest du {selectedMember?.name} wirklich aus dem Team entfernen? Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedMember(null)}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedMember) {
                    deleteMutation.mutate({ memberId: selectedMember.id });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird gelöscht...
                  </>
                ) : (
                  "Löschen"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Image Cropper Dialog */}
        <Dialog open={cropperOpen} onOpenChange={setCropperOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Bild zuschneiden</DialogTitle>
              <DialogDescription>
                Passe den Bildausschnitt an
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden">
                {photoPreview && (
                  <Cropper
                    image={photoPreview}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <ZoomOut className="h-4 w-4" />
                    Zoom
                  </Label>
                  <Label className="flex items-center gap-2">
                    <ZoomIn className="h-4 w-4" />
                  </Label>
                </div>
                <Slider
                  value={[zoom]}
                  onValueChange={(value) => setZoom(value[0])}
                  min={1}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCropperOpen(false);
                  setPhotoPreview("");
                  setPhotoFile(null);
                }}
              >
                Abbrechen
              </Button>
              <Button onClick={handleCropSave}>
                Zuschnitt übernehmen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
