
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Trip } from '@/types/operations';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Link,
  Plus,
  Save,
  Search,
  Truck,
  Unlink,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../ui/button-variants';
import { Select } from '../ui/form-elements';
import Modal from '../ui/modal';

// Type definitions
interface DieselRecord {
  id: string;
  fleet_number: string;
  date: string;
  litres_filled: number;
  total_cost: number;
  fuel_station: string;
  driver_name?: string;
  km_reading?: number;
  trip_id?: string;
  linked_trip_ids?: string[];
  currency?: string;
  notes?: string;
  cost_entry_ids?: string[];
}

interface TripLinkageModalProps {
  isOpen: boolean;
  onClose: () => void;
  dieselRecord: DieselRecord | null;
  trips: Trip[];
  onLinkToTrip: (dieselRecord: DieselRecord, tripId: string) => Promise<void>;
  onUnlinkFromTrip: (dieselRecordId: string, tripId?: string) => Promise<void>;
  previousRefillDate?: string | null;
  vehicleId?: string | null;
}

const TripLinkageModal = ({
  isOpen,
  onClose,
  dieselRecord,
  trips,
  onLinkToTrip,
  onUnlinkFromTrip,
  previousRefillDate,
  vehicleId,
}: TripLinkageModalProps) => {
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedTripId('');
      setSearchQuery('');
      setErrors({});
      setOperationError(null);
      setOperationSuccess(null);
      setShowSearch(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (operationSuccess) {
      const timer = setTimeout(() => {
        setOperationSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [operationSuccess]);

  // Get all trip IDs linked to this diesel record
  const linkedTripIds = useMemo(() => {
    if (!dieselRecord) return [];
    const ids: string[] = [];
    if (dieselRecord.linked_trip_ids && dieselRecord.linked_trip_ids.length > 0) {
      ids.push(...dieselRecord.linked_trip_ids);
    } else if (dieselRecord.trip_id) {
      ids.push(dieselRecord.trip_id);
    }
    return [...new Set(ids)];
  }, [dieselRecord]);

  // Get trip objects for all linked trips
  const linkedTrips = useMemo(() => {
    return linkedTripIds
      .map(id => trips.find(t => t.id === id))
      .filter((t): t is Trip => !!t);
  }, [linkedTripIds, trips]);

  // Trips available for linking — uses arrival/completion dates for completed trips
  const availableTrips = useMemo(() => {
    if (!dieselRecord) return [];
    const currentDate = new Date(dieselRecord.date).getTime();
    const refillDate = previousRefillDate ? new Date(previousRefillDate).getTime() : null;

    return trips
      .filter(trip => {
        // Exclude already-linked trips
        if (linkedTripIds.includes(trip.id)) return false;

        // Allow active AND completed trips
        if (trip.status !== 'active' && trip.status !== 'completed') return false;

        // Filter by vehicle using fleet_vehicle_id
        if (vehicleId && trip.fleet_vehicle_id !== vehicleId) return false;

        // For completed trips: use arrival_date or completed_at as the offloading date
        if (trip.status === 'completed') {
          const offloadDate = new Date(
            trip.arrival_date || trip.completed_at || trip.departure_date || trip.created_at!
          ).getTime();
          if (offloadDate > currentDate) return false;
          if (refillDate && offloadDate < refillDate) return false;
        }

        // For active trips: driver is still on the road, allow linking if departure is before fill date
        if (trip.status === 'active') {
          const tripStart = new Date(trip.departure_date || trip.created_at!).getTime();
          if (tripStart > currentDate) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.arrival_date || a.departure_date || a.created_at!).getTime();
        const dateB = new Date(b.arrival_date || b.departure_date || b.created_at!).getTime();
        return dateB - dateA;
      });
  }, [trips, dieselRecord, previousRefillDate, vehicleId, linkedTripIds]);

  // Search results: search across ALL trips by trip_number (ad-hoc linking)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !dieselRecord) return [];
    const q = searchQuery.trim().toLowerCase();
    return trips
      .filter(trip => {
        if (linkedTripIds.includes(trip.id)) return false;
        if (trip.status !== 'active' && trip.status !== 'completed') return false;
        return (
          trip.trip_number?.toLowerCase().includes(q) ||
          trip.route?.toLowerCase().includes(q) ||
          trip.client_name?.toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [searchQuery, trips, linkedTripIds, dieselRecord]);

  const selectedTrip = useMemo(() => {
    if (!selectedTripId) return undefined;
    return trips.find(t => t.id === selectedTripId);
  }, [selectedTripId, trips]);

  const handleLinkTrip = useCallback(async (tripId: string) => {
    if (!dieselRecord) {
      setErrors({ general: 'No diesel record selected' });
      return;
    }

    setIsProcessing(true);
    setOperationError(null);

    try {
      await onLinkToTrip(dieselRecord, tripId);
      const trip = trips.find(t => t.id === tripId);
      setOperationSuccess(`Successfully linked to trip ${trip?.trip_number} with automatic cost entries`);
      setSelectedTripId('');
      setSearchQuery('');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to link diesel record');
    } finally {
      setIsProcessing(false);
    }
  }, [dieselRecord, trips, onLinkToTrip]);

  const handleSave = useCallback(async () => {
    if (!selectedTripId) {
      setErrors({ tripId: 'Please select a trip' });
      return;
    }
    await handleLinkTrip(selectedTripId);
  }, [selectedTripId, handleLinkTrip]);

  const handleRemoveLinkage = useCallback(async (tripId: string) => {
    if (!dieselRecord) return;

    if (!window.confirm('Remove this trip link from the diesel record? Associated cost entries will be deleted.')) {
      return;
    }

    setIsProcessing(true);
    setOperationError(null);

    try {
      await onUnlinkFromTrip(dieselRecord.id, tripId);
      setOperationSuccess('Successfully unlinked trip from diesel record');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to unlink diesel record');
    } finally {
      setIsProcessing(false);
    }
  }, [dieselRecord, onUnlinkFromTrip]);

  if (!dieselRecord) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link Diesel Record to Trip(s)" maxWidth="xl">
      <div className="space-y-6">
        {operationSuccess && (
          <div className="bg-success/10 border border-success rounded-md p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-success" />
              <p className="text-sm font-medium text-success">{operationSuccess}</p>
            </div>
          </div>
        )}

        {operationError && (
          <div className="bg-destructive/10 border border-destructive rounded-md p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">{operationError}</p>
            </div>
          </div>
        )}

        {/* Diesel Record Details */}
        <div className="bg-info/10 border border-info rounded-md p-4">
          <h3 className="text-sm font-medium text-info-foreground mb-3 flex items-center">
            <Truck className="w-4 h-4 mr-2" />
            Diesel Record Details
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p><strong>Fleet:</strong> {dieselRecord.fleet_number}</p>
              <p><strong>Driver:</strong> {dieselRecord.driver_name}</p>
              <p><strong>Date:</strong> {formatDate(dieselRecord.date)}</p>
            </div>
            <div className="space-y-1">
              <p><strong>Litres:</strong> {dieselRecord.litres_filled.toFixed(1)}L</p>
              <p><strong>Cost:</strong> {formatCurrency(dieselRecord.total_cost, (dieselRecord.currency || 'ZAR') as 'ZAR' | 'USD')}</p>
              <p><strong>Station:</strong> {dieselRecord.fuel_station}</p>
            </div>
          </div>
        </div>

        {/* Currently Linked Trips */}
        {linkedTrips.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center">
              <Link className="w-4 h-4 mr-2" />
              Linked Trips ({linkedTrips.length})
            </h4>
            {linkedTrips.map(trip => (
              <div key={trip.id} className="bg-accent/10 border border-accent rounded-md p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm space-y-1">
                      <p><strong>Trip/POD Ref:</strong> {trip.trip_number}</p>
                      <p><strong>Route:</strong> {trip.route || 'N/A'}</p>
                      <p><strong>Client:</strong> {trip.client_name}</p>
                      <p><strong>Status:</strong> <span className={trip.status === 'active' ? 'text-blue-600 font-medium' : 'text-green-600 font-medium'}>{trip.status}</span></p>
                      {trip.arrival_date && <p><strong>Arrival:</strong> {formatDate(trip.arrival_date)}</p>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveLinkage(trip.id)}
                    disabled={isProcessing}
                    icon={<Unlink className="w-4 h-4" />}
                  >
                    {isProcessing ? 'Unlinking...' : 'Unlink'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Trip Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              {linkedTrips.length > 0 ? 'Link Another Trip' : 'Link to Trip'}
            </h4>
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
              disabled={isProcessing}
            >
              <Search className="w-3 h-3" />
              {showSearch ? 'Show filtered list' : 'Search by reference'}
            </button>
          </div>

          {showSearch ? (
            /* Search by trip reference number */
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by trip number, route, or client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isProcessing}
                />
              </div>

              {searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No matching trips found for &ldquo;{searchQuery}&rdquo;
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-2">
                  {searchResults.map(trip => (
                    <div
                      key={trip.id}
                      className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-sm space-y-0.5 flex-1">
                        <p className="font-medium">{trip.trip_number} {trip.route ? `— ${trip.route}` : ''}</p>
                        <p className="text-muted-foreground">
                          {trip.client_name} • {trip.driver_name || 'No driver'} •{' '}
                          <span className={trip.status === 'active' ? 'text-blue-600' : 'text-green-600'}>
                            {trip.status}
                          </span>
                        </p>
                        {trip.arrival_date && <p className="text-xs text-muted-foreground">Arrival: {formatDate(trip.arrival_date)}</p>}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleLinkTrip(trip.id)}
                        disabled={isProcessing}
                        icon={<Link className="w-3.5 h-3.5" />}
                      >
                        Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Filtered drop-down list */
            <>
              {availableTrips.length > 0 ? (
                <div className="space-y-4">
                  <Select
                    label="Select Trip to Link"
                    value={selectedTripId}
                    onChange={(e) => {
                      setSelectedTripId(e.target.value);
                      setErrors({});
                    }}
                    options={[
                      { label: 'Select a trip...', value: '' },
                      ...availableTrips.map(trip => ({
                        label: `${trip.trip_number}${trip.route ? ` — ${trip.route}` : ''} [${trip.status}]`,
                        value: trip.id
                      }))
                    ]}
                    error={errors.tripId}
                    disabled={isProcessing}
                  />

                  {selectedTrip && (
                    <div className="bg-success/10 border border-success rounded-md p-4">
                      <h4 className="text-sm font-medium mb-3 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Selected Trip Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <p><strong>Trip/POD Ref:</strong> {selectedTrip.trip_number}</p>
                          <p><strong>Route:</strong> {selectedTrip.route || 'N/A'}</p>
                          <p><strong>Client:</strong> {selectedTrip.client_name}</p>
                        </div>
                        <div className="space-y-2">
                          <p><strong>Driver:</strong> {selectedTrip.driver_name}</p>
                          <p><strong>Distance:</strong> {selectedTrip.distance_km}km</p>
                          <p><strong>Status:</strong> <span className={selectedTrip.status === 'active' ? 'text-blue-600 font-medium' : 'text-green-600 font-medium'}>{selectedTrip.status}</span></p>
                          {selectedTrip.arrival_date && <p><strong>Arrival:</strong> {formatDate(selectedTrip.arrival_date)}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-info/10 border border-info rounded-md p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-info mt-0.5" />
                      <p className="text-sm">
                        When you link this diesel record to a trip, a cost entry of {formatCurrency(dieselRecord.total_cost, (dieselRecord.currency || 'ZAR') as 'ZAR' | 'USD')} will be automatically added to the trip&apos;s expenses.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-warning/10 border border-warning rounded-md p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium">No Matching Trips in Date Range</h4>
                      <p className="text-sm mt-1">
                        No active or completed trips found for this vehicle between {previousRefillDate ? formatDate(previousRefillDate) : 'the beginning'} and {formatDate(dieselRecord.date)}.
                        Use the <button type="button" onClick={() => setShowSearch(true)} className="text-primary underline">search feature</button> to find a specific trip by reference number.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            icon={<X className="w-4 h-4" />}
            disabled={isProcessing}
          >
            {linkedTrips.length > 0 ? 'Close' : 'Cancel'}
          </Button>
          {!showSearch && availableTrips.length > 0 && (
            <Button
              onClick={handleSave}
              icon={<Save className="w-4 h-4" />}
              disabled={!selectedTripId || isProcessing}
            >
              {isProcessing ? 'Linking...' : 'Link to Trip'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default TripLinkageModal;
