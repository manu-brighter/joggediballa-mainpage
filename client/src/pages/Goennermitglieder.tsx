import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { usePermission } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-time-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/lib/errorMessages';
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
  ArrowUpDown,
  Pencil,
  Eye,
  Banknote,
  Copy,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { getLoginUrl } from '@/const';

const MotionDiv = motion.div;

type SortOption = 'endDate' | 'firstName' | 'lastName';

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
  paymentStatus: 'paid' | 'pending';
  paymentPendingSince: Date | null;
  contributionAmount: number;
  createdAt: Date;
}

function getDaysUntilExpiry(endDate: Date): number {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysSinceExpiry(endDate: Date): number {
  const now = new Date();
  const end = new Date(endDate);
  const diff = now.getTime() - end.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysSinceCreation(createdAt: Date): number {
  const now = new Date();
  const created = new Date(createdAt);
  const diff = now.getTime() - created.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysSincePaymentPending(pendingSince: Date | null): number {
  if (!pendingSince) return 0;
  const now = new Date();
  const pending = new Date(pendingSince);
  const diff = now.getTime() - pending.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isNewMember(member: Member): boolean {
  return getDaysSinceCreation(member.createdAt) <= 30;
}

function getMemberStatus(member: Member): 'active' | 'expiring' | 'expired' {
  const days = getDaysUntilExpiry(member.membershipEndDate);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}

// MemberCard component defined outside to prevent re-renders
const MemberCard = React.memo(
  ({
    member,
    isExpired = false,
    canManageGoennermitglieder,
    onViewClick,
    onEditClick,
    onExtendClick,
    onDeleteClick,
    onConfirmPayment,
  }: {
    member: Member;
    isExpired?: boolean;
    canManageGoennermitglieder: boolean;
    onViewClick: (member: Member) => void;
    onEditClick: (member: Member) => void;
    onExtendClick: (member: Member) => void;
    onDeleteClick: (member: Member) => void;
    onConfirmPayment: (member: Member) => void;
  }) => {
    const status = getMemberStatus(member);
    const daysLeft = getDaysUntilExpiry(member.membershipEndDate);

    return (
      <MotionDiv
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'rounded-xl border-2 p-4 transition-all duration-300 cursor-pointer',
          status === 'expired' &&
            'bg-muted/50 border-muted-foreground/20 hover:bg-muted/90 hover:border-destructive/30',
          status === 'expiring' &&
            'bg-warning/10 border-warning/20 hover:bg-warning/20 hover:border-warning/40',
          status === 'active' &&
            member.paymentStatus === 'pending' &&
            'bg-pending/10 border-pending/30 hover:bg-pending/20 hover:border-pending/40',
          status === 'active' &&
            member.paymentStatus === 'paid' &&
            'bg-card border-border hover:bg-muted/90 hover:border-primary/30',
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">
                {member.firstName} {member.lastName}
              </h3>
              {status === 'expired' && (
                <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                  Abgelaufen seit {getDaysSinceExpiry(member.membershipEndDate)}{' '}
                  Tagen
                </span>
              )}
              {status === 'expiring' && (
                <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning-foreground text-xs font-medium">
                  {daysLeft} Tage
                </span>
              )}
              {isNewMember(member) &&
                status !== 'expired' &&
                member.paymentStatus === 'paid' && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary dark:text-primary text-xs font-medium">
                    Neu
                  </span>
                )}
              {member.paymentStatus === 'pending' && (
                <span className="px-2 py-0.5 rounded-full bg-pending/20 text-pending-foreground text-xs font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Zahlung fällig seit{' '}
                  {getDaysSincePaymentPending(member.paymentPendingSince)} Tagen
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {member.street} {member.houseNumber}, {member.zipCode}{' '}
              {member.city}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Start:{' '}
                {new Date(member.membershipStartDate).toLocaleDateString(
                  'de-DE',
                )}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ende:{' '}
                {new Date(member.membershipEndDate).toLocaleDateString('de-DE')}
              </span>
              <span className="flex items-center gap-1">
                <Banknote className="h-3 w-3" />
                CHF {member.contributionAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManageGoennermitglieder &&
              member.paymentStatus === 'pending' && (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1 bg-primary hover:bg-primary/80"
                  onClick={() => onConfirmPayment(member)}
                  title="Zahlung bestätigen"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Zahlung bestätigen</span>
                  <span className="sm:hidden">Bestätigen</span>
                </Button>
              )}
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-muted-foreground hover:!bg-primary/10 hover:!text-primary transition-all duration-200"
              onClick={() => onViewClick(member)}
              title="Details anzeigen"
            >
              <Eye className="h-4 w-4" />
            </Button>

            {canManageGoennermitglieder && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-muted-foreground hover:!bg-primary/10 hover:!text-primary transition-all duration-200"
                  onClick={() => onEditClick(member)}
                  title="Bearbeiten"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-primary hover:!bg-primary/15 hover:!text-primary transition-all duration-200 font-medium"
                  onClick={() => onExtendClick(member)}
                >
                  <RefreshCw className="h-4 w-4" />
                  +1 Jahr
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-muted-foreground hover:!bg-destructive/10 hover:!text-destructive transition-all duration-200"
                  onClick={() => onDeleteClick(member)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </MotionDiv>
    );
  },
);

export default function Goennermitglieder() {
  const { user, isAuthenticated, loading } = useAuth();

  // Detect if device is mobile to prevent auto-focus
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentStatusDialogOpen, setPaymentStatusDialogOpen] = useState(false);
  const [pendingPaymentStatus, setPendingPaymentStatus] = useState<
    'paid' | 'pending'
  >('paid');
  const [currentAction, setCurrentAction] = useState<
    'create' | 'extend' | null
  >(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('endDate');
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    street: '',
    houseNumber: '',
    zipCode: '',
    city: '',
    email: '',
    phone: '',
    membershipStartDate: new Date().toISOString().split('T')[0],
    notes: '',
    contributionAmount: '20',
  });

  const utils = trpc.useUtils();
  const { data: allMembers = [], isLoading } =
    trpc.goennermitglieder.list.useQuery(undefined, {
      enabled: isAuthenticated,
    });

  const createMutation = trpc.goennermitglieder.create.useMutation({
    onSuccess: () => {
      utils.goennermitglieder.list.invalidate();
      toast.success('Mitglied erfolgreich hinzugefügt!');
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const extendMutation = trpc.goennermitglieder.extend.useMutation({
    onSuccess: data => {
      utils.goennermitglieder.list.invalidate();
      toast.success(
        `Mitgliedschaft verlängert bis ${new Date(data.newEndDate).toLocaleDateString('de-DE')}`,
      );
      setExtendDialogOpen(false);
      setSelectedMember(null);
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const deleteMutation = trpc.goennermitglieder.delete.useMutation({
    onSuccess: () => {
      utils.goennermitglieder.list.invalidate();
      toast.success('Mitglied gelöscht!');
      setDeleteDialogOpen(false);
      setSelectedMember(null);
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const updateMutation = trpc.goennermitglieder.update.useMutation({
    onSuccess: () => {
      utils.goennermitglieder.list.invalidate();
      toast.success('Mitglied aktualisiert!');
      setEditDialogOpen(false);
      setSelectedMember(null);
      resetForm();
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const confirmPaymentMutation =
    trpc.goennermitglieder.confirmPayment.useMutation({
      onSuccess: () => {
        utils.goennermitglieder.list.invalidate();
        toast.success('Zahlung bestätigt! Mitgliedschaft ist jetzt aktiv.');
        setSelectedMember(null);
      },
      onError: error => {
        toast.error(parseErrorMessage(error));
      },
    });

  const openEditDialog = (member: Member) => {
    setSelectedMember(member);
    setFormData({
      firstName: member.firstName,
      lastName: member.lastName,
      street: member.street,
      houseNumber: member.houseNumber,
      zipCode: member.zipCode,
      city: member.city,
      email: member.email || '',
      phone: member.phone || '',
      membershipStartDate: new Date(member.membershipStartDate)
        .toISOString()
        .split('T')[0],
      notes: member.notes || '',
      contributionAmount: member.contributionAmount.toString(),
    });
    setEditDialogOpen(true);
  };

  const openViewDialog = (member: Member) => {
    setSelectedMember(member);
    setViewDialogOpen(true);
  };

  const canManageGoennermitglieder = usePermission('manage_goennermitglieder');

  // Get available years from all members
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allMembers.forEach(member => {
      const startYear = new Date(member.membershipStartDate).getFullYear();
      years.add(startYear);
    });
    return Array.from(years).sort((a, b) => b - a); // Newest first
  }, [allMembers]);

  const { activeMembers, pendingMembers, expiredMembers } = useMemo(() => {
    const active: Member[] = [];
    const pending: Member[] = [];
    const expired: Member[] = [];

    allMembers.forEach(member => {
      const typedMember = member as Member;
      const status = getMemberStatus(typedMember);

      // Filter by year if selected
      if (filterYear !== 'all') {
        const startYear = new Date(
          typedMember.membershipStartDate,
        ).getFullYear();
        if (startYear !== filterYear) {
          return; // Skip this member
        }
      }

      if (typedMember.paymentStatus === 'pending') {
        // Ausstehende Zahlungen
        pending.push(typedMember);
      } else if (status === 'expired') {
        // Abgelaufene Mitglieder
        expired.push(typedMember);
      } else {
        // Aktive Mitglieder (paid and not expired)
        active.push(typedMember);
      }
    });

    // Sort active members
    active.sort((a, b) => {
      switch (sortBy) {
        case 'firstName':
          return a.firstName.localeCompare(b.firstName);
        case 'lastName':
          return a.lastName.localeCompare(b.lastName);
        case 'endDate':
          return (
            new Date(a.membershipEndDate).getTime() -
            new Date(b.membershipEndDate).getTime()
          );
        default:
          return 0;
      }
    });

    // Sort pending members by payment pending date (oldest first)
    pending.sort((a, b) => {
      const aDate = a.paymentPendingSince
        ? new Date(a.paymentPendingSince).getTime()
        : 0;
      const bDate = b.paymentPendingSince
        ? new Date(b.paymentPendingSince).getTime()
        : 0;
      return aDate - bDate;
    });

    // Sort expired by most recently expired first
    expired.sort(
      (a, b) =>
        new Date(b.membershipEndDate).getTime() -
        new Date(a.membershipEndDate).getTime(),
    );

    return {
      activeMembers: active,
      pendingMembers: pending,
      expiredMembers: expired,
    };
  }, [allMembers, sortBy, filterYear]);

  // Calculate total contribution amount from active members only
  const totalActiveContributions = useMemo(() => {
    return activeMembers.reduce(
      (sum, member) => sum + (member.contributionAmount || 0),
      0,
    );
  }, [activeMembers]);

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      street: '',
      houseNumber: '',
      zipCode: '',
      city: '',
      email: '',
      phone: '',
      membershipStartDate: new Date().toISOString().split('T')[0],
      notes: '',
      contributionAmount: '20',
    });
  };

  const handleCreateClick = () => {
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.street ||
      !formData.houseNumber ||
      !formData.zipCode ||
      !formData.city
    ) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    // Open payment status dialog
    setCurrentAction('create');
    setPaymentStatusDialogOpen(true);
  };

  const handleCreate = () => {
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
      notes: formData.notes || undefined,
      paymentStatus: pendingPaymentStatus,
      contributionAmount: parseFloat(formData.contributionAmount) || 20,
    });
    setPaymentStatusDialogOpen(false);
  };

  const handleExtendClick = (member: Member) => {
    setSelectedMember(member);
    setCurrentAction('extend');
    setPaymentStatusDialogOpen(true);
  };

  const handleExtend = () => {
    if (selectedMember) {
      extendMutation.mutate({
        memberId: selectedMember.id,
        years: 1,
        paymentStatus: pendingPaymentStatus,
      });
      setPaymentStatusDialogOpen(false);
      setExtendDialogOpen(false);
    }
  };

  const handleConfirmPayment = (member: Member) => {
    confirmPaymentMutation.mutate({ memberId: member.id });
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
              Du musst angemeldet sein, um die Gönnermitgliederverwaltung zu
              nutzen.
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          {/* Filter and Sort Dropdowns - Side by side on mobile */}
          <div className="flex gap-2">
            {/* Year Filter Dropdown */}
            <Select
              value={filterYear.toString()}
              onValueChange={value =>
                setFilterYear(value === 'all' ? 'all' : parseInt(value))
              }
            >
              <SelectTrigger className="w-full sm:w-auto min-w-[140px] h-10">
                <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                <SelectValue placeholder="Jahr" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Jahre</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Dropdown */}
            <Select
              value={sortBy}
              onValueChange={value => setSortBy(value as SortOption)}
            >
              <SelectTrigger className="w-full sm:w-auto min-w-[140px] h-10">
                <ArrowUpDown className="h-4 w-4 mr-2 flex-shrink-0" />
                <SelectValue placeholder="Sortieren" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="endDate">Nach Ablaufdatum</SelectItem>
                <SelectItem value="firstName">Nach Vorname</SelectItem>
                <SelectItem value="lastName">Nach Nachname</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons - Side by side on mobile */}
          <div className="flex gap-2">
            {/* Payment Info Button */}
            <Dialog
              open={paymentDialogOpen}
              onOpenChange={setPaymentDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 h-9.5 flex-1 sm:flex-initial sm:w-auto"
                >
                  <Banknote className="h-4 w-4" />
                  <span className="hidden sm:inline">Einzahlen</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Gönnermitgliedschaft Einzahlung
                  </DialogTitle>
                  <DialogDescription className="text-left">
                    Scanne den QR-Code mit deiner Banking-App oder verwende die
                    untenstehenden Zahlungsinformationen.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
                  {/* QR Code Section */}
                  <div className="flex flex-col items-center justify-center p-3 sm:p-6 bg-muted/30 rounded-lg">
                    <div className="bg-white p-2 sm:p-4 rounded-lg shadow-sm">
                      <img
                        src="/images/Einzahlungs-QR-Code.png"
                        alt="Swiss QR Payment"
                        className="w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64"
                      />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-4 text-center">
                      Swiss QR-Rechnung
                    </p>
                  </div>

                  {/* Payment Details */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">
                      Zahlungsinformationen
                    </h3>

                    {/* IBAN */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">IBAN</Label>
                      <div className="flex gap-2">
                        <Input
                          value="CH98 0076 9438 7141 3200 1"
                          readOnly
                          className="font-mono bg-muted/50"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              'CH9800769438714132001',
                            );
                            setCopiedField('iban');
                            toast.success('IBAN kopiert');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                        >
                          {copiedField === 'iban' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Empfänger */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Empfänger</Label>
                      <div className="p-3 bg-muted/50 rounded-md">
                        <p className="font-medium">Jogge di Balla</p>
                        <p className="text-sm text-muted-foreground">
                          Breitenbacherstrasse 24
                        </p>
                        <p className="text-sm text-muted-foreground">
                          4225 Brislach
                        </p>
                      </div>
                    </div>

                    {/* Referenz */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Zahlungszweck
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value="Gönnermitgliedschaft"
                          readOnly
                          className="bg-muted/50"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              'Gönnermitgliedschaft',
                            );
                            setCopiedField('reference');
                            toast.success('Zahlungszweck kopiert');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                        >
                          {copiedField === 'reference' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Betrag */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Betrag</Label>
                      <Input
                        value="mind. CHF 20.- pro Jahr"
                        readOnly
                        className="bg-muted/50"
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm text-foreground">
                      <strong>Hinweis:</strong> Nach Zahlungseingang wird die
                      Mitgliedschaft vom Admin bestätigt und aktiviert.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Create Button */}
            {canManageGoennermitglieder && (
              <Dialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="btn-animate gap-2 h-9.5 flex-1 sm:flex-initial sm:w-auto">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Neues Mitglied</span>
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="max-w-lg max-h-[90vh] overflow-y-auto"
                  onEnterKey={handleCreateClick}
                >
                  <DialogHeader>
                    <DialogTitle>Neues Gönnermitglied</DialogTitle>
                    <DialogDescription>
                      Füge ein neues Gönnermitglied hinzu. Die Mitgliedschaft
                      läuft automatisch ohne reaktivierung nach einem Jahr ab.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">
                          Vorname <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                          placeholder="Max"
                          autoFocus={!isMobile}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">
                          Nachname <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                          placeholder="Mustermann"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="street">
                          Strasse <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="street"
                          value={formData.street}
                          onChange={e =>
                            setFormData({ ...formData, street: e.target.value })
                          }
                          placeholder="Musterstrasse"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="houseNumber">
                          Nr. <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="houseNumber"
                          value={formData.houseNumber}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              houseNumber: e.target.value,
                            })
                          }
                          placeholder="42"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">
                          PLZ <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="zipCode"
                          value={formData.zipCode}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              zipCode: e.target.value,
                            })
                          }
                          placeholder="1234"
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="city">
                          Stadt <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={e =>
                            setFormData({ ...formData, city: e.target.value })
                          }
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
                          onChange={e =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="max@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefon</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={e =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          placeholder="+41 12 345 67 89"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="membershipStartDate">
                        Mitgliedschaft ab *
                      </Label>
                      <DateInput
                        id="membershipStartDate"
                        value={formData.membershipStartDate}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            membershipStartDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contributionAmount">
                        Gönnerbeitrag (CHF) *
                      </Label>
                      <Input
                        id="contributionAmount"
                        type="number"
                        min="1"
                        step="1"
                        value={formData.contributionAmount}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            contributionAmount: e.target.value,
                          })
                        }
                        placeholder="20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notizen</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={e =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="Optionale Notizen..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      onClick={handleCreateClick}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? 'Erstelle...' : 'Hinzufügen'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards - Compact horizontal layout */}
      {/* Total Contributions Card */}
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border-teal-500/20">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Gesamtsumme aktiver Mitglieder
                </p>
                <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                  CHF {totalActiveContributions.toLocaleString('de-CH')}.-
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeMembers.length}{' '}
                  {activeMembers.length === 1 ? 'Mitglied' : 'Mitglieder'}
                </p>
              </div>
              <div className="h-16 w-16 rounded-full bg-teal-500/20 flex items-center justify-center">
                <Banknote className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Stats Badges */}
      <div className="flex flex-wrap gap-3 justify-center md:justify-start">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <CheckCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {activeMembers.filter(m => getMemberStatus(m) === 'active').length}{' '}
            Aktiv
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm font-medium">
            {
              activeMembers.filter(m => getMemberStatus(m) === 'expiring')
                .length
            }{' '}
            Läuft bald ab
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-pending/10 border border-pending/20">
          <Clock className="h-4 w-4 text-pending" />
          <span className="text-sm font-medium">
            {pendingMembers.length} Provisorisch
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium">
            {expiredMembers.length} Abgelaufen
          </span>
        </div>
      </div>

      {/* Active Members */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="text-primary">
            Aktive Mitglieder ({activeMembers.length})
          </span>
        </h2>

        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                Lade Mitglieder...
              </p>
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
            <AnimatePresence mode="popLayout">
              {activeMembers.map(member => (
                <MemberCard
                  key={member.id}
                  member={member as Member}
                  canManageGoennermitglieder={canManageGoennermitglieder}
                  onViewClick={openViewDialog}
                  onEditClick={openEditDialog}
                  onExtendClick={handleExtendClick}
                  onDeleteClick={m => {
                    setSelectedMember(m);
                    setDeleteDialogOpen(true);
                  }}
                  onConfirmPayment={handleConfirmPayment}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Provisorische Mitglieder Section */}
      {pendingMembers.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Clock className="h-6 w-6 text-pending" />
            <span className="text-pending">
              Provisorische Mitglieder ({pendingMembers.length})
            </span>
          </h2>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {pendingMembers.map(member => (
                <MemberCard
                  key={member.id}
                  member={member as Member}
                  canManageGoennermitglieder={canManageGoennermitglieder}
                  onViewClick={openViewDialog}
                  onEditClick={openEditDialog}
                  onExtendClick={handleExtendClick}
                  onDeleteClick={m => {
                    setSelectedMember(m);
                    setDeleteDialogOpen(true);
                  }}
                  onConfirmPayment={handleConfirmPayment}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Expired Members Section */}
      {expiredMembers.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-destructive/70">
            <XCircle className="h-6 w-6 text-destructive/70" />
            Abgelaufene Mitgliedschaften ({expiredMembers.length})
          </h2>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {expiredMembers.map(member => (
                <MemberCard
                  key={member.id}
                  member={member as Member}
                  isExpired
                  canManageGoennermitglieder={canManageGoennermitglieder}
                  onViewClick={openViewDialog}
                  onEditClick={openEditDialog}
                  onExtendClick={handleExtendClick}
                  onDeleteClick={m => {
                    setSelectedMember(m);
                    setDeleteDialogOpen(true);
                  }}
                  onConfirmPayment={handleConfirmPayment}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Extend Confirmation Dialog */}
      <AlertDialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitgliedschaft verlängern?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du die Mitgliedschaft von{' '}
              <strong>
                {selectedMember?.firstName} {selectedMember?.lastName}
              </strong>{' '}
              um 1 Jahr verlängern?
              {selectedMember &&
                getMemberStatus(selectedMember) === 'expired' && (
                  <span className="block mt-2 text-primary">
                    Die abgelaufene Mitgliedschaft wird ab heute neu gestartet.
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExtend}
              className="bg-primary hover:bg-primary/90"
            >
              Verlängern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent onEnterKey={handleDelete}>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du{' '}
              <strong>
                {selectedMember?.firstName} {selectedMember?.lastName}
              </strong>{' '}
              löschen möchtest? Diese Aktion kann nicht rückgängig gemacht
              werden.
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

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mitglied Details</DialogTitle>
            <DialogDescription>
              Alle Informationen zu diesem Gönnermitglied.
            </DialogDescription>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Vorname
                  </Label>
                  <p className="font-medium">{selectedMember.firstName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Nachname
                  </Label>
                  <p className="font-medium">{selectedMember.lastName}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Adresse</Label>
                <p className="font-medium">
                  {selectedMember.street} {selectedMember.houseNumber}
                  <br />
                  {selectedMember.zipCode} {selectedMember.city}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">
                    E-Mail
                  </Label>
                  <p className="font-medium">{selectedMember.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Telefon
                  </Label>
                  <p className="font-medium">{selectedMember.phone || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Mitgliedschaft Start
                  </Label>
                  <p className="font-medium">
                    {new Date(
                      selectedMember.membershipStartDate,
                    ).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Mitgliedschaft Ende
                  </Label>
                  <p className="font-medium">
                    {new Date(
                      selectedMember.membershipEndDate,
                    ).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">
                  Gönnerbeitrag
                </Label>
                <p className="font-medium">
                  CHF {selectedMember.contributionAmount}.-
                </p>
              </div>
              {selectedMember.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Notizen
                  </Label>
                  <p className="font-medium whitespace-pre-wrap">
                    {selectedMember.notes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={open => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedMember(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mitglied bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Informationen des Gönnermitglieds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">
                  Vorname <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={e =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="Vorname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">
                  Nachname <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={e =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Nachname"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-street">
                  Strasse <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-street"
                  value={formData.street}
                  onChange={e =>
                    setFormData({ ...formData, street: e.target.value })
                  }
                  placeholder="Strasse"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-houseNumber">
                  Nr. <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-houseNumber"
                  value={formData.houseNumber}
                  onChange={e =>
                    setFormData({ ...formData, houseNumber: e.target.value })
                  }
                  placeholder="Nr."
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-zipCode">
                  PLZ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-zipCode"
                  value={formData.zipCode}
                  onChange={e =>
                    setFormData({ ...formData, zipCode: e.target.value })
                  }
                  placeholder="PLZ"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-city">
                  Ort <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-city"
                  value={formData.city}
                  onChange={e =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="Ort"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-Mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={e =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@beispiel.ch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefon</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={e =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+41 79 123 45 67"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-contributionAmount">
                Gönnerbeitrag (CHF) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-contributionAmount"
                type="number"
                min="1"
                step="1"
                value={formData.contributionAmount}
                onChange={e =>
                  setFormData({
                    ...formData,
                    contributionAmount: e.target.value,
                  })
                }
                placeholder="20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notizen</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={e =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optionale Notizen..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                if (!selectedMember) return;
                updateMutation.mutate({
                  memberId: selectedMember.id,
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  street: formData.street,
                  houseNumber: formData.houseNumber,
                  zipCode: formData.zipCode,
                  city: formData.city,
                  email: formData.email || undefined,
                  phone: formData.phone || undefined,
                  notes: formData.notes || undefined,
                  contributionAmount:
                    parseFloat(formData.contributionAmount) || 20,
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Speichere...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Status Dialog */}
      <AlertDialog
        open={paymentStatusDialogOpen}
        onOpenChange={setPaymentStatusDialogOpen}
      >
        <AlertDialogContent
          onEnterKey={() => {
            if (currentAction === 'create') {
              handleCreate();
            } else if (currentAction === 'extend') {
              handleExtend();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Zahlungsstatus</AlertDialogTitle>
            <AlertDialogDescription>
              Hat das Mitglied den Mitgliederbeitrag bereits bezahlt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setPendingPaymentStatus('paid')}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer',
                  pendingPaymentStatus === 'paid'
                    ? 'border-success bg-success/10'
                    : 'border-border hover:border-success/50',
                )}
              >
                <CheckCircle
                  className={cn(
                    'h-5 w-5',
                    pendingPaymentStatus === 'paid'
                      ? 'text-success'
                      : 'text-muted-foreground',
                  )}
                />
                <div className="text-left">
                  <p className="font-semibold">Ja, bereits bezahlt</p>
                  <p className="text-sm text-muted-foreground">
                    Mitgliedschaft wird sofort aktiviert
                  </p>
                </div>
              </button>
              <button
                onClick={() => setPendingPaymentStatus('pending')}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer',
                  pendingPaymentStatus === 'pending'
                    ? 'border-pending bg-pending/10'
                    : 'border-border hover:border-pending/50',
                )}
              >
                <AlertTriangle
                  className={cn(
                    'h-5 w-5',
                    pendingPaymentStatus === 'pending'
                      ? 'text-pending'
                      : 'text-muted-foreground',
                  )}
                />
                <div className="text-left">
                  <p className="font-semibold">Nein, Zahlung ausständig</p>
                  <p className="text-sm text-muted-foreground">
                    Mitgliedschaft wird als provisorisch markiert
                  </p>
                </div>
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPaymentStatusDialogOpen(false);
                if (currentAction === 'create') {
                  // Stay in create dialog
                } else if (currentAction === 'extend') {
                  setExtendDialogOpen(false);
                }
              }}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (currentAction === 'create') {
                  handleCreate();
                } else if (currentAction === 'extend') {
                  handleExtend();
                }
              }}
            >
              Bestätigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
