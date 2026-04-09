"use client";

import { useState } from "react";
import { Users, UserPlus, Search, MoreHorizontal, Shield, ShieldOff, UserX, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers } from "@/lib/queries";
import { useInviteUser, useUpdateUser } from "@/lib/mutations";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminUsers({ search: search || undefined, page });
  const inviteMutation = useInviteUser();
  const updateMutation = useUpdateUser();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate(inviteEmail, {
      onSuccess: () => {
        setInviteEmail("");
        setInviteOpen(false);
      },
    });
  }

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} total user{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-sm font-medium">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/30">
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <Input
                placeholder="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="glass"
                required
              />
              {inviteMutation.isError && (
                <p className="text-xs text-red-400">{(inviteMutation.error as Error).message}</p>
              )}
              <Button
                type="submit"
                disabled={inviteMutation.isPending}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Send Invitation
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users by email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="glass pl-10"
        />
      </div>

      <Card className="glass border-border/30">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30">
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="border-border/20">
                    <TableCell className="font-medium text-sm">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${user.is_active ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-strong border-border/30">
                          {user.is_active ? (
                            <DropdownMenuItem
                              onClick={() => updateMutation.mutate({ id: user.id, is_active: false })}
                              className="text-yellow-400"
                            >
                              <UserX className="w-4 h-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => updateMutation.mutate({ id: user.id, is_active: true })}
                              className="text-green-400"
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          {user.role === "user" ? (
                            <DropdownMenuItem
                              onClick={() => updateMutation.mutate({ id: user.id, role: "admin" })}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              Promote to Admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => updateMutation.mutate({ id: user.id, role: "user" })}
                            >
                              <ShieldOff className="w-4 h-4 mr-2" />
                              Demote to User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="glass border-border/30"
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="glass border-border/30"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
