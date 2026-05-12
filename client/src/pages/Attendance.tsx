import { useState, useMemo, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { usePermission } from '@/hooks/usePermissions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SafeSelect } from '@/components/ui/safe-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-time-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/lib/errorMessages';
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  BarChart3,
  ClipboardList,
  UserPlus,
  UserMinus,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { AttendanceMembersManagement } from '@/components/AttendanceMembersManagement';
import { AttendanceSessionCard } from '@/components/AttendanceSessionCard';

const MotionCard = motion.create(Card);

interface Session {
  id: number;
  date: Date;
  title: string;
  type: 'meeting' | 'event';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Member {
  id: number;
  name: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AttendanceRecord {
  id: number;
  sessionId: number;
  memberId: number;
  status: 'present' | 'partial' | 'absent';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AttendanceFormData {
  [memberId: number]: {
    status: 'present' | 'partial' | 'absent';
    notes: string;
  };
}

export default function Attendance() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const canManageAttendance = usePermission('manage_attendance');

  // Detect if device is mobile to prevent auto-focus
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Filter state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [typeFilter, setTypeFilter] = useState<'all' | 'meeting' | 'event'>(
    'all',
  );

  // Dialog states
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [membersManagementOpen, setMembersManagementOpen] = useState(false);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [deleteMemberDialogOpen, setDeleteMemberDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  // Form state
  const [sessionForm, setSessionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    type: 'meeting' as 'meeting' | 'event',
    notes: '',
  });

  const [memberForm, setMemberForm] = useState({
    name: '',
  });

  const [editMemberForm, setEditMemberForm] = useState({
    name: '',
    isActive: true,
  });

  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormData>({});

  // Queries
  const { data: sessions = [], isLoading: sessionsLoading } =
    trpc.attendance.listSessions.useQuery({
      year: selectedYear === 'all' ? undefined : selectedYear,
    });

  const { data: members = [], isLoading: membersLoading } =
    trpc.attendance.listMembers.useQuery({
      activeOnly: true,
    });

  const { data: allMembers = [] } = trpc.attendance.listMembers.useQuery({
    activeOnly: false,
  });

  const { data: records = [] } = trpc.attendance.listRecords.useQuery(
    { sessionId: selectedSession?.id || 0 },
    { enabled: !!selectedSession },
  );

  // Mutations
  const createSessionMutation = trpc.attendance.createSession.useMutation({
    onSuccess: () => {
      utils.attendance.listSessions.invalidate();
      toast.success('Meeting/Event erfolgreich erstellt');
      setSessionDialogOpen(false);
      resetSessionForm();
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const updateSessionMutation = trpc.attendance.updateSession.useMutation({
    onSuccess: () => {
      utils.attendance.listSessions.invalidate();
      toast.success('Meeting/Event erfolgreich aktualisiert');
      setSessionDialogOpen(false);
      resetSessionForm();
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const deleteSessionMutation = trpc.attendance.deleteSession.useMutation({
    onSuccess: () => {
      utils.attendance.listSessions.invalidate();
      toast.success('Meeting/Event erfolgreich gelöscht');
      setDeleteDialogOpen(false);
      setSelectedSession(null);
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const createMemberMutation = trpc.attendance.createMember.useMutation({
    onSuccess: () => {
      utils.attendance.listMembers.invalidate();
      toast.success('Mitglied erfolgreich hinzugefügt');
      setMemberDialogOpen(false);
      resetMemberForm();
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  const saveAttendanceMutation = trpc.attendance.saveAttendance.useMutation({
    onSuccess: () => {
      utils.attendance.listRecords.invalidate();
      toast.success('Anwesenheit erfolgreich gespeichert');
      setAttendanceDialogOpen(false);
      setSelectedSession(null);
      setAttendanceForm({});
    },
    onError: error => {
      toast.error(parseErrorMessage(error));
    },
  });

  // Handlers
  const resetSessionForm = () => {
    setSessionForm({
      date: new Date().toISOString().split('T')[0],
      title: '',
      type: 'meeting',
      notes: '',
    });
    setIsEdit(false);
  };

  const resetMemberForm = () => {
    setMemberForm({ name: '' });
  };

  const handleCreateSession = () => {
    if (!sessionForm.title.trim()) {
      toast.error('Titel ist erforderlich');
      return;
    }
    createSessionMutation.mutate(sessionForm);
  };

  const handleUpdateSession = () => {
    if (!selectedSession) return;
    if (!sessionForm.title.trim()) {
      toast.error('Titel ist erforderlich');
      return;
    }
    updateSessionMutation.mutate({
      sessionId: selectedSession.id,
      ...sessionForm,
    });
  };

  const handleDeleteSession = () => {
    if (!selectedSession) return;
    deleteSessionMutation.mutate({ sessionId: selectedSession.id });
  };

  const handleCreateMember = () => {
    if (!memberForm.name.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }
    createMemberMutation.mutate(memberForm);
  };

  const handleOpenAttendance = async (session: Session) => {
    setSelectedSession(session);

    // Wait for records to be loaded
    const sessionRecords = await utils.attendance.listRecords.fetch({
      sessionId: session.id,
    });

    // Initialize form with existing records only
    const initialForm: AttendanceFormData = {};
    members.forEach(member => {
      const record = sessionRecords.find(r => r.memberId === member.id);
      if (record) {
        initialForm[member.id] = {
          status: record.status,
          notes: record.notes || '',
        };
      }
    });
    setAttendanceForm(initialForm);
    setAttendanceDialogOpen(true);
  };

  const handleSaveAttendance = () => {
    if (!selectedSession) return;

    const recordsToSave = Object.entries(attendanceForm).map(
      ([memberId, data]) => ({
        memberId: parseInt(memberId),
        status: data.status,
        notes: data.notes || undefined,
      }),
    );

    saveAttendanceMutation.mutate({
      sessionId: selectedSession.id,
      records: recordsToSave,
    });
  };

  const handleEditSession = (session: Session) => {
    setSelectedSession(session);
    setSessionForm({
      date: new Date(session.date).toISOString().split('T')[0],
      title: session.title,
      type: session.type,
      notes: session.notes || '',
    });
    setIsEdit(true);
    setSessionDialogOpen(true);
  };

  const handleViewSession = (session: Session) => {
    setSelectedSession(session);
    setViewDialogOpen(true);
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      if (typeFilter !== 'all' && session.type !== typeFilter) return false;
      return true;
    });
  }, [sessions, typeFilter]);

  // Available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    sessions.forEach(session => {
      const year = new Date(session.date).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [sessions]);

  if (!canManageAttendance) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Keine Berechtigung</CardTitle>
            <CardDescription>
              Du hast keine Berechtigung, die Anwesenheitsliste zu verwalten.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Anwesenheitsliste</h1>
            <p className="text-muted-foreground">
              Verwalte Meetings, Events und Anwesenheit
            </p>
          </div>
          <Link href="/attendance/statistics">
            <Button variant="outline" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Statistiken
            </Button>
          </Link>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Year Filter */}
          <Select
            value={selectedYear.toString()}
            onValueChange={value =>
              setSelectedYear(value === 'all' ? 'all' : parseInt(value))
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
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

          {/* Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(value: 'all' | 'meeting' | 'event') =>
              setTypeFilter(value)
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              <SelectItem value="meeting">Meetings</SelectItem>
              <SelectItem value="event">Events</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setMembersManagementOpen(true)}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Verwalten</span>
            </Button>

            {/* Create Session Button */}
            <Button
              className="gap-2"
              onClick={() => {
                resetSessionForm();
                setSessionDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Meeting/Event
            </Button>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      {sessionsLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Keine Meetings/Events gefunden
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-1">
          <AnimatePresence mode="popLayout">
            {filteredSessions.map(session => (
              <AttendanceSessionCard
                key={session.id}
                session={session}
                members={members}
                onOpenAttendance={handleOpenAttendance}
                onEditSession={handleEditSession}
                onDeleteSession={session => {
                  setSelectedSession(session);
                  setDeleteDialogOpen(true);
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Session Dialog */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Meeting/Event bearbeiten' : 'Meeting/Event erstellen'}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Bearbeite die Details'
                : 'Erstelle ein neues Meeting oder Event'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={sessionForm.title}
                onChange={e =>
                  setSessionForm({ ...sessionForm, title: e.target.value })
                }
                placeholder="z.B. Jahressitzung"
                autoFocus={!isMobile}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    isEdit ? handleUpdateSession() : handleCreateSession();
                  }
                }}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="date">
                Datum <span className="text-destructive">*</span>
              </Label>
              <DateInput
                id="sessionDate"
                value={sessionForm.date}
                onChange={e =>
                  setSessionForm({ ...sessionForm, date: e.target.value })
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    isEdit ? handleUpdateSession() : handleCreateSession();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">
                Typ <span className="text-destructive">*</span>
              </Label>
              <SafeSelect
                id="type"
                value={sessionForm.type}
                onValueChange={val =>
                  setSessionForm({
                    ...sessionForm,
                    type: val as 'meeting' | 'event',
                  })
                }
                options={[
                  { value: 'meeting', label: 'Meeting' },
                  { value: 'event', label: 'Event' },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                value={sessionForm.notes}
                onChange={e =>
                  setSessionForm({ ...sessionForm, notes: e.target.value })
                }
                placeholder="Optionale Notizen zum Meeting/Event"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSessionDialogOpen(false);
                resetSessionForm();
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={isEdit ? handleUpdateSession : handleCreateSession}
            >
              {isEdit ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
      >
        <DialogContent className="w-[100vw] sm:w-[90vw] lg:min-w-[1000px] max-w-[1600px] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Anwesenheit erfassen: {selectedSession?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedSession &&
                new Date(selectedSession.date).toLocaleDateString('de-CH', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 sm:space-y-3 py-2 sm:py-4">
            {members.map(member => (
              <div
                key={member.id}
                className="p-2 sm:p-4 border rounded-lg space-y-2 sm:space-y-3 bg-card"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="font-medium text-sm sm:text-base">
                    {member.name}
                  </span>
                  <div className="flex gap-1 sm:gap-2">
                    <Button
                      size="sm"
                      variant={
                        attendanceForm[member.id]?.status === 'present'
                          ? 'default'
                          : 'outline'
                      }
                      className={cn(
                        'gap-1 flex-1 sm:flex-none',
                        attendanceForm[member.id]?.status === 'present' &&
                          'bg-success text-success-foreground hover:bg-success/90',
                      )}
                      onClick={() =>
                        setAttendanceForm({
                          ...attendanceForm,
                          [member.id]: {
                            ...attendanceForm[member.id],
                            status: 'present',
                          },
                        })
                      }
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Anwesend</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        attendanceForm[member.id]?.status === 'partial'
                          ? 'default'
                          : 'outline'
                      }
                      className={cn(
                        'gap-1 flex-1 sm:flex-none',
                        attendanceForm[member.id]?.status === 'partial' &&
                          'bg-warning text-warning-foreground hover:bg-warning/90',
                      )}
                      onClick={() =>
                        setAttendanceForm({
                          ...attendanceForm,
                          [member.id]: {
                            ...attendanceForm[member.id],
                            status: 'partial',
                          },
                        })
                      }
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span className="hidden sm:inline">Teilweise</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        attendanceForm[member.id]?.status === 'absent'
                          ? 'default'
                          : 'outline'
                      }
                      className={cn(
                        'gap-1 flex-1 sm:flex-none',
                        attendanceForm[member.id]?.status === 'absent' &&
                          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                      )}
                      onClick={() =>
                        setAttendanceForm({
                          ...attendanceForm,
                          [member.id]: {
                            ...attendanceForm[member.id],
                            status: 'absent',
                          },
                        })
                      }
                    >
                      <XCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Abwesend</span>
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="Notiz (optional)"
                  className="text-sm"
                  value={attendanceForm[member.id]?.notes || ''}
                  onChange={e =>
                    setAttendanceForm({
                      ...attendanceForm,
                      [member.id]: {
                        ...attendanceForm[member.id],
                        status: attendanceForm[member.id]?.status || 'absent',
                        notes: e.target.value,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAttendanceDialogOpen(false);
                setSelectedSession(null);
                setAttendanceForm({});
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSaveAttendance}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mitglied hinzufügen</DialogTitle>
            <DialogDescription>
              Füge ein neues Mitglied oder temporären Helfer hinzu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="memberName">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="memberName"
                value={memberForm.name}
                onChange={e => setMemberForm({ name: e.target.value })}
                placeholder="z.B. Max Mustermann"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateMember();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMemberDialogOpen(false);
                resetMemberForm();
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreateMember}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Session Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Meeting/Event Details</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Titel</Label>
                <p className="font-medium">{selectedSession.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Datum</Label>
                <p className="font-medium">
                  {new Date(selectedSession.date).toLocaleDateString('de-CH', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Typ</Label>
                <div className="mt-1">
                  <Badge
                    variant={
                      selectedSession.type === 'event' ? 'default' : 'secondary'
                    }
                    className={cn(
                      selectedSession.type === 'event' && 'bg-primary',
                    )}
                  >
                    {selectedSession.type === 'event' ? 'Event' : 'Meeting'}
                  </Badge>
                </div>
              </div>
              {selectedSession.notes && (
                <div>
                  <Label className="text-muted-foreground">Notizen</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">
                    {selectedSession.notes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Meeting/Event löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du "{selectedSession?.title}" löschen
              möchtest? Alle Anwesenheitseinträge werden ebenfalls gelöscht.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedSession(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members Management Dialog */}
      <AttendanceMembersManagement
        open={membersManagementOpen}
        onOpenChange={setMembersManagementOpen}
        members={allMembers}
        onCreateMember={() => setMemberDialogOpen(true)}
      />
    </div>
  );
}
