import { useState, useRef } from "react";
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
import { Users, Plus, Pencil, Trash2, Upload, X, Loader2, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MotionDiv = motion.div;

interface MemberFormData {
  name: string;
  nickname: string;
  role: string;
  bio: string;
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
  
  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  const resetMemberForm = () => {
    setMemberForm({ name: "", nickname: "", role: "", bio: "" });
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedMember(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
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
    if (member.photoUrl) {
      setPhotoPreview(member.photoUrl);
    }
    setEditMemberOpen(true);
  };

  const openDeleteMember = (member: { id: number; name: string }) => {
    setSelectedMember(member);
    setDeleteMemberOpen(true);
  };

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
          ein Ort voller Freude, Kreativität und unvergesslicher Momente.
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
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Neues Mitglied hinzufügen</DialogTitle>
                <DialogDescription>
                  Füge ein neues Team-Mitglied mit Foto und Beschreibung hinzu.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Photo Upload */}
                <div className="flex justify-center">
                  <div className="relative">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    {photoPreview ? (
                      <div className="relative">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20">
                          <img
                            src={photoPreview}
                            alt="Vorschau"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-8 w-8 rounded-full"
                          onClick={clearPhoto}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="w-32 h-32 rounded-full border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground"
                      >
                        <Camera className="h-8 w-8" />
                        <span className="text-xs">Foto hinzufügen</span>
                      </button>
                    )}
                  </div>
                </div>

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
                  <Label htmlFor="nickname">Spitzname (optional)</Label>
                  <Input
                    id="nickname"
                    value={memberForm.nickname}
                    onChange={(e) => setMemberForm({ ...memberForm, nickname: e.target.value })}
                    placeholder="Spitzname"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rolle (optional)</Label>
                  <Input
                    id="role"
                    value={memberForm.role}
                    onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                    placeholder="z.B. Gründer, DJ, Organisator"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Beschreibung (optional)</Label>
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
              >
                <Card className="overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300 group">
                  {/* Member Photo */}
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
                    
                    {/* Edit/Delete Buttons */}
                    {canManageTeam && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-white/90 dark:bg-black/90"
                          onClick={() => openEditMember(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDeleteMember({ id: member.id, name: member.name })}
                        >
                          <Trash2 className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mitglied bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Details des Team-Mitglieds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Photo Upload */}
            <div className="flex justify-center">
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="edit-photo-input"
                />
                {photoPreview ? (
                  <div className="relative">
                    <label htmlFor="edit-photo-input" className="cursor-pointer block">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20 group">
                        <img
                          src={photoPreview}
                          alt="Vorschau"
                          className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="h-8 w-8 text-white drop-shadow-lg" />
                        </div>
                      </div>
                    </label>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-1 -right-1 h-8 w-8 rounded-full"
                      onClick={clearPhoto}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="edit-photo-input"
                    className="w-32 h-32 rounded-full border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer"
                  >
                    <Camera className="h-8 w-8" />
                    <span className="text-xs">Foto hinzufügen</span>
                  </label>
                )}
              </div>
            </div>

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
              <Label htmlFor="edit-nickname">Spitzname (optional)</Label>
              <Input
                id="edit-nickname"
                value={memberForm.nickname}
                onChange={(e) => setMemberForm({ ...memberForm, nickname: e.target.value })}
                placeholder="Spitzname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Rolle (optional)</Label>
              <Input
                id="edit-role"
                value={memberForm.role}
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                placeholder="z.B. Gründer, DJ, Organisator"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bio">Beschreibung (optional)</Label>
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
                <><Loader2 className="h-4 w-4 animate-spin" />Speichern...</>
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
