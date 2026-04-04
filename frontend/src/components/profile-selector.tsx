"use client";

import { Languages, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { useProfiles } from "@/lib/queries";

const langShortcuts: Record<string, string> = {
  Python: "py", JavaScript: "js", TypeScript: "ts",
};
const availableLangs = ["Python", "JavaScript", "TypeScript"];

export function ProfileSelector() {
  const { activeProfile, setActiveProfile, language, setLanguage } = useStore();
  const { data } = useProfiles();
  const profiles = data?.profiles ?? [];
  const langProfiles = profiles.filter((p) => p.language === language || p.language === "");

  return (
    <div className="space-y-2 px-4">
      {/* Language */}
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
          <Languages className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">{language}</span>
          <Badge variant="secondary" className="text-[9px] px-1 py-0">{langShortcuts[language] || language}</Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 glass">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">Language</DropdownMenuLabel>
            {availableLangs.map((lang) => (
              <DropdownMenuItem key={lang} onClick={() => setLanguage(lang)} className={language === lang ? "bg-primary/10 text-primary" : ""}>
                {lang}
                <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0">{langShortcuts[lang]}</Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="flex-1 text-left truncate">{activeProfile}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 glass">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">Scoring Profile</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(langProfiles.length > 0 ? langProfiles : profiles).map((p) => (
              <DropdownMenuItem key={p.name} onClick={() => setActiveProfile(p.name)} className={activeProfile === p.name ? "bg-primary/10 text-primary" : ""}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{p.name}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">min {p.min_score}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{p.description}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
