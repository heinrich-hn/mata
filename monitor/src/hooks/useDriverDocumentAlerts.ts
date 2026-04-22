import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureAlert } from '@/lib/alertUtils';

interface AlertMetadata {
  driver_id: string;
  driver_name: string;
  driver_number: string;
  document_id?: string;
  document_type: string;
  document_number?: string | null;
  expiry_date?: string;
  days_until_expiry?: number;
  status: 'overdue' | 'soon' | 'missing';
  issue_type: 'document_expiry' | 'document_missing';
  entity_type: 'driver';
  [key: string]: unknown;
}

const DOC_LABELS: Record<string, string> = {
  license: 'Driver License',
  pdp: 'PDP',
  passport: 'Passport',
  medical: 'Medical Certificate',
  retest: 'Retest Certificate',
  defensive_driving: 'Defensive Driving',
};

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

      // Fetch ALL driver documents (including those without expiry, to detect missing types)
      const { data: docs, error: docErr } = await supabase
        .from('driver_documents')
        .select('id, driver_id, document_type, document_number, expiry_date')
        .in('driver_id', drivers.map(d => d.id));

      if (docErr) {
        console.error('Error fetching documents:', docErr);
        return;
      }

      // Build per-driver map of uploaded doc types
      const driverDocsMap: Record<string, Set<string>> = {};
      for (const doc of docs || []) {
        if (!driverDocsMap[doc.driver_id]) driverDocsMap[doc.driver_id] = new Set();
        driverDocsMap[doc.driver_id].add(doc.document_type);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const alertPromises: Promise<void>[] = [];

      for (const driver of drivers) {
        const activeTypes = (driver as { active_document_types?: string[] | null }).active_document_types || [];
        const uploadedTypes = driverDocsMap[driver.id] || new Set();
        const driverName = `${driver.first_name} ${driver.last_name}`.trim();
        const sourceLabel = `${driverName} (${driver.driver_number})`;

        // 1. Check for MISSING documents — active types with no uploaded doc
        for (const docType of activeTypes) {
          if (uploadedTypes.has(docType)) continue;
          const label = DOC_LABELS[docType] || docType.replace(/_/g, ' ');

          const metadata: AlertMetadata = {
            driver_id: driver.id,
            driver_name: driverName,
            driver_number: driver.driver_number,
            document_type: docType,
            status: 'missing',
            issue_type: 'document_missing',
            entity_type: 'driver',
          };

          alertPromises.push(
            ensureAlert({
              sourceType: 'driver',
              sourceId: driver.id,
              sourceLabel,
              category: 'document_missing',
              severity: 'high',
              title: `Missing ${label}`,
              message: `${driverName} has no ${label} document uploaded`,
              metadata,
            }).then(() => { }).catch(err => console.error('Failed to create missing doc alert:', err))
          );
        }
      }

      // 2. Check for EXPIRED / EXPIRING documents
      const driverMap = new Map(drivers.map(d => [d.id, d]));

      for (const doc of docs || []) {
        if (!doc.expiry_date) continue;

        const expiryDate = new Date(doc.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);

        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiry > 30) continue;

        const driver = driverMap.get(doc.driver_id);
        if (!driver) continue;

        const activeTypes = (driver as { active_document_types?: string[] | null }).active_document_types || [];
        if (activeTypes.length > 0 && !activeTypes.includes(doc.document_type)) continue;

        const driverName = `${driver.first_name} ${driver.last_name}`.trim();
        const isExpired = expiryDate < today;
        const docType = doc.document_type.replace(/_/g, ' ');

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

        alertPromises.push(
          ensureAlert({
            sourceType: 'driver',
            sourceId: doc.id,
            sourceLabel: `${driverName} (${driver.driver_number})`,
            category: 'document_expiry',
            severity,
            title: `Driver ${docType.toUpperCase()} ${isExpired ? 'Expired' : 'Expiring Soon'}`,
            message: `${driverName}'s ${docType} ${isExpired ? 'expired on' : 'expires on'} ${formatDate(doc.expiry_date)}`,
            metadata,
          }).then(() => { }).catch(err => console.error('Failed to create driver doc alert:', err))
        );
      }

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