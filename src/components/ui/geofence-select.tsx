import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGeofences } from '@/hooks/useGeofences';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';

interface GeofenceSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
}

export const GeofenceSelect = ({
  value,
  onValueChange,
  placeholder = 'Select location...',
  disabled = false,
  allowCreate = true,
}: GeofenceSelectProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: geofences = [], isLoading, error } = useGeofences();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    description: '',
  });

  const handleCreateGeofence = async () => {
    if (!newGeofence.name.trim()) {
      toast({
        title: 'Error',
        description: 'Location name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const insertData = {
        name: newGeofence.name.trim(),
        description: newGeofence.description.trim() || null,
        center_lat: 0, // Default - can be updated later
        center_lng: 0, // Default - can be updated later
        radius: 500, // Default radius in meters
        is_active: true,
        type: 'circle', // Valid types are 'circle' or 'polygon'
      };

      const { error } = await supabase
        .from('geofences' as never)
        .insert([insertData] as never)
        .select()
        .single();

      if (error) throw error;

      // Refresh geofences list
      await queryClient.invalidateQueries({ queryKey: ['geofences'] });

      toast({
        title: 'Location Added',
        description: `${newGeofence.name} has been added successfully.`,
      });

      // Select the new geofence
      onValueChange(newGeofence.name.trim());

      // Reset form and close dialog
      setNewGeofence({ name: '', description: '' });
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Error creating geofence:', err);
      toast({
        title: 'Error',
        description: 'Failed to create location. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Deduplicate geofences by name (keeps first occurrence)
  const uniqueGeofences = geofences.reduce((acc, geofence) => {
    if (!acc.some(g => g.name === geofence.name)) {
      acc.push(geofence);
    }
    return acc;
  }, [] as typeof geofences);

  // Find the current geofence to show in display
  const currentGeofence = uniqueGeofences.find(g => g.name === value);

  if (isLoading) {
    return (
      <div className="flex items-center h-10 px-3 rounded-md border bg-muted">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading locations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center h-10 px-3 rounded-md border border-destructive bg-destructive/10">
        <span className="text-sm text-destructive">Error loading locations</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Select
          value={value || undefined}
          onValueChange={onValueChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder}>
              {currentGeofence ? (
                <span className="flex items-center gap-2 overflow-hidden">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{currentGeofence.name}</span>
                </span>
              ) : value ? (
                <span className="flex items-center gap-2 overflow-hidden">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{value}</span>
                </span>
              ) : (
                placeholder
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {uniqueGeofences.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No locations found. Click + to add one.
              </div>
            ) : (
              uniqueGeofences.map((geofence) => (
                <SelectItem key={geofence.id} value={geofence.name}>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {geofence.name}
                    {geofence.description && <span className="text-muted-foreground ml-1">({geofence.description})</span>}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {allowCreate && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsDialogOpen(true)}
            disabled={disabled}
            title="Add new location"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Quick Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>
              Quickly add a new destination or origin location.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Location Name *</Label>
              <Input
                id="name"
                value={newGeofence.name}
                onChange={(e) => setNewGeofence(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Warehouse A, Client Site, Port Elizabeth"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={newGeofence.description}
                onChange={(e) => setNewGeofence(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Main warehouse, Loading bay 2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateGeofence}
              disabled={isCreating || !newGeofence.name.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Location
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GeofenceSelect;