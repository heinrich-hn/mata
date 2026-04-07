import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const NAV_ITEMS = [
  { to: "/alerts", label: "Go to Alerts", shortcut: "1" },
  { to: "/trip-alerts", label: "Go to Trip Alerts", shortcut: "2" },
  { to: "/faults", label: "Go to Faults", shortcut: "3" },
  { to: "/documents", label: "Go to Documents", shortcut: "4" },
  { to: "/diesel-alerts", label: "Go to Diesel Alerts", shortcut: "5" },
  { to: "/config", label: "Go to Alert Rules", shortcut: "6" },
];

export default function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-[600px] overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <Command className="border-0 shadow-dialog">
          <CommandInput
            placeholder="Type a command or search..."
            className="border-b border-slate-200 text-slate-900 placeholder:text-slate-400"
          />
          <CommandList className="max-h-[400px] p-2">
            <CommandEmpty className="py-6 text-sm text-slate-500">
              No results found.
            </CommandEmpty>

            <CommandGroup heading="Navigation" className="text-slate-500 text-xs font-medium uppercase tracking-wider">
              {NAV_ITEMS.map((item) => (
                <CommandItem
                  key={item.to}
                  value={item.label}
                  onSelect={() => handleSelect(() => navigate(item.to))}
                  className="cursor-pointer text-slate-700 hover:bg-slate-50 data-[selected=true]:bg-slate-50"
                >
                  <span>{item.label}</span>
                  <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
                    <span className="text-xs">⌘</span>
                    {item.shortcut}
                  </kbd>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator className="my-2 bg-slate-200" />

            <CommandGroup heading="Actions" className="text-slate-500 text-xs font-medium uppercase tracking-wider">
              <CommandItem
                value="Refresh data"
                onSelect={() => handleSelect(() => window.location.reload())}
                className="cursor-pointer text-slate-700 hover:bg-slate-50 data-[selected=true]:bg-slate-50"
              >
                <span>Refresh Data</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
                  <span className="text-xs">⌘</span>
                  R
                </kbd>
              </CommandItem>

              {mounted && (
                <CommandItem
                  value={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  onSelect={() => handleSelect(toggleTheme)}
                  className="cursor-pointer text-slate-700 hover:bg-slate-50 data-[selected=true]:bg-slate-50"
                >
                  <span>{theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
                  <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
                    <span className="text-xs">⌘</span>
                    D
                  </kbd>
                </CommandItem>
              )}
            </CommandGroup>

            <CommandSeparator className="my-2 bg-slate-200" />

            <CommandGroup heading="Search" className="text-slate-500 text-xs font-medium uppercase tracking-wider">
              <CommandItem
                value="Search alerts"
                onSelect={() => handleSelect(() => navigate("/alerts"))}
                className="cursor-pointer text-slate-700 hover:bg-slate-50 data-[selected=true]:bg-slate-50"
              >
                <span>Search Alerts</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
                  /
                </kbd>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// Keyboard shortcut hint component
export function CommandPaletteHint() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
      >
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandPalette open={open} setOpen={setOpen} />
    </>
  );
}