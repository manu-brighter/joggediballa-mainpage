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
import { 
  Calendar, 
  MapPin, 
  Image as ImageIcon, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MotionDiv = motion.div;

interface EventFormData {
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  location: string;
}

export default function Events() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: events = [], isLoading: eventsLoading } = trpc.events.list.useQuery();
  const { data: allPhotos = [], isLoading: photosLoading } = trpc.photos.listAll.useQuery();
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Event management state
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{ id: number; title: string } | null>(null);
  const [eventForm, setEventForm] = useState<EventFormData>({
    title: "",
    description: "",
    eventDate: "",
    eventTime: "",
    location: ""
  });
  
  // Photo upload state
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadEventId, setUploadEventId] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const isLoggedIn = !!user;
  const canManageEvents = user && ["admin", "maintainer", "editor"].includes(user.role);

  // Mutations
  const createEventMutation = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      toast.success("Event erfolgreich erstellt!");
      setCreateEventOpen(false);
      resetEventForm();
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const updateEventMutation = trpc.events.update.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      toast.success("Event aktualisiert!");
      setEditEventOpen(false);
      resetEventForm();
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const deleteEventMutation = trpc.events.delete.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      utils.photos.listAll.invalidate();
      toast.success("Event gelöscht!");
      setDeleteEventOpen(false);
      setSelectedEvent(null);
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const createPhotoMutation = trpc.photos.create.useMutation({
    onSuccess: () => {
      utils.photos.listAll.invalidate();
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const deletePhotoMutation = trpc.photos.delete.useMutation({
    onSuccess: () => {
      utils.photos.listAll.invalidate();
      toast.success("Foto gelöscht!");
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const selectedPhotos = selectedEventId
    ? allPhotos.filter((p) => p.eventId === selectedEventId)
    : allPhotos;

  const resetEventForm = () => {
    setEventForm({ title: "", description: "", eventDate: "", eventTime: "", location: "" });
    setSelectedEvent(null);
  };

  const openLightbox = (index: number, eventId?: number) => {
    setCurrentPhotoIndex(index);
    setSelectedEventId(eventId || null);
    setLightboxOpen(true);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % selectedPhotos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + selectedPhotos.length) % selectedPhotos.length);
  };

  const handleCreateEvent = () => {
    if (!eventForm.title.trim() || !eventForm.eventDate) {
      toast.error("Bitte Titel und Datum angeben");
      return;
    }
    // Combine date and optional time
    const dateStr = eventForm.eventTime 
      ? `${eventForm.eventDate}T${eventForm.eventTime}` 
      : `${eventForm.eventDate}T00:00`;
    createEventMutation.mutate({
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || undefined,
      eventDate: new Date(dateStr),
      location: eventForm.location.trim() || undefined
    });
  };

  const handleUpdateEvent = () => {
    if (!selectedEvent || !eventForm.title.trim() || !eventForm.eventDate) {
      toast.error("Bitte Titel und Datum angeben");
      return;
    }
    // Combine date and optional time
    const dateStr = eventForm.eventTime 
      ? `${eventForm.eventDate}T${eventForm.eventTime}` 
      : `${eventForm.eventDate}T00:00`;
    updateEventMutation.mutate({
      eventId: selectedEvent.id,
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || undefined,
      eventDate: new Date(dateStr),
      location: eventForm.location.trim() || undefined
    });
  };

  const openEditEvent = (event: typeof events[0]) => {
    setSelectedEvent({ id: event.id, title: event.title });
    const eventDate = new Date(event.eventDate);
    const dateStr = eventDate.toISOString().slice(0, 10);
    const timeStr = eventDate.getHours() > 0 || eventDate.getMinutes() > 0 
      ? eventDate.toTimeString().slice(0, 5) 
      : "";
    setEventForm({
      title: event.title,
      description: event.description || "",
      eventDate: dateStr,
      eventTime: timeStr,
      location: event.location || ""
    });
    setEditEventOpen(true);
  };

  const openDeleteEvent = (event: { id: number; title: string }) => {
    setSelectedEvent(event);
    setDeleteEventOpen(true);
  };

  const handlePhotoUpload = async (files: FileList | null, eventId: number) => {
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    setUploadEventId(eventId);

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} ist keine Bilddatei`);
          continue;
        }

        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} ist zu groß (max. 25MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/event-photo", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Upload fehlgeschlagen für ${file.name}`);
        }

        const { url, key } = await response.json();

        await createPhotoMutation.mutateAsync({
          eventId,
          imageUrl: url,
          imageKey: key,
          title: file.name.replace(/\.[^/.]+$/, "")
        });
      }

      toast.success("Fotos erfolgreich hochgeladen!");
    } catch (error) {
      console.error("Photo upload error:", error);
      toast.error("Fehler beim Hochladen der Fotos");
    } finally {
      setUploadingPhotos(false);
      setUploadEventId(null);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="container py-12 space-y-12">
      {/* Header */}
      <MotionDiv
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
          <Calendar className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black">
          <span className="gradient-text">Events & Fotos</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Erlebe unsere unvergesslichen Momente und entdecke die Highlights unserer Events.
        </p>
      </MotionDiv>

      {/* Add Event Button */}
      {canManageEvents && (
        <div className="flex justify-center">
          <Dialog open={createEventOpen} onOpenChange={(open) => {
            setCreateEventOpen(open);
            if (!open) resetEventForm();
          }}>
            <DialogTrigger asChild>
              <Button size="lg" className="btn-animate gap-2">
                <Plus className="h-5 w-5" />
                Event erstellen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neues Event erstellen</DialogTitle>
                <DialogDescription>
                  Erstelle ein neues Event mit Titel, Beschreibung und Datum.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel *</Label>
                  <Input
                    id="title"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    placeholder="Event-Titel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Datum *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={eventForm.eventDate}
                    onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Uhrzeit (optional)</Label>
                  <Input
                    id="time"
                    type="time"
                    value={eventForm.eventTime}
                    onChange={(e) => setEventForm({ ...eventForm, eventTime: e.target.value })}
                    placeholder="--:--"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Ort (optional)</Label>
                  <Input
                    id="location"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    placeholder="Veranstaltungsort"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung (optional)</Label>
                  <Textarea
                    id="description"
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    placeholder="Beschreibe das Event..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateEventOpen(false)}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleCreateEvent}
                  disabled={createEventMutation.isPending}
                >
                  {createEventMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Erstellen...</>
                  ) : "Erstellen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

         {/* Event Cards */}
      <section id="event-cards" className="space-y-6 scroll-mt-24">
        <h2 className="text-3xl font-bold">Unsere Events</h2>
        {eventsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <Calendar className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                Noch keine Events vorhanden.
              </p>
              {canManageEvents && (
                <p className="text-sm text-muted-foreground mt-2">
                  Erstelle das erste Event!
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <AnimatePresence>
              {events.map((event, index) => {
                const eventPhotos = allPhotos.filter((p) => p.eventId === event.id);
                return (
                  <MotionDiv
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                      {/* Event Cover Image */}
                      {eventPhotos.length > 0 ? (
                        <div
                          className="aspect-video overflow-hidden bg-muted cursor-pointer relative group"
                          onClick={() => openLightbox(0, event.id)}
                        >
                          <img
                            src={eventPhotos[0].thumbnailUrl || eventPhotos[0].imageUrl}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-black/90 px-3 py-1.5 rounded-full text-sm font-medium">
                              {eventPhotos.length} {eventPhotos.length === 1 ? "Foto" : "Fotos"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-xl">{event.title}</CardTitle>
                          {canManageEvents && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditEvent(event)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => openDeleteEvent({ id: event.id, title: event.title })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(event.eventDate).toLocaleDateString("de-DE", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="flex-1 flex flex-col gap-3">
                        {event.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                        )}
                        {event.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0" />
                            {event.location}
                          </p>
                        )}
                        
                        {/* Photo Gallery Preview */}
                        {eventPhotos.length > 1 && (
                          <div className="grid grid-cols-4 gap-1 mt-auto">
                            {eventPhotos.slice(0, 4).map((photo, idx) => (
                              <div
                                key={photo.id}
                                className={cn(
                                  "aspect-square overflow-hidden rounded cursor-pointer relative",
                                  idx === 3 && eventPhotos.length > 4 && "relative"
                                )}
                                onClick={() => openLightbox(idx, event.id)}
                              >
                                <img
                                  src={photo.thumbnailUrl || photo.imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover hover:scale-110 transition-transform"
                                  loading="lazy"
                                />
                                {idx === 3 && eventPhotos.length > 4 && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold">
                                    +{eventPhotos.length - 4}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Photo Upload for logged-in users */}
                        {canManageEvents && (
                          <div className="mt-auto pt-3 border-t">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              ref={photoInputRef}
                              onChange={(e) => handlePhotoUpload(e.target.files, event.id)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => {
                                setUploadEventId(event.id);
                                photoInputRef.current?.click();
                              }}
                              disabled={uploadingPhotos && uploadEventId === event.id}
                            >
                              {uploadingPhotos && uploadEventId === event.id ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />Hochladen...</>
                              ) : (
                                <><Upload className="h-4 w-4" />Fotos hochladen</>
                              )}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </MotionDiv>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* All Photos Gallery */}
      {allPhotos.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold">Alle Fotos</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Fotos © Manuel Heller | Für Anfragen:{" "}
              <a href="/contact" className="text-primary hover:underline">
                Kontakt
              </a>
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {allPhotos.map((photo, index) => (
              <MotionDiv
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                className="aspect-square overflow-hidden bg-muted rounded-xl cursor-pointer group relative"
                onClick={() => openLightbox(index)}
              >
                <img
                  src={photo.thumbnailUrl || photo.imageUrl}
                  alt={photo.title || "Event Foto"}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
                {canManageEvents && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePhotoMutation.mutate({ photoId: photo.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </MotionDiv>
            ))}
          </div>
        </section>
      )}

      {/* Edit Event Dialog */}
      <Dialog open={editEventOpen} onOpenChange={(open) => {
        setEditEventOpen(open);
        if (!open) resetEventForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Details des Events.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Titel *</Label>
              <Input
                id="edit-title"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="Event-Titel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Datum *</Label>
              <Input
                id="edit-date"
                type="date"
                value={eventForm.eventDate}
                onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time">Uhrzeit (optional)</Label>
              <Input
                id="edit-time"
                type="time"
                value={eventForm.eventTime}
                onChange={(e) => setEventForm({ ...eventForm, eventTime: e.target.value })}
                placeholder="--:--"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Ort (optional)</Label>
              <Input
                id="edit-location"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="Veranstaltungsort"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Beschreibung (optional)</Label>
              <Textarea
                id="edit-description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Beschreibe das Event..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEventOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleUpdateEvent}
              disabled={updateEventMutation.isPending}
            >
              {updateEventMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Speichern...</>
              ) : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Event Dialog */}
      <AlertDialog open={deleteEventOpen} onOpenChange={setDeleteEventOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du das Event "{selectedEvent?.title}" wirklich löschen? 
              Alle zugehörigen Fotos werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedEvent && deleteEventMutation.mutate({ eventId: selectedEvent.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEventMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Löschen...</>
              ) : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox Dialog - Full screen with theme support */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 dark:bg-black/95 backdrop-blur-sm border-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-foreground dark:text-white">
              {selectedPhotos[currentPhotoIndex]?.title || "Foto"}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <img
              src={selectedPhotos[currentPhotoIndex]?.imageUrl}
              alt={selectedPhotos[currentPhotoIndex]?.title || "Event Foto"}
              className="w-full h-auto max-h-[85vh] object-contain"
            />
            {selectedPhotos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white h-14 w-14 shadow-lg border border-white/20"
                  onClick={prevPhoto}
                >
                  <ChevronLeft className="h-10 w-10" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white h-14 w-14 shadow-lg border border-white/20"
                  onClick={nextPhoto}
                >
                  <ChevronRight className="h-10 w-10" />
                </Button>
              </>
            )}
          </div>
          {selectedPhotos[currentPhotoIndex]?.description && (
            <div className="p-4 pt-0">
              <p className="text-sm text-white/70">
                {selectedPhotos[currentPhotoIndex].description}
              </p>
            </div>
          )}
          <div className="p-4 pt-0 text-center text-xs text-white/50">
            Foto {currentPhotoIndex + 1} von {selectedPhotos.length} | © Manuel Heller
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
