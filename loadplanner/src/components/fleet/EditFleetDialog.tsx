import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useFleetVehicles, useUpdateFleetVehicle } from '@/hooks/useFleetVehicles';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Pencil } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Import the type from the hook to ensure consistency
import type { FleetVehicle } from '@/hooks/useFleetVehicles';

const vehicleTypes = [
  'Horse',
  'Reefer',
  'Interlink',
  'Flatbed',
  'Box Truck',
  'Refrigerated',
  'Tanker',
  'Trailer',
  'Van',
  'Pickup',
];

// FIXED: Removed all *_active fields from schema
const formSchema = z.object({
  vehicle_id: z.string().min(2, 'Vehicle ID must be at least 2 characters'),
  type: z.string().min(1, 'Vehicle type is required'),
  capacity: z.number().min(0.1, 'Capacity must be greater than 0'),
  available: z.boolean(),
  // Vehicle details
  registration_number: z.string().optional(),
  vin_number: z.string().optional(),
  engine_number: z.string().optional(),
  make_model: z.string().optional(),
  engine_size: z.string().optional(),
  // Telematics integration
  telematics_asset_id: z.string().optional(),
  // Linked trailers (Horse only)
  linked_reefer_id: z.string().optional(),
  linked_interlink_id: z.string().optional(),
  // Expiry dates only (no active flags)
  license_expiry: z.date().optional(),
  cof_expiry: z.date().optional(),
  radio_license_expiry: z.date().optional(),
  insurance_expiry: z.date().optional(),
  svg_expiry: z.date().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditFleetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: FleetVehicle | null;
}

export function EditFleetDialog({ open, onOpenChange, vehicle }: EditFleetDialogProps) {
  const updateFleetVehicle = useUpdateFleetVehicle();
  const { data: allVehicles = [] } = useFleetVehicles();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicle_id: '',
      type: '',
      capacity: 0,
      available: true,
      registration_number: '',
      vin_number: '',
      engine_number: '',
      make_model: '',
      engine_size: '',
      telematics_asset_id: '',
    },
  });

  // Reset form when vehicle changes
  useEffect(() => {
    if (vehicle && open) {
      form.reset({
        vehicle_id: vehicle.vehicle_id,
        type: vehicle.type,
        capacity: vehicle.capacity,
        available: vehicle.available,
        registration_number: vehicle.registration_number || '',
        vin_number: vehicle.vin_number || '',
        engine_number: vehicle.engine_number || '',
        make_model: vehicle.make_model || '',
        engine_size: vehicle.engine_size || '',
        telematics_asset_id: vehicle.telematics_asset_id || '',
        linked_reefer_id: vehicle.linked_reefer_id || '',
        linked_interlink_id: vehicle.linked_interlink_id || '',
        license_expiry: vehicle.license_expiry ? parseISO(vehicle.license_expiry) : undefined,
        cof_expiry: vehicle.cof_expiry ? parseISO(vehicle.cof_expiry) : undefined,
        radio_license_expiry: vehicle.radio_license_expiry ? parseISO(vehicle.radio_license_expiry) : undefined,
        insurance_expiry: vehicle.insurance_expiry ? parseISO(vehicle.insurance_expiry) : undefined,
        svg_expiry: vehicle.svg_expiry ? parseISO(vehicle.svg_expiry) : undefined,
      });
    }
  }, [vehicle, open, form]);

  const handleSubmit = (data: FormData) => {
    if (!vehicle) return;

    // FIXED: Removed all *_active fields from submission
    updateFleetVehicle.mutate(
      {
        id: vehicle.id,
        vehicle_id: data.vehicle_id,
        type: data.type,
        capacity: data.capacity,
        available: data.available,
        registration_number: data.registration_number || null,
        vin_number: data.vin_number || null,
        engine_number: data.engine_number || null,
        make_model: data.make_model || null,
        engine_size: data.engine_size || null,
        telematics_asset_id: data.telematics_asset_id || null,
        linked_reefer_id: data.linked_reefer_id && data.linked_reefer_id !== 'none' ? data.linked_reefer_id : null,
        linked_interlink_id: data.linked_interlink_id && data.linked_interlink_id !== 'none' ? data.linked_interlink_id : null,
        license_expiry: data.license_expiry ? format(data.license_expiry, 'yyyy-MM-dd') : null,
        cof_expiry: data.cof_expiry ? format(data.cof_expiry, 'yyyy-MM-dd') : null,
        radio_license_expiry: data.radio_license_expiry ? format(data.radio_license_expiry, 'yyyy-MM-dd') : null,
        insurance_expiry: data.insurance_expiry ? format(data.insurance_expiry, 'yyyy-MM-dd') : null,
        svg_expiry: data.svg_expiry ? format(data.svg_expiry, 'yyyy-MM-dd') : null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
        },
      }
    );
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Pencil className="h-4 w-4" />
            </span>
            Edit Vehicle: {vehicle.vehicle_id}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edit fleet vehicle details including vehicle information, linked trailers, expiry dates, and availability status.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vehicle_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle ID / Plate Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., TRK-001 or ABC 1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vehicleTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
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
                  name="registration_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ABC 123 GP" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="make_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make & Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Scania R450" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (Tons)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Enter capacity in tons"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Vehicle Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vin_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VIN Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Vehicle Identification Number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="engine_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Engine Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Engine serial number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="engine_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Engine Size</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 12.7L or 450hp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telematics_asset_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telematics Asset ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Telematics Guru asset ID for tracking" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Linked Trailers (Horse only) */}
            {form.watch('type') === 'Horse' && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Linked Trailers</h4>
                <p className="text-xs text-muted-foreground">Link a Reefer and/or Interlink trailer to this Horse. Linked details appear on PDF exports only and do not affect trip assignments.</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="linked_reefer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Linked Reefer</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Reefer (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {allVehicles
                              .filter((v) => v.type === 'Reefer' && v.id !== vehicle?.id)
                              .map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.vehicle_id} {v.registration_number ? `(${v.registration_number})` : ''}
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
                    name="linked_interlink_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Linked Interlink</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Interlink (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {allVehicles
                              .filter((v) => v.type === 'Interlink' && v.id !== vehicle?.id)
                              .map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.vehicle_id} {v.registration_number ? `(${v.registration_number})` : ''}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            {/* Expiry Dates */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Expiry Dates</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* License Expiry */}
                <FormField
                  control={form.control}
                  name="license_expiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>License Expiry</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date('1900-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* COF Expiry */}
                <FormField
                  control={form.control}
                  name="cof_expiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>COF Expiry</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date('1900-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Radio License Expiry */}
                <FormField
                  control={form.control}
                  name="radio_license_expiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Radio License</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date('1900-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Insurance Expiry */}
                <FormField
                  control={form.control}
                  name="insurance_expiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Insurance</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date('1900-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* SVG Expiry */}
                <FormField
                  control={form.control}
                  name="svg_expiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>SVG Expiry</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date('1900-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Availability */}
            <FormField
              control={form.control}
              name="available"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Available for assignments</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Vehicle can be assigned to trips and drivers
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateFleetVehicle.isPending}
              >
                {updateFleetVehicle.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}