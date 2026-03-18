import { useEffect, useRef } from 'react';
import { ensureAlert } from '@/lib/alertUtils';
import { useOverdueMaintenance } from './useOverdueMaintenance';

export function useMaintenanceAlerts(enabled: boolean = true) {
  const { data: overdueMaintenance } = useOverdueMaintenance();
  const alertedItems = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !overdueMaintenance?.length) return;

    const createMaintenanceAlerts = async () => {
      for (const item of overdueMaintenance) {
        const alertKey = `maintenance-${item.id}-${item.overdue_type}`;

        if (!alertedItems.current.has(alertKey)) {
          // Determine severity based on overdue amount and type
          let severity: 'critical' | 'high' | 'medium' = 'medium';

          if (item.overdue_type === 'date') {
            const daysOverdue = item.overdue_amount;
            severity = daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium';
          } else if (item.overdue_type === 'km') {
            const kmOverdue = item.overdue_amount;
            const interval = item.interval_km || 10000;
            const percentOverdue = (kmOverdue / interval) * 100;
            severity = percentOverdue > 20 ? 'critical' : percentOverdue > 10 ? 'high' : 'medium';
          } else if (item.overdue_type === 'hours') {
            const hoursOverdue = item.overdue_amount;
            const interval = item.interval_km || 500;
            const percentOverdue = (hoursOverdue / interval) * 100;
            severity = percentOverdue > 20 ? 'critical' : percentOverdue > 10 ? 'high' : 'medium';
          }

          const vehicleInfo = item.vehicles
            ? `${item.vehicles.fleet_number || item.vehicles.registration_number}`
            : 'Unknown vehicle';

          // Create appropriate message based on overdue type
          let message = '';
          if (item.overdue_type === 'date') {
            message = `${vehicleInfo} - ${item.overdue_amount} ${item.overdue_amount === 1 ? 'day' : 'days'} overdue`;
          } else if (item.overdue_type === 'km') {
            message = `${vehicleInfo} - ${item.overdue_amount.toLocaleString()} km overdue (current: ${item.current_odometer?.toLocaleString()} km, due at: ${((item.last_odometer || 0) + (item.interval_km || 0)).toLocaleString()} km)`;
          } else if (item.overdue_type === 'hours') {
            message = `${vehicleInfo} - ${item.overdue_amount.toLocaleString()} hrs overdue (current: ${item.current_odometer?.toLocaleString()} hrs, due at: ${((item.last_odometer || 0) + (item.interval_km || 0)).toLocaleString()} hrs)`;
          }

          await ensureAlert({
            sourceType: 'maintenance',
            sourceId: item.id,
            sourceLabel: `Maintenance: ${item.title}`,
            category: 'maintenance_due',
            severity,
            title: `Overdue ${item.is_reefer ? 'Reefer' : ''} Maintenance: ${item.title}`,
            message,
            fleetNumber: item.vehicles?.fleet_number,
            metadata: {
              maintenance_id: item.id,
              title: item.title,
              due_date: item.due_date,
              overdue_amount: item.overdue_amount,
              overdue_type: item.overdue_type,
              vehicle_id: item.vehicle_id,
              fleet_number: item.vehicles?.fleet_number,
              registration: item.vehicles?.registration_number,
              priority: item.priority,
              is_reefer: item.is_reefer,
              issue_type: `overdue_${item.overdue_type}_maintenance`,
              ...(item.overdue_type === 'km' && {
                current_km: item.current_odometer,
                last_service_km: item.last_odometer,
                interval_km: item.interval_km,
              }),
              ...(item.overdue_type === 'hours' && {
                current_hours: item.current_odometer,
                last_service_hours: item.last_odometer,
                interval_hours: item.interval_km,
              }),
            },
          });

          alertedItems.current.add(alertKey);
        }
      }
    };

    createMaintenanceAlerts();

    // Clean up old alerts from the Set periodically
    const cleanup = setInterval(() => {
      alertedItems.current.clear();
    }, 60 * 60 * 1000); // Clear every hour

    return () => clearInterval(cleanup);
  }, [enabled, overdueMaintenance]);
}