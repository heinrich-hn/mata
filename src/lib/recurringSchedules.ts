/**
 * Recurring Schedule Utilities
 * Functions for managing recurring load schedules and auto-generation
 */

import { supabase } from '@/integrations/supabase/client';
import { DESTINATION_LOCATIONS, FARM_LOCATIONS } from '@/types/loadPlanning';
import type {
  CreateRecurringScheduleInput,
  GenerateLoadsResult,
  RecurringSchedule,
} from '@/types/recurringSchedules';

/**
 * Fetch all recurring schedules
 */
export const getRecurringSchedules = async (
  activeOnly = false
): Promise<RecurringSchedule[]> => {
  let query = supabase
    .from('recurring_schedules')
    .select('*')
    .order('name');

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as RecurringSchedule[];
};

/**
 * Create a new recurring schedule
 */
export const createRecurringSchedule = async (
  input: CreateRecurringScheduleInput
): Promise<RecurringSchedule> => {
  // Auto-fill GPS coordinates if available
  const origin = FARM_LOCATIONS[input.origin as keyof typeof FARM_LOCATIONS];
  const destination = DESTINATION_LOCATIONS[input.destination as keyof typeof DESTINATION_LOCATIONS];

  const scheduleData = {
    ...input,
    origin_lat: input.origin_lat ?? origin?.lat,
    origin_lng: input.origin_lng ?? origin?.lng,
    destination_lat: input.destination_lat ?? destination?.lat,
    destination_lng: input.destination_lng ?? destination?.lng,
  };

  const { data, error } = await supabase
    .from('recurring_schedules')
    .insert([scheduleData])
    .select()
    .single();

  if (error) throw error;
  return data as RecurringSchedule;
};

/**
 * Update a recurring schedule
 */
export const updateRecurringSchedule = async (
  id: string,
  updates: Partial<CreateRecurringScheduleInput>
): Promise<RecurringSchedule> => {
  const { data, error } = await supabase
    .from('recurring_schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as RecurringSchedule;
};

/**
 * Delete a recurring schedule
 */
export const deleteRecurringSchedule = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('recurring_schedules')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

/**
 * Toggle schedule active status
 */
export const toggleScheduleActive = async (
  id: string,
  isActive: boolean
): Promise<RecurringSchedule> => {
  return updateRecurringSchedule(id, { is_active: isActive } as Partial<CreateRecurringScheduleInput>);
};

/**
 * Generate loads from a recurring schedule
 */
export const generateLoadsFromSchedule = async (
  scheduleId: string,
  startDate?: string,
  endDate?: string
): Promise<GenerateLoadsResult> => {
  const { data, error } = await supabase.rpc('generate_loads_from_schedule', {
    p_schedule_id: scheduleId,
    p_start_date: startDate || new Date().toISOString().split('T')[0],
    p_end_date: endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  if (error) throw error;
  return (data as GenerateLoadsResult[])[0] || { generated_count: 0, load_ids: [] }; // RPC returns array with single result
};

/**
 * Generate loads from all active schedules
 */
export const generateLoadsFromAllSchedules = async (
  startDate?: string,
  endDate?: string
): Promise<{ schedules: number; loads: number; errors: string[] }> => {
  const schedules = await getRecurringSchedules(true);

  const results = {
    schedules: 0,
    loads: 0,
    errors: [] as string[],
  };

  for (const schedule of schedules) {
    try {
      const result = await generateLoadsFromSchedule(schedule.id, startDate, endDate);
      results.schedules++;
      results.loads += result.generated_count;
    } catch (error) {
      results.errors.push(`${schedule.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results;
};

/**
 * Get schedule statistics
 */
export const getScheduleStats = async () => {
  const { data, error } = await supabase
    .from('recurring_schedules')
    .select('id, is_active');

  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    active: data?.filter((s) => s.is_active).length || 0,
    inactive: data?.filter((s) => !s.is_active).length || 0,
    totalLoadsGenerated: 0,
  };

  return stats;
};

/**
 * Predict next generation dates for a schedule
 */
export const getNextGenerationDates = (
  schedule: RecurringSchedule,
  count = 5
): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  while (dates.length < count) {
    if (schedule.frequency === 'daily') {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (schedule.frequency === 'weekly' && schedule.days_of_week) {
      const dayOfWeek = currentDate.getDay() || 7; // Convert Sunday=0 to 7
      if (schedule.days_of_week.includes(dayOfWeek)) {
        dates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (schedule.frequency === 'monthly' && schedule.days_of_week) {
      const dayOfMonth = currentDate.getDate();
      if (schedule.days_of_week.includes(dayOfMonth)) {
        dates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    } else {
      break;
    }
  }

  return dates;
};

/**
 * Format days of week for display
 */
export const formatDaysOfWeek = (days?: number[]): string => {
  if (!days || days.length === 0) return 'Not set';

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes(6) && !days.includes(7)) return 'Weekdays';
  if (days.length === 2 && days.includes(6) && days.includes(7)) return 'Weekends';

  return days.map(d => dayNames[d - 1] || '').filter(Boolean).join(', ');
};

/**
 * Validate schedule configuration
 */
export const validateSchedule = (input: Partial<CreateRecurringScheduleInput>): string[] => {
  const errors: string[] = [];

  if (!input.name?.trim()) {
    errors.push('Schedule name is required');
  }
  if (!input.origin?.trim()) {
    errors.push('Origin is required');
  }
  if (!input.destination?.trim()) {
    errors.push('Destination is required');
  }
  if (!input.frequency) {
    errors.push('Frequency is required');
  }
  if (input.frequency === 'weekly' && (!input.days_of_week || input.days_of_week.length === 0)) {
    errors.push('Select at least one day for weekly schedules');
  }
  if (input.delivery_offset_days !== undefined && input.delivery_offset_days < 0) {
    errors.push('Delivery offset cannot be negative');
  }

  return errors;
};