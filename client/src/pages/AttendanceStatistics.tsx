import { useState, useMemo, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Trophy,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const COLORS = {
  present: '#22c55e',
  partial: '#f97316',
  absent: '#ef4444',
  meeting: '#3b82f6',
  event: '#14b8a6',
};

// "+N tied" badge listing members sharing the same rank value. Controlled so a
// tap toggles on mobile; hover/focus still opens it on desktop.
function TieBadge({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <UITooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        type="button"
        aria-label={`${names.length - 1} weitere mit gleichem Wert anzeigen`}
        // Suppress Radix's built-in close-on-pointerdown / close-on-click so a
        // tap toggles instead of immediately re-closing (mobile).
        onPointerDown={e => e.preventDefault()}
        onClick={e => {
          e.preventDefault();
          setOpen(o => !o);
        }}
        className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-muted-foreground"
      >
        +{names.length - 1}
      </TooltipTrigger>
      <TooltipContent>{names.join(', ')}</TooltipContent>
    </UITooltip>
  );
}

export default function AttendanceStatistics() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const canManageAttendance = usePermission('manage_attendance');

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [eventWeight, setEventWeight] = useState('2.0');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Queries
  const { data: stats, isLoading } = trpc.attendance.getStatistics.useQuery({
    year: selectedYear === 'all' ? undefined : selectedYear,
  });

  const { data: sessions = [] } = trpc.attendance.listSessions.useQuery({
    year: selectedYear === 'all' ? undefined : selectedYear,
  });

  const { data: weightSetting } = trpc.attendance.getSetting.useQuery({
    key: 'event_weight_multiplier',
  });

  // Mutations
  const updateWeightMutation = trpc.attendance.updateEventWeight.useMutation({
    onSuccess: () => {
      utils.attendance.getStatistics.invalidate();
      utils.attendance.getSetting.invalidate();
      toast.success('Event-Gewichtung aktualisiert');
      setSettingsOpen(false);
    },
    onError: error => {
      toast.error('Fehler beim Speichern: ' + error.message);
    },
  });

  // Set initial weight from settings
  useMemo(() => {
    if (weightSetting) {
      setEventWeight(weightSetting.settingValue);
    }
  }, [weightSetting]);

  // Available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    sessions.forEach(session => {
      const year = new Date(session.date).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [sessions]);

  // Prepare chart data
  const attendanceRateData = useMemo(() => {
    if (!stats) return [];
    // Sort by the rate this chart actually shows. memberStats arrives ordered
    // by weightedAbsences, which counts event absences eventWeight times while
    // attendanceRate counts every session equally — so reversing that order
    // does not produce a descending rate whenever eventWeight != 1. Copy first,
    // the server order is what absenceData and best/worstMembers rely on.
    return [...stats.memberStats]
      .sort(
        (a, b) =>
          b.attendanceRate - a.attendanceRate ||
          a.weightedAbsences - b.weightedAbsences,
      )
      .map(m => ({
        name: m.memberName,
        rate: Math.round(m.attendanceRate * 10) / 10,
        present: m.presentCount,
        partial: m.partialCount,
        absent: m.absentCount,
      }));
  }, [stats]);

  const absenceData = useMemo(() => {
    if (!stats) return [];
    return stats.memberStats.map(m => ({
      name: m.memberName,
      weighted: Math.round(m.weightedAbsences * 10) / 10,
      absent: m.absentCount,
      partial: m.partialCount,
    }));
  }, [stats]);

  // Calculate max weighted absence for domain
  const maxWeightedAbsence = useMemo(() => {
    if (!absenceData.length) return 10;
    return Math.max(...absenceData.map(d => d.weighted));
  }, [absenceData]);

  // All members tied with the best / worst member on the SAME key the server
  // ranks by — weightedAbsences (attendance_db.ts sorts memberStats by it and
  // picks best/worst from the ends). bestMember/worstMember are themselves
  // entries of memberStats, so `===` compares same-source values (safe).
  const bestMembers = useMemo(() => {
    if (!stats?.bestMember) return [];
    const target = stats.bestMember.weightedAbsences;
    return stats.memberStats.filter(m => m.weightedAbsences === target);
  }, [stats]);

  const worstMembers = useMemo(() => {
    if (!stats?.worstMember) return [];
    const target = stats.worstMember.weightedAbsences;
    return stats.memberStats.filter(m => m.weightedAbsences === target);
  }, [stats]);

  // Only surface a "+N tied" badge when the tie is a real subset — if every
  // member shares the value there is no meaningful best/worst to single out
  // (and both cards would otherwise list the whole roster).
  const memberCount = stats?.memberStats.length ?? 0;
  const showBestTie =
    bestMembers.length > 1 && bestMembers.length < memberCount;
  const showWorstTie =
    worstMembers.length > 1 && worstMembers.length < memberCount;

  const sessionTypeData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Meetings', value: stats.meetingCount, color: COLORS.meeting },
      { name: 'Events', value: stats.eventCount, color: COLORS.event },
    ];
  }, [stats]);

  // Monthly activity
  const monthlyActivity = useMemo(() => {
    const months: { [key: string]: { meetings: number; events: number } } = {};

    sessions.forEach(session => {
      const date = new Date(session.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!months[monthKey]) {
        months[monthKey] = { meetings: 0, events: 0 };
      }

      if (session.type === 'meeting') {
        months[monthKey].meetings++;
      } else {
        months[monthKey].events++;
      }
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('de-CH', {
          month: 'short',
          year: selectedYear === 'all' ? '2-digit' : undefined,
        }),
        meetings: data.meetings,
        events: data.events,
      }));
  }, [sessions, selectedYear]);

  const handleUpdateWeight = () => {
    const weight = parseFloat(eventWeight);
    if (isNaN(weight) || weight < 1 || weight > 10) {
      toast.error('Gewichtung muss zwischen 1 und 10 liegen');
      return;
    }
    updateWeightMutation.mutate({ weight });
  };

  if (!canManageAttendance) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Keine Berechtigung</CardTitle>
            <CardDescription>
              Du hast keine Berechtigung, die Statistiken zu sehen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt Statistiken...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Keine Daten verfügbar</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/attendance">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Statistiken</h1>
              <p className="text-muted-foreground">
                Anwesenheitsanalyse und Trends
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
            Einstellungen
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Select
            value={selectedYear.toString()}
            onValueChange={value =>
              setSelectedYear(value === 'all' ? 'all' : parseInt(value))
            }
          >
            <SelectTrigger className="w-[180px]">
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.meetingCount} Meetings, {stats.eventCount} Events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ø Anwesenheit</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.avgAttendanceRate)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Durchschnitt aller Mitglieder
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Beste Anwesenheit
            </CardTitle>
            <Trophy className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1.5 text-2xl font-bold">
              <span className="min-w-0 truncate">
                {stats.bestMember?.memberName || '-'}
              </span>
              {showBestTie && (
                <TieBadge names={bestMembers.map(m => m.memberName)} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.bestMember
                ? `${Math.round(stats.bestMember.attendanceRate)}%`
                : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Meiste Fehlzeiten
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1.5 text-2xl font-bold">
              <span className="min-w-0 truncate">
                {stats.worstMember?.memberName || '-'}
              </span>
              {showWorstTie && (
                <TieBadge names={worstMembers.map(m => m.memberName)} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.worstMember
                ? `${Math.round(stats.worstMember.attendanceRate)}%`
                : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance Rate Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Anwesenheitsquote pro Mitglied</CardTitle>
            <CardDescription>
              Prozentuale Anwesenheit (Beste zuerst)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={attendanceRateData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: isDarkMode ? '#d1d5db' : '#374151' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fill: isDarkMode ? '#e5e7eb' : '#374151' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    color: isDarkMode ? '#f3f4f6' : '#000000',
                  }}
                  cursor={{
                    fill: isDarkMode
                      ? 'rgba(75, 85, 99, 0.3)'
                      : 'rgba(229, 231, 235, 0.5)',
                  }}
                />
                <Bar
                  dataKey="rate"
                  fill={COLORS.present}
                  name="Anwesenheit %"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weighted Absences Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Gewichtete Fehlzeiten</CardTitle>
            <CardDescription>
              Events zählen {stats.eventWeight}x (Schlechteste zuerst)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={absenceData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                />
                <XAxis
                  type="number"
                  domain={[0, maxWeightedAbsence]}
                  tick={{ fill: isDarkMode ? '#d1d5db' : '#374151' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fill: isDarkMode ? '#e5e7eb' : '#374151' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    color: isDarkMode ? '#f3f4f6' : '#000000',
                  }}
                  cursor={{
                    fill: isDarkMode
                      ? 'rgba(75, 85, 99, 0.3)'
                      : 'rgba(229, 231, 235, 0.5)',
                  }}
                />
                <Bar
                  dataKey="weighted"
                  fill={COLORS.absent}
                  name="Gewichtete Fehlzeiten"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Session Type Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Meetings vs. Events</CardTitle>
            <CardDescription>Verteilung der Session-Typen</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sessionTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={props => {
                    const {
                      cx,
                      cy,
                      midAngle,
                      innerRadius,
                      outerRadius,
                      value,
                    } = props;
                    const RADIAN = Math.PI / 180;
                    // Place the value INSIDE the slice so nothing clips off the
                    // edge on narrow (mobile) viewports; names move to the legend.
                    const radius = (innerRadius + outerRadius) / 2;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#ffffff"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="14"
                        fontWeight="600"
                      >
                        {value}
                      </text>
                    );
                  }}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sessionTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                    borderRadius: '6px',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#f3f4f6' : '#000000',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#f3f4f6' : '#000000',
                  }}
                />
                <Legend
                  wrapperStyle={{ color: isDarkMode ? '#f3f4f6' : '#000000' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Activity Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Aktivität über Zeit</CardTitle>
            <CardDescription>
              Anzahl Meetings und Events pro Monat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={monthlyActivity}
                margin={{ top: 5, right: 12, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: isDarkMode ? '#d1d5db' : '#374151' }}
                />
                <YAxis tick={{ fill: isDarkMode ? '#d1d5db' : '#374151' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    color: isDarkMode ? '#f3f4f6' : '#000000',
                  }}
                  cursor={{
                    fill: isDarkMode
                      ? 'rgba(75, 85, 99, 0.3)'
                      : 'rgba(229, 231, 235, 0.5)',
                  }}
                />
                <Legend
                  wrapperStyle={{ color: isDarkMode ? '#f3f4f6' : '#000000' }}
                />
                <Line
                  type="monotone"
                  dataKey="meetings"
                  stroke={COLORS.meeting}
                  name="Meetings"
                />
                <Line
                  type="monotone"
                  dataKey="events"
                  stroke={COLORS.event}
                  name="Events"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Statistik-Einstellungen</DialogTitle>
            <DialogDescription>Passe die Event-Gewichtung an</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Event-Gewichtung (Multiplikator)</Label>
              <Input
                id="weight"
                type="number"
                min="1"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateWeight();
                  }
                }}
                max="10"
                step="0.1"
                value={eventWeight}
                onChange={e => setEventWeight(e.target.value)}
                className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <p className="text-sm text-muted-foreground">
                Events werden mit diesem Faktor gewichtet (z.B. 2.0 = doppelt so
                wichtig wie Meetings)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdateWeight}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
