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

export const resolveAlert = async (options: ResolveAlertOptions): Promise<boolean> => {
  try {
    let query = supabase
      .from('alerts')
      .update({ 
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_comment: options.resolutionComment,
        resolved_by: options.resolvedBy
      })
      .eq('status', 'active');

    // Apply filters
    if (options.sourceId) {
      query = query.eq('source_id', options.sourceId);
    }
    
    if (options.sourceType) {
      query = query.eq('source_type', options.sourceType);
    }
    
    if (options.category) {
      query = query.eq('category', options.category);
    }
    
    if (options.issueType) {
      query = query.eq('metadata->>issue_type', options.issueType);
    }

    const { error, data } = await query.select();

    if (error) {
      console.error('Error resolving alert:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Failed to resolve alert:', error);
    return false;
  }
};

// Specific function for missing revenue alerts
export const resolveMissingRevenueAlert = async (
  tripId: string, 
  tripNumber: string, 
  comment: string, 
  resolvedBy: string
): Promise<boolean> => {
  return resolveAlert({
    sourceId: tripId,
    sourceType: 'trip',
    category: 'load_exception',
    issueType: 'missing_revenue',
    resolutionComment: comment,
    resolvedBy,
    metadata: {
      trip_id: tripId,
      trip_number: tripNumber,
      resolved_at: new Date().toISOString()
    }
  });
};

// Function to resolve duplicate POD alerts
export const resolveDuplicatePodAlert = async (
  podNumber: string,
  comment: string,
  resolvedBy: string
): Promise<boolean> => {
  return resolveAlert({
    sourceId: podNumber,
    sourceType: 'system',
    category: 'duplicate_pod',
    resolutionComment: comment,
    resolvedBy,
    metadata: {
      pod_number: podNumber,
      resolved_at: new Date().toISOString()
    }
  });
};

// Function to resolve flagged cost alerts
export const resolveFlaggedCostAlert = async (
  tripId: string,
  costId: string,
  comment: string,
  resolvedBy: string
): Promise<boolean> => {
  return resolveAlert({
    sourceId: tripId,
    sourceType: 'trip',
    category: 'load_exception',
    issueType: 'flagged_costs',
    resolutionComment: comment,
    resolvedBy,
    metadata: {
      trip_id: tripId,
      cost_id: costId,
      resolved_at: new Date().toISOString()
    }
  });
};

// Function to resolve no costs alerts
export const resolveNoCostsAlert = async (
  tripId: string,
  comment: string,
  resolvedBy: string
): Promise<boolean> => {
  return resolveAlert({
    sourceId: tripId,
    sourceType: 'trip',
    category: 'fuel_anomaly',
    issueType: 'no_costs',
    resolutionComment: comment,
    resolvedBy,
    metadata: {
      trip_id: tripId,
      resolved_at: new Date().toISOString()
    }
  });
};