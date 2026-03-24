// src/lib/alertResolution.ts
// ✅ FULLY FIXED & COMPLETE (TS2339 + TS2352 gone)

import { supabase } from '@/integrations/supabase/client';

export interface ResolveAlertOptions {
  sourceId: string;
  sourceType?: string;
  category?: string;
  issueType?: string;
  resolutionComment: string;
  resolvedBy: string;
  metadata?: Record<string, any>;
}

// Temporary interface until you run `npx supabase gen types`
interface CostEntryForValidation {
  id: string;
  verification_type: string | null;
  attachments: any[] | null;
  notes: string | null;
  investigation_status: string | null;
}

// Helper to check if expenses have proper documentation
async function validateExpenseDocumentation(tripId: string): Promise<{ valid: boolean; missingDocs: string[] }> {
  const { data: expensesRaw, error } = await supabase
    .from('cost_entries')
    .select('id, verification_type, attachments, notes, investigation_status')
    .eq('trip_id', tripId)
    .eq('investigation_status', 'resolved');

  if (error) {
    console.error('Error validating expense documentation:', error);
    return { valid: false, missingDocs: [] };
  }

  // ←←← FIXED: Cast through unknown to satisfy TS2352
  const expenses = ((expensesRaw ?? []) as unknown) as CostEntryForValidation[];

  const missingDocs: string[] = [];

  for (const expense of expenses) {
    const hasReceipt = Array.isArray(expense.attachments) && expense.attachments.length > 0;
    const hasComment = expense.notes && expense.notes.trim().length > 0;

    if (expense.verification_type === 'quick') {
      if (!hasReceipt && !hasComment) {
        missingDocs.push(`Expense ${expense.id}: Quick verification requires either receipt or comment`);
      }
    } else if (expense.verification_type === 'detailed') {
      if (!hasReceipt) {
        missingDocs.push(`Expense ${expense.id}: Detailed verification requires receipt`);
      }
      if (!hasComment) {
        missingDocs.push(`Expense ${expense.id}: Detailed verification requires comment`);
      }
    } else if (!expense.verification_type) {
      if (!hasComment) {
        missingDocs.push(`Expense ${expense.id}: Resolution requires justification comment`);
      }
    }
  }

  return { valid: missingDocs.length === 0, missingDocs };
}

// Main resolver
export const resolveAlert = async (options: ResolveAlertOptions): Promise<boolean> => {
  try {
    if (options.issueType === 'unverified_costs' && options.sourceId) {
      const { valid, missingDocs } = await validateExpenseDocumentation(options.sourceId);
      if (!valid) {
        console.error('Cannot resolve alert: Missing documentation', missingDocs);
        throw new Error(`Cannot resolve: Missing documentation for ${missingDocs.length} expense(s)`);
      }
    }

    let query = supabase
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_comment: options.resolutionComment,
        resolved_by: options.resolvedBy
      })
      .eq('status', 'active');

    if (options.sourceId) query = query.eq('source_id', options.sourceId);
    if (options.sourceType) query = query.eq('source_type', options.sourceType);
    if (options.category) query = query.eq('category', options.category);
    if (options.issueType) {
      query = query.filter('metadata->>issue_type', 'eq', options.issueType);
    }

    const { error, data } = await query.select();
    if (error) {
      console.error('Error resolving alert:', error);
      return false;
    }

    return !!(data && data.length > 0);
  } catch (error) {
    console.error('Failed to resolve alert:', error);
    return false;
  }
};

// Batch resolver (used by useTripAlerts hook)
export async function resolveAlertsByTrip(
  tripId: string,
  categories: string[],
  issueType: string,
  resolutionComment?: string,
  resolvedBy?: string
): Promise<boolean> {
  const BATCH_SIZE = 20;

  try {
    let query = supabase
      .from('alerts')
      .select('id')
      .eq('source_type', 'trip')
      .eq('source_id', tripId)
      .eq('status', 'active');

    if (categories.length > 0) query = query.in('category', categories);
    if (issueType) query = query.filter('metadata->>issue_type', 'eq', issueType);

    const { data: alerts, error } = await query;
    if (error) throw error;
    if (!alerts || alerts.length === 0) return true;

    if (issueType === 'unverified_costs') {
      const { valid } = await validateExpenseDocumentation(tripId);
      if (!valid) return false;
    }

    for (let i = 0; i < alerts.length; i += BATCH_SIZE) {
      const batch = alerts.slice(i, i + BATCH_SIZE).map(a => a.id);
      if (i > 0) await new Promise(r => setTimeout(r, 200));

      const { error: updateError } = await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_comment: resolutionComment || `Auto-resolved: ${issueType}`,
          resolved_by: resolvedBy || 'system'
        })
        .in('id', batch);

      if (updateError) throw updateError;
    }

    return true;
  } catch (error) {
    console.error('Error resolving alerts by trip:', error);
    return false;
  }
}

// Duplicate POD resolver
export async function resolveDuplicatePODAlerts(podNumber: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_comment: 'Duplicate POD resolved'
      })
      .eq('category', 'duplicate_pod')
      .eq('status', 'active')
      .filter('metadata->>pod_number', 'eq', podNumber);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error resolving duplicate POD alerts:', error);
    return false;
  }
}

// Specific resolvers (used by modals + hooks)
export const resolveMissingRevenueAlert = async (
  tripId: string,
  tripNumber: string,
  comment: string,
  resolvedBy: string
): Promise<boolean> => resolveAlert({
  sourceId: tripId,
  sourceType: 'trip',
  category: 'load_exception',
  issueType: 'missing_revenue',
  resolutionComment: comment,
  resolvedBy,
});

export const resolveDuplicatePodAlert = async (
  podNumber: string,
  comment: string,
  resolvedBy: string
): Promise<boolean> => resolveAlert({
  sourceId: podNumber,
  sourceType: 'system',
  category: 'duplicate_pod',
  resolutionComment: comment,
  resolvedBy,
});

export const resolveFlaggedCostAlert = async (
  tripId: string,
  costId: string,
  comment: string,
  resolvedBy: string
): Promise<boolean> => resolveAlert({
  sourceId: tripId,
  sourceType: 'trip',
  category: 'fuel_anomaly',
  issueType: 'flagged_costs',
  resolutionComment: comment,
  resolvedBy,
});

export const resolveNoCostsAlert = async (
  tripId: string,
  comment: string,
  resolvedBy: string
): Promise<boolean> => resolveAlert({
  sourceId: tripId,
  sourceType: 'trip',
  category: 'fuel_anomaly',
  issueType: 'no_costs',
  resolutionComment: comment,
  resolvedBy,
});

export const resolveUnverifiedCostsAlert = async (
  tripId: string,
  comment: string,
  resolvedBy: string
): Promise<{ success: boolean; missingDocs?: string[] }> => {
  const { valid, missingDocs } = await validateExpenseDocumentation(tripId);
  if (!valid) return { success: false, missingDocs };

  const success = await resolveAlert({
    sourceId: tripId,
    sourceType: 'trip',
    category: 'fuel_anomaly',
    issueType: 'unverified_costs',
    resolutionComment: comment,
    resolvedBy,
  });

  return { success };
};

export const resolveMissingDocumentsAlert = async (
  tripId: string,
  comment: string,
  resolvedBy: string
): Promise<boolean> => {
  const { data: missingDocsData } = await supabase
    .from('cost_entries')
    .select('id')
    .eq('trip_id', tripId)
    .is('attachments', null)
    .limit(1);

  if (missingDocsData && missingDocsData.length > 0) {
    console.error('Cannot resolve: Still have expenses without attachments');
    return false;
  }

  return resolveAlert({
    sourceId: tripId,
    sourceType: 'trip',
    category: 'fuel_anomaly',
    issueType: 'missing_documents',
    resolutionComment: comment,
    resolvedBy,
  });
};