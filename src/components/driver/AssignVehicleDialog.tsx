import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { Driver } from '@/hooks/useDrivers';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Container, Loader2, Snowflake, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AssignVehicleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    driver: Driver | null;
}

interface VehicleRow {
    id: string;
    fleet_number: string | null;
    registration_number: string;
    vehicle_type: string | null;
    make: string;
    model: string;
    active: boolean | null;
}

interface AssignmentRow {
    id: string;
    driver_id: string;
    vehicle_id: string;
    is_active: boolean;
    assigned_at: string;
    vehicles: VehicleRow | null;
}

const TRUCK_TYPES = ['truck', 'van', 'bus', 'rigid_truck', 'horse_truck', 'refrigerated_truck'];
const TRAILER_TYPES = ['reefer', 'trailer', 'interlink'];

export default function AssignVehicleDialog({ open, onOpenChange, driver }: AssignVehicleDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [selectedReeferId, setSelectedReeferId] = useState<string>('');

    const authUserId = driver?.auth_user_id;

    // Fetch active vehicles
    const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<VehicleRow[]>({
        queryKey: ['vehicles-for-assignment'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vehicles')
                .select('id, fleet_number, registration_number, vehicle_type, make, model, active')
                .eq('active', true)
                .order('fleet_number');
            if (error) throw error;
            return (data || []) as VehicleRow[];
        },
        enabled: open,
    });

    // Split vehicles into trucks and reefers/trailers
    const trucks = vehicles.filter(v => !v.vehicle_type || TRUCK_TYPES.includes(v.vehicle_type));
    const reefersAndTrailers = vehicles.filter(v => v.vehicle_type && TRAILER_TYPES.includes(v.vehicle_type));

    // Fetch current truck assignment
    const { data: currentAssignment, isLoading: assignmentLoading } = useQuery<AssignmentRow | null>({
        queryKey: ['driver-vehicle-assignment', authUserId],
        queryFn: async () => {
            if (!authUserId) return null;
            const { data, error } = await supabase
                .from('driver_vehicle_assignments')
                .select(`
          id, driver_id, vehicle_id, is_active, assigned_at, notes,
          vehicles (id, fleet_number, registration_number, vehicle_type, make, model, active)
        `)
                .eq('driver_id', authUserId)
                .eq('is_active', true)
                .order('assigned_at', { ascending: false });
            if (error) throw error;

            const rows = (data || []) as AssignmentRow[];
            // Find the truck assignment (non-reefer/trailer)
            return rows.find(r => {
                const vt = r.vehicles?.vehicle_type;
                return !vt || TRUCK_TYPES.includes(vt);
            }) || null;
        },
        enabled: open && !!authUserId,
    });

    // Fetch current reefer/trailer assignment
    const { data: currentReeferAssignment, isLoading: reeferAssignmentLoading } = useQuery<AssignmentRow | null>({
        queryKey: ['driver-reefer-assignment', authUserId],
        queryFn: async () => {
            if (!authUserId) return null;
            const { data, error } = await supabase
                .from('driver_vehicle_assignments')
                .select(`
          id, driver_id, vehicle_id, is_active, assigned_at, notes,
          vehicles (id, fleet_number, registration_number, vehicle_type, make, model, active)
        `)
                .eq('driver_id', authUserId)
                .eq('is_active', true)
                .order('assigned_at', { ascending: false });
            if (error) throw error;

            const rows = (data || []) as AssignmentRow[];
            return rows.find(r => {
                const vt = r.vehicles?.vehicle_type;
                return vt && TRAILER_TYPES.includes(vt);
            }) || null;
        },
        enabled: open && !!authUserId,
    });

    // Sync selected values when assignments load
    useEffect(() => {
        setSelectedVehicleId(currentAssignment?.vehicle_id || '');
    }, [currentAssignment]);

    useEffect(() => {
        setSelectedReeferId(currentReeferAssignment?.vehicle_id || '');
    }, [currentReeferAssignment]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setSelectedVehicleId('');
            setSelectedReeferId('');
        }
    }, [open]);

    // Save mutation — deactivates ALL existing active assignments, then inserts new ones
    const assignMutation = useMutation({
        mutationFn: async () => {
            if (!authUserId) throw new Error('Driver has no mobile profile');

            const truckChanged = selectedVehicleId !== (currentAssignment?.vehicle_id || '');
            const reeferChanged = selectedReeferId !== (currentReeferAssignment?.vehicle_id || '');
            if (!truckChanged && !reeferChanged) return;

            const driverName = driver ? `${driver.first_name} ${driver.last_name}`.trim() : 'admin';
            const now = new Date().toISOString();

            // Step 1: Deactivate ALL active assignments for this driver
            // This avoids unique constraint violations from orphaned rows or
            // when the old (driver_id)-only unique index is still in place
            const { error: deactivateError } = await supabase
                .from('driver_vehicle_assignments')
                .update({ is_active: false, unassigned_at: now } as never)
                .eq('driver_id', authUserId)
                .eq('is_active', true);
            if (deactivateError) throw deactivateError;

            // Step 2: Insert all current assignments (both changed and unchanged)
            const newRows: Record<string, unknown>[] = [];
            if (selectedVehicleId) {
                newRows.push({
                    driver_id: authUserId,
                    vehicle_id: selectedVehicleId,
                    assigned_at: now,
                    is_active: true,
                    notes: `Truck assigned by admin for ${driverName}`,
                });
            }
            if (selectedReeferId) {
                newRows.push({
                    driver_id: authUserId,
                    vehicle_id: selectedReeferId,
                    assigned_at: now,
                    is_active: true,
                    notes: `Reefer/trailer assigned by admin for ${driverName}`,
                });
            }

            if (newRows.length > 0) {
                const { error: insertError } = await supabase
                    .from('driver_vehicle_assignments')
                    .insert(newRows as never);
                if (insertError) throw insertError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driver-vehicle-assignment', authUserId] });
            queryClient.invalidateQueries({ queryKey: ['driver-reefer-assignment', authUserId] });
            queryClient.invalidateQueries({ queryKey: ['driver-vehicle-assignments'] });
            toast({
                title: 'Assignments saved',
                description: `Updated vehicle assignments for ${driver?.first_name} ${driver?.last_name}`,
            });
            onOpenChange(false);
        },
        onError: (error: Error & { code?: string; details?: string }) => {
            let description = error.message || 'Failed to update assignments';
            if (error.code === '23505') {
                description = 'Unique constraint violation — this driver already has an active assignment. Please run the database migration to allow multiple assignments.';
            } else if (error.code === '23503') {
                description = 'Foreign key error — this driver may not have a valid mobile profile linked.';
            }
            toast({
                title: 'Assignment Failed',
                description,
                variant: 'destructive',
            });
        },
    });

    // Unassign helpers
    const unassignTruck = () => setSelectedVehicleId('');
    const unassignReefer = () => setSelectedReeferId('');

    const isLoading = vehiclesLoading || assignmentLoading || reeferAssignmentLoading;
    const truckChanged = selectedVehicleId !== (currentAssignment?.vehicle_id || '');
    const reeferChanged = selectedReeferId !== (currentReeferAssignment?.vehicle_id || '');
    const hasChanged = truckChanged || reeferChanged;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Assign Vehicle
                    </DialogTitle>
                    <DialogDescription>
                        Assign a vehicle to <strong>{driver ? `${driver.first_name} ${driver.last_name}` : ''}</strong>.
                        This will be their pre-configured vehicle in the mobile app.
                    </DialogDescription>
                </DialogHeader>

                {!authUserId ? (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No Mobile Profile</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                This driver doesn&apos;t have a mobile app account yet. Create a mobile profile first before assigning a vehicle.
                            </p>
                        </div>
                    </div>
                ) : isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-5 py-2">
                        {/* --- Truck Assignment --- */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-primary" />
                                Truck / Horse
                            </Label>
                            {currentAssignment?.vehicles && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                                    <span>Current:</span>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        {currentAssignment.vehicles.fleet_number || 'N/A'} — {currentAssignment.vehicles.registration_number}
                                    </Badge>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Choose a truck..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {trucks.map((v) => (
                                            <SelectItem key={v.id} value={v.id}>
                                                {v.fleet_number || 'N/A'} — {v.registration_number} ({v.make} {v.model})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedVehicleId && (
                                    <Button variant="ghost" size="icon" onClick={unassignTruck} className="shrink-0 text-destructive hover:text-destructive">
                                        ✕
                                    </Button>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* --- Reefer / Trailer Assignment --- */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Snowflake className="h-4 w-4 text-sky-500" />
                                Reefer / Trailer / Interlink
                            </Label>
                            {currentReeferAssignment?.vehicles && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                                    <span>Current:</span>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        {currentReeferAssignment.vehicles.fleet_number || 'N/A'} — {currentReeferAssignment.vehicles.registration_number}
                                    </Badge>
                                </div>
                            )}
                            {reefersAndTrailers.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-1">
                                    No reefers/trailers found. Add vehicles with type &quot;reefer&quot;, &quot;trailer&quot;, or &quot;interlink&quot; first.
                                </p>
                            ) : (
                                <div className="flex gap-2">
                                    <Select value={selectedReeferId} onValueChange={setSelectedReeferId}>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Choose a reefer/trailer..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {reefersAndTrailers.map((v) => (
                                                <SelectItem key={v.id} value={v.id}>
                                                    {v.fleet_number || 'N/A'} — {v.registration_number} ({v.vehicle_type})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedReeferId && (
                                        <Button variant="ghost" size="icon" onClick={unassignReefer} className="shrink-0 text-destructive hover:text-destructive">
                                            ✕
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => assignMutation.mutate()}
                        disabled={!hasChanged || assignMutation.isPending || !authUserId}
                    >
                        {assignMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Save Assignments
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
