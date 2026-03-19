import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import {
  mapDbToActionItem,
  mapDbToCARReport,
  mapDbToCostEntry,
  mapDbToDieselNorms,
  mapDbToDieselRecord,
  mapDbToDriverEvent,
  mapDbToMissedLoad,
  mapDbToTrip,
  mapTripToDb
} from '@/lib/typeMappers';
import type {
  ActionItem,
  CARReport,
  CostEntry,
  DieselConsumptionRecord,
  DieselNorms,
  DriverBehaviorEvent,
  DriverPerformance,
  MissedLoad,
  Trip
} from '@/types/operations';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { requestGoogleSheetsSync } from '@/hooks/useGoogleSheetsSync';

interface OperationsContextType {
  // Trips
  trips: Trip[];
  addTrip: (trip: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateTrip: (trip: Trip) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;

  // Cost Entries
  costEntries: CostEntry[];
  addCostEntry: (costEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateCostEntry: (costEntry: CostEntry) => Promise<void>;
  deleteCostEntry: (id: string) => Promise<void>;

  // Diesel Records
  dieselRecords: DieselConsumptionRecord[];
  addDieselRecord: (record: Omit<DieselConsumptionRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateDieselRecord: (record: DieselConsumptionRecord) => Promise<void>;
  deleteDieselRecord: (id: string) => Promise<void>;
  linkDieselToTrip: (dieselRecord: DieselConsumptionRecord, tripId: string) => Promise<void>;
  unlinkDieselFromTrip: (dieselRecordId: string) => Promise<void>;

  // Diesel Norms
  dieselNorms: DieselNorms[];
  addDieselNorm: (norm: Omit<DieselNorms, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateDieselNorm: (norm: DieselNorms) => Promise<void>;
  deleteDieselNorm: (id: string) => Promise<void>;
  updateDieselNorms: (norms: DieselNorms[]) => Promise<void>;

  // Driver Behavior
  driverBehaviorEvents: DriverBehaviorEvent[];
  addDriverBehaviorEvent: (event: Omit<DriverBehaviorEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateDriverBehaviorEvent: (event: DriverBehaviorEvent) => Promise<void>;
  deleteDriverBehaviorEvent: (id: string) => Promise<void>;
  getDriverPerformance: (driverName: string) => DriverPerformance;
  getAllDriversPerformance: () => DriverPerformance[];

  // Action Items
  actionItems: ActionItem[];
  addActionItem: (item: Omit<ActionItem, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateActionItem: (item: ActionItem) => Promise<void>;
  deleteActionItem: (id: string) => Promise<void>;

  // CAR Reports
  carReports: CARReport[];
  addCARReport: (report: Omit<CARReport, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateCARReport: (report: CARReport) => Promise<void>;
  deleteCARReport: (id: string) => Promise<void>;

  // Missed Loads
  missedLoads: MissedLoad[];
  addMissedLoad: (load: Omit<MissedLoad, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  updateMissedLoad: (load: MissedLoad) => Promise<void>;
  deleteMissedLoad: (id: string) => Promise<void>;

  // Loading state
  isLoading: boolean;
}

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

export const OperationsProvider = ({ children }: { children: ReactNode }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [dieselRecords, setDieselRecords] = useState<DieselConsumptionRecord[]>([]);
  const [dieselNorms, setDieselNorms] = useState<DieselNorms[]>([]);
  const [driverBehaviorEvents, setDriverBehaviorEvents] = useState<DriverBehaviorEvent[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [carReports, setCARReports] = useState<CARReport[]>([]);
  const [missedLoads, setMissedLoads] = useState<MissedLoad[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize data and set up real-time subscriptions
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);

        const [
          tripsRes,
          costsRes,
          dieselRes,
          dieselNormsRes,
          behaviorRes,
          actionsRes,
          carRes,
          loadsRes
        ] = await Promise.all([
          supabase.from('trips').select('*').order('created_at', { ascending: false }),
          supabase.from('cost_entries').select('*').order('created_at', { ascending: false }),
          supabase.from('diesel_records').select('*').order('date', { ascending: false }),
          supabase.from('diesel_norms').select('*').order('fleet_number'),
          supabase.from('driver_behavior_events').select('*').order('event_date', { ascending: false }),
          supabase.from('action_items').select('*').order('created_at', { ascending: false }),
          supabase.from('car_reports').select('*').order('incident_date', { ascending: false }),
          supabase.from('missed_loads').select('*').order('scheduled_date', { ascending: false })
        ]);

        if (tripsRes.data) setTrips(tripsRes.data.map(mapDbToTrip));
        if (costsRes.data) setCostEntries(costsRes.data.map(mapDbToCostEntry));
        if (dieselRes.data) setDieselRecords(dieselRes.data.map(mapDbToDieselRecord));
        if (dieselNormsRes.data) setDieselNorms(dieselNormsRes.data.map(mapDbToDieselNorms));
        if (behaviorRes.data) setDriverBehaviorEvents(behaviorRes.data.map(mapDbToDriverEvent));
        if (actionsRes.data) setActionItems(actionsRes.data.map(mapDbToActionItem));
        if (carRes.data) setCARReports(carRes.data.map(mapDbToCARReport));
        if (loadsRes.data) setMissedLoads(loadsRes.data.map(mapDbToMissedLoad));
      } catch (error) {
        console.error('Error initializing operations data:', error);
        toast.error('Failed to load operations data');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();

    // Set up real-time subscriptions
    const tripsChannel = supabase
      .channel('trips_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload) => {
        if (payload.eventType === 'INSERT') setTrips(prev => [mapDbToTrip(payload.new as Database['public']['Tables']['trips']['Row']), ...prev]);
        else if (payload.eventType === 'UPDATE') setTrips(prev => prev.map(t => t.id === payload.new.id ? mapDbToTrip(payload.new as Database['public']['Tables']['trips']['Row']) : t));
        else if (payload.eventType === 'DELETE') setTrips(prev => prev.filter(t => t.id !== payload.old.id));
      })
      .subscribe();

    const costsChannel = supabase
      .channel('cost_entries_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_entries' }, (payload) => {
        if (payload.eventType === 'INSERT') setCostEntries(prev => [payload.new as CostEntry, ...prev]);
        else if (payload.eventType === 'UPDATE') setCostEntries(prev => prev.map(c => c.id === payload.new.id ? payload.new as CostEntry : c));
        else if (payload.eventType === 'DELETE') setCostEntries(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .subscribe();

    const dieselChannel = supabase
      .channel('diesel_records_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diesel_records' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Insert and maintain date order (descending - most recent first)
          setDieselRecords(prev => {
            const newRecord = mapDbToDieselRecord(payload.new as Database['public']['Tables']['diesel_records']['Row']);
            const updated = [...prev, newRecord];
            return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });
        }
        else if (payload.eventType === 'UPDATE') {
          // Update and re-sort in case date changed
          setDieselRecords(prev => {
            const updated = prev.map(d => d.id === payload.new.id ? mapDbToDieselRecord(payload.new as Database['public']['Tables']['diesel_records']['Row']) : d);
            return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });
        }
        else if (payload.eventType === 'DELETE') setDieselRecords(prev => prev.filter(d => d.id !== payload.old.id));
      })
      .subscribe();

    const dieselNormsChannel = supabase
      .channel('diesel_norms_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diesel_norms' }, (payload) => {
        if (payload.eventType === 'INSERT') setDieselNorms(prev => [...prev, payload.new as DieselNorms]);
        else if (payload.eventType === 'UPDATE') setDieselNorms(prev => prev.map(n => n.id === payload.new.id ? payload.new as DieselNorms : n));
        else if (payload.eventType === 'DELETE') setDieselNorms(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .subscribe();

    const behaviorChannel = supabase
      .channel('driver_behavior_events_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_behavior_events' }, (payload) => {
        if (payload.eventType === 'INSERT') setDriverBehaviorEvents(prev => [payload.new as DriverBehaviorEvent, ...prev]);
        else if (payload.eventType === 'UPDATE') setDriverBehaviorEvents(prev => prev.map(e => e.id === payload.new.id ? payload.new as DriverBehaviorEvent : e));
        else if (payload.eventType === 'DELETE') setDriverBehaviorEvents(prev => prev.filter(e => e.id !== payload.old.id));
      })
      .subscribe();

    const actionsChannel = supabase
      .channel('action_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'action_items' }, (payload) => {
        if (payload.eventType === 'INSERT') setActionItems(prev => [payload.new as ActionItem, ...prev]);
        else if (payload.eventType === 'UPDATE') setActionItems(prev => prev.map(a => a.id === payload.new.id ? payload.new as ActionItem : a));
        else if (payload.eventType === 'DELETE') setActionItems(prev => prev.filter(a => a.id !== payload.old.id));
      })
      .subscribe();

    const carChannel = supabase
      .channel('car_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'car_reports' }, (payload) => {
        if (payload.eventType === 'INSERT') setCARReports(prev => [payload.new as CARReport, ...prev]);
        else if (payload.eventType === 'UPDATE') setCARReports(prev => prev.map(r => r.id === payload.new.id ? payload.new as CARReport : r));
        else if (payload.eventType === 'DELETE') setCARReports(prev => prev.filter(r => r.id !== payload.old.id));
      })
      .subscribe();

    const loadsChannel = supabase
      .channel('missed_loads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missed_loads' }, (payload) => {
        if (payload.eventType === 'INSERT') setMissedLoads(prev => [payload.new as MissedLoad, ...prev]);
        else if (payload.eventType === 'UPDATE') setMissedLoads(prev => prev.map(l => l.id === payload.new.id ? payload.new as MissedLoad : l));
        else if (payload.eventType === 'DELETE') setMissedLoads(prev => prev.filter(l => l.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(costsChannel);
      supabase.removeChannel(dieselChannel);
      supabase.removeChannel(dieselNormsChannel);
      supabase.removeChannel(behaviorChannel);
      supabase.removeChannel(actionsChannel);
      supabase.removeChannel(carChannel);
      supabase.removeChannel(loadsChannel);
    };
  }, []);

  // Trip operations
  const addTrip = async (tripData: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) => {
    const insertData = mapTripToDb(tripData as Trip);
    const { data, error } = await supabase.from('trips').insert([insertData]).select().single();
    if (error) throw error;
    toast.success('Trip added successfully');
    requestGoogleSheetsSync('trips');
    return data.id;
  };

  const updateTrip = async (trip: Trip) => {
    const updateData = mapTripToDb(trip);
    const { error } = await supabase.from('trips').update(updateData).eq('id', trip.id);
    if (error) throw error;
    toast.success('Trip updated successfully');
    requestGoogleSheetsSync('trips');
  };

  const deleteTrip = async (id: string) => {
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (error) throw error;
    toast.success('Trip deleted successfully');
    requestGoogleSheetsSync('trips');
  };

  // Cost entry operations
  const addCostEntry = async (costData: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'>) => {
    const insertData = { ...costData, attachments: costData.attachments as unknown as Json };
    const { data, error } = await supabase.from('cost_entries').insert([insertData]).select().single();
    if (error) throw error;
    toast.success('Cost entry added');
    requestGoogleSheetsSync('trips');
    return data.id;
  };

  const updateCostEntry = async (cost: CostEntry) => {
    const updateData = { ...cost, attachments: cost.attachments as unknown as Json };
    const { error } = await supabase.from('cost_entries').update(updateData).eq('id', cost.id);
    if (error) throw error;
    toast.success('Cost entry updated');
    requestGoogleSheetsSync('trips');
  };

  const deleteCostEntry = async (id: string) => {
    const { error } = await supabase.from('cost_entries').delete().eq('id', id);
    if (error) throw error;
    toast.success('Cost entry deleted');
    requestGoogleSheetsSync('trips');
  };

  // Helper function to fetch previous km reading for a diesel record
  const fetchPreviousKmReading = async (fleetNumber: string, currentDate: string, excludeId?: string): Promise<{ km_reading: number; date: string } | null> => {
    try {
      let query = supabase
        .from('diesel_records')
        .select('km_reading, date')
        .eq('fleet_number', fleetNumber)
        .lt('date', currentDate)
        .order('date', { ascending: false })
        .limit(1);

      // If we're updating an existing record, exclude it from the query
      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query.single();
      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  };

  // Diesel operations
  const addDieselRecord = async (recordData: Omit<DieselConsumptionRecord, 'id' | 'created_at' | 'updated_at'>) => {
    // If previous_km_reading or distance_travelled is not set, try to calculate it
    const enrichedData = { ...recordData };

    if (enrichedData.km_reading && enrichedData.date && (enrichedData.previous_km_reading === null || enrichedData.previous_km_reading === undefined || enrichedData.distance_travelled === null || enrichedData.distance_travelled === undefined)) {
      const prevRecord = await fetchPreviousKmReading(enrichedData.fleet_number, enrichedData.date);
      if (prevRecord) {
        enrichedData.previous_km_reading = prevRecord.km_reading;
        enrichedData.distance_travelled = enrichedData.km_reading - prevRecord.km_reading;

        // Calculate km/L if we have distance and litres
        if (enrichedData.distance_travelled > 0 && enrichedData.litres_filled > 0) {
          // Use vehicle_litres_only if available (excludes trailer fuel), otherwise use total litres
          const litresForCalculation = enrichedData.vehicle_litres_only && enrichedData.vehicle_litres_only > 0
            ? enrichedData.vehicle_litres_only
            : enrichedData.litres_filled;
          enrichedData.km_per_litre = enrichedData.distance_travelled / litresForCalculation;
        }
      }
    }

    const dbData = {
      ...enrichedData,
      trailer_fuel_data: enrichedData.trailer_fuel_data as unknown as Json,
    };
    const { data, error } = await supabase.from('diesel_records').insert([dbData]).select().single();
    if (error) throw error;

    // Create reefer diesel records for linked trailers
    if (data.id && enrichedData.linked_trailers && enrichedData.trailer_fuel_data) {
      const trailerData = enrichedData.trailer_fuel_data as Array<{
        trailer_id: string;
        operating_hours: number;
        litres_per_hour: number;
        total_litres: number;
        fuel_cost: number;
      }>;

      for (const trailer of trailerData) {
        if (trailer.total_litres > 0) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('reefer_diesel_records').insert({
              reefer_unit: trailer.trailer_id,
              date: enrichedData.date,
              fuel_station: enrichedData.fuel_station,
              litres_filled: trailer.total_litres,
              cost_per_litre: enrichedData.cost_per_litre,
              total_cost: trailer.fuel_cost,
              operating_hours: trailer.operating_hours,
              litres_per_hour: trailer.litres_per_hour,
              driver_name: enrichedData.driver_name,
              currency: enrichedData.currency || 'ZAR',
              linked_diesel_record_id: data.id,
              notes: `Linked to ${enrichedData.fleet_number} diesel record`,
            });
          } catch (reeferError) {
            console.error('Failed to create reefer record for', trailer.trailer_id, reeferError);
          }
        }
      }
    }

    toast.success('Diesel record added');
    requestGoogleSheetsSync('diesel');
    return data.id;
  };

  const updateDieselRecord = async (record: DieselConsumptionRecord) => {
    // If updating and distance data is missing, try to recalculate
    const enrichedRecord = { ...record };

    if (enrichedRecord.km_reading && enrichedRecord.date && (enrichedRecord.previous_km_reading === null || enrichedRecord.previous_km_reading === undefined || enrichedRecord.distance_travelled === null || enrichedRecord.distance_travelled === undefined)) {
      const prevRecord = await fetchPreviousKmReading(enrichedRecord.fleet_number, enrichedRecord.date, enrichedRecord.id);
      if (prevRecord) {
        enrichedRecord.previous_km_reading = prevRecord.km_reading;
        enrichedRecord.distance_travelled = enrichedRecord.km_reading - prevRecord.km_reading;

        // Calculate km/L if we have distance and litres
        if (enrichedRecord.distance_travelled > 0 && enrichedRecord.litres_filled > 0) {
          const litresForCalculation = enrichedRecord.vehicle_litres_only && enrichedRecord.vehicle_litres_only > 0
            ? enrichedRecord.vehicle_litres_only
            : enrichedRecord.litres_filled;
          enrichedRecord.km_per_litre = enrichedRecord.distance_travelled / litresForCalculation;
        }
      }
    }

    const dbData = {
      ...enrichedRecord,
      trailer_fuel_data: enrichedRecord.trailer_fuel_data as unknown as Json,
    };
    const { error } = await supabase.from('diesel_records').update(dbData).eq('id', record.id);
    if (error) throw error;

    // Sync reefer diesel records for linked trailers
    // First, delete any existing reefer records linked to this diesel record
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('reefer_diesel_records')
        .delete()
        .eq('linked_diesel_record_id', record.id);
    } catch (deleteError) {
      console.error('Failed to delete old reefer records:', deleteError);
    }

    // Then create new reefer records if trailer_fuel_data is present
    if (enrichedRecord.linked_trailers && enrichedRecord.trailer_fuel_data) {
      const trailerData = enrichedRecord.trailer_fuel_data as Array<{
        trailer_id: string;
        operating_hours: number;
        litres_per_hour: number;
        total_litres: number;
        fuel_cost: number;
      }>;

      for (const trailer of trailerData) {
        if (trailer.total_litres > 0) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('reefer_diesel_records').insert({
              reefer_unit: trailer.trailer_id,
              date: enrichedRecord.date,
              fuel_station: enrichedRecord.fuel_station,
              litres_filled: trailer.total_litres,
              cost_per_litre: enrichedRecord.cost_per_litre,
              total_cost: trailer.fuel_cost,
              operating_hours: trailer.operating_hours,
              litres_per_hour: trailer.litres_per_hour,
              driver_name: enrichedRecord.driver_name,
              currency: enrichedRecord.currency || 'ZAR',
              linked_diesel_record_id: record.id,
              notes: `Linked to ${enrichedRecord.fleet_number} diesel record`,
            });
          } catch (reeferError) {
            console.error('Failed to create reefer record for', trailer.trailer_id, reeferError);
          }
        }
      }
    }

    toast.success('Diesel record updated');
    requestGoogleSheetsSync('diesel');
  };

  const deleteDieselRecord = async (id: string) => {
    // First delete any linked reefer diesel records
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('reefer_diesel_records')
        .delete()
        .eq('linked_diesel_record_id', id);
    } catch (reeferError) {
      console.error('Failed to delete linked reefer records:', reeferError);
    }

    const { error } = await supabase.from('diesel_records').delete().eq('id', id);
    if (error) throw error;
    toast.success('Diesel record deleted');
    requestGoogleSheetsSync('diesel');
  };

  // Diesel norms operations
  const addDieselNorm = async (normData: Omit<DieselNorms, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('diesel_norms').insert([normData]).select().single();
    if (error) throw error;
    toast.success('Diesel norm added');
    return data.id;
  };

  const updateDieselNorm = async (norm: DieselNorms) => {
    const { error } = await supabase.from('diesel_norms').update(norm).eq('id', norm.id);
    if (error) throw error;
    toast.success('Diesel norm updated');
  };

  const deleteDieselNorm = async (id: string) => {
    const { error } = await supabase.from('diesel_norms').delete().eq('id', id);
    if (error) throw error;
    toast.success('Diesel norm deleted');
  };

  const updateDieselNorms = async (norms: DieselNorms[]) => {
    // Update all norms in a batch
    for (const norm of norms) {
      if (norm.id) {
        await updateDieselNorm(norm);
      } else {
        await addDieselNorm(norm);
      }
    }
    toast.success('Diesel norms updated successfully');
  };

  // Link diesel record to trip with automatic cost entry creation
  const linkDieselToTrip = async (dieselRecord: DieselConsumptionRecord, tripId: string) => {
    try {
      // 1. Create cost entry for the horse/primary vehicle using vehicle fuel cost
      const vehicleCost = dieselRecord.vehicle_fuel_cost || dieselRecord.total_cost;
      const horseCostEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'> = {
        trip_id: tripId,
        category: 'Fuel',
        sub_category: 'Diesel - Horse',
        amount: vehicleCost,
        currency: dieselRecord.currency || 'ZAR',
        date: dieselRecord.date,
        reference_number: `DSL-${dieselRecord.id.substring(0, 8)}`,
        notes: `Diesel for ${dieselRecord.fleet_number} at ${dieselRecord.fuel_station}`,
        diesel_record_id: dieselRecord.id,
        vehicle_identifier: dieselRecord.fleet_number,
        is_flagged: false,
        is_system_generated: true,
      };

      const horseCostId = await addCostEntry(horseCostEntry);
      const costEntryIds = [horseCostId];

      // 2. If trailers are linked with fuel data, create individual cost entries
      if (dieselRecord.trailer_fuel_data && dieselRecord.trailer_fuel_data.length > 0) {
        for (const trailerData of dieselRecord.trailer_fuel_data) {
          const trailerCostEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'> = {
            trip_id: tripId,
            category: 'Fuel',
            sub_category: 'Diesel - Trailer',
            amount: trailerData.fuel_cost,
            currency: dieselRecord.currency || 'ZAR',
            date: dieselRecord.date,
            reference_number: `DSL-${dieselRecord.id.substring(0, 8)}-${trailerData.trailer_id}`,
            notes: `Diesel for trailer ${trailerData.trailer_id}: ${trailerData.operating_hours}hrs @ ${trailerData.litres_per_hour}L/hr`,
            diesel_record_id: dieselRecord.id,
            vehicle_identifier: trailerData.trailer_id,
            is_flagged: false,
            is_system_generated: true,
          };

          const trailerCostId = await addCostEntry(trailerCostEntry);
          costEntryIds.push(trailerCostId);
        }
      }

      // 3. Check for linked reefer records and create cost entries for them
      const { data: linkedReefers } = await (supabase as any).from('reefer_diesel_records')
        .select('*')
        .eq('linked_diesel_record_id', dieselRecord.id);

      if (linkedReefers && linkedReefers.length > 0) {
        for (const reefer of linkedReefers) {
          const reeferCostEntry: Omit<CostEntry, 'id' | 'created_at' | 'updated_at'> = {
            trip_id: tripId,
            category: 'Fuel',
            sub_category: 'Diesel - Reefer',
            amount: reefer.total_cost,
            currency: reefer.currency || 'ZAR',
            date: reefer.date,
            reference_number: `RFR-${reefer.id.substring(0, 8)}`,
            notes: `Reefer diesel for ${reefer.reefer_unit} at ${reefer.fuel_station}`,
            diesel_record_id: reefer.id,
            vehicle_identifier: reefer.reefer_unit,
            is_flagged: false,
            is_system_generated: true,
          };
          const reeferCostId = await addCostEntry(reeferCostEntry);
          costEntryIds.push(reeferCostId);
          // Update reefer record with trip linkage
          await (supabase as any).from('reefer_diesel_records')
            .update({ trip_id: tripId, cost_entry_ids: [reeferCostId] })
            .eq('id', reefer.id);
        }
      }

      // 4. Update diesel record with trip_id and cost_entry_ids
      await updateDieselRecord({
        ...dieselRecord,
        trip_id: tripId,
        cost_entry_ids: costEntryIds
      });

      toast.success('Diesel record linked to trip with cost entries created');
    } catch (error) {
      toast.error('Failed to link diesel record to trip');
      throw error;
    }
  };

  // Unlink diesel record from trip and remove associated cost entries
  const unlinkDieselFromTrip = async (dieselRecordId: string) => {
    try {
      const record = dieselRecords.find(r => r.id === dieselRecordId);
      if (!record) throw new Error('Diesel record not found');

      // 1. Delete associated cost entries
      if (record.cost_entry_ids && record.cost_entry_ids.length > 0) {
        for (const costId of record.cost_entry_ids) {
          await deleteCostEntry(costId);
        }
      }

      // 2. Clean up linked reefer records' trip linkage and cost entries
      const { data: linkedReefers } = await (supabase as any).from('reefer_diesel_records')
        .select('*')
        .eq('linked_diesel_record_id', dieselRecordId);

      if (linkedReefers && linkedReefers.length > 0) {
        for (const reefer of linkedReefers) {
          if (reefer.cost_entry_ids && reefer.cost_entry_ids.length > 0) {
            for (const costId of reefer.cost_entry_ids) {
              await deleteCostEntry(costId);
            }
          }
          await (supabase as any).from('reefer_diesel_records')
            .update({ trip_id: null, cost_entry_ids: null })
            .eq('id', reefer.id);
        }
      }

      // 3. Update diesel record to remove trip linkage
      await updateDieselRecord({
        ...record,
        trip_id: undefined,
        cost_entry_ids: []
      });

      toast.success('Diesel record unlinked from trip');
    } catch (error) {
      toast.error('Failed to unlink diesel record');
      throw error;
    }
  };

  // Driver behavior operations
  const addDriverBehaviorEvent = async (eventData: Omit<DriverBehaviorEvent, 'id' | 'created_at' | 'updated_at'>) => {
    const insertData = { ...eventData, attachments: eventData.attachments as unknown as Json };
    const { data, error } = await supabase.from('driver_behavior_events').insert([insertData]).select().single();
    if (error) throw error;
    toast.success('Driver behavior event added');
    return data.id;
  };

  const updateDriverBehaviorEvent = async (event: DriverBehaviorEvent) => {
    const updateData = { ...event, attachments: event.attachments as unknown as Json };
    const { error } = await supabase.from('driver_behavior_events').update(updateData).eq('id', event.id);
    if (error) throw error;
    toast.success('Driver behavior event updated');
  };

  const deleteDriverBehaviorEvent = async (id: string) => {
    const { error } = await supabase.from('driver_behavior_events').delete().eq('id', id);
    if (error) throw error;
    toast.success('Driver behavior event deleted');
  };

  const getDriverPerformance = (driverName: string): DriverPerformance => {
    const driverEvents = driverBehaviorEvents.filter(e => e.driver_name === driverName);
    const driverTrips = trips.filter(t => t.driver_name === driverName);

    const totalPoints = driverEvents.reduce((sum, e) => sum + (e.points || 0), 0);
    const totalDistance = driverTrips.reduce((sum, t) => sum + (t.distance_km || 0), 0);
    const behaviorScore = Math.max(0, 100 - totalPoints);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (behaviorScore >= 85) riskLevel = 'low';
    else if (behaviorScore >= 70) riskLevel = 'medium';
    else if (behaviorScore >= 50) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      driver_name: driverName,
      behavior_score: behaviorScore,
      total_behavior_events: driverEvents.length,
      total_points: totalPoints,
      total_trips: driverTrips.length,
      total_distance: totalDistance,
      risk_level: riskLevel,
      improvement_trend: 'stable'
    };
  };

  const getAllDriversPerformance = (): DriverPerformance[] => {
    const driverNames = Array.from(new Set([
      ...trips.map(t => t.driver_name).filter(Boolean),
      ...driverBehaviorEvents.map(e => e.driver_name)
    ])) as string[];

    return driverNames.map(name => getDriverPerformance(name));
  };

  // Action item operations
  const addActionItem = async (itemData: Omit<ActionItem, 'id' | 'created_at' | 'updated_at'>) => {
    const insertData = { ...itemData, comments: itemData.comments as unknown as Json };
    const { data, error } = await supabase.from('action_items').insert([insertData]).select().single();
    if (error) throw error;
    toast.success('Action item created');
    return data.id;
  };

  const updateActionItem = async (item: ActionItem) => {
    const updateData = { ...item, comments: item.comments as unknown as Json };
    const { error } = await supabase.from('action_items').update(updateData).eq('id', item.id);
    if (error) throw error;
    toast.success('Action item updated');
  };

  const deleteActionItem = async (id: string) => {
    const { error } = await supabase.from('action_items').delete().eq('id', id);
    if (error) throw error;
    toast.success('Action item deleted');
  };

  // CAR report operations
  const addCARReport = async (reportData: Omit<CARReport, 'id' | 'created_at' | 'updated_at'>) => {
    const insertData = { ...reportData, attachments: reportData.attachments as unknown as Json };
    const { data, error } = await supabase.from('car_reports').insert([insertData]).select().single();
    if (error) throw error;
    toast.success('CAR report created');
    return data.id;
  };

  const updateCARReport = async (report: CARReport) => {
    const updateData = { ...report, attachments: report.attachments as unknown as Json };
    const { error } = await supabase.from('car_reports').update(updateData).eq('id', report.id);
    if (error) throw error;
    toast.success('CAR report updated');
  };

  const deleteCARReport = async (id: string) => {
    const { error } = await supabase.from('car_reports').delete().eq('id', id);
    if (error) throw error;
    toast.success('CAR report deleted');
  };

  // Missed load operations
  const addMissedLoad = async (loadData: Omit<MissedLoad, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('missed_loads').insert([loadData as unknown as Database['public']['Tables']['missed_loads']['Insert']]).select().single();
    if (error) throw error;
    toast.success('Missed load recorded');
    return data.id;
  };

  const updateMissedLoad = async (load: MissedLoad) => {
    const { error } = await supabase.from('missed_loads').update(load as unknown as Database['public']['Tables']['missed_loads']['Update']).eq('id', load.id);
    if (error) throw error;
    toast.success('Missed load updated');
  };

  const deleteMissedLoad = async (id: string) => {
    const { error } = await supabase.from('missed_loads').delete().eq('id', id);
    if (error) throw error;
    toast.success('Missed load deleted');
  };

  return (
    <OperationsContext.Provider
      value={{
        trips,
        addTrip,
        updateTrip,
        deleteTrip,
        costEntries,
        addCostEntry,
        updateCostEntry,
        deleteCostEntry,
        dieselRecords,
        addDieselRecord,
        updateDieselRecord,
        deleteDieselRecord,
        linkDieselToTrip,
        unlinkDieselFromTrip,
        dieselNorms,
        addDieselNorm,
        updateDieselNorm,
        deleteDieselNorm,
        updateDieselNorms,
        driverBehaviorEvents,
        addDriverBehaviorEvent,
        updateDriverBehaviorEvent,
        deleteDriverBehaviorEvent,
        getDriverPerformance,
        getAllDriversPerformance,
        actionItems,
        addActionItem,
        updateActionItem,
        deleteActionItem,
        carReports,
        addCARReport,
        updateCARReport,
        deleteCARReport,
        missedLoads,
        addMissedLoad,
        updateMissedLoad,
        deleteMissedLoad,
        isLoading
      }}
    >
      {children}
    </OperationsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useOperations = () => {
  const context = useContext(OperationsContext);
  if (!context) {
    throw new Error('useOperations must be used within OperationsProvider');
  }
  return context;
};