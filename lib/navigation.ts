import { Search, Settings, Star, Upload } from "lucide-react";

export const navigationItems = [
  {
    href: "/",
    label: "Search",
    icon: Search,
  },
  {
    href: "/added",
    label: "RD",
    icon: Upload,
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
