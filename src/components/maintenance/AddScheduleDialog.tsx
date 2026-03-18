
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getFleetSubcategory, isReeferFleet, FLEET_SUBCATEGORY_META } from "@/utils/fleetCategories";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

interface AddScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddScheduleDialog({ open, onOpenChange, onSuccess }: AddScheduleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Fetch active vehicles for selection
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, registration_number, fleet_number, vehicle_type")
        .eq("active", true)
        .order("fleet_number");

      if (error) throw error;
      // Filter out any vehicles with empty or null IDs
      return (data || []).filter(vehicle => vehicle.id && vehicle.id.trim() !== "");
    },
  });

  const { register, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: {
      vehicle_id: "none",
      title: "",
      description: "",
      schedule_type: "one_time",
      frequency: "monthly",
      frequency_value: 1,
      start_date: new Date().toISOString().split('T')[0],
      category: "service",
      maintenance_type: "",
      priority: "medium",
      assigned_to: "",
      estimated_duration_hours: 0,
      auto_create_job_card: false,
      odometer_based: false,
      odometer_interval_km: 0,
      last_odometer_reading: 0,
      notes: "",
    },
  });

  const scheduleType = watch("schedule_type");
  const odometerBased = watch("odometer_based");
  const selectedVehicleId = watch("vehicle_id");

  // Fetch the selected vehicle's fleet number to determine subcategory
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const selectedFleetNumber = selectedVehicle?.fleet_number ?? null;

  // Determine if selected vehicle is a REEFER (fleet suffix 'F')
  const isReeferVehicle = isReeferFleet(selectedFleetNumber);
  const fleetSubcategory = selectedFleetNumber ? getFleetSubcategory(selectedFleetNumber) : null;

  // Fetch the most recent operating hours from reefer_diesel_records for REEFERS
  const { data: latestReeferHours } = useQuery({
    queryKey: ["reefer-latest-hours", selectedFleetNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reefer_diesel_records")
        .select("operating_hours")
        .eq("reefer_unit", selectedFleetNumber!)
        .not("operating_hours", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.operating_hours ?? null;
    },
    enabled: isReeferVehicle && !!selectedFleetNumber,
  });

  // Auto-set odometer_based when a REEFER is selected (repurposed for hours)
  if (isReeferVehicle && !odometerBased) {
    setValue("odometer_based", true);
    if (latestReeferHours !== null && latestReeferHours !== undefined) {
      setValue("last_odometer_reading", latestReeferHours);
    }
  } else if (!isReeferVehicle && odometerBased) {
    // Only clear if user didn't manually toggle — we don't track manual toggle here,
    // so we leave it alone for non-reefer vehicles
  }

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      // Calculate next_due_date based on start_date and frequency
      const startDate = new Date(data.start_date as string);
      const nextDueDate = new Date(startDate);

      if (data.schedule_type === "recurring") {
        // Add frequency interval to start date
        switch (data.frequency) {
          case "daily":
            nextDueDate.setDate(nextDueDate.getDate() + (data.frequency_value as number || 1));
            break;
          case "weekly":
            nextDueDate.setDate(nextDueDate.getDate() + (7 * (data.frequency_value as number || 1)));
            break;
          case "monthly":
            nextDueDate.setMonth(nextDueDate.getMonth() + (data.frequency_value as number || 1));
            break;
          case "quarterly":
            nextDueDate.setMonth(nextDueDate.getMonth() + (3 * (data.frequency_value as number || 1)));
            break;
          case "yearly":
            nextDueDate.setFullYear(nextDueDate.getFullYear() + (data.frequency_value as number || 1));
            break;
        }
      }

      // For KM-based or hours-based (REEFER) schedules, use a far-future sentinel date
      const isOdometerBased = data.odometer_based as boolean;
      const finalNextDueDate = isOdometerBased
        ? '2099-12-31'
        : nextDueDate.toISOString().split('T')[0];

      const submitData = {
        title: data.title,
        description: data.description,
        schedule_type: data.schedule_type,
        frequency: data.frequency,
        frequency_value: data.frequency_value,
        start_date: data.start_date,
        category: data.category,
        maintenance_type: data.maintenance_type,
        service_type: data.maintenance_type || data.category || "service",
        priority: data.priority,
        assigned_to: data.assigned_to || null,
        estimated_duration_hours: data.estimated_duration_hours,
        auto_create_job_card: data.auto_create_job_card,
        // For REEFERS: odometer_based=true, odometer_interval_km stores hours interval,
        // last_odometer_reading stores last hours reading.
        // For non-REEFERS: odometer columns store km values normally.
        odometer_based: isReeferVehicle ? true : data.odometer_based,
        odometer_interval_km: (isReeferVehicle || isOdometerBased) ? data.odometer_interval_km : null,
        last_odometer_reading: (isReeferVehicle || isOdometerBased) ? (data.last_odometer_reading || 0) : null,
        notes: data.notes || null,
        // Required fields
        next_due_date: finalNextDueDate,
        // Vehicle ID - null for fleet-wide, specific UUID for vehicle-specific
        vehicle_id: data.vehicle_id === "none" ? null : data.vehicle_id,
        // Optional fields
        created_by: "System User",
        notification_channels: {
          email: true,
          sms: false,
          in_app: true,
        },
        notification_recipients: [],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("maintenance_schedules").insert([submitData as any]);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Maintenance schedule created successfully",
      });

      reset();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Maintenance Schedule</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new maintenance schedule for your fleet or a specific vehicle.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[600px] pr-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" {...register("title")} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance_type">Maintenance Type *</Label>
                <Input id="maintenance_type" {...register("maintenance_type")} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle_id">Vehicle</Label>
              <Select
                onValueChange={(value) => setValue("vehicle_id", value)}
                disabled={vehiclesLoading}
                defaultValue="none"
              >
                <SelectTrigger>
                  <SelectValue placeholder={vehiclesLoading ? "Loading vehicles..." : "Select vehicle (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Fleet-wide schedule)</SelectItem>
                  {vehicles.map((vehicle) => {
                    const sub = getFleetSubcategory(vehicle.fleet_number);
                    const meta = FLEET_SUBCATEGORY_META[sub];
                    return (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.fleet_number || vehicle.registration_number} - {vehicle.registration_number}
                        {vehicle.vehicle_type && ` (${vehicle.vehicle_type})`}
                        {` [${meta.label}]`}
                        {isReeferFleet(vehicle.fleet_number) && " ❄️"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedVehicleId && selectedVehicleId !== "none" && fleetSubcategory && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`${FLEET_SUBCATEGORY_META[fleetSubcategory].color} border text-xs font-semibold`}>
                    {isReeferVehicle ? "❄️ " : ""}{FLEET_SUBCATEGORY_META[fleetSubcategory].label}
                    {isReeferVehicle && " — Hours-based scheduling"}
                  </Badge>
                  {isReeferVehicle && latestReeferHours !== null && latestReeferHours !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Current hours: <strong>{latestReeferHours.toLocaleString()} h</strong>
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Select a specific vehicle or leave empty for fleet-wide maintenance.
                {" "}Reefer fleets (suffix F) use hour-based scheduling automatically.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register("description")} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  onValueChange={(value) => setValue("category", value as "inspection" | "service" | "repair" | "replacement" | "calibration")}
                  defaultValue="service"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="replacement">Replacement</SelectItem>
                    <SelectItem value="calibration">Calibration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select
                  onValueChange={(value) => setValue("priority", value as "low" | "medium" | "high" | "critical")}
                  defaultValue="medium"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date-based scheduling — hidden for hours-based REEFER schedules */}
            {!odometerBased && !isReeferVehicle && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="schedule_type">Schedule Type *</Label>
                  <Select
                    onValueChange={(value) => setValue("schedule_type", value as "one_time" | "recurring")}
                    defaultValue="one_time"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">One Time</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scheduleType === "recurring" && (
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency *</Label>
                    <Select
                      onValueChange={(value) => setValue("frequency", value as "daily" | "weekly" | "monthly" | "quarterly" | "yearly")}
                      defaultValue="monthly"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {!odometerBased && !isReeferVehicle && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <DatePicker
                    id="start_date"
                    value={watch("start_date")}
                    onChange={(date) => setValue("start_date", date ? date.toISOString().split('T')[0] : '')}
                    placeholder="Select start date"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimated_duration_hours">Estimated Duration (hours)</Label>
                  <Input
                    id="estimated_duration_hours"
                    type="number"
                    step="0.5"
                    {...register("estimated_duration_hours", { valueAsNumber: true })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Input id="assigned_to" {...register("assigned_to")} />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="auto_create_job_card"
                onCheckedChange={(checked) => setValue("auto_create_job_card", checked)}
              />
              <Label htmlFor="auto_create_job_card">Auto-create job card when due</Label>
            </div>

            {/* Odometer-based toggle — hidden for REEFER vehicles */}
            {!isReeferVehicle && (
              <>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="odometer_based"
                    onCheckedChange={(checked) => setValue("odometer_based", checked)}
                  />
                  <Label htmlFor="odometer_based">Odometer-based scheduling</Label>
                </div>

                {odometerBased && (
                  <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-800">KM-Based Schedule — no date required</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="last_odometer_reading">Previous / Last Service KM *</Label>
                        <Input
                          id="last_odometer_reading"
                          type="number"
                          placeholder="KM at last service"
                          {...register("last_odometer_reading", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="odometer_interval_km">Service Interval (km) *</Label>
                        <Input
                          id="odometer_interval_km"
                          type="number"
                          placeholder="e.g. 10000"
                          {...register("odometer_interval_km", { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                    {watch("last_odometer_reading") > 0 && watch("odometer_interval_km") > 0 && (
                      <div className="rounded-md bg-white p-3 border">
                        <p className="text-sm text-muted-foreground">Next Service Due At</p>
                        <p className="text-xl font-bold text-blue-700">
                          {(watch("last_odometer_reading") + watch("odometer_interval_km")).toLocaleString()} km
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ({watch("last_odometer_reading").toLocaleString()} km + {watch("odometer_interval_km").toLocaleString()} km interval)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Hours-based scheduling — auto-shown for REEFER vehicles, binds to odometer DB columns */}
            {isReeferVehicle && (
              <div className="space-y-4 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-sm font-medium text-cyan-800">
                  ❄️ REEFER Hours-Based Schedule — tracked by operating hours
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="add-last_hours_reading">Current / Last Service Hours *</Label>
                    <Input
                      id="add-last_hours_reading"
                      type="number"
                      step="0.1"
                      placeholder="Hours at last service"
                      {...register("last_odometer_reading", { valueAsNumber: true })}
                    />
                    {latestReeferHours !== null && latestReeferHours !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Latest recorded hours (diesel log): <strong>{latestReeferHours.toLocaleString()} h</strong>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-hours_interval">Service Interval (hours) *</Label>
                    <Input
                      id="add-hours_interval"
                      type="number"
                      step="0.1"
                      placeholder="e.g. 500"
                      {...register("odometer_interval_km", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                {watch("last_odometer_reading") > 0 && watch("odometer_interval_km") > 0 && (
                  <div className="rounded-md bg-white p-3 border">
                    <p className="text-sm text-muted-foreground">Next Service Due At</p>
                    <p className="text-xl font-bold text-cyan-700">
                      {(watch("last_odometer_reading") + watch("odometer_interval_km")).toLocaleString()} hours
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ({watch("last_odometer_reading").toLocaleString()} h + {watch("odometer_interval_km").toLocaleString()} h interval)
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" {...register("notes")} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Schedule"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
