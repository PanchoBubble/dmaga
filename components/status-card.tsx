import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "green" | "blue" | "red";
};

export function StatusCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "green",
}: StatusCardProps) {
  return (
    <section
      className={cn(
        "border-2 border-foreground bg-card p-4 shadow-line",
        tone === "blue" && "bg-sky-100",
        tone === "green" && "bg-emerald-100",
        tone === "red" && "bg-red-100",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        <Icon className="size-8" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
    </section>
  );
}
