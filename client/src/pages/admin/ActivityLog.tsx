import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Shield,
  ArrowLeft,
  Activity,
  LogIn,
  UserCog,
  Settings,
  Clock,
  User,
  Filter,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MotionDiv = motion.div;

type ActionType =
  | 'all'
  | 'login'
  | 'registration'
  | 'role_change'
  | 'admin_action';

export default function ActivityLog() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [actionFilter, setActionFilter] = useState<ActionType>('all');
  const [limit, setLimit] = useState(100);

  const { data: activityLogs = [], isLoading } = trpc.activityLog.list.useQuery(
    { limit },
    { enabled: isAuthenticated && user?.role === 'admin' },
  );

  // Redirect if not admin
  if (!loading && (!isAuthenticated || user?.role !== 'admin')) {
    setLocation('/');
    return null;
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <LogIn className="h-4 w-4" />;
      case 'registration':
        return <User className="h-4 w-4" />;
      case 'role_change':
        return <UserCog className="h-4 w-4" />;
      case 'admin_action':
        return <Settings className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'login':
        return (
          <Badge variant="secondary" className="gap-1">
            {getActionIcon(action)} Login
          </Badge>
        );
      case 'registration':
        return (
          <Badge className="bg-green-500 hover:bg-green-600 gap-1">
            {getActionIcon(action)} Registrierung
          </Badge>
        );
      case 'role_change':
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 gap-1">
            {getActionIcon(action)} Rollenänderung
          </Badge>
        );
      case 'admin_action':
        return (
          <Badge variant="destructive" className="gap-1">
            {getActionIcon(action)} Admin-Aktion
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            {getActionIcon(action)} {action}
          </Badge>
        );
    }
  };

  const filteredLogs =
    actionFilter === 'all'
      ? activityLogs
      : activityLogs.filter(log => log.action === actionFilter);

  return (
    <div className="container py-8 max-w-7xl">
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/admin')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Activity className="h-8 w-8 text-primary" />
                Activity Log
              </h1>
              <p className="text-muted-foreground mt-1">
                Übersicht aller Benutzeraktivitäten und Admin-Aktionen
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-2">
            <Shield className="h-4 w-4" />
            Admin
          </Badge>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Aktionstyp
              </label>
              <Select
                value={actionFilter}
                onValueChange={value => setActionFilter(value as ActionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Aktionen</SelectItem>
                  <SelectItem value="login">Logins</SelectItem>
                  <SelectItem value="registration">Registrierungen</SelectItem>
                  <SelectItem value="role_change">Rollenänderungen</SelectItem>
                  <SelectItem value="admin_action">Admin-Aktionen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">
                Anzahl Einträge
              </label>
              <Select
                value={limit.toString()}
                onValueChange={value => setLimit(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 Einträge</SelectItem>
                  <SelectItem value="100">100 Einträge</SelectItem>
                  <SelectItem value="200">200 Einträge</SelectItem>
                  <SelectItem value="500">500 Einträge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Activity Log Table */}
        <Card>
          <CardHeader>
            <CardTitle>Aktivitäten ({filteredLogs.length})</CardTitle>
            <CardDescription>
              Chronologische Auflistung aller Benutzeraktivitäten
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Keine Aktivitäten gefunden
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Zeitpunkt</TableHead>
                      <TableHead>Benutzer</TableHead>
                      <TableHead>Aktion</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {new Date(log.timestamp).toLocaleString('de-DE', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {log.userName || 'Unbekannt'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="max-w-md">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {log.details || '-'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </MotionDiv>
    </div>
  );
}
