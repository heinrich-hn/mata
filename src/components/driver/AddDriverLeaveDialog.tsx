import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import type { Driver } from '@/hooks/useDrivers';
import type { DriverLeave, DriverLeaveInsert } from '@/hooks/useDriverPlanning';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AddDriverLeaveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    drivers: Driver[];
    getDriverFullName: (driver: Driver) => string;
    onSubmit: (leave: DriverLeaveInsert) => Promise<unknown>;
    onUpdate?: (data: { id: string; updates: Partial<DriverLeaveInsert> }) => Promise<unknown>;
    isSubmitting: boolean;
    editingLeave?: DriverLeave | null;
    preselectedDriver?: string;
}

const LEAVE_TYPES = [
    { value: 'annual', label: 'Annual Leave' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'family', label: 'Family Responsibility' },
    { value: 'unpaid', label: 'Unpaid Leave' },
    { value: 'other', label: 'Other' },
] as const;

const LEAVE_STATUSES = [
    { value: 'planned', label: 'Planned' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
] as const;

export default function AddDriverLeaveDialog({
    open,
    onOpenChange,
    drivers,
    getDriverFullName,
    onSubmit,
    onUpdate,
    isSubmitting,
    editingLeave,
    preselectedDriver,
}: AddDriverLeaveDialogProps) {
    const [driverName, setDriverName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [leaveType, setLeaveType] = useState<string>('annual');
    const [status, setStatus] = useState<string>('approved');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (editingLeave) {
            setDriverName(editingLeave.driver_name);
            setStartDate(editingLeave.start_date);
            setEndDate(editingLeave.end_date);
            setLeaveType(editingLeave.leave_type);
            setStatus(editingLeave.status);
            setNotes(editingLeave.notes || '');
        } else {
            setDriverName(preselectedDriver || '');
            setStartDate('');
            setEndDate('');
            setLeaveType('annual');
            setStatus('approved');
            setNotes('');
        }
    }, [editingLeave, open, preselectedDriver]);

    const handleSubmit = async () => {
        if (!driverName || !startDate || !endDate) return;

        const leaveData: DriverLeaveInsert = {
            driver_name: driverName,
            start_date: startDate,
            end_date: endDate,
            leave_type: leaveType as DriverLeaveInsert['leave_type'],
            status: status as DriverLeaveInsert['status'],
            notes: notes || null,
            created_by: null,
        };

        if (editingLeave && onUpdate) {
            await onUpdate({ id: editingLeave.id, updates: leaveData });
        } else {
            await onSubmit(leaveData);
        }
        onOpenChange(false);
    };

    const isValid = driverName && startDate && endDate && endDate >= startDate;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingLeave ? 'Edit Leave Entry' : 'Add Driver Leave'}</DialogTitle>
                    <DialogDescription>
                        {editingLeave ? 'Update the leave details' : 'Record a leave or time-off entry for a driver'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Driver *</Label>
                        <Select value={driverName} onValueChange={setDriverName}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select driver" />
                            </SelectTrigger>
                            <SelectContent>
                                {drivers.map((driver) => {
                                    const fullName = getDriverFullName(driver);
                                    return (
                                        <SelectItem key={driver.id} value={fullName}>
                                            {fullName}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date *</Label>
                            <DatePicker
                                value={startDate || undefined}
                                onChange={(date) => setStartDate(date ? date.toISOString().split('T')[0] : '')}
                                placeholder="Start date"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date *</Label>
                            <DatePicker
                                value={endDate || undefined}
                                onChange={(date) => setEndDate(date ? date.toISOString().split('T')[0] : '')}
                                placeholder="End date"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Leave Type</Label>
                            <Select value={leaveType} onValueChange={setLeaveType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LEAVE_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LEAVE_STATUSES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes about the leave..."
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !isValid}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingLeave ? 'Update Leave' : 'Add Leave'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
