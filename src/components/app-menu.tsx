import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const menuItems = [
  { label: "BUY ME", to: "/buy-me" as const },
  { label: "Member Login", to: "/login" as const },
  { label: "About / FAQ", to: "/about" as const },
];

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <div className="fixed right-5 top-5 z-40 sm:right-8 sm:top-8">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full text-foreground shadow-none hover:bg-accent"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-navigation"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-6" strokeWidth={1.8} />
        </Button>
      </div>

      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        className={`fixed inset-0 z-40 bg-overlay transition-opacity duration-300 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
      />
      <aside
        id="app-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 w-[min(84vw,22rem)] border-l border-border bg-background px-8 pb-10 pt-20 shadow-xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <Button
          ref={closeButtonRef}
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-10 w-10 rounded-full text-primary"
          aria-label="Close navigation"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        >
          <X className="size-5" />
        </Button>
        <nav aria-label="Main navigation" className="flex flex-col">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className="border-b border-border py-5 text-lg font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}