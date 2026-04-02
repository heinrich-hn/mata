import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVehicles } from '@/hooks/useVehicles';
import { Loader2, Truck } from 'lucide-react';

interface VehicleSelectProps {
    value?: string;
    onValueChange: (vehicleId: string) => void;
    onVehicleChange?: (vehicle: { id: string; fleet_number: string | null; registration_number: string; make: string | null; model: string | null } | null) => void;
    placeholder?: string;
    disabled?: boolean;
}

export const VehicleSelect = ({
    value,
    onValueChange,
    onVehicleChange,
    placeholder = 'Select vehicle...',
    disabled = false,
}: VehicleSelectProps) => {
    const { data: vehicles = [], isLoading, error } = useVehicles();

    const handleValueChange = (vehicleId: string) => {
        onValueChange(vehicleId);
        if (onVehicleChange) {
            const vehicle = vehicles.find(v => v.id === vehicleId);
            onVehicleChange(vehicle ? { id: vehicle.id, fleet_number: vehicle.fleet_number, registration_number: vehicle.registration_number, make: vehicle.make, model: vehicle.model } : null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center h-10 px-3 rounded-md border bg-muted">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading vehicles...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center h-10 px-3 rounded-md border border-destructive bg-destructive/10">
                <span className="text-sm text-destructive">Error loading vehicles</span>
            </div>
        );
    }

    const currentVehicle = vehicles.find(v => v.id === value);

    return (
        <Select
            value={value ?? ''}
            onValueChange={handleValueChange}
            disabled={disabled}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder}>
                    {currentVehicle ? (
                        <span className="flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            {currentVehicle.fleet_number && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                    {currentVehicle.fleet_number}
                                </Badge>
                            )}
                            <span className="font-medium">{currentVehicle.registration_number}</span>
                            <span className="text-muted-foreground text-sm">
                                {currentVehicle.make} {currentVehicle.model}
                            </span>
                        </span>
                    ) : (
                        placeholder
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {vehicles.length === 0 ? (
                    <SelectItem value="__no_vehicles__" disabled>
                        <span className="text-sm text-muted-foreground">No vehicles found.</span>
                    </SelectItem>
                ) : (
                    vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                            <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                {vehicle.fleet_number && (
                                    <Badge variant="secondary" className="font-mono text-xs">
                                        {vehicle.fleet_number}
                                    </Badge>
                                )}
                                <span className="font-medium">{vehicle.registration_number}</span>
                                <span className="text-muted-foreground text-sm">
                                    {vehicle.make} {vehicle.model}
                                </span>
                            </div>
                        </SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
    );
};

export default VehicleSelect;
