"use client";

import { BarChart3, Users, Activity, Search, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAdminAnalytics } from "@/lib/queries";

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useAdminAnalytics();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          Platform Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const stats = [
    { label: "Total Users", value: data.total_users, icon: Users },
    { label: "Active Users", value: data.active_users, icon: Users },
    { label: "Total Scans", value: data.total_scans, icon: Search },
    { label: "Issues Found", value: data.total_issues_found, icon: FileText },
    { label: "Pending Requests", value: data.pending_requests, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          Platform Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform-wide statistics and activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="glass border-border/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Activity Chart */}
      {data.daily_activity.length > 0 && (
        <Card className="glass border-border/30">
          <CardContent className="p-6">
            <h3 className="text-sm font-medium mb-4">Daily Activity (Last 30 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily_activity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="scans" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Bar dataKey="issues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Users */}
      {data.top_users.length > 0 && (
        <Card className="glass border-border/30">
          <CardContent className="p-6">
            <h3 className="text-sm font-medium mb-4">Top Users by Activity</h3>
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Scans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_users.map((u, i) => (
                  <TableRow key={u.email} className="border-border/20">
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs tabular-nums w-6 justify-center">
                          {i + 1}
                        </Badge>
                        {u.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{u.scan_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
