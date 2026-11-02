import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSpinner({ className, label = "Loading…" }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground", className)}>
      <Loader2 className="size-5 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  );
}

export function ButtonSpinner() {
  return <Loader2 className="size-4 animate-spin" />;
}
