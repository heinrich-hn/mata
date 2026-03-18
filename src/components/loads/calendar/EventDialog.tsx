import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CalendarEvent } from "./LoadPlanningCalendar";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

// Define a type for load data
interface Load {
  id: string;
  load_number: string;
  customer_name: string;
  origin: string;
  destination: string;
  status: string;
}

// Define a type for vehicle data
interface Vehicle {
  id: string;
  fleet_number: string;
  name: string;
}

export const EventDialog = ({
  open,
  onOpenChange,
  event,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
}: EventDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!event;

  // Form state
  const [eventType, setEventType] = useState<"pickup" | "delivery" | "maintenance" | "blocked">("pickup");
  const [loadId, setLoadId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("none");
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("09:00");
  const [notes, setNotes] = useState<string>("");

  // Fetch available loads (pending/assigned)
  const { data: loads = [] } = useQuery<Load[]>({
    queryKey: ["loads-for-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loads")
        .select("id, load_number, customer_name, origin, destination, status")
        .in("status", ["pending", "assigned"])
        .order("pickup_datetime", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch available vehicles
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["wialon-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wialon_vehicles")
        .select("id, fleet_number, name")
        .order("fleet_number");

      if (error) throw error;
      return data || [];
    },
  });

  // Initialize form with event data or defaults
  useEffect(() => {
    if (event) {
      setEventType(event.event_type);
      setLoadId(event.load_id || "");
      setVehicleId(event.assigned_vehicle_id || "none");

      const start = new Date(event.start_time);
      const end = new Date(event.end_time);

      setStartDate(start.toISOString().split("T")[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split("T")[0]);
      setEndTime(end.toTimeString().slice(0, 5));
      setNotes(event.notes || "");
    } else if (defaultDate) {
      const dateStr = defaultDate.toISOString().split("T")[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
      setStartTime(defaultStartTime || "08:00");
      setEndTime(defaultEndTime || "09:00");
      setEventType("pickup");
      setLoadId("");
      setVehicleId("");
      setNotes("");
    }
  }, [event, defaultDate, defaultStartTime, defaultEndTime]);

  // Create event mutation
  const createMutation = useMutation<CalendarEvent, Error, Omit<CalendarEvent, 'id'>, unknown>({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase
        .from("calendar_events")
        .insert([data as never])
        .select()
        .single();

      if (error) throw error;
      return result as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: "Event created",
        description: "Calendar event has been created successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error creating event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update event mutation
  const updateMutation = useMutation<CalendarEvent, Error, Omit<CalendarEvent, 'id'>, unknown>({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase
        .from("calendar_events")
        .update(data as never)
        .eq("id", event!.id)
        .select()
        .single();

      if (error) throw error;
      return result as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: "Event updated",
        description: "Calendar event has been updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error updating event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteMutation = useMutation<void, Error, void, unknown>({
    mutationFn: async () => {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", event!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: "Event deleted",
        description: "Calendar event has been deleted successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error deleting event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!startDate || !startTime || !endDate || !endTime) {
      toast({
        title: "Validation error",
        description: "Please fill in all date and time fields",
        variant: "destructive",
      });
      return;
    }

    if ((eventType === "pickup" || eventType === "delivery") && !loadId) {
      toast({
        title: "Validation error",
        description: "Please select a load for pickup/delivery events",
        variant: "destructive",
      });
      return;
    }

    if ((eventType === "maintenance" || eventType === "blocked") && (!vehicleId || vehicleId === "none")) {
      toast({
        title: "Validation error",
        description: "Please select a vehicle for maintenance/blocked events",
        variant: "destructive",
      });
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();
    const endDateTime = new Date(`${endDate}T${endTime}`).toISOString();

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      toast({
        title: "Validation error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    const eventData: Omit<CalendarEvent, 'id'> = {
      event_type: eventType,
      load_id: loadId || null,
      assigned_vehicle_id: vehicleId && vehicleId !== "none" ? vehicleId : null,
      start_time: startDateTime,
      end_time: endDateTime,
      notes: notes || null,
    };

    if (isEditMode) {
      updateMutation.mutate(eventData);
    } else {
      createMutation.mutate(eventData);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isEditMode ? "Edit Calendar Event" : "Create Calendar Event"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update event details or delete the event"
              : "Schedule a new pickup, delivery, maintenance, or blocked period"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type *</Label>
            <Select
              value={eventType}
              onValueChange={(value) => setEventType(value as "pickup" | "delivery" | "maintenance" | "blocked")}
            >
              <SelectTrigger id="eventType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="blocked">Blocked/Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Load Selection (for pickup/delivery) */}
          {(eventType === "pickup" || eventType === "delivery") && (
            <div className="space-y-2">
              <Label htmlFor="loadId">Load *</Label>
              <Select value={loadId} onValueChange={setLoadId}>
                <SelectTrigger id="loadId">
                  <SelectValue placeholder="Select a load..." />
                </SelectTrigger>
                <SelectContent>
                  {loads.map((load) => (
                    <SelectItem key={load.id} value={load.id}>
                      {load.load_number} - {load.customer_name} ({load.origin} → {load.destination})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Vehicle Selection */}
          <div className="space-y-2">
            <Label htmlFor="vehicleId">
              Vehicle {(eventType === "maintenance" || eventType === "blocked") ? "*" : "(Optional)"}
            </Label>
            <Select value={vehicleId || undefined} onValueChange={setVehicleId}>
              <SelectTrigger id="vehicleId">
                <SelectValue placeholder="Select a vehicle (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.fleet_number} - {vehicle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <DatePicker
                id="startDate"
                value={startDate}
                onChange={(date) => setStartDate(date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select start date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <DatePicker
                id="endDate"
                value={endDate}
                onChange={(date) => setEndDate(date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select end date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this event..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {isEditMode && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Event
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditMode ? "Update Event" : "Create Event"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
