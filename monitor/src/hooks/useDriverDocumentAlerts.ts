import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureAlert } from '@/lib/alertUtils';

interface DriverDoc {
  id: string;
  driver_id: string;
  document_type: string;
  document_number: string | null;
  expiry_date: string | null;
}

interface AlertMetadata {
  driver_id: string;
  driver_name: string;
  driver_number: string;
  document_id: string;
  document_type: string;
  document_number: string | null;
  expiry_date: string;
  days_until_expiry: number;
  status: 'overdue' | 'soon';
  issue_type: 'document_expiry';
  entity_type: 'driver';
  [key: string]: unknown; // Add index signature to satisfy Record<string, unknown>
}

export function useDriverDocumentAlerts(enabled: boolean = true) {
  const isMounted = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(); // Fixed: Changed from NodeJS.Timeout
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel>>();

  const formatDate = useCallback((date: string): string => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  const checkDriverDocExpiries = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      // Fetch active drivers
      const { data: drivers, error: dErr } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, driver_number, active_document_types')
        .eq('status', 'active');

      if (dErr) {
        console.error('Error fetching drivers:', dErr);
        return;
      }

      if (!drivers?.length) return;

      // Fetch driver documents with expiry dates
      const { data: docs, error: docErr } = await supabase
        .from('driver_documents')
        .select('id, driver_id, document_type, document_number, expiry_date')
        .in('driver_id', drivers.map(d => d.id))
        .not('expiry_date', 'is', null);

      if (docErr) {
        console.error('Error fetching documents:', docErr);
        return;
      }

      if (!docs?.length) return;

      // Create driver map for quick lookup
      const driverMap = new Map(drivers.map(d => [d.id, d]));
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to beginning of day for accurate comparison

      // Process each document
      const alertPromises = docs.map(async (doc: DriverDoc) => {
        if (!doc.expiry_date) return;

        const expiryDate = new Date(doc.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);

        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Skip if more than 30 days away
        if (daysUntilExpiry > 30) return;

        const driver = driverMap.get(doc.driver_id);
        if (!driver) return;

        // Only alert for document types the driver has toggled on
        const activeTypes = (driver as { active_document_types?: string[] | null }).active_document_types || [];
        if (activeTypes.length > 0 && !activeTypes.includes(doc.document_type)) return;

        const driverName = `${driver.first_name} ${driver.last_name}`.trim();
        const isExpired = expiryDate < today;
        const docType = doc.document_type.replace(/_/g, ' ');

        // Determine severity
        let severity: 'critical' | 'high' | 'medium' = 'medium';
        if (isExpired) {
          severity = 'critical';
        } else if (daysUntilExpiry <= 7) {
          severity = 'high';
        }

        const metadata: AlertMetadata = {
          driver_id: doc.driver_id,
          driver_name: driverName,
          driver_number: driver.driver_number,
          document_id: doc.id,
          document_type: doc.document_type,
          document_number: doc.document_number,
          expiry_date: doc.expiry_date,
          days_until_expiry: daysUntilExpiry,
          status: isExpired ? 'overdue' : 'soon',
          issue_type: 'document_expiry',
          entity_type: 'driver',
        };

        await ensureAlert({
          sourceType: 'driver',
          sourceId: doc.id,
          sourceLabel: `${driverName} (${driver.driver_number})`,
          category: 'document_expiry',
          severity,
          title: `Driver ${docType.toUpperCase()} ${isExpired ? 'Expired' : 'Expiring Soon'}`,
          message: `${driverName}'s ${docType} ${isExpired ? 'expired on' : 'expires on'} ${formatDate(doc.expiry_date)}`,
          metadata,
        }).catch(err => console.error('Failed to create driver doc alert:', err));
      });

      await Promise.allSettled(alertPromises);
    } catch (error) {
      console.error('Error in checkDriverDocExpiries:', error);
    }
  }, [formatDate]);

  useEffect(() => {
    if (!enabled) return;

    isMounted.current = true;

    // Initial check
    checkDriverDocExpiries();

    // Set up real-time subscription for document changes
    subscriptionRef.current = supabase
      .channel('driver-documents-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_documents' },
        () => {
          // Debounce the check to avoid multiple rapid calls
          setTimeout(() => {
            if (isMounted.current) {
              checkDriverDocExpiries();
            }
          }, 100);
        }
      )
      .subscribe();

    // Set up periodic check (every 6 hours)
    intervalRef.current = setInterval(() => {
      if (isMounted.current) {
        checkDriverDocExpiries();
      }
    }, 6 * 60 * 60 * 1000);

    // Cleanup function
    return () => {
      isMounted.current = false;

      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, checkDriverDocExpiries]);
}