import { useState, useRef, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Loader2,
  Star,
  Info
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
  const [imageLoading, setImageLoading] = useState(true);
  const [imageLoadProgress, setImageLoadProgress] = useState(0);

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
  
  // Photo upload state - use separate refs for each event
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadEventId, setUploadEventId] = useState<number | null>(null);
  const photoInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  
  // Photo management dialog state
  const [photoManagementOpen, setPhotoManagementOpen] = useState(false);
  const [photoManagementEventId, setPhotoManagementEventId] = useState<number | null>(null);

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

  const setThumbnailMutation = trpc.events.setThumbnail.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      toast.success("Thumbnail gesetzt!");
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`)
  });

  const selectedPhotos = selectedEventId
    ? allPhotos.filter((p) => p.eventId === selectedEventId)
    : allPhotos;

  // Get event name for current photo
  const currentPhotoEventName = selectedPhotos[currentPhotoIndex]
    ? events.find(e => e.id === selectedPhotos[currentPhotoIndex].eventId)?.title
    : null;

  const resetEventForm = () => {
    setEventForm({ title: "", description: "", eventDate: "", eventTime: "", location: "" });
    setSelectedEvent(null);
  };

  const openLightbox = (index: number, eventId?: number) => {
    setCurrentPhotoIndex(index);
    setSelectedEventId(eventId || null);
    setLightboxOpen(true);
    setImageLoading(true);
  };

  const nextPhoto = () => {
    setImageLoading(true);
    setCurrentPhotoIndex((prev) => (prev + 1) % selectedPhotos.length);
  };

  const prevPhoto = () => {
    setImageLoading(true);
    setCurrentPhotoIndex((prev) => (prev - 1 + selectedPhotos.length) % selectedPhotos.length);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, selectedPhotos.length]);

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

  // Fixed photo upload handler - uses the eventId passed directly
  const handlePhotoUpload = async (files: FileList | null, targetEventId: number) => {
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    setUploadEventId(targetEventId);

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

        const { url, key, compressedUrl, compressedKey } = await response.json();

        // Use the targetEventId that was captured when the button was clicked
        await createPhotoMutation.mutateAsync({
          eventId: targetEventId,
          imageUrl: url,
          imageKey: key,
          compressedUrl,
          compressedKey,
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
      // Clear the specific input
      const inputRef = photoInputRefs.current.get(targetEventId);
      if (inputRef) {
        inputRef.value = "";
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
                  Erstelle ein neues Event für den Verein.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel <span className="text-destructive">*</span></Label>
                  <Input
                    id="title"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    placeholder="Event-Titel"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Datum <span className="text-destructive">*</span></Label>
                    <Input
                      id="date"
                      type="date"
                      value={eventForm.eventDate}
                      onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Uhrzeit</Label>
                    <Input
                      id="time"
                      type="time"
                      value={eventForm.eventTime}
                      onChange={(e) => setEventForm({ ...eventForm, eventTime: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Ort</Label>
                  <Input
                    id="location"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    placeholder="Veranstaltungsort"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung</Label>
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
                <Button onClick={handleCreateEvent} disabled={createEventMutation.isPending}>
                  {createEventMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Erstellen...</>
                  ) : "Erstellen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Events Grid */}
      <section id="event-cards" className="space-y-6">
        <h2 className="text-3xl font-bold">Unsere Events</h2>
        
        {eventsLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted" />
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
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
                // Find thumbnail photo or use first photo
                const thumbnailPhoto = event.thumbnailPhotoId 
                  ? eventPhotos.find(p => p.id === event.thumbnailPhotoId) || eventPhotos[0]
                  : eventPhotos[0];
                
                return (
                  <MotionDiv
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                      {/* Event Cover Image - removed top padding */}
                      {thumbnailPhoto ? (
                        <div
                          className="aspect-video overflow-hidden bg-muted cursor-pointer relative group"
                          onClick={() => openLightbox(eventPhotos.indexOf(thumbnailPhoto), event.id)}
                        >
                          <img
                            src={thumbnailPhoto.thumbnailUrl || thumbnailPhoto.imageUrl}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading={index < 2 ? "eager" : "lazy"}
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
                        
                        {/* Photo Gallery Preview - with thumbnail selection */}
                        {eventPhotos.length > 0 && (
                          <div className="space-y-2 mt-auto">
                            <div className="grid grid-cols-4 gap-1">
                              {eventPhotos.slice(0, 4).map((photo, idx) => (
                                <div
                                  key={photo.id}
                                  className={cn(
                                    "aspect-square overflow-hidden rounded cursor-pointer relative group/thumb",
                                    idx === 3 && eventPhotos.length > 4 && "relative",
                                    photo.id === event.thumbnailPhotoId && "ring-2 ring-primary"
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
                                  {/* Set as thumbnail button */}
                                  {canManageEvents && photo.id !== event.thumbnailPhotoId && (
                                    <Button
                                      variant="secondary"
                                      size="icon"
                                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setThumbnailMutation.mutate({ eventId: event.id, photoId: photo.id });
                                      }}
                                      title="Als Thumbnail setzen"
                                    >
                                      <Star className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {/* Expand button to show all photos */}
                            {eventPhotos.length > 4 && canManageEvents && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs h-7"
                                onClick={() => {
                                  setPhotoManagementEventId(event.id);
                                  setPhotoManagementOpen(true);
                                }}
                              >
                                Alle {eventPhotos.length} Fotos verwalten
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Photo Upload for logged-in users - separate input per event */}
                        {canManageEvents && (
                          <div className="mt-auto pt-3 border-t">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              ref={(el) => {
                                if (el) photoInputRefs.current.set(event.id, el);
                              }}
                              onChange={(e) => handlePhotoUpload(e.target.files, event.id)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => {
                                const inputRef = photoInputRefs.current.get(event.id);
                                if (inputRef) inputRef.click();
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

      {/* Datenschutz-Hinweis */}
      <MotionDiv
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-4xl mx-auto"
      >
        <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-muted-foreground ml-2">
            <strong className="text-foreground">Fotografie an Veranstaltungen:</strong> An unseren Veranstaltungen werden Fotos und Videos erstellt, welche für unsere Website, Social Media sowie Vereinskommunikation verwendet werden. Die Veröffentlichung erfolgt auf Grundlage unseres berechtigten Interesses an der Öffentlichkeitsarbeit. Personen, die nicht fotografiert werden möchten oder mit einer Veröffentlichung nicht einverstanden sind, können dies jederzeit unserem Team mitteilen oder eine nachträgliche Entfernung verlangen.
          </AlertDescription>
        </Alert>
      </MotionDiv>

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
                  src={photo.compressedUrl || photo.imageUrl}
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
              <Label htmlFor="edit-title">Titel <span className="text-destructive">*</span></Label>
              <Input
                id="edit-title"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="Event-Titel"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Datum <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={eventForm.eventDate}
                  onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time">Uhrzeit</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={eventForm.eventTime}
                  onChange={(e) => setEventForm({ ...eventForm, eventTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Ort</Label>
              <Input
                id="edit-location"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="Veranstaltungsort"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Beschreibung</Label>
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
            <Button onClick={handleUpdateEvent} disabled={updateEventMutation.isPending}>
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

      {/* Fullscreen Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="w-[95vw] h-[95vh] !max-w-[95vw] p-4 bg-black/95 border-0 rounded-lg" showCloseButton={false}>
          {/* Hidden title and description for accessibility */}
          <DialogTitle className="sr-only">
            {currentPhotoEventName || "Foto"} - Bild {currentPhotoIndex + 1} von {selectedPhotos.length}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Vollbild-Ansicht des Fotos. Verwende die Pfeiltasten oder Buttons zum Navigieren.
          </DialogDescription>
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white h-10 w-10"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Photo info - event name instead of filename */}
          <div className="absolute top-4 left-4 z-50 text-white">
            <p className="text-lg font-medium">
              {currentPhotoEventName || "Foto"}
            </p>
            <p className="text-sm text-white/60">
              {currentPhotoIndex + 1} / {selectedPhotos.length}
            </p>
          </div>

          {/* Main image container */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Loading progress */}
            {imageLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
                <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${imageLoadProgress}%` }}
                  />
                </div>
                <p className="text-white/70 text-sm">{Math.round(imageLoadProgress)}%</p>
              </div>
            )}
            
            {/* Show compressed version first, then load original */}
            <img
              src={imageLoading ? (selectedPhotos[currentPhotoIndex]?.compressedUrl || selectedPhotos[currentPhotoIndex]?.imageUrl) : selectedPhotos[currentPhotoIndex]?.imageUrl}
              alt={currentPhotoEventName || "Event Foto"}
              className={cn(
                "max-w-full max-h-full object-contain transition-opacity duration-300",
                imageLoading ? "opacity-50" : "opacity-100"
              )}
              onLoad={() => {
                if (!imageLoading) return;
                // Simulate progress for original image load
                const img = new Image();
                img.src = selectedPhotos[currentPhotoIndex]?.imageUrl;
                
                // Fake progress animation
                let progress = 0;
                const interval = setInterval(() => {
                  progress += 10;
                  setImageLoadProgress(progress);
                  if (progress >= 90) clearInterval(interval);
                }, 50);
                
                img.onload = () => {
                  clearInterval(interval);
                  setImageLoadProgress(100);
                  setTimeout(() => {
                    setImageLoading(false);
                    setImageLoadProgress(0);
                  }, 200);
                };
              }}
            />

            {/* Navigation arrows - smaller and cleaner */}
            {selectedPhotos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white h-10 w-10 rounded-full"
                  onClick={prevPhoto}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white h-10 w-10 rounded-full"
                  onClick={nextPhoto}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/50">
            © Manuel Heller | Pfeiltasten zur Navigation
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Management Dialog */}
      <Dialog open={photoManagementOpen} onOpenChange={setPhotoManagementOpen}>
        <DialogContent className="w-[90vw] h-[90vh] !max-w-[90vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fotos verwalten</DialogTitle>
            <DialogDescription>
              Wähle ein Thumbnail oder lösche Fotos für dieses Event.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const eventPhotos = photoManagementEventId
              ? allPhotos.filter((p) => p.eventId === photoManagementEventId)
              : [];
            const event = events.find((e) => e.id === photoManagementEventId);
            
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {eventPhotos.length} {eventPhotos.length === 1 ? "Foto" : "Fotos"} vorhanden
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {eventPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className={cn(
                        "aspect-square overflow-hidden rounded-lg relative group border-2 transition-all",
                        photo.id === event?.thumbnailPhotoId
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-muted-foreground/30"
                      )}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {/* Thumbnail indicator */}
                      {photo.id === event?.thumbnailPhotoId && (
                        <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="h-3 w-3" fill="currentColor" />
                          Thumbnail
                        </div>
                      )}
                      {/* Action buttons - always visible on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
                        {photo.id !== event?.thumbnailPhotoId && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2 text-sm font-medium"
                            onClick={() => {
                              if (photoManagementEventId) {
                                setThumbnailMutation.mutate({ eventId: photoManagementEventId, photoId: photo.id });
                              }
                            }}
                          >
                            <Star className="h-4 w-4" />
                            Als Thumbnail
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2 text-sm font-medium"
                          onClick={() => {
                            deletePhotoMutation.mutate({ photoId: photo.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Löschen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhotoManagementOpen(false)}>
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
