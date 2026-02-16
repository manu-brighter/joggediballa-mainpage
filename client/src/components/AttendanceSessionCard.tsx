import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ClipboardList, Pencil, Trash2, Eye, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const MotionCard = motion(Card);

interface Session {
  id: number;
  date: Date;
  title: string;
  type: "meeting" | "event";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Member {
  id: number;
  name: string;
  isActive: boolean;
  displayOrder: number;
}

interface AttendanceSessionCardProps {
  session: Session;
  members: Member[];
  onOpenAttendance: (session: Session) => void;
  onViewSession: (session: Session) => void;
  onEditSession: (session: Session) => void;
  onDeleteSession: (session: Session) => void;
}

export function AttendanceSessionCard({
  session,
  members,
  onOpenAttendance,
  onViewSession,
  onEditSession,
  onDeleteSession,
}: AttendanceSessionCardProps) {
  // Load attendance records for this session
  const { data: records = [] } = trpc.attendance.listRecords.useQuery({
    sessionId: session.id,
  });

  // Calculate attendance stats
  const presentCount = records.filter((r) => r.status === "present").length;
  const partialCount = records.filter((r) => r.status === "partial").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const totalMembers = members.length;
  const recordedCount = records.length;

  return (
    <MotionCard
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="hover:shadow-lg transition-shadow"
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{session.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3" />
              {new Date(session.date).toLocaleDateString("de-CH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </CardDescription>
          </div>
          <Badge
            variant={session.type === "event" ? "default" : "secondary"}
            className={cn(
              session.type === "event" && "bg-teal-500 hover:bg-teal-600"
            )}
          >
            {session.type === "event" ? "Event" : "Meeting"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Attendance Preview */}
        {recordedCount > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Anwesenheit ({recordedCount}/{totalMembers})</span>
            </div>
            <div className="flex gap-2">
              {presentCount > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium">{presentCount}</span>
                </div>
              )}
              {partialCount > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">{partialCount}</span>
                </div>
              )}
              {absentCount > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium">{absentCount}</span>
                </div>
              )}
            </div>
            {/* Member Names Preview */}
            <div className="flex flex-wrap gap-1 mt-2">
              {records.slice(0, 5).map((record) => {
                const member = members.find((m) => m.id === record.memberId);
                if (!member) return null;
                return (
                  <Badge
                    key={record.id}
                    variant="outline"
                    className={cn(
                      "text-xs",
                      record.status === "present" && "border-green-500 text-green-700 dark:text-green-400",
                      record.status === "partial" && "border-orange-500 text-orange-700 dark:text-orange-400",
                      record.status === "absent" && "border-red-500 text-red-700 dark:text-red-400"
                    )}
                  >
                    {member.name}
                  </Badge>
                );
              })}
              {records.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{records.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="flex-1 gap-1"
            onClick={() => onOpenAttendance(session)}
          >
            <ClipboardList className="h-4 w-4" />
            Anwesenheit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewSession(session)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEditSession(session)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDeleteSession(session)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </MotionCard>
  );
}
