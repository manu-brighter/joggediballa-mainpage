import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  Users, 
  Calendar, 
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

const MotionDiv = motion.div;

type SortOption = "name" | "endDate" | "expiresSoon";

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  email: string | null;
  phone: string | null;
  membershipStartDate: Date;
  membershipEndDate: Date;
  notes: string | null;
  isActive: boolean;
}

function getDaysUntilExpiry(endDate: Date): number {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getMemberStatus(member: Member): "active" | "expiring" | "expired" {
  const days = getDaysUntilExpiry(member.membershipEndDate);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "active";
}

export default function Goennermitglieder() {
  const { user, isAuthenticated, loading } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("endDate");
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    street: "",
    houseNumber: "",
    zipCode: "",
    city: "",
    email: "",
    phone: "",
    membershipStartDate: new Date().toISOString().split("T")[0],
    notes: ""
  });

  const utils = trpc.useUtils();
  const { data: allMembers = [], isLoading } = trpc.goennermitglieder.list.useQuery(undefined, {
    enabled: isAuthenticated
  });

  const createMutation = trpc.goennermitglieder.create.useMutation({
    onSuccess: () => {
      utils.goennermitglieder.list.invalidate();
      toast.success("Mitglied erfolgreich hinzugefügt!");
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const extendMutation = trpc.goennermitglieder.extend.useMutation({
    onSuccess: (data) => {
      utils.goennermitglieder.list.invalidate();
      toast.success(`Mitgliedschaft verlängert bis ${new Date(data.newEndDate).toLocaleDateString("de-DE")}`);
      setExtendDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const deleteMutation = trpc.goennermitglieder.delete.useMutation({
    onSuccess: () => {
      utils.goennermitglieder.list.invalidate();
      toast.success("Mitglied gelöscht!");
      setDeleteDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const isMaintainerOrAdmin = user && ["admin", "maintainer"].includes(user.role);

  // Sort and filter members
  const { activeMembers, expiredMembers } = useMemo(() => {
    const active: Member[] = [];
    const expired: Member[] = [];

    allMembers.forEach((member) => {
      const status = getMemberStatus(member as Member);
      if (status === "expired") {
        expired.push(member as Member);
      } else {
        active.push(member as Member);
      }
    });

    // Sort active members
    active.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        case "endDate":
          return new Date(a.membershipEndDate).getTime() - new Date(b.membershipEndDate).getTime();
        case "expiresSoon":
          return getDaysUntilExpiry(a.membershipEndDate) - getDaysUntilExpiry(b.membershipEndDate);
        default:
          return 0;
      }
    });

    // Sort expired by most recently expired first
    expired.sort((a, b) => 
      new Date(b.membershipEndDate).getTime() - new Date(a.membershipEndDate).getTime()
    );

    return { activeMembers: active, expiredMembers: expired };
  }, [allMembers, sortBy]);

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      street: "",
      houseNumber: "",
      zipCode: "",
      city: "",
      email: "",
      phone: "",
      membershipStartDate: new Date().toISOString().split("T")[0],
      notes: ""
    });
  };

  const handleCreate = () => {
    if (!formData.firstName || !formData.lastName || !formData.street || 
        !formData.houseNumber || !formData.zipCode || !formData.city) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    
    createMutation.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
      street: formData.street,
      houseNumber: formData.houseNumber,
      zipCode: formData.zipCode,
      city: formData.city,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      membershipStartDate: new Date(formData.membershipStartDate),
      notes: formData.notes || undefined
    });
  };

  const handleExtend = () => {
    if (selectedMember) {
      extendMutation.mutate({ memberId: selectedMember.id, years: 1 });
    }
  };

  const handleDelete = () => {
    if (selectedMember) {
      deleteMutation.mutate({ memberId: selectedMember.id });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="container py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Anmeldung erforderlich</CardTitle>
            <CardDescription>
              Du musst angemeldet sein, um die Gönnermitgliederverwaltung zu nutzen.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="btn-animate">
              <a href={getLoginUrl()}>Jetzt anmelden</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const MemberCard = ({ member, isExpired = false }: { member: Member; isExpired?: boolean }) => {
    const status = getMemberStatus(member);
    const daysLeft = getDaysUntilExpiry(member.membershipEndDate);

    return (
      <MotionDiv
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "rounded-xl border-2 p-4 transition-all duration-300",
          status === "expired" && "bg-muted/50 border-muted-foreground/20",
          status === "expiring" && "bg-yellow-500/10 border-yellow-500/30",
          status === "active" && "bg-card border-border hover:border-primary/30"
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">
                {member.firstName} {member.lastName}
              </h3>
              {status === "expired" && (
                <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                  Abgelaufen
                </span>
              )}
              {status === "expiring" && (
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
                  {daysLeft} Tage
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {member.street} {member.houseNumber}, {member.zipCode} {member.city}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Start: {new Date(member.membershipStartDate).toLocaleDateString("de-DE")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ende: {new Date(member.membershipEndDate).toLocaleDateString("de-DE")}
              </span>
            </div>
          </div>

          {isMaintainerOrAdmin && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => {
                  setSelectedMember(member);
                  setExtendDialogOpen(true);
                }}
              >
                <RefreshCw className="h-4 w-4" />
                +1 Jahr
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setSelectedMember(member);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </MotionDiv>
    );
  };

  return (
    <div className="container py-8 md:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <MotionDiv
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center md:text-left"
        >
          <h1 className="text-4xl md:text-5xl font-black">
            <span className="gradient-text">Gönnermitglieder</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Verwaltung der Gönnermitgliedschaften
          </p>
        </MotionDiv>

        <div className="flex items-center gap-3">
          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-auto min-w-[200px]">
              <ArrowUpDown className="h-4 w-4 mr-2 flex-shrink-0" />
              <SelectValue placeholder="Sortieren" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="endDate">Nach Ablaufdatum</SelectItem>
              <SelectItem value="expiresSoon">Läuft bald ab</SelectItem>
              <SelectItem value="name">Nach Name</SelectItem>
            </SelectContent>
          </Select>

          {/* Create Button */}
          {isMaintainerOrAdmin && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="btn-animate gap-2">
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline">Neues Mitglied</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Neues Gönnermitglied</DialogTitle>
                  <DialogDescription>
                    Füge ein neues Gönnermitglied hinzu. Die Mitgliedschaft läuft automatisch ohne reaktivierung nach einem Jahr ab.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Vorname *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="Max"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nachname *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Mustermann"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="street">Straße *</Label>
                      <Input
                        id="street"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        placeholder="Musterstraße"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="houseNumber">Nr. *</Label>
                      <Input
                        id="houseNumber"
                        value={formData.houseNumber}
                        onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                        placeholder="42"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">PLZ *</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        placeholder="1234"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="city">Stadt *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Musterstadt"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-Mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="max@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+41 12 345 67 89"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="membershipStartDate">Mitgliedschaft ab *</Label>
                    <Input
                      id="membershipStartDate"
                      type="date"
                      value={formData.membershipStartDate}
                      onChange={(e) => setFormData({ ...formData, membershipStartDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notizen</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optionale Notizen..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Erstelle..." : "Hinzufügen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="py-6 flex items-center justify-center h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/20">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeMembers.filter(m => getMemberStatus(m) === "active").length}</p>
                <p className="text-sm text-muted-foreground">Aktiv</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="py-6 flex items-center justify-center h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/20">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeMembers.filter(m => getMemberStatus(m) === "expiring").length}</p>
                <p className="text-sm text-muted-foreground">Läuft bald ab</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="py-6 flex items-center justify-center h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-500/20">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiredMembers.length}</p>
                <p className="text-sm text-muted-foreground">Abgelaufen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Members */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Aktive Mitglieder ({activeMembers.length})
        </h2>
        
        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">Lade Mitglieder...</p>
            </CardContent>
          </Card>
        ) : activeMembers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Users className="h-16 w-16 text-muted-foreground/50 mx-auto" />
                <p className="text-muted-foreground text-lg">
                  Noch keine aktiven Mitglieder vorhanden.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {activeMembers.map((member) => (
                <MemberCard key={member.id} member={member as Member} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Expired Members */}
      {expiredMembers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Abgelaufene Mitgliedschaften ({expiredMembers.length})
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {expiredMembers.map((member) => (
                <MemberCard key={member.id} member={member as Member} isExpired />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Extend Confirmation Dialog */}
      <AlertDialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitgliedschaft verlängern?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du die Mitgliedschaft von <strong>{selectedMember?.firstName} {selectedMember?.lastName}</strong> um 1 Jahr verlängern?
              {selectedMember && getMemberStatus(selectedMember) === "expired" && (
                <span className="block mt-2 text-primary">
                  Die abgelaufene Mitgliedschaft wird ab heute neu gestartet.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtend} className="bg-primary hover:bg-primary/90">
              Verlängern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du <strong>{selectedMember?.firstName} {selectedMember?.lastName}</strong> löschen möchtest? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
