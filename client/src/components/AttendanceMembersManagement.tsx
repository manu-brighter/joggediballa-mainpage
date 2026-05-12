import { useState } from 'react';
import { trpc } from '@/lib/trpc';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/lib/errorMessages';
import { Pencil, Trash2, ChevronUp, ChevronDown, UserPlus } from 'lucide-react';

interface Member {
  id: number;
  name: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AttendanceMembersManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  onCreateMember?: () => void;
}

export function AttendanceMembersManagement({
  open,
  onOpenChange,
  members,
  onCreateMember,
}: AttendanceMembersManagementProps) {
  const utils = trpc.useUtils();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({ name: '', isActive: true });

  // Sort members by displayOrder
  const sortedMembers = [...members].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  // Mutations
  const updateMemberMutation = trpc.attendance.updateMember.useMutation({
    onSuccess: () => {
      utils.attendance.listMembers.invalidate();
      toast.success('Mitglied aktualisiert');
      setEditDialogOpen(false);
      setSelectedMember(null);
    },
    onError: error => {
      toast.error(parseErrorMessage(error.message));
    },
  });

  const deleteMemberMutation = trpc.attendance.deleteMember.useMutation({
    onSuccess: () => {
      utils.attendance.listMembers.invalidate();
      toast.success('Mitglied gelöscht');
      setDeleteDialogOpen(false);
      setSelectedMember(null);
    },
    onError: error => {
      toast.error(parseErrorMessage(error.message));
    },
  });

  const reorderMembersMutation = trpc.attendance.reorderMembers.useMutation({
    onSuccess: () => {
      utils.attendance.listMembers.invalidate();
      toast.success('Reihenfolge aktualisiert');
    },
    onError: error => {
      toast.error(parseErrorMessage(error.message));
    },
  });

  const handleEditClick = (member: Member) => {
    setSelectedMember(member);
    setEditForm({ name: member.name, isActive: member.isActive });
    setEditDialogOpen(true);
  };

  const handleUpdateMember = () => {
    if (!selectedMember) return;
    updateMemberMutation.mutate({
      memberId: selectedMember.id,
      name: editForm.name,
      isActive: editForm.isActive,
    });
  };

  const handleDeleteClick = (member: Member) => {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteMember = () => {
    if (!selectedMember) return;
    deleteMemberMutation.mutate({ memberId: selectedMember.id });
  };

  const handleMoveUp = (member: Member, index: number) => {
    if (index === 0) return;
    const newOrder = [...sortedMembers];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    reorderMembersMutation.mutate({
      memberIds: newOrder.map(m => m.id),
    });
  };

  const handleMoveDown = (member: Member, index: number) => {
    if (index === sortedMembers.length - 1) return;
    const newOrder = [...sortedMembers];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    reorderMembersMutation.mutate({
      memberIds: newOrder.map(m => m.id),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[100vw] sm:w-[80vw] lg:min-w-[800px] max-w-[1600px] max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
          <DialogHeader>
            <DialogTitle>Mitglieder verwalten</DialogTitle>
            <DialogDescription>
              Bearbeite Mitglieder, ändere die Reihenfolge oder lösche sie
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {sortedMembers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Keine Mitglieder vorhanden
              </p>
            ) : (
              sortedMembers.map((member, index) => (
                <Card
                  key={member.id}
                  className="border-0 shadow-none bg-muted/30"
                >
                  <CardContent className="px-3 py-0">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={() => handleMoveUp(member, index)}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={() => handleMoveDown(member, index)}
                          disabled={index === sortedMembers.length - 1}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name}</span>
                          {!member.isActive && (
                            <Badge variant="secondary">Inaktiv</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => handleEditClick(member)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => handleDeleteClick(member)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Schliessen
            </Button>
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => {
                onOpenChange(false);
                if (onCreateMember) {
                  onCreateMember();
                }
              }}
            >
              <UserPlus className="h-4 w-4" />
              Neues Mitglied
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitglied bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editName"
                value={editForm.name}
                onChange={e =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateMember();
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="editActive">Aktiv</Label>
              <Switch
                id="editActive"
                checked={editForm.isActive}
                onCheckedChange={checked =>
                  setEditForm({ ...editForm, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedMember(null);
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleUpdateMember}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du "{selectedMember?.name}" löschen möchtest?
              Alle Anwesenheitseinträge dieses Mitglieds werden ebenfalls
              gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedMember(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
