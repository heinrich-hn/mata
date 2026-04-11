import { formatCurrency, formatDate } from '@/lib/formatters';
import type { ReeferDieselRecordRow } from '@/hooks/useReeferDiesel';
import type { DieselConsumptionRecord } from '@/types/operations';
import { CheckCircle, Link, Snowflake, Truck, Unlink, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../ui/button-variants';
import { Select } from '../ui/form-elements';
import Modal from '../ui/modal';

interface ReeferVehicleLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    reeferRecord: ReeferDieselRecordRow | null;
    dieselRecords: DieselConsumptionRecord[];
    onLink: (reeferRecordId: string, dieselRecordId: string, fleetNumber: string) => Promise<void>;
    onUnlink: (reeferRecordId: string) => Promise<void>;
}

const ReeferVehicleLinkModal = ({
    isOpen,
    onClose,
    reeferRecord,
    dieselRecords,
    onLink,
    onUnlink,
}: ReeferVehicleLinkModalProps) => {
    const [selectedDieselId, setSelectedDieselId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [operationSuccess, setOperationSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedDieselId('');
            setOperationSuccess(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (operationSuccess) {
            const timer = setTimeout(() => {
                setOperationSuccess(null);
                onClose();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [operationSuccess, onClose]);

    // Get unique vehicles with diesel transactions on the same date
    const vehicleOptions = useMemo(() => {
        if (!reeferRecord) return [];
        return dieselRecords
            .filter(r => r.date === reeferRecord.date && r.fleet_number && !r.fleet_number.match(/^\d+F$/i))
            .map(r => ({
                dieselId: r.id,
                fleetNumber: r.fleet_number,
                driverName: r.driver_name,
                litres: r.litres_filled,
                cost: r.total_cost,
                currency: r.currency || 'USD',
                station: r.fuel_station,
            }));
    }, [reeferRecord, dieselRecords]);

    const currentLinkedDiesel = useMemo(() => {
        if (!reeferRecord?.linked_diesel_record_id) return null;
        const linked = dieselRecords.find(r => r.id === reeferRecord.linked_diesel_record_id);
        if (!linked) return null;
        return {
            fleetNumber: linked.fleet_number,
            driverName: linked.driver_name,
            station: linked.fuel_station,
        };
    }, [reeferRecord, dieselRecords]);

    const selectedOption = useMemo(() => {
        return vehicleOptions.find(v => v.dieselId === selectedDieselId);
    }, [selectedDieselId, vehicleOptions]);

    const handleLink = useCallback(async () => {
        if (!reeferRecord || !selectedDieselId) return;
        const option = vehicleOptions.find(v => v.dieselId === selectedDieselId);
        if (!option) return;
        setIsProcessing(true);
        try {
            await onLink(reeferRecord.id, selectedDieselId, option.fleetNumber);
            setOperationSuccess(`Linked to ${option.fleetNumber}`);
        } catch {
            // Error handling done by parent
        } finally {
            setIsProcessing(false);
        }
    }, [reeferRecord, selectedDieselId, vehicleOptions, onLink]);

    const handleUnlink = useCallback(async () => {
        if (!reeferRecord) return;
        setIsProcessing(true);
        try {
            await onUnlink(reeferRecord.id);
            setOperationSuccess('Unlinked from vehicle');
        } catch {
            // Error handling done by parent
        } finally {
            setIsProcessing(false);
        }
    }, [reeferRecord, onUnlink]);

    if (!reeferRecord) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link Reefer to Vehicle" maxWidth="lg">
            <div className="space-y-5">
                {operationSuccess && (
                    <div className="bg-success/10 border border-success rounded-md p-3">
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-success" />
                            <p className="text-sm font-medium text-success">{operationSuccess}</p>
                        </div>
                    </div>
                )}

                <div className="bg-info/10 border border-info rounded-md p-4">
                    <h3 className="text-sm font-medium text-info-foreground mb-2 flex items-center">
                        <Snowflake className="w-4 h-4 mr-2" />
                        Reefer Record
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <p><strong>Unit:</strong> {reeferRecord.reefer_unit}</p>
                        <p><strong>Date:</strong> {formatDate(reeferRecord.date)}</p>
                        <p><strong>Litres:</strong> {reeferRecord.litres_filled.toFixed(1)}L</p>
                        <p><strong>Cost:</strong> {formatCurrency(reeferRecord.total_cost, (reeferRecord.currency || 'USD') as string)}</p>
                    </div>
                </div>

                {currentLinkedDiesel && (
                    <div className="bg-accent/10 border border-accent rounded-md p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="text-sm font-medium flex items-center">
                                    <Link className="w-4 h-4 mr-2" />
                                    Currently Linked to Vehicle
                                </h4>
                                <div className="text-sm mt-2 space-y-1">
                                    <p><strong>Vehicle:</strong> {currentLinkedDiesel.fleetNumber}</p>
                                    <p><strong>Driver:</strong> {currentLinkedDiesel.driverName || 'N/A'}</p>
                                    <p><strong>Station:</strong> {currentLinkedDiesel.station}</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleUnlink}
                                disabled={isProcessing}
                                icon={<Unlink className="w-4 h-4" />}
                            >
                                {isProcessing ? 'Unlinking...' : 'Unlink'}
                            </Button>
                        </div>
                    </div>
                )}

                {!currentLinkedDiesel && (
                    <>
                        {vehicleOptions.length > 0 ? (
                            <div className="space-y-4">
                                <Select
                                    label="Select Vehicle (same date transactions) *"
                                    value={selectedDieselId}
                                    onChange={(e) => setSelectedDieselId(e.target.value)}
                                    options={[
                                        { label: 'Select a vehicle...', value: '' },
                                        ...vehicleOptions.map(v => ({
                                            label: `${v.fleetNumber} — ${v.driverName || 'No driver'} (${v.litres.toFixed(0)}L)`,
                                            value: v.dieselId,
                                        })),
                                    ]}
                                    disabled={isProcessing}
                                />

                                {selectedOption && (
                                    <div className="bg-muted/40 border rounded-md p-3 text-sm space-y-1">
                                        <div className="flex items-center gap-2 font-medium">
                                            <Truck className="w-4 h-4" />
                                            {selectedOption.fleetNumber}
                                        </div>
                                        <p><strong>Driver:</strong> {selectedOption.driverName || 'N/A'}</p>
                                        <p><strong>Station:</strong> {selectedOption.station}</p>
                                        <p><strong>Horse Fill:</strong> {selectedOption.litres.toFixed(1)}L — {formatCurrency(selectedOption.cost, selectedOption.currency as string)}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-warning/10 border border-warning rounded-md p-4 text-sm">
                                <p className="font-medium">No vehicle transactions found</p>
                                <p className="mt-1 text-muted-foreground">
                                    No truck diesel records exist for {formatDate(reeferRecord.date)}.
                                </p>
                            </div>
                        )}
                    </>
                )}

                <div className="flex justify-end space-x-3 pt-3 border-t">
                    <Button variant="outline" onClick={onClose} icon={<X className="w-4 h-4" />} disabled={isProcessing}>
                        {currentLinkedDiesel ? 'Close' : 'Cancel'}
                    </Button>
                    {!currentLinkedDiesel && vehicleOptions.length > 0 && (
                        <Button
                            onClick={handleLink}
                            icon={<Truck className="w-4 h-4" />}
                            disabled={!selectedDieselId || isProcessing}
                        >
                            {isProcessing ? 'Linking...' : 'Link to Vehicle'}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ReeferVehicleLinkModal;
