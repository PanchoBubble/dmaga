import { Download, Search, Settings } from "lucide-react";

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
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
] as const;
