/* eslint-disable @typescript-eslint/no-explicit-any */
// driver_leave & driver_day_status tables are not yet in generated Supabase types — `as any` casts required until types are regenerated
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDrivers } from '@/hooks/useDrivers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
} from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Location options for At Work (non-trip) days */
export const AT_WORK_LOCATIONS = [
    'Mutare',
    'JHB',
    'CPT',
    'Harare',
    'Bulawayo',
    'Burma Valley',
    'CBC',
    'Nyamagaya',
    'Workshop',
    'BB Border',
    'Botswana Border',
    'Zambia Border',
    'Client',
    'Waiting to load',
    'Waiting to offload',
    'In Transit',
] as const;

export type AtWorkLocation = (typeof AT_WORK_LOCATIONS)[number];

export interface DriverLeave {
    id: string;
    driver_name: string;
    start_date: string;
    end_date: string;
    leave_type: 'annual' | 'sick' | 'family' | 'unpaid' | 'other';
    status: 'planned' | 'approved' | 'rejected';
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
    created_by: string | null;
}

export type DriverLeaveInsert = Omit<DriverLeave, 'id' | 'created_at' | 'updated_at'>;

/** Manual day statuses the user can assign. 'off' means no row in DB. 'off_day' = unapplied off day (light purple). */
export type DayStatus = 'at_work' | 'on_trip' | 'leave' | 'off' | 'off_day';

export interface TripInfo {
    trip_number: string | null;
    vehicle_id: string | null;
    origin: string | null;
    destination: string | null;
    departure_date: string | null;
    arrival_date: string | null;
    status: string | null;
}

export interface DriverPlanningData {
    driverName: string;
    /** Computed day statuses (manual + auto-derived) */
    dayStatuses: Record<string, DayStatus>;
    /** Read-only: trip name/number for days with trip coverage */
    tripDays: Record<string, string>;
    /** Notes/location for manually marked at_work days */
    dayNotes: Record<string, string>;
    daysAtWork: number;
    daysOnTrip: number;
    daysOnLeave: number;
    daysOff: number;
    daysOffDay: number;
    maxConsecutiveWorkingDays: number;
    currentStreak: number;
    isOverworked: boolean;
    trips: TripInfo[];
    leaveEntries: DriverLeave[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OVERWORK_CONSECUTIVE_THRESHOLD = 26;
const OVERWORK_MONTHLY_THRESHOLD = 26;

function parseDateLocal(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function isWorkingStatus(status: DayStatus): boolean {
    return status === 'at_work' || status === 'on_trip';
}

/**
 * Compute consecutive working days, excluding days where the driver was
 * specifically at Mutare (those don't count towards overwork alerts).
 * Streaks reset on leave, off, off_day, and Mutare days.
 */
function computeConsecutiveWorkingDays(
    dayStatuses: Record<string, DayStatus>,
    dayNotes: Record<string, string>,
    daysInMonth: Date[]
): { maxStreak: number; currentStreak: number } {
    let maxStreak = 0;
    let currentStreak = 0;

    for (const day of daysInMonth) {
        const key = format(day, 'yyyy-MM-dd');
        const status = dayStatuses[key] || 'off';
        const isMutare = dayNotes[key] === 'Mutare';
        if (isWorkingStatus(status) && !isMutare) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    }

    return { maxStreak, currentStreak };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useDriverPlanning = (selectedMonth: Date) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { activeDrivers, isLoading: isLoadingDrivers, getDriverFullName } = useDrivers();

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const monthStartStr = format(monthStart, 'yyyy-MM-dd');
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    // Fetch manual day statuses for the selected month
    const { data: dayStatusRows = [], isLoading: isLoadingStatuses } = useQuery({
        queryKey: ['driver-day-status', year, month],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('driver_day_status' as any)
                .select('driver_name, date, status, notes')
                .gte('date', monthStartStr)
                .lte('date', monthEndStr);

            if (error) throw error;
            return (data || []) as unknown as { driver_name: string; date: string; status: string; notes: string | null }[];
        },
    });

    // Fetch trips for the selected month (read-only reference)
    const { data: trips = [], isLoading: isLoadingTrips } = useQuery({
        queryKey: ['driver-planning-trips', year, month],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('trips')
                .select('driver_name, vehicle_id, departure_date, arrival_date, actual_departure_date, actual_arrival_date, status, trip_number, origin, destination')
                .not('driver_name', 'is', null)
                .not('status', 'eq', 'cancelled')
                .lte('departure_date', monthEndStr)
                .gte('arrival_date', monthStartStr);

            if (error) throw error;
            return data || [];
        },
    });

    // Fetch leave entries for the selected month
    const { data: leaveEntries = [], isLoading: isLoadingLeave } = useQuery({
        queryKey: ['driver-leave', year, month],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('driver_leave' as any)
                .select('*')
                .lte('start_date', monthEndStr)
                .gte('end_date', monthStartStr)
                .neq('status', 'rejected');

            if (error) throw error;
            return (data || []) as unknown as DriverLeave[];
        },
    });

    // Compute planning data per driver
    const planningData = useMemo((): DriverPlanningData[] => {
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

        // Build manual day statuses per driver
        const driverManualStatuses = new Map<string, Record<string, DayStatus>>();
        const driverManualNotes = new Map<string, Record<string, string>>();
        for (const row of dayStatusRows) {
            if (!driverManualStatuses.has(row.driver_name)) {
                driverManualStatuses.set(row.driver_name, {});
                driverManualNotes.set(row.driver_name, {});
            }
            driverManualStatuses.get(row.driver_name)![row.date] = row.status as DayStatus;
            if (row.notes) {
                driverManualNotes.get(row.driver_name)![row.date] = row.notes;
            }
        }

        // Build trip reference days per driver — store trip name/number
        const driverTripDays = new Map<string, Record<string, string>>();
        const driverTrips = new Map<string, TripInfo[]>();

        for (const trip of trips) {
            const driverName = trip.driver_name;
            if (!driverName) continue;

            const depDate = trip.actual_departure_date || trip.departure_date;
            const arrDate = trip.actual_arrival_date || trip.arrival_date;
            if (!depDate) continue;

            const tripStart = parseDateLocal(depDate);
            const tripEnd = arrDate ? parseDateLocal(arrDate) : tripStart;

            const clampedStart = tripStart < monthStart ? monthStart : tripStart;
            const clampedEnd = tripEnd > monthEnd ? monthEnd : tripEnd;
            if (clampedStart > clampedEnd) continue;

            if (!driverTripDays.has(driverName)) {
                driverTripDays.set(driverName, {});
            }
            const tripDayMap = driverTripDays.get(driverName)!;

            const tripLabel = trip.trip_number || `${trip.origin || '?'} → ${trip.destination || '?'}`;
            const tripDays = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
            for (const d of tripDays) {
                const dk = format(d, 'yyyy-MM-dd');
                // If multiple trips on same day, join names
                tripDayMap[dk] = tripDayMap[dk] ? `${tripDayMap[dk]}, ${tripLabel}` : tripLabel;
            }

            if (!driverTrips.has(driverName)) {
                driverTrips.set(driverName, []);
            }
            driverTrips.get(driverName)!.push({
                trip_number: trip.trip_number,
                vehicle_id: trip.vehicle_id,
                origin: trip.origin,
                destination: trip.destination,
                departure_date: depDate,
                arrival_date: arrDate,
                status: trip.status,
            });
        }

        // Build leave day coverage per driver (approved/planned leave auto-fills days)
        const driverLeaveDays = new Map<string, Record<string, boolean>>();
        const driverLeaveEntries = new Map<string, DriverLeave[]>();
        for (const leave of leaveEntries) {
            if (!driverLeaveEntries.has(leave.driver_name)) {
                driverLeaveEntries.set(leave.driver_name, []);
            }
            driverLeaveEntries.get(leave.driver_name)!.push(leave);

            // Expand leave date range into per-day coverage
            const leaveStart = parseDateLocal(leave.start_date);
            const leaveEnd = parseDateLocal(leave.end_date);
            const clampedStart = leaveStart < monthStart ? monthStart : leaveStart;
            const clampedEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;
            if (clampedStart > clampedEnd) continue;

            if (!driverLeaveDays.has(leave.driver_name)) {
                driverLeaveDays.set(leave.driver_name, {});
            }
            const leaveDayMap = driverLeaveDays.get(leave.driver_name)!;
            const days = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
            for (const d of days) {
                leaveDayMap[format(d, 'yyyy-MM-dd')] = true;
            }
        }

        // Only show active drivers in the planner grid
        const activeDriverNames = new Set<string>();
        for (const driver of activeDrivers) {
            activeDriverNames.add(getDriverFullName(driver));
        }

        // Compute data for each active driver
        const result: DriverPlanningData[] = [];

        for (const driverName of Array.from(activeDriverNames).sort()) {
            const manualStatuses = driverManualStatuses.get(driverName) || {};
            const tripDayMap = driverTripDays.get(driverName) || {};
            const leaveDayMap = driverLeaveDays.get(driverName) || {};
            const notesMap = driverManualNotes.get(driverName) || {};

            const dayStatuses: Record<string, DayStatus> = {};
            const dayNotes: Record<string, string> = {};
            let daysAtWork = 0;
            let daysOnTrip = 0;
            let daysOnLeave = 0;
            let daysOff = 0;
            let daysOffDay = 0;

            const todayStr = format(new Date(), 'yyyy-MM-dd');

            for (const day of daysInMonth) {
                const key = format(day, 'yyyy-MM-dd');
                // Priority: leave (auto) > off_day (manual) > at_work (trip days count as at_work, manual at_work) > off
                // Being on a trip counts as working — tripDays map kept for visual indicator
                let status: DayStatus;
                if (leaveDayMap[key]) {
                    status = 'leave';
                } else if (manualStatuses[key] === 'off_day') {
                    status = 'off_day';
                } else if (tripDayMap[key] || manualStatuses[key] === 'at_work') {
                    status = 'at_work';
                } else {
                    status = 'off';
                }
                dayStatuses[key] = status;

                if (notesMap[key]) dayNotes[key] = notesMap[key];

                if (tripDayMap[key]) daysOnTrip++; // reference count: days with trips
                if (status === 'at_work') daysAtWork++;
                else if (status === 'leave') daysOnLeave++;
                else if (status === 'off_day') daysOffDay++;
                else if (key <= todayStr) daysOff++;
                // future dates with 'off' status: don't count in daysOff
            }

            const { maxStreak, currentStreak } = computeConsecutiveWorkingDays(dayStatuses, dayNotes, daysInMonth);

            // Fatigue calculation excludes Mutare days — Mutare is treated as a
            // depot/home location that does not contribute to overwork risk.
            const fatigueWorkDays = Object.entries(dayStatuses).reduce((count, [key, status]) => {
                if (status !== 'at_work') return count;
                if (dayNotes[key] === 'Mutare') return count;
                return count + 1;
            }, 0);
            const isOverworked = maxStreak >= OVERWORK_CONSECUTIVE_THRESHOLD || fatigueWorkDays >= OVERWORK_MONTHLY_THRESHOLD;

            result.push({
                driverName,
                dayStatuses,
                tripDays: tripDayMap,
                dayNotes,
                daysAtWork,
                daysOnTrip,
                daysOnLeave,
                daysOff,
                daysOffDay,
                maxConsecutiveWorkingDays: maxStreak,
                currentStreak,
                isOverworked,
                trips: driverTrips.get(driverName) || [],
                leaveEntries: driverLeaveEntries.get(driverName) || [],
            });
        }

        return result;
    }, [dayStatusRows, trips, leaveEntries, activeDrivers, monthStart, monthEnd, getDriverFullName]);

    // ─── Mutations: Manual day status ────────────────────────────────────────

    const setDayStatusMutation = useMutation({
        mutationFn: async ({ driverName, date, status, notes }: { driverName: string; date: string; status?: DayStatus; notes?: string }) => {
            const { error } = await supabase
                .from('driver_day_status' as any)
                .upsert(
                    { driver_name: driverName, date, status: status || 'at_work', notes: notes || null } as any,
                    { onConflict: 'driver_name,date' }
                );

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driver-day-status'] });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const clearDayStatusMutation = useMutation({
        mutationFn: async ({ driverName, date }: { driverName: string; date: string }) => {
            const { error } = await supabase
                .from('driver_day_status' as any)
                .delete()
                .eq('driver_name', driverName)
                .eq('date', date);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driver-day-status'] });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    // ─── Mutations: Leave CRUD ───────────────────────────────────────────────

    const createLeaveMutation = useMutation({
        mutationFn: async (leave: DriverLeaveInsert) => {
            const { data, error } = await supabase
                .from('driver_leave' as any)
                .insert([leave as any])
                .select()
                .single();

            if (error) throw error;
            return data as unknown as DriverLeave;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driver-leave'] });
            toast({ title: 'Leave Added', description: 'Driver leave entry has been recorded.' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const updateLeaveMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<DriverLeaveInsert> }) => {
            const { data, error } = await supabase
                .from('driver_leave' as any)
                .update(updates as any)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as unknown as DriverLeave;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driver-leave'] });
            toast({ title: 'Leave Updated', description: 'Driver leave entry has been updated.' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const deleteLeaveMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('driver_leave' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driver-leave'] });
            toast({ title: 'Leave Deleted', description: 'Driver leave entry has been removed.' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    return {
        planningData,
        isLoading: isLoadingDrivers || isLoadingStatuses || isLoadingTrips || isLoadingLeave,
        activeDrivers,
        getDriverFullName,
        setDayStatus: setDayStatusMutation.mutateAsync as (data: { driverName: string; date: string; status?: DayStatus; notes?: string }) => Promise<void>,
        clearDayStatus: clearDayStatusMutation.mutateAsync,
        createLeave: createLeaveMutation.mutateAsync,
        updateLeave: updateLeaveMutation.mutateAsync,
        deleteLeave: deleteLeaveMutation.mutateAsync,
        isCreatingLeave: createLeaveMutation.isPending,
        isUpdatingLeave: updateLeaveMutation.isPending,
        isDeletingLeave: deleteLeaveMutation.isPending,
    };
};
