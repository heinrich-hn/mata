import { useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isWithinInterval, parseISO, startOfDay } from "date-fns";
import {
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  FileSpreadsheet,
  Link2,
  Loader2,
  MapPin,
  Plus,
  Truck,
  UserPlus,
  X,
} from "lucide-react";

// Components
import { CreateClientDialog } from "@/components/trips/CreateClientDialog";
import { DeliveryConfirmationDialog } from "@/components/trips/DeliveryConfirmationDialog";
import { EditThirdPartyLoadDialog } from "@/components/trips/EditThirdPartyLoadDialog";
import { LoadsTable } from "@/components/trips/LoadsTable";
import { QuickFilters } from "@/components/trips/QuickFilters";
import { AddLocationDialog } from "@/components/tracking/AddLocationDialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Hooks & Utilities
import { useClients } from "@/hooks/useClients";
import { useCustomLocations, type CustomLocation } from "@/hooks/useCustomLocations";
import { useDrivers } from "@/hooks/useDrivers";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import {
  generateLoadId,
  useCreateLoad,
  useLoads,
  type Load,
} from "@/hooks/useTrips";
import { DEPOTS } from "@/lib/depots";
import {
  exportLoadsToExcel,
  exportLoadsToExcelSimplified,
} from "@/lib/exportTripsToExcel";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface WeekFilter {
  start: Date | null;
  end: Date | null;
}

interface LocationItem {
  id: string;
  name: string;
  type: string;
  isCustom?: boolean;
}

interface DialogState {
  create: boolean;
  edit: boolean;
  delivery: boolean;
  createClient: boolean;
  addLocation: boolean;
}

type FilterState = {
  search: string;
  status: string;
  origin: string;
};

// ============================================================================
// Constants
// ============================================================================

const INITIAL_FILTERS: FilterState = {
  search: "",
  status: "all",
  origin: "all",
};

const INITIAL_DIALOGS: DialogState = {
  create: false,
  edit: false,
  delivery: false,
  createClient: false,
  addLocation: false,
};

const formSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  linkedLoadId: z.string().optional(),
  loadingDate: z.date({ required_error: "Loading date is required" }),
  offloadingDate: z.date({ required_error: "Offloading date is required" }),
  customerId: z.string().min(1, "Customer is required"),
  loadingPlaceName: z.string().min(1, "Loading place name is required"),
  loadingAddress: z.string().optional(),
  offloadingPlaceName: z.string().min(1, "Offloading place name is required"),
  offloadingAddress: z.string().optional(),
  loadingPlannedArrival: z.string().min(1, "Planned arrival time is required"),
  loadingPlannedDeparture: z.string().min(1, "Planned departure time is required"),
  offloadingPlannedArrival: z.string().min(1, "Planned arrival time is required"),
  offloadingPlannedDeparture: z.string().min(1, "Planned departure time is required"),
  cargoDescription: z.string().min(1, "Cargo description is required"),
  fleetVehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().optional(),
  notes: z.string(),
});

type FormData = z.infer<typeof formSchema>;

const DEFAULT_FORM_VALUES = {
  priority: "medium" as const,
  linkedLoadId: "",
  customerId: "",
  loadingPlaceName: "",
  loadingAddress: "",
  offloadingPlaceName: "",
  offloadingAddress: "",
  loadingPlannedArrival: "08:00",
  loadingPlannedDeparture: "10:00",
  offloadingPlannedArrival: "14:00",
  offloadingPlannedDeparture: "16:00",
  cargoDescription: "",
  fleetVehicleId: "",
  driverId: "",
  notes: "",
};

// ============================================================================
// Helper Functions
// ============================================================================

const isThirdPartyLoad = (loadId: string): boolean => loadId.startsWith("TP-");
const isNotThirdPartyLoad = (loadId: string): boolean => !isThirdPartyLoad(loadId);

const matchesSearchQuery = (load: Load, query: string): boolean => {
  if (!query) return true;

  const searchLower = query.toLowerCase();
  return (
    load.load_id.toLowerCase().includes(searchLower) ||
    load.driver?.name?.toLowerCase().includes(searchLower) ||
    load.origin.toLowerCase().includes(searchLower)
  );
};

const matchesWeekFilter = (load: Load, weekFilter: WeekFilter): boolean => {
  if (!weekFilter.start || !weekFilter.end) return true;

  try {
    const loadDate = startOfDay(parseISO(load.loading_date));
    return isWithinInterval(loadDate, {
      start: startOfDay(weekFilter.start),
      end: weekFilter.end,
    });
  } catch {
    return false;
  }
};

// ============================================================================
// Custom Hooks
// ============================================================================

const useFilteredThirdPartyLoads = (
  loads: Load[],
  filters: FilterState,
  weekFilter: WeekFilter
) => {
  const thirdPartyLoads = useMemo(
    () => loads.filter(load => isThirdPartyLoad(load.load_id)),
    [loads]
  );

  return useMemo(() => {
    return thirdPartyLoads.filter((load) => {
      const searchMatch = matchesSearchQuery(load, filters.search);
      const statusMatch = filters.status === "all" || load.status === filters.status;
      const originMatch = filters.origin === "all" || load.origin === filters.origin;
      const weekMatch = matchesWeekFilter(load, weekFilter);

      return searchMatch && statusMatch && originMatch && weekMatch;
    });
  }, [thirdPartyLoads, filters, weekFilter]);
};

// ============================================================================
// Sub-Components
// ============================================================================

interface DepotComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  customLocations?: CustomLocation[];
}

const DepotCombobox: React.FC<DepotComboboxProps> = ({
  value,
  onChange,
  placeholder = "Select a depot...",
  customLocations = []
}) => {
  const [open, setOpen] = useState(false);

  const { locationsByCountry, allLocations } = useMemo(() => {
    const map: Record<string, LocationItem[]> = {};

    // Add static DEPOTS
    DEPOTS.forEach((depot) => {
      const key = depot.country;
      if (!map[key]) map[key] = [];
      map[key].push({ id: depot.id, name: depot.name, type: depot.type });
    });

    // Add custom locations
    customLocations.forEach((loc) => {
      const key = loc.country ?? "Other";
      if (!map[key]) map[key] = [];
      map[key].push({
        id: loc.id,
        name: loc.name,
        type: loc.type ?? "",
        isCustom: true
      });
    });

    const all: LocationItem[] = [
      ...DEPOTS.map(d => ({ id: d.id, name: d.name, type: d.type })),
      ...customLocations.map(loc => ({
        id: loc.id,
        name: loc.name,
        type: loc.type ?? "",
        isCustom: true
      })),
    ];

    return { locationsByCountry: map, allLocations: all };
  }, [customLocations]);

  const selectedLocation = allLocations.find((loc) => loc.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {(selectedLocation?.name ?? value) || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 max-w-[--radix-popover-trigger-width]">
        <Command>
          <CommandInput placeholder="Search locations..." />
          <CommandList>
            <CommandEmpty>No location found.</CommandEmpty>
            {Object.keys(locationsByCountry)
              .sort()
              .map((country) => (
                <CommandGroup key={country} heading={country}>
                  {locationsByCountry[country]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((loc) => (
                      <CommandItem
                        key={loc.id}
                        value={loc.name}
                        onSelect={() => {
                          onChange(loc.name);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === loc.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {loc.name}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {loc.isCustom ? `★ ${loc.type}` : loc.type}
                        </span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface LinkedLoadSectionProps {
  form: ReturnType<typeof useForm<FormData>>;
  linkableLoads: Load[];
}

const LinkedLoadSection: React.FC<LinkedLoadSectionProps> = ({ form, linkableLoads }) => {
  const linkedLoadId = form.watch("linkedLoadId");

  return (
    <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2 text-purple-700 dark:text-purple-400">
          <Link2 className="h-4 w-4" />
          Link to Existing Load (Optional)
        </h4>
        {linkedLoadId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => form.setValue("linkedLoadId", "")}
            className="h-7 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Associate this third-party load with an existing load as a backload
      </p>
      <FormField
        control={form.control}
        name="linkedLoadId"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="linkedLoad">Link to Load</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger id="linkedLoad">
                  <SelectValue placeholder="Select an existing load to link (optional)" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {linkableLoads.map((load) => (
                  <SelectItem key={load.id} value={load.id}>
                    {load.load_id} - {load.origin} → {load.destination} (
                    {format(parseISO(load.loading_date), "MMM d, yyyy")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

interface LocationSectionProps {
  title: string;
  icon: React.ElementType;
  color: "green" | "blue";
  placeNameField: keyof FormData;
  addressField: keyof FormData;
  arrivalField: keyof FormData;
  departureField: keyof FormData;
  form: ReturnType<typeof useForm<FormData>>;
  customLocations: CustomLocation[];
}

const LocationSection: React.FC<LocationSectionProps> = ({
  title,
  icon: Icon,
  color,
  placeNameField,
  addressField,
  arrivalField,
  departureField,
  form,
  customLocations,
}) => {
  const colorClasses = {
    green: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
    blue: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
  };

  const textColorClasses = {
    green: "text-green-700 dark:text-green-400",
    blue: "text-blue-700 dark:text-blue-400",
  };

  return (
    <div className={cn("space-y-3 p-4 rounded-lg border", colorClasses[color])}>
      <h4 className={cn("font-medium flex items-center gap-2", textColorClasses[color])}>
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name={placeNameField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Depot / Location</FormLabel>
              <FormControl>
                <DepotCombobox
                  value={field.value as string}
                  onChange={field.onChange}
                  placeholder={`Select ${title.toLowerCase()} depot...`}
                  customLocations={customLocations}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={addressField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Custom address (overrides depot)" {...field} value={field.value as string} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name={arrivalField}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Arrival Time
              </FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value as string} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={departureField}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Departure Time
              </FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value as string} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export default function ThirdPartyLoadsPage() {
  // State
  const [dialogs, setDialogs] = useState<DialogState>(INITIAL_DIALOGS);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [weekFilter, setWeekFilter] = useState<WeekFilter>({ start: null, end: null });

  // Data
  const { data: loads = [], isLoading } = useLoads();
  const { data: clients = [] } = useClients();
  const { data: fleetVehicles = [] } = useFleetVehicles();
  const { data: drivers = [] } = useDrivers();
  const { data: customLocations = [] } = useCustomLocations();
  const createLoad = useCreateLoad();

  // Computed values
  const filteredLoads = useFilteredThirdPartyLoads(loads, filters, weekFilter);

  const linkableLoads = useMemo(
    () => loads.filter(load => isNotThirdPartyLoad(load.load_id)),
    [loads]
  );

  // Form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  // Handlers
  const updateDialog = useCallback((key: keyof DialogState, value: boolean) => {
    setDialogs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleLoadAction = useCallback((load: Load, dialog: keyof DialogState) => {
    setSelectedLoad(load);
    updateDialog(dialog, true);
  }, [updateDialog]);

  const handleWeekFilter = useCallback((weekStart: Date | null, weekEnd: Date | null) => {
    setWeekFilter({ start: weekStart, end: weekEnd });
  }, []);

  const handleExportExcel = useCallback((simplified = false) => {
    const exportFn = simplified ? exportLoadsToExcelSimplified : exportLoadsToExcel;
    exportFn(filteredLoads);
  }, [filteredLoads]);

  const handleSubmit = useCallback((data: FormData) => {
    const customer = clients.find((c) => c.id === data.customerId);
    if (!customer) return;

    const linkedLoad = data.linkedLoadId
      ? linkableLoads.find((l) => l.id === data.linkedLoadId)
      : null;

    const timeData = {
      origin: {
        plannedArrival: data.loadingPlannedArrival,
        plannedDeparture: data.loadingPlannedDeparture,
        placeName: data.loadingPlaceName,
        address: data.loadingAddress,
      },
      destination: {
        plannedArrival: data.offloadingPlannedArrival,
        plannedDeparture: data.offloadingPlannedDeparture,
        placeName: data.offloadingPlaceName,
        address: data.offloadingAddress,
      },
      thirdParty: {
        customerId: customer.id,
        customerName: customer.name,
        cargoDescription: data.cargoDescription,
        linkedLoadId: linkedLoad?.id || null,
        linkedLoadNumber: linkedLoad?.load_id || null,
      },
    };

    createLoad.mutate(
      {
        load_id: generateLoadId("TP"),
        loading_date: format(data.loadingDate, "yyyy-MM-dd"),
        offloading_date: format(data.offloadingDate, "yyyy-MM-dd"),
        origin: data.loadingPlaceName,
        destination: data.offloadingPlaceName,
        cargo_type: "Retail",
        priority: data.priority,
        status: "scheduled",
        fleet_vehicle_id: data.fleetVehicleId,
        driver_id: data.driverId || null,
        time_window: JSON.stringify(timeData),
        notes: data.notes,
        client_id: customer.id,
      },
      {
        onSuccess: () => {
          updateDialog("create", false);
          form.reset();
        },
      }
    );
  }, [clients, linkableLoads, createLoad, updateDialog, form]);

  const exportMenuItems = [
    { label: "Full Export (All Columns)", onClick: () => handleExportExcel(false) },
    { label: "Simplified Export", onClick: () => handleExportExcel(true) },
  ];

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => updateDialog("addLocation", true)}
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              Add Location
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!filteredLoads.length}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export to Excel
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {exportMenuItems.map((item) => (
                  <DropdownMenuItem key={item.label} onClick={item.onClick}>
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => updateDialog("create", true)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Third-Party Load
            </Button>
          </div>
        </header>

        <QuickFilters
          onSearch={(search) => setFilters(prev => ({ ...prev, search }))}
          onStatusFilter={(status) => setFilters(prev => ({ ...prev, status }))}
          onOriginFilter={(origin) => setFilters(prev => ({ ...prev, origin }))}
          onWeekFilter={handleWeekFilter}
        />

        <LoadsTable
          loads={filteredLoads}
          isLoading={isLoading}
          onLoadClick={(load) => handleLoadAction(load, "edit")}
          onEditLoad={(load) => handleLoadAction(load, "edit")}
          onConfirmDelivery={(load) => handleLoadAction(load, "delivery")}
        />
      </div>

      {/* Create Third-Party Load Dialog */}
      <Dialog open={dialogs.create} onOpenChange={(open) => updateDialog("create", open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-accent" />
              Create Third-Party Load
            </DialogTitle>
            <DialogDescription>
              Create a new load for a third-party customer
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <LinkedLoadSection form={form} linkableLoads={linkableLoads} />

              {/* Customer Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Customer</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateDialog("createClient", true)}
                    className="gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    New Customer
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="customer">Customer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id="customer">
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="loadingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loading Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : "Pick a date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="offloadingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offloading Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : "Pick a date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Loading Location */}
              <LocationSection
                title="Loading Location"
                icon={Truck}
                color="green"
                placeNameField="loadingPlaceName"
                addressField="loadingAddress"
                arrivalField="loadingPlannedArrival"
                departureField="loadingPlannedDeparture"
                form={form}
                customLocations={customLocations}
              />

              {/* Offloading Location */}
              <LocationSection
                title="Offloading Location"
                icon={MapPin}
                color="blue"
                placeNameField="offloadingPlaceName"
                addressField="offloadingAddress"
                arrivalField="offloadingPlannedArrival"
                departureField="offloadingPlannedDeparture"
                form={form}
                customLocations={customLocations}
              />

              {/* Cargo & Assignment */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cargoDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo Description</FormLabel>
                      <FormControl>
                        <Input placeholder="What is being transported?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fleetVehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Vehicle</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fleetVehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.vehicle_id} - {vehicle.type ?? "Unknown Type"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="driverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Auto-assign from vehicle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {drivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateDialog("create", false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLoad.isPending || !form.watch("customerId")}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {createLoad.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Load
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Supporting Dialogs */}
      <CreateClientDialog
        open={dialogs.createClient}
        onOpenChange={(open) => updateDialog("createClient", open)}
      />

      <EditThirdPartyLoadDialog
        open={dialogs.edit}
        onOpenChange={(open) => updateDialog("edit", open)}
        load={selectedLoad}
      />

      <DeliveryConfirmationDialog
        open={dialogs.delivery}
        onOpenChange={(open) => updateDialog("delivery", open)}
        load={selectedLoad}
      />

      <AddLocationDialog
        open={dialogs.addLocation}
        onOpenChange={(open) => updateDialog("addLocation", open)}
      />
    </>
  );
}