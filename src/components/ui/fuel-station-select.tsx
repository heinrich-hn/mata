import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form-elements';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAddFuelStation, useFuelStations, useHistoricalFuelStations } from '@/hooks/useFuelStations';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Fuel, Loader2, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface FuelStationSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  onPriceChange?: (price: number | null, currency: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  id?: string; // Added for accessibility
}

export const FuelStationSelect = ({
  value,
  onValueChange,
  onPriceChange,
  disabled = false,
  error,
  placeholder = 'Select filling station...',
  id,
}: FuelStationSelectProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationLocation, setNewStationLocation] = useState('');
  const [newStationPrice, setNewStationPrice] = useState('');
  const [newStationCurrency, setNewStationCurrency] = useState('USD');

  // Generate unique IDs for accessibility
  const selectId = id || `fuel-station-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${selectId}-error`;
  const descriptionId = `${selectId}-description`;

  // Fetch saved fuel stations
  const { data: savedStations = [], isLoading: isLoadingSaved } = useFuelStations(true);

  // Fetch historical stations from diesel_records
  const { data: historicalStations = [], isLoading: isLoadingHistorical } = useHistoricalFuelStations();

  // Add station mutation
  const addStationMutation = useAddFuelStation();

  // Combine and deduplicate stations
  const allStations = useMemo(() => {
    const savedNames = new Set(savedStations.map(s => s.name.toLowerCase()));

    // Saved stations with full data
    const stationsFromDb = savedStations.map(s => ({
      name: s.name,
      location: s.location,
      price: s.price_per_litre,
      currency: s.currency || 'USD',
      isSaved: true,
    }));

    // Historical stations that aren't already saved
    const historicalOnly = historicalStations
      .filter(name => !savedNames.has(name.toLowerCase()))
      .map(name => ({
        name,
        location: undefined as string | undefined,
        price: undefined as number | undefined,
        currency: 'USD',
        isSaved: false,
      }));

    return [...stationsFromDb, ...historicalOnly].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [savedStations, historicalStations]);

  // Filter stations based on search query
  const filteredStations = useMemo(() => {
    if (!searchQuery) return allStations;
    const query = searchQuery.toLowerCase();
    return allStations.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.location?.toLowerCase().includes(query)
    );
  }, [allStations, searchQuery]);

  // Check if current search query matches any station exactly
  const exactMatch = allStations.some(
    s => s.name.toLowerCase() === searchQuery.toLowerCase()
  );

  // Handle selection
  const handleSelect = (stationName: string) => {
    onValueChange(stationName);
    setSearchQuery('');
    setOpen(false);

    // If station has a saved price, optionally notify parent
    if (onPriceChange) {
      const station = savedStations.find(s => s.name === stationName);
      if (station?.price_per_litre) {
        onPriceChange(station.price_per_litre, station.currency || 'USD');
      } else {
        onPriceChange(null, 'USD');
      }
    }
  };

  // Handle adding new station
  const handleAddStation = async () => {
    if (!newStationName.trim()) return;

    await addStationMutation.mutateAsync({
      name: newStationName.trim(),
      location: newStationLocation.trim() || undefined,
      price_per_litre: newStationPrice ? parseFloat(newStationPrice) : undefined,
      currency: newStationCurrency,
      is_active: true,
    });

    // Also set as current value
    onValueChange(newStationName.trim());

    // Notify parent of price if provided
    if (onPriceChange && newStationPrice) {
      onPriceChange(parseFloat(newStationPrice), newStationCurrency);
    }

    // Reset and close
    setNewStationName('');
    setNewStationLocation('');
    setNewStationPrice('');
    setNewStationCurrency('USD');
    setShowAddDialog(false);
  };

  // Open add dialog with search query as initial name
  const openAddDialog = () => {
    setNewStationName(searchQuery);
    setShowAddDialog(true);
    setOpen(false);
  };

  // Reset search when popover closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  const isLoading = isLoadingSaved || isLoadingHistorical;

  return (
    <>
      <div className="space-y-1">
        {/* Add hidden description for screen readers */}
        <span id={descriptionId} className="sr-only">
          Select a filling station from the list or type to search for a new one
        </span>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-describedby={error ? errorId : descriptionId}
              aria-invalid={error ? "true" : "false"}
              aria-controls={`${selectId}-listbox`}
              disabled={disabled || isLoading}
              className={cn(
                'w-full justify-between font-normal',
                !value && 'text-muted-foreground',
                error && 'border-destructive'
              )}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading stations...
                </span>
              ) : value ? (
                <span className="flex items-center gap-2 truncate">
                  <Fuel className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{value}</span>
                </span>
              ) : (
                <span>{placeholder}</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search or type station name..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                aria-controls={`${selectId}-listbox`}
              />
              <CommandList id={`${selectId}-listbox`} role="listbox">
                {/* Manual empty state since CommandEmpty doesn't work with shouldFilter={false} */}
                {filteredStations.length === 0 && (
                  <div className="py-6 text-center" role="status">
                    {searchQuery ? (
                      <div>
                        <p className="text-sm text-muted-foreground mb-3">
                          No station found for "{searchQuery}"
                        </p>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={openAddDialog}
                          className="gap-1"
                          aria-label={`Add "${searchQuery}" as new station`}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Add "{searchQuery}" as new station
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Start typing to search or add a station
                      </p>
                    )}
                  </div>
                )}

                {filteredStations.length > 0 && (
                  <CommandGroup heading="Filling Stations">
                    {filteredStations.map((station) => (
                      <CommandItem
                        key={station.name}
                        value={station.name}
                        onSelect={() => handleSelect(station.name)}
                        className="flex items-center justify-between"
                        role="option"
                        aria-selected={value === station.name}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Check
                            className={cn(
                              'h-4 w-4 shrink-0',
                              value === station.name ? 'opacity-100' : 'opacity-0'
                            )}
                            aria-hidden="true"
                          />
                          <Fuel className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <div className="min-w-0">
                            <span className="truncate block">{station.name}</span>
                            {station.location && (
                              <span className="text-xs text-muted-foreground truncate block">
                                {station.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {station.price && (
                            <span className="text-xs text-muted-foreground">
                              {station.currency === 'USD' ? '$' : 'R'}{station.price.toFixed(2)}/L
                            </span>
                          )}
                          {station.isSaved && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Saved
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {searchQuery && !exactMatch && filteredStations.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={openAddDialog} className="gap-2">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span>Add "{searchQuery}" as new station</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}

                {/* Always show Add New Station option */}
                <CommandSeparator />
                <div className="p-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={openAddDialog}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add New Filling Station
                  </Button>
                </div>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {error && (
          <p id={errorId} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Add Station Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Filling Station</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stationName">Station Name *</Label>
              <Input
                id="stationName"
                label=""
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                placeholder="e.g., Engen Midrand"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stationLocation">Location (optional)</Label>
              <Input
                id="stationLocation"
                label=""
                value={newStationLocation}
                onChange={(e) => setNewStationLocation(e.target.value)}
                placeholder="e.g., N1 Highway, Midrand"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stationPrice">Price per Litre (optional)</Label>
                <Input
                  id="stationPrice"
                  label=""
                  type="number"
                  step="0.01"
                  value={newStationPrice}
                  onChange={(e) => setNewStationPrice(e.target.value)}
                  placeholder="20.50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stationCurrency">Currency</Label>
                <select
                  id="stationCurrency"
                  value={newStationCurrency}
                  onChange={(e) => setNewStationCurrency(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  aria-label="Select currency for station price"
                >
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddStation}
              disabled={!newStationName.trim() || addStationMutation.isPending}
            >
              {addStationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Add Station
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FuelStationSelect;