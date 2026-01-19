import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Shield, UserCheck, Eye, Clock } from "lucide-react";

type UserRole = "admin" | "maintainer" | "editor" | "user" | "visitor";

const roleConfig: Record<UserRole, { label: string; color: string; icon: React.ReactNode }> = {
  admin: { label: "Admin", color: "bg-red-500", icon: <Shield className="h-3 w-3" /> },
  maintainer: { label: "Maintainer", color: "bg-orange-500", icon: <UserCheck className="h-3 w-3" /> },
  editor: { label: "Editor", color: "bg-blue-500", icon: <UserCheck className="h-3 w-3" /> },
  user: { label: "Member", color: "bg-green-500", icon: <UserCheck className="h-3 w-3" /> },
  visitor: { label: "Visitor", color: "bg-gray-500", icon: <Eye className="h-3 w-3" /> },
};

export default function UserManagement() {
  const { data: users, isLoading, refetch } = trpc.admin.getAllUsers.useQuery();
  const promoteUserMutation = trpc.admin.promoteUser.useMutation({
    onSuccess: () => {
      toast.success("Benutzerrolle erfolgreich aktualisiert");
      refetch();
    },
    onError: (error) => {
      toast.error("Fehler beim Aktualisieren der Rolle: " + error.message);
    },
  });

  const [changingRole, setChangingRole] = useState<number | null>(null);

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    setChangingRole(userId);
    await promoteUserMutation.mutateAsync({ userId, role: newRole });
    setChangingRole(null);
  };

  const visitors = users?.filter(u => u.role === "visitor") || [];
  const members = users?.filter(u => u.role !== "visitor") || [];

  if (isLoading) {
    return (
      <div className="container py-12">
        <div className="text-center">Lade Benutzer...</div>
      </div>
    );
  }

  return (
    <div className="container py-12 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          Benutzerverwaltung
        </h1>
        <p className="text-muted-foreground">
          Verwalte Benutzerrollen und Zugriffsrechte
        </p>
      </div>

      {/* Pending Visitors */}
      {visitors.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Wartende Besucher ({visitors.length})
            </CardTitle>
            <CardDescription>
              Diese Benutzer haben sich angemeldet und warten auf Freischaltung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {visitors.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    {user.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt={user.name || "User"}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                        {(user.name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{user.name || "Unbekannt"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Registriert: {new Date(user.createdAt).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                      disabled={changingRole === user.id}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Zu Member</SelectItem>
                        <SelectItem value="editor">Zu Editor</SelectItem>
                        <SelectItem value="maintainer">Zu Maintainer</SelectItem>
                        <SelectItem value="admin">Zu Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Members */}
      <Card>
        <CardHeader>
          <CardTitle>Alle Benutzer ({members.length})</CardTitle>
          <CardDescription>
            Übersicht aller registrierten Benutzer mit ihren Rollen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4">
                  {user.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt={user.name || "User"}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                      {(user.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.name || "Unbekannt"}</p>
                      <Badge className={`${roleConfig[user.role as UserRole].color} text-white`}>
                        <span className="mr-1">{roleConfig[user.role as UserRole].icon}</span>
                        {roleConfig[user.role as UserRole].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Letzter Login: {new Date(user.lastSignedIn).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={user.role}
                    onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                    disabled={changingRole === user.id}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visitor">Visitor</SelectItem>
                      <SelectItem value="user">Member</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="maintainer">Maintainer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
