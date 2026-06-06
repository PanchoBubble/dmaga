import { Download, Search, Settings, Star } from "lucide-react";

export const navigationItems = [
  {
    href: "/",
    label: "Search",
    icon: Search,
  },
  {
    href: "/added",
    label: "Added",
    icon: Download,
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
