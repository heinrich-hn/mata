/**
 * Dialog for saving routes created in the Unified Map View
 * Allows naming, describing, and marking routes as templates
 */

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSavedRoutes } from '@/hooks/useSavedRoutes';
import { useState } from 'react';

// Local RouteWaypoint type matching UnifiedMapView
interface LocalRouteWaypoint {
  id: string;
  geofenceId?: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'pickup' | 'delivery' | 'stop';
  sequence?: number;
}

interface SaveRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waypoints: LocalRouteWaypoint[];
  totalDistance: number;
  estimatedDuration: number;
}

export const SaveRouteDialog = ({
  open,
  onOpenChange,
  waypoints,
  totalDistance,
  estimatedDuration,
}: SaveRouteDialogProps) => {
  const { createRoute, isCreating } = useSavedRoutes();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }

    createRoute({
      name: name.trim(),
      description: description.trim() || undefined,
      waypoints: waypoints.map(wp => ({
        sequence: wp.sequence || 0,
        name: wp.name,
        address: wp.name, // Using name as address for now
        latitude: wp.latitude,
        longitude: wp.longitude,
        type: wp.type,
        geofence_id: wp.geofenceId,
      })),
      total_distance_km: totalDistance,
      estimated_duration_mins: estimatedDuration,
      is_template: isTemplate,
    });

    // Reset form
    setName('');
    setDescription('');
    setIsTemplate(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Route</DialogTitle>
          <DialogDescription>
            Save this route for future use in load planning and assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="route-name">Route Name *</Label>
            <Input
              id="route-name"
              placeholder="e.g., JHB to CPT via Bloemfontein"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="route-description">Description</Label>
            <Textarea
              id="route-description"
              placeholder="Optional notes about this route..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-template"
              checked={isTemplate}
              onCheckedChange={(checked) => setIsTemplate(checked as boolean)}
              disabled={isCreating}
            />
            <Label htmlFor="is-template" className="text-sm font-normal cursor-pointer">
              Save as reusable template
            </Label>
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Waypoints:</span>
              <span className="font-medium">{waypoints.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Distance:</span>
              <span className="font-medium">{totalDistance.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Time:</span>
              <span className="font-medium">
                {Math.floor(estimatedDuration / 60)}h {estimatedDuration % 60}m
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isCreating}>
            {isCreating ? 'Saving...' : 'Save Route'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
