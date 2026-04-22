import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureAlert } from '@/lib/alertUtils';

interface WorkDocument {
  id: string;
  document_type: string | null;
  document_category: string | null;
  document_number: string;
  title: string;
  metadata: {
    expiry_date?: string;
    [key: string]: unknown;
  } | null;
}

// Type for the Supabase response
type VehicleDocumentResponse = {
  id: string;
  registration_number: string;
  fleet_number: string | null;
  make: string;
  model: string;
  active_document_types: string[] | null;
  work_documents: WorkDocument[];
};

function formatDocCategory(cat: string | null): string {
  if (!cat) return 'Document';
  const map: Record<string, string> = {
    license_disk: 'License Disk',
    insurance: 'Insurance',
    cof: 'COF',
    permit: 'Permit',
  };
  return map[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function useVehicleDocumentAlerts(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const checkDocumentExpiries = async () => {
      // Get all active vehicles with their documents
      const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select(`
          id,
          registration_number,
          fleet_number,
          make,
          model,
          active_document_types,
          work_documents (
            id,
            document_type,
            document_category,
            document_number,
            title,
            metadata
          )
        `)
        .eq('active', true);

      if (error) {
        console.error('Error fetching vehicle documents:', error);
        return;
      }

      // Type guard to check if vehicles is an array
      if (!vehicles || !Array.isArray(vehicles)) {
        console.error('Invalid vehicle data received');
        return;
      }

      const today = new Date();
      const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      };

      // Check each vehicle's documents
      for (const vehicle of vehicles as VehicleDocumentResponse[]) {
        const sourceLabel = vehicle.fleet_number || vehicle.registration_number;
        const activeTypes = vehicle.active_document_types || [];
        const docs = vehicle.work_documents || [];

        // Build set of uploaded categories for missing-doc detection
        const uploadedCategories = new Set<string>();
        for (const doc of docs) {
          const cat = doc.document_category || doc.document_type;
          if (cat) uploadedCategories.add(cat);
        }

        // 1. Check for MISSING documents — active categories with no uploaded doc
        for (const cat of activeTypes) {
          if (uploadedCategories.has(cat)) continue;
          const docLabel = formatDocCategory(cat);

          await ensureAlert({
            sourceType: "vehicle",
            sourceId: vehicle.id,
            sourceLabel,
            category: "document_missing",
            severity: "high",
            title: `Missing ${docLabel}`,
            message: `${sourceLabel} has no ${docLabel} document uploaded`,
            fleetNumber: vehicle.fleet_number,
            metadata: {
              vehicle_id: vehicle.id,
              registration_number: vehicle.registration_number,
              fleet_number: vehicle.fleet_number,
              make: vehicle.make,
              model: vehicle.model,
              document_category: cat,
              status: "missing",
              issue_type: "document_missing",
            },
          }).catch((err) => console.error('Failed to create missing document alert:', err));
        }

        // 2. Check for EXPIRED / EXPIRING documents
        for (const doc of docs) {
          const expiry = doc.metadata?.expiry_date;
          if (!expiry) continue;

          // Only alert for categories the vehicle has toggled on
          const category = doc.document_category || doc.document_type;
          if (category && activeTypes.length > 0 && !activeTypes.includes(category)) continue;

          const exp = new Date(expiry);
          const daysUntilExpiry = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Check if document is expired or expiring within 30 days
          if (exp < today || daysUntilExpiry <= 30) {
            const isOverdue = exp < today;
            const docLabel = formatDocCategory(category);

            await ensureAlert({
              sourceType: "vehicle",
              sourceId: vehicle.id,
              sourceLabel,
              category: "document_expiry",
              severity: isOverdue ? "critical" : "high",
              title: `${docLabel} ${isOverdue ? 'Expired' : 'Expiring Soon'}`,
              message: `${doc.title || doc.document_number} ${isOverdue ? 'expired on' : 'expires on'} ${formatDate(expiry)}`,
              fleetNumber: vehicle.fleet_number,
              metadata: {
                vehicle_id: vehicle.id,
                registration_number: vehicle.registration_number,
                fleet_number: vehicle.fleet_number,
                make: vehicle.make,
                model: vehicle.model,
                document_id: doc.id,
                document_type: doc.document_type,
                document_category: category,
                document_number: doc.document_number,
                expiry_date: expiry,
                status: isOverdue ? "overdue" : "soon",
                issue_type: "document_expiry",
              },
            }).catch((err) => console.error('Failed to create document alert:', err));
          }
        }
      }
    };

    // Initial check
    checkDocumentExpiries();

    // Set up realtime subscription for document changes
    const subscription = supabase
      .channel('vehicle-documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_documents',
        },
        () => {
          // Re-check expiries when documents change
          checkDocumentExpiries();
        }
      )
      .subscribe();

    // Run check every 6 hours to catch new expiries
    const interval = setInterval(checkDocumentExpiries, 6 * 60 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [enabled]);
}