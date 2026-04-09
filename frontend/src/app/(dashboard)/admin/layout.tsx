"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = useStore((s) => s.role);
  const router = useRouter();

  useEffect(() => {
    if (role !== "admin") {
      toast.error("Admin access required");
      router.push("/discover");
    }
  }, [role, router]);

  if (role !== "admin") return null;

  return <>{children}</>;
}
