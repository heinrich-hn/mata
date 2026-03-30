// Updated TripLinkForm component to handle existing freight
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Truck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Types
interface TripEntry {
  id: string;
  trip_number: string | null;
  vehicle_id: string | null;
  fleet_vehicle_id: string | null;
  origin: string | null;
  destination: string | null;
  departure_date: string | null;
  arrival_date: string | null;
  driver_name: string | null;
  client_name: string | null;
  distance_km: number | null;
  base_revenue: number | null;
  invoice_amount: number | null;
  status: string | null;
  created_at: string | null;
}

interface FreightDetail {
  id: string;
  trip_id: string;
  driver_id: string;
  vehicle_id: string;
  freight_type: string;
  cargo_description: string;
  weight_kg: number;
  rate_per_km: number | null;
  additional_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Define the zod schema first - use explicit number type without coerce
const formSchema = z.object({
  freight_type: z.string().min(1, "Freight type is required"),
  cargo_description: z.string().min(1, "Cargo description is required"),
  weight_kg: z.number({ message: "Weight must be a number" }).min(1, "Weight must be greater than 0"),
  additional_notes: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});

// Infer the type from the schema
type FormValues = z.infer<typeof formSchema>;

// Define the field renderer props type
interface FieldRendererProps {
  field: {
    onChange: (...event: unknown[]) => void;
    value: unknown;
    name?: string;
    ref?: React.Ref<unknown>;
    onBlur?: () => void;
  };
}

function TripLinkForm({
  trip,
  open,
  onOpenChange,
  existingFreight
}: {
  trip: TripEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFreight?: FreightDetail;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const supabase = createClient();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      freight_type: existingFreight?.freight_type || "",
      cargo_description: existingFreight?.cargo_description || "",
      weight_kg: existingFreight?.weight_kg || 0,
      additional_notes: existingFreight?.additional_notes || "",
      status: (existingFreight?.status as FormValues["status"]) || "pending",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!user || !trip.id || !trip.fleet_vehicle_id) return;

    setIsSubmitting(true);
    try {
      if (existingFreight) {
        // Update existing freight
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("freight_details")
          .update({
            freight_type: values.freight_type,
            cargo_description: values.cargo_description,
            weight_kg: values.weight_kg,
            additional_notes: values.additional_notes,
            status: values.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingFreight.id);

        if (error) throw error;
      } else {
        // Insert new freight
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("freight_details").insert({
          trip_id: trip.id,
          driver_id: user.id,
          vehicle_id: trip.fleet_vehicle_id,
                    freight_type: values.freight_type,
          cargo_description: values.cargo_description,
          weight_kg: values.weight_kg,
          additional_notes: values.additional_notes,
          status: values.status,
        });

        if (error) throw error;
      }

      // Refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["monthly-trips"] }),
        queryClient.invalidateQueries({ queryKey: ["freight-details"] }),
      ]);

      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving freight:", error);
      alert("Failed to save freight details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingFreight?.id) return;

    if (!confirm("Are you sure you want to remove this freight?")) return;

    setIsDeleting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("freight_details")
        .delete()
        .eq("id", existingFreight.id);

      if (error) throw error;

      // Refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["monthly-trips"] }),
        queryClient.invalidateQueries({ queryKey: ["freight-details"] }),
      ]);

      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting freight:", error);
      alert("Failed to delete freight. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingFreight ? "Edit Freight Details" : "Link Freight to Trip"}
          </DialogTitle>
          <DialogDescription>
            {existingFreight
              ? `Update freight details for trip ${trip.trip_number || trip.id.slice(0, 8)}`
              : `Add freight details for trip ${trip.trip_number || trip.id.slice(0, 8)}`
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="freight_type"
                render={({ field }: FieldRendererProps) => (
                  <FormItem>
                    <FormLabel>Freight Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value as string}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="refrigerated">Refrigerated</SelectItem>
                        <SelectItem value="hazardous">Hazardous</SelectItem>
                        <SelectItem value="bulk">Bulk</SelectItem>
                        <SelectItem value="liquid">Liquid</SelectItem>
                        <SelectItem value="container">Container</SelectItem>
                        <SelectItem value="livestock">Livestock</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weight_kg"
                render={({ field }: FieldRendererProps) => (
                  <FormItem>
                    <FormLabel>Weight (kg) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 1000"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          // Convert to number or use 0 if empty
                          field.onChange(value === "" ? 0 : Number(value));
                        }}
                        value={field.value as number === 0 ? "" : field.value as number}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref as React.LegacyRef<HTMLInputElement>}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cargo_description"
              render={({ field }: FieldRendererProps) => (
                <FormItem>
                  <FormLabel>Cargo Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the cargo..."
                      className="resize-none"
                      rows={3}
                      value={field.value as string}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref as React.LegacyRef<HTMLTextAreaElement>}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }: FieldRendererProps) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value as string}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additional_notes"
              render={({ field }: FieldRendererProps) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional information..."
                      className="resize-none"
                      rows={2}
                      value={field.value as string || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref as React.LegacyRef<HTMLTextAreaElement>}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between gap-2 pt-4">
              <div>
                {existingFreight && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isSubmitting || isDeleting}
                    className="text-xs h-9"
                  >
                    {isDeleting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Remove Freight
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting || isDeleting}
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isDeleting} className="h-9">
                  {(isSubmitting || isDeleting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {existingFreight ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Sub-components
function StatCard({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-lg font-bold">{value}</p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function LoadingSpinner(): JSX.Element {
  return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Truck className="w-8 h-8 mb-2 opacity-20" />
        <p className="text-sm">No trips found for this month.</p>
      </CardContent>
    </Card>
  );
}

export { TripLinkForm, StatCard, LoadingSpinner, EmptyState };