"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bell, ExternalLink, Check, RefreshCw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/lib/queries";
import { useMarkNotificationRead, useMarkAllNotificationsRead, useScanBookmarks } from "@/lib/mutations";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const bellRef = useRef<HTMLButtonElement>(null);
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const scanBookmarks = useScanBookmarks();

  const unread = data?.unread_count ?? 0;
  const notifications = data?.notifications ?? [];

  useEffect(() => {
    if (open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setPos({
        top: Math.max(8, rect.top - 320), // open above, 320px height
        left: rect.right + 8,             // right of the bell
      });
    }
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />

          {/* Dropdown — positioned via portal */}
          <div
            className="fixed w-80 glass-strong rounded-lg border border-border/30 shadow-2xl z-[60]"
            style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 340) }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <h3 className="text-sm font-medium">Notifications</h3>
              <div className="flex gap-1">
                <Button
                  variant="ghost" size="sm" className="h-6 px-2 text-[10px]"
                  onClick={() => scanBookmarks.mutate()}
                  disabled={scanBookmarks.isPending}
                >
                  {scanBookmarks.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
                {unread > 0 && (
                  <Button
                    variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-primary"
                    onClick={() => markAllRead.mutate()}
                  >
                    <Check className="w-3 h-3 mr-1" />Read all
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="max-h-72">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No notifications yet.
                  <br />
                  <button onClick={() => scanBookmarks.mutate()} className="text-primary underline mt-1">
                    Scan bookmarked repos
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border/10">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 text-xs transition-colors cursor-pointer ${
                        n.read ? "opacity-50" : "hover:bg-accent/30"
                      }`}
                      onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground/80 line-clamp-2">{n.message}</p>
                          {n.issue_title && <p className="text-muted-foreground truncate mt-0.5">{n.issue_title}</p>}
                          <p className="text-muted-foreground/50 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                        {n.issue_url && (
                          <a href={n.issue_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary shrink-0" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
