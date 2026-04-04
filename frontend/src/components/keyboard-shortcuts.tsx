"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // "/" - focus search
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("input[placeholder*='Search']");
        input?.focus();
      }

      // "g d" - go to discover (simple: just "d")
      if (e.key === "d" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push("/discover");
      }

      // "g h" - go to history
      if (e.key === "h" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push("/history");
      }

      // "g b" - go to bookmarks
      if (e.key === "b" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push("/bookmarks");
      }

      // Escape - close any open panels/modals
      if (e.key === "Escape") {
        // Blur focused element
        (document.activeElement as HTMLElement)?.blur?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
