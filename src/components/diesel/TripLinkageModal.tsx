
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Trip } from '@/types/operations';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Link,
  Save,
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
  currency?: string;
  notes?: string;
}

interface TripLinkageModalProps {
  isOpen: boolean;
  onClose: () => void;
  dieselRecord: DieselRecord | null;
  trips: Trip[];
  onLinkToTrip: (dieselRecord: DieselRecord, tripId: string) => Promise<void>;
  onUnlinkFromTrip: (dieselRecordId: string) => Promise<void>;
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTripId('');
      setErrors({});
      setOperationError(null);
      setOperationSuccess(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (operationSuccess) {
      const timer = setTimeout(() => {
        setOperationSuccess(null);
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [operationSuccess, onClose]);

  const availableTrips = useMemo(() => {
    if (!dieselRecord) return [];
    const currentDate = new Date(dieselRecord.date).getTime();
    const refillDate = previousRefillDate ? new Date(previousRefillDate).getTime() : null;

    return trips
      .filter(trip => {
        if (trip.status !== 'active' && trip.status !== 'completed') return false;
        // Filter by vehicle using fleet_vehicle_id (references vehicles table, not wialon_vehicles)
        if (vehicleId && trip.fleet_vehicle_id !== vehicleId) return false;
        // Filter by date range: from previous refill date up to and including current transaction date
        const tripDate = new Date(trip.departure_date || trip.created_at!).getTime();
        if (tripDate > currentDate) return false;
        if (refillDate && tripDate < refillDate) return false;
        return true;
      })
      .sort((a, b) => new Date(b.departure_date || b.created_at!).getTime() - new Date(a.departure_date || a.created_at!).getTime());
  }, [trips, dieselRecord, previousRefillDate, vehicleId]);

  const currentLinkedTrip = useMemo(() => {
    if (!dieselRecord || !dieselRecord.trip_id) return undefined;
    return trips.find(t => t.id === dieselRecord.trip_id);
  }, [dieselRecord, trips]);

  const selectedTrip = useMemo(() => {
    if (!selectedTripId) return undefined;
    return trips.find(t => t.id === selectedTripId);
  }, [selectedTripId, trips]);

  const handleSave = useCallback(async () => {
    if (!dieselRecord) {
      setErrors({ general: 'No diesel record selected' });
      return;
    }

    if (!selectedTripId) {
      setErrors({ tripId: 'Please select a trip' });
      return;
    }

    setIsProcessing(true);
    setOperationError(null);

    try {
      await onLinkToTrip(dieselRecord, selectedTripId);
      const trip = trips.find(t => t.id === selectedTripId);
      setOperationSuccess(`Successfully linked to trip ${trip?.trip_number} with automatic cost entries`);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Failed to link diesel record');
    } finally {
      setIsProcessing(false);
    }
  }, [dieselRecord, selectedTripId, trips, onLinkToTrip]);

  const handleRemoveLinkage = useCallback(async () => {
    if (!dieselRecord || !dieselRecord.trip_id) return;

    if (!window.confirm('Remove this diesel record from the linked trip?')) {
      return;
    }

    setIsProcessing(true);
    setOperationError(null);

    try {
      await onUnlinkFromTrip(dieselRecord.id);
      setOperationSuccess('Successfully unlinked diesel record from trip');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Link Diesel Record to Trip" maxWidth="xl">
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

        {currentLinkedTrip && (
          <div className="bg-accent/10 border border-accent rounded-md p-4">
            <div className="flex items-start space-x-3">
              <Link className="w-5 h-5 text-accent mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium">Currently Linked to Trip</h4>
                <div className="text-sm mt-2 space-y-1">
                  <p><strong>Trip/POD Ref:</strong> {currentLinkedTrip.trip_number}</p>
                  <p><strong>Route:</strong> {currentLinkedTrip.route || 'N/A'}</p>
                  <p><strong>Client:</strong> {currentLinkedTrip.client_name}</p>
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRemoveLinkage}
                    disabled={isProcessing}
                    icon={<Unlink className="w-4 h-4" />}
                  >
                    {isProcessing ? 'Unlinking...' : 'Remove Linkage'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!currentLinkedTrip && (
          <>
            {availableTrips.length > 0 ? (
              <div className="space-y-4">
                <Select
                  label="Select Trip to Link *"
                  value={selectedTripId}
                  onChange={(e) => {
                    setSelectedTripId(e.target.value);
                    setErrors({});
                  }}
                  options={[
                    { label: 'Select a trip...', value: '' },
                    ...availableTrips.map(trip => ({
                      label: `${trip.trip_number}${trip.route ? ` — ${trip.route}` : ''}`,
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
                        <p><strong>Status:</strong> {selectedTrip.status}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-info/10 border border-info rounded-md p-4">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-info mt-0.5" />
                    <p className="text-sm">
                      When you link this diesel record to a trip, a cost entry of {formatCurrency(dieselRecord.total_cost, (dieselRecord.currency || 'ZAR') as 'ZAR' | 'USD')} will be automatically added to the trip's expenses.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-warning/10 border border-warning rounded-md p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">No Matching Trips Available</h4>
                    <p className="text-sm mt-1">
                      There are no active or completed trips for this vehicle in the applicable date range.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            icon={<X className="w-4 h-4" />}
            disabled={isProcessing}
          >
            {currentLinkedTrip ? 'Close' : 'Cancel'}
          </Button>
          {!currentLinkedTrip && availableTrips.length > 0 && (
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
