import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermission } from "@/hooks/usePermissions";
import { parseErrorMessage } from "@/lib/errorMessages";
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
import { DateInput, TimeInput } from "@/components/ui/date-time-input";
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
  Info,
  Mail,
  Clock,
  ExternalLink,
  Link2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MotionDiv = motion.div;

interface EventLink {
  url: string;
  label: string;
}

interface EventFormData {
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  location: string;
  eventLinks: EventLink[];
}

// =============================================================================
// Helper: pick the best available URL for a given purpose
// =============================================================================
function pickSrc(
  photo: { thumbnailUrl?: string | null; compressedUrl?: string | null; imageUrl: string },
  purpose: "thumb" | "preview" | "full"
): string {
  switch (purpose) {
    case "thumb":
      // Smallest available: thumbnail → compressed → original
      return photo.thumbnailUrl || photo.compressedUrl || photo.imageUrl;
    case "preview":
      // Medium: compressed → thumbnail → original
      return photo.compressedUrl || photo.thumbnailUrl || photo.imageUrl;
    case "full":
      return photo.imageUrl;
  }
}

// =============================================================================
// Optimized image component with lazy loading via IntersectionObserver
// =============================================================================
function LazyImage({
  src,
  alt,
  className,
  eager = false,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  onClick?: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (eager || !imgRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" } // start loading 200px before visible
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [eager]);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : undefined}
      alt={alt}
      className={cn(
        className,
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0"
      )}
      onLoad={() => setLoaded(true)}
      onClick={onClick}
      draggable={false}
    />
  );
}

export default function Events() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: events = [], isLoading: eventsLoading } = trpc.events.list.useQuery();
  const { data: allPhotos = [] } = trpc.photos.listAll.useQuery();
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [fullResLoaded, setFullResLoaded] = useState(false);

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
    location: "",
    eventLinks: []
  });
  
  // Photo upload state
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadEventId, setUploadEventId] = useState<number | null>(null);
  const photoInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  
  // Photo management dialog state
  const [photoManagementOpen, setPhotoManagementOpen] = useState(false);
  const [photoManagementEventId, setPhotoManagementEventId] = useState<number | null>(null);

  // Touch/swipe state for lightbox
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const isLoggedIn = !!user;
  const canManageEvents = usePermission("edit_events");

  // Mutations
  const createEventMutation = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      toast.success("Event erfolgreich erstellt!");
      setCreateEventOpen(false);
      resetEventForm();
    },
    onError: (error) => toast.error(parseErrorMessage(error))
  });

  const updateEventMutation = trpc.events.update.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      toast.success("Event aktualisiert!");
      setEditEventOpen(false);
      resetEventForm();
    },
    onError: (error) => toast.error(parseErrorMessage(error))
  });

  const deleteEventMutation = trpc.events.delete.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      utils.photos.listAll.invalidate();
      toast.success("Event gelöscht!");
      setDeleteEventOpen(false);
      setSelectedEvent(null);
    },
    onError: (error) => toast.error(parseErrorMessage(error))
  });

  const createPhotoMutation = trpc.photos.create.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      utils.photos.listAll.invalidate();
    },
    onError: (error) => toast.error(parseErrorMessage(error))
  });

  const deletePhotoMutation = trpc.photos.delete.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      utils.photos.listAll.invalidate();
      toast.success("Foto gelöscht!");
    },
    onError: (error) => toast.error(parseErrorMessage(error))
  });

  const setThumbnailMutation = trpc.events.setThumbnail.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      toast.success("Thumbnail gesetzt!");
    },
    onError: (error) => toast.error(parseErrorMessage(error))
  });

  // Memoize filtered photos to avoid re-filtering on every render
  const selectedPhotos = useMemo(
    () => selectedEventId ? allPhotos.filter((p) => p.eventId === selectedEventId) : allPhotos,
    [selectedEventId, allPhotos]
  );

  // Get event name for current photo
  const currentPhotoEventName = selectedPhotos[currentPhotoIndex]
    ? events.find(e => e.id === selectedPhotos[currentPhotoIndex].eventId)?.title
    : null;

  const resetEventForm = () => {
    setEventForm({ title: "", description: "", eventDate: "", eventTime: "", location: "", eventLinks: [] });
    setSelectedEvent(null);
  };

  const openLightbox = useCallback((index: number, eventId?: number) => {
    setCurrentPhotoIndex(index);
    setSelectedEventId(eventId || null);
    setFullResLoaded(false);
    setLightboxOpen(true);
  }, []);

  const nextPhoto = useCallback(() => {
    setFullResLoaded(false);
    setCurrentPhotoIndex((prev) => (prev + 1) % selectedPhotos.length);
  }, [selectedPhotos.length]);

  const prevPhoto = useCallback(() => {
    setFullResLoaded(false);
    setCurrentPhotoIndex((prev) => (prev - 1 + selectedPhotos.length) % selectedPhotos.length);
  }, [selectedPhotos.length]);

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
  }, [lightboxOpen, nextPhoto, prevPhoto]);

  // Preload adjacent images in lightbox
  useEffect(() => {
    if (!lightboxOpen || selectedPhotos.length <= 1) return;
    const preload = (idx: number) => {
      const photo = selectedPhotos[idx];
      if (!photo) return;
      // Preload the compressed version (shown immediately) and full res
      const img1 = new Image();
      img1.src = pickSrc(photo, "preview");
      const img2 = new Image();
      img2.src = photo.imageUrl;
    };
    const nextIdx = (currentPhotoIndex + 1) % selectedPhotos.length;
    const prevIdx = (currentPhotoIndex - 1 + selectedPhotos.length) % selectedPhotos.length;
    preload(nextIdx);
    preload(prevIdx);
  }, [lightboxOpen, currentPhotoIndex, selectedPhotos]);

  // Touch handlers for swipe navigation in lightbox
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement is dominant and > 50px
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) nextPhoto();
      else prevPhoto();
    }
  }, [nextPhoto, prevPhoto]);

  const handleCreateEvent = () => {
    if (!eventForm.title.trim() || !eventForm.eventDate) {
      toast.error("Bitte Titel und Datum angeben");
      return;
    }
    const dateStr = eventForm.eventTime 
      ? `${eventForm.eventDate}T${eventForm.eventTime}` 
      : `${eventForm.eventDate}T00:00`;
    const validLinks = eventForm.eventLinks.filter(l => l.url.trim());
    createEventMutation.mutate({
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || undefined,
      eventDate: new Date(dateStr),
      location: eventForm.location.trim() || undefined,
      eventLinks: validLinks.length > 0 ? validLinks : undefined
    });
  };

  const handleUpdateEvent = () => {
    if (!selectedEvent || !eventForm.title.trim() || !eventForm.eventDate) {
      toast.error("Bitte Titel und Datum angeben");
      return;
    }
    const dateStr = eventForm.eventTime 
      ? `${eventForm.eventDate}T${eventForm.eventTime}` 
      : `${eventForm.eventDate}T00:00`;
    const validLinks = eventForm.eventLinks.filter(l => l.url.trim());
    updateEventMutation.mutate({
      eventId: selectedEvent.id,
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || undefined,
      eventDate: new Date(dateStr),
      location: eventForm.location.trim() || undefined,
      eventLinks: validLinks.length > 0 ? validLinks : undefined
    });
  };

  const openEditEvent = (event: typeof events[0]) => {
    setSelectedEvent({ id: event.id, title: event.title });
    const eventDate = new Date(event.eventDate);
    // Use local time (not UTC) to avoid timezone offset shifting the date by one day
    const yyyy = eventDate.getFullYear();
    const mm = String(eventDate.getMonth() + 1).padStart(2, "0");
    const dd = String(eventDate.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = eventDate.getHours() > 0 || eventDate.getMinutes() > 0
      ? eventDate.toTimeString().slice(0, 5)
      : "";
    let parsedLinks: EventLink[] = [];
    try { parsedLinks = JSON.parse((event as any).eventLinks || "[]"); } catch {}
    setEventForm({
      title: event.title,
      description: event.description || "",
      eventDate: dateStr,
      eventTime: timeStr,
      location: event.location || "",
      eventLinks: parsedLinks
    });
    setEditEventOpen(true);
  };

  const openDeleteEvent = (event: { id: number; title: string }) => {
    setSelectedEvent(event);
    setDeleteEventOpen(true);
  };

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
          toast.error(`${file.name} ist zu gross (max. 25MB)`);
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

        const { url, key, compressedUrl, compressedKey, thumbnailUrl, thumbnailKey } = await response.json();

        await createPhotoMutation.mutateAsync({
          eventId: targetEventId,
          imageUrl: url,
          imageKey: key,
          compressedUrl,
          compressedKey,
          thumbnailUrl,
          thumbnailKey,
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
      const inputRef = photoInputRefs.current.get(targetEventId);
      if (inputRef) {
        inputRef.value = "";
      }
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================
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
            <div className="flex flex-col items-start gap-3">
              <div className="flex-1">
                <h1><strong className="text-foreground">Fotografie an Veranstaltungen:</strong></h1>
                An unseren Veranstaltungen werden Fotos und Videos erstellt, welche für unsere Website, Social Media sowie Vereinskommunikation verwendet werden.
                Die Veröffentlichung erfolgt auf Grundlage unseres berechtigten Interesses an der Öffentlichkeitsarbeit. Personen, die nicht fotografiert werden möchten oder mit einer
                Veröffentlichung nicht einverstanden sind, können dies jederzeit unserem Team mitteilen oder eine nachträgliche Entfernung verlangen.
              </div>
              <Link href="/contact">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="btn-animate border-blue-300 bg-blue-100/50 hover:bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 whitespace-nowrap"
                >
                  Fotos © Manuel Heller → Für Anfragen
                  <Mail className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
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
            <DialogContent onEnterKey={handleCreateEvent}>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="date">Datum <span className="text-destructive">*</span></Label>
                    <DateInput
                      id="date"
                      value={eventForm.eventDate}
                      onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="time">Uhrzeit</Label>
                    <TimeInput
                      id="time"
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
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Links
                  </Label>
                  <div className="space-y-2">
                    {eventForm.eventLinks.map((link, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...eventForm.eventLinks];
                            updated[i] = { ...updated[i], url: e.target.value };
                            setEventForm({ ...eventForm, eventLinks: updated });
                          }}
                          placeholder="https://..."
                          type="url"
                          className="flex-1"
                        />
                        <Input
                          value={link.label}
                          onChange={(e) => {
                            const updated = [...eventForm.eventLinks];
                            updated[i] = { ...updated[i], label: e.target.value };
                            setEventForm({ ...eventForm, eventLinks: updated });
                          }}
                          placeholder="Bezeichnung"
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            const updated = eventForm.eventLinks.filter((_, idx) => idx !== i);
                            setEventForm({ ...eventForm, eventLinks: updated });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setEventForm({ ...eventForm, eventLinks: [...eventForm.eventLinks, { url: "", label: "" }] })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Link hinzufügen
                    </Button>
                  </div>
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
              {(() => {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const futureEvents = [...events]
                  .filter(e => { const d = new Date(e.eventDate); d.setHours(0,0,0,0); return d >= today; })
                  .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
                const pastEvents = [...events]
                  .filter(e => { const d = new Date(e.eventDate); d.setHours(0,0,0,0); return d < today; })
                  .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
                const sortedEvents = [...futureEvents, ...pastEvents];
                return sortedEvents;
              })().map((event, index) => {
                const eventPhotos = allPhotos.filter((p) => p.eventId === event.id);
                const thumbnailPhoto = event.thumbnailPhotoId 
                  ? eventPhotos.find(p => p.id === event.thumbnailPhotoId) || eventPhotos[0]
                  : eventPhotos[0];
                const _today = new Date(); _today.setHours(0, 0, 0, 0);
                const eventDay = new Date(event.eventDate); eventDay.setHours(0, 0, 0, 0);
                const isFuture = eventDay >= _today;
                
                return (
                  <MotionDiv
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={`overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col relative ${isFuture ? "border-primary/60 shadow-primary/10 shadow-md" : "hover:border-primary/30"}`}>
                      {/* Upcoming Badge */}
                      {isFuture && (
                        <div className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                          Kommendes Event
                        </div>
                      )}

                      {/* Event Cover Image — use compressed for cover */}
                      {thumbnailPhoto ? (
                        <div
                          className="aspect-video overflow-hidden bg-muted cursor-pointer relative group"
                          onClick={() => openLightbox(eventPhotos.indexOf(thumbnailPhoto), event.id)}
                        >
                          <LazyImage
                            src={pickSrc(thumbnailPhoto, "preview")}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            eager={index < 2}
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
                        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 shrink-0" />
                            {new Date(event.eventDate).toLocaleDateString("de-DE", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                          {(() => {
                            const d = new Date(event.eventDate);
                            return (d.getHours() > 0 || d.getMinutes() > 0) ? (
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 shrink-0" />
                                {d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                              </span>
                            ) : null;
                          })()}
                        </CardDescription>
                      </CardHeader>
                      
                        <CardContent className="flex-1 flex flex-col gap-3">
                        {event.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0" />
                            {event.location}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                        )}
                        {(() => {
                          const links: EventLink[] = (() => {
                            try { return JSON.parse((event as any).eventLinks || "[]"); } catch { return []; }
                          })();
                          if (links.length === 0) return null;
                          return (
                            <div className="flex flex-col gap-1">
                              {links.map((link, i) => (
                                <a
                                  key={i}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary flex items-center gap-2 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-4 w-4 shrink-0" />
                                  {link.label || link.url}
                                </a>
                              ))}
                            </div>
                          );
                        })()}
                        
                        {/* Photo Gallery Preview — thumbnails for small grid */}
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
                                  <LazyImage
                                    src={pickSrc(photo, "thumb")}
                                    alt=""
                                    className="w-full h-full object-cover hover:scale-110 transition-transform"
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
                            {/* Expand button to show all photos - always visible for admins */}
                            {canManageEvents && (
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

                        {/* Photo Upload for logged-in users */}
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

      {/* Edit Event Dialog */}
      <Dialog open={editEventOpen} onOpenChange={(open) => {
        setEditEventOpen(open);
        if (!open) resetEventForm();
      }}>
          <DialogContent onEnterKey={handleUpdateEvent}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="edit-date">Datum <span className="text-destructive">*</span></Label>
                <DateInput
                  id="edit-date"
                  value={eventForm.eventDate}
                  onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor="edit-time">Uhrzeit</Label>
                <TimeInput
                  id="edit-time"
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
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Links
              </Label>
              <div className="space-y-2">
                {eventForm.eventLinks.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={link.url}
                      onChange={(e) => {
                        const updated = [...eventForm.eventLinks];
                        updated[i] = { ...updated[i], url: e.target.value };
                        setEventForm({ ...eventForm, eventLinks: updated });
                      }}
                      placeholder="https://..."
                      type="url"
                      className="flex-1"
                    />
                    <Input
                      value={link.label}
                      onChange={(e) => {
                        const updated = [...eventForm.eventLinks];
                        updated[i] = { ...updated[i], label: e.target.value };
                        setEventForm({ ...eventForm, eventLinks: updated });
                      }}
                      placeholder="Bezeichnung"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        const updated = eventForm.eventLinks.filter((_, idx) => idx !== i);
                        setEventForm({ ...eventForm, eventLinks: updated });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setEventForm({ ...eventForm, eventLinks: [...eventForm.eventLinks, { url: "", label: "" }] })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Link hinzufügen
                </Button>
              </div>
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

      {/* ================================================================= */}
      {/* Fullscreen Lightbox — optimized                                    */}
      {/* ================================================================= */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          onEnterKey={() => {}}
          className="w-[95vw] h-[95vh] !max-w-[95vw] p-4 bg-black/95 border-0 rounded-lg"
          showCloseButton={false}
        >
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

          {/* Photo info */}
          <div className="absolute top-4 left-4 z-50 text-white">
            <p className="text-lg font-medium">
              {currentPhotoEventName || "Foto"}
            </p>
            <p className="text-sm text-white/60">
              {currentPhotoIndex + 1} / {selectedPhotos.length}
            </p>
          </div>

          {/* Main image container with touch support */}
          <div
            className="relative w-full h-full flex items-center justify-center select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {selectedPhotos[currentPhotoIndex] && (() => {
              const photo = selectedPhotos[currentPhotoIndex];
              const previewSrc = pickSrc(photo, "preview");
              const fullSrc = photo.imageUrl;
              const isAlreadyFull = previewSrc === fullSrc;

              return (
                <>
                  {/* Preview layer — always visible at full brightness, stays underneath */}
                  <img
                    key={`preview-${currentPhotoIndex}`}
                    src={previewSrc}
                    alt={currentPhotoEventName || "Event Foto"}
                    className="absolute max-w-full max-h-full object-contain"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                    draggable={false}
                  />

                  {/* Full resolution image — positioned on top, fades in seamlessly */}
                  {!isAlreadyFull && (
                    <img
                      key={`full-${currentPhotoIndex}`}
                      src={fullSrc}
                      alt={currentPhotoEventName || "Event Foto"}
                      className={cn(
                        "absolute max-w-full max-h-full object-contain transition-opacity duration-300",
                        fullResLoaded ? "opacity-100" : "opacity-0"
                      )}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                      onLoad={() => setFullResLoaded(true)}
                      draggable={false}
                    />
                  )}

                  {/* Subtle loading indicator — small spinner bottom-right */}
                  {!fullResLoaded && !isAlreadyFull && (
                    <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3 bg-black/40 px-5 py-3 rounded-full">
                      <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                      <span className="text-base font-medium text-white/50">HD laden...</span>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Navigation arrows */}
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
            © Manuel Heller
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Management Dialog */}
      <Dialog open={photoManagementOpen} onOpenChange={setPhotoManagementOpen}>
        <DialogContent className="w-[90vw] h-[90vh] !max-w-[90vw] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
          <DialogHeader className="top-0 bg-background mb-8 pb-8 border-b border-muted/20">
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
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
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
                      <LazyImage
                        src={pickSrc(photo, "thumb")}
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
                      {/* Action buttons */}
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
