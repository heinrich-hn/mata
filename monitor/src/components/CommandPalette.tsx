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
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import {
  BarChart3,
  Bell,
  FileText,
  Fuel,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Truck,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const NAV_ITEMS = [
  { to: "/alerts", icon: Bell, label: "Go to Alerts", shortcut: "1" },
  { to: "/trip-alerts", icon: Truck, label: "Go to Trip Alerts", shortcut: "2" },
  { to: "/faults", icon: Wrench, label: "Go to Faults", shortcut: "3" },
  { to: "/documents", icon: FileText, label: "Go to Documents", shortcut: "4" },
  { to: "/diesel-alerts", icon: Fuel, label: "Go to Diesel Alerts", shortcut: "5" },
  { to: "/analytics", icon: BarChart3, label: "Go to Analytics", shortcut: "6" },
  { to: "/config", icon: Settings, label: "Go to Alert Rules", shortcut: "7" },
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
      <DialogContent className="p-0 gap-0 max-w-[600px] overflow-hidden">
        <Command className="border-0 shadow-dialog">
          <CommandInput
            placeholder="Search commands, navigate..."
            className="border-b border-border"
          />
          <CommandList className="max-h-[400px] p-2">
            <CommandEmpty className="py-6 text-sm text-muted-foreground">
              No results found.
            </CommandEmpty>

            <CommandGroup heading="Navigation">
              {NAV_ITEMS.map((item) => (
                <CommandItem
                  key={item.to}
                  value={item.label}
                  onSelect={() => handleSelect(() => navigate(item.to))}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">⌘</span>
                    {item.shortcut}
                  </kbd>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator className="my-2" />

            <CommandGroup heading="Actions">
              <CommandItem
                value="Refresh data"
                onSelect={() => handleSelect(() => window.location.reload())}
                className="cursor-pointer"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                <span>Refresh Data</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>
                  R
                </kbd>
              </CommandItem>

              {mounted && (
                <CommandItem
                  value={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  onSelect={() => handleSelect(toggleTheme)}
                  className="cursor-pointer"
                >
                  {theme === "dark" ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  <span>{theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
                  <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">⌘</span>
                    D
                  </kbd>
                </CommandItem>
              )}
            </CommandGroup>

            <CommandSeparator className="my-2" />

            <CommandGroup heading="Search">
              <CommandItem
                value="Search alerts"
                onSelect={() => handleSelect(() => navigate("/alerts"))}
                className="cursor-pointer"
              >
                <Search className="mr-2 h-4 w-4" />
                <span>Search Alerts</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
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
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 hover:bg-muted border border-border rounded-md transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandPalette open={open} setOpen={setOpen} />
    </>
  );
}
