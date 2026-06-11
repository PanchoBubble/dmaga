import { Clapperboard, ListChecks, Search, Settings, Star } from "lucide-react";

export const navigationItems = [
  {
    href: "/",
    label: "Discover",
    icon: Clapperboard,
  },
  {
    href: "/search",
    label: "Search",
    icon: Search,
  },
  {
    href: "/added",
    label: "Tracked",
    icon: ListChecks,
  },
  {
    href: "/saved",
    label: "Saved",
    icon: Star,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
] as const;
