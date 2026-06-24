"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Input } from "@openschedule/ui/components/input";
import { Label } from "@openschedule/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";
import { Spinner } from "@openschedule/ui/components/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openschedule/ui/components/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openschedule/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    name: string;
    email: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

export function TeamSection() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const setActiveMutation = useMutation(convexApi.mutations.users.setActive);
  const toggleTherapistMutation = useMutation(convexApi.mutations.users.toggleTherapistRole);
  const currentUser = useQuery(convexApi.queries.users.getSelf);
  const isOwner = currentUser?.roles?.includes("owner") ?? false;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        authClient.organization.listMembers(),
        authClient.organization.listInvitations(),
      ]);
      if (membersRes.data) {
        const raw = membersRes.data;
        const memberList = Array.isArray(raw) ? raw : (raw as any).members ?? [];
        setMembers(memberList as Member[]);
      }
      if (invitationsRes.data) {
        const raw = invitationsRes.data;
        const invList = Array.isArray(raw) ? raw : (raw as any).invitations ?? [];
        setInvitations(
          (invList as Invitation[]).filter((i) => i.status === "pending"),
        );
      }
    } catch (err) {
      console.error("Failed to load team data:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsInviting(true);
    try {
      const result = await authClient.organization.inviteMember({
        email: inviteEmail,
        role: "member",
      });
      if (result.error) {
        setError(result.error.message ?? "Failed to send invitation");
      } else {
        setInviteEmail("");
        await loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await authClient.organization.removeMember({ memberIdOrEmail: memberId });
      await loadData();
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      await authClient.organization.cancelInvitation({ invitationId });
      await loadData();
    } catch (err) {
      console.error("Failed to cancel invitation:", err);
    }
  }

  async function handleResendInvitation(invitationId: string) {
    try {
      const invitation = invitations.find((i) => i.id === invitationId);
      if (!invitation) return;
      await authClient.organization.inviteMember({
        email: invitation.email,
        role: "member",
        resend: true,
      });
    } catch (err) {
      console.error("Failed to resend invitation:", err);
    }
  }

  async function handleToggleActive(userId: string, currentlyActive: boolean) {
    try {
      await setActiveMutation({ userId: userId as any, active: !currentlyActive });
      await loadData();
    } catch (err) {
      console.error("Failed to toggle active status:", err);
    }
  }

  async function handleToggleOwnTherapist() {
    try {
      await toggleTherapistMutation({});
    } catch (err) {
      console.error("Failed to toggle therapist role:", err);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent>
          <Spinner size="sm" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Members */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Members</h4>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{member.user.name}</p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {member.role === "owner" ? "Owner" : "Therapist"}
                    </Badge>
                    {member.role === "owner" && isOwner && member.user.email === currentUser?.email && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleToggleOwnTherapist}>
                            {currentUser?.roles?.includes("therapist") ? "Remove Therapist Role" : "Add Therapist Role"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {member.role !== "owner" && isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(member.userId, true)}
                          >
                            Deactivate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setRemovingMember(member)}
                          >
                            Remove from team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Pending Invitations</h4>
            <ul className="space-y-2">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {new Date(invitation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResendInvitation(invitation.id)}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleCancelInvitation(invitation.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Invite Form */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Invite Therapist</h4>
          <form onSubmit={handleInvite} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-email" className="sr-only">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="therapist@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={isInviting}>
              {isInviting ? "Inviting..." : "Invite as Therapist"}
            </Button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>


      </CardContent>
    </Card>

    {/* Remove member confirmation dialog */}
    <AlertDialog open={removingMember !== null} onOpenChange={() => setRemovingMember(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove team member?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove {removingMember?.user.name} from the organization. Their active schedules will be deactivated and future bookings cancelled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            if (removingMember) {
              handleRemoveMember(removingMember.id);
            }
            setRemovingMember(null);
          }}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
