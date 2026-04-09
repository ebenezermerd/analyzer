"use client";

import { useState } from "react";
import { UserPlus, Check, X, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAccessRequests } from "@/lib/queries";
import { useApproveRequest, useDenyRequest } from "@/lib/mutations";

export default function AccessRequestsPage() {
  const [tab, setTab] = useState("pending");
  const { data, isLoading } = useAdminAccessRequests(tab);
  const approveMutation = useApproveRequest();
  const denyMutation = useDenyRequest();

  const requests = data?.requests || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-3">
          <UserPlus className="w-6 h-6 text-primary" />
          Access Requests
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage access requests
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="glass border border-border/30">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="denied" className="gap-2">
            <XCircle className="w-3.5 h-3.5" />
            Denied
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <Card className="glass border-border/30">
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : requests.length === 0 ? (
            <Card className="glass border-border/30">
              <CardContent className="py-8 text-center text-muted-foreground">
                No {tab} requests
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <Card key={req.id} className="glass border-border/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{req.email}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              req.status === "pending"
                                ? "border-yellow-500/30 text-yellow-400"
                                : req.status === "approved"
                                ? "border-green-500/30 text-green-400"
                                : "border-red-500/30 text-red-400"
                            }`}
                          >
                            {req.status}
                          </Badge>
                        </div>
                        {req.name && (
                          <p className="text-xs text-muted-foreground mt-1">{req.name}</p>
                        )}
                        {req.reason && (
                          <p className="text-xs text-muted-foreground mt-2 bg-accent/30 rounded-md p-2">
                            {req.reason}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-2">
                          Requested {new Date(req.created_at).toLocaleDateString()}
                          {req.reviewed_at && ` — Reviewed ${new Date(req.reviewed_at).toLocaleDateString()}`}
                        </p>
                      </div>

                      {req.status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(req.id)}
                            disabled={approveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white h-8"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => denyMutation.mutate(req.id)}
                            disabled={denyMutation.isPending}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Deny
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
