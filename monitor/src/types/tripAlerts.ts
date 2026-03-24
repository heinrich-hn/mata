// types/tripAlerts.ts
export interface TripAlertContext {
  tripId: string;
    tripNumber: string;
      fleetNumber?: string;
        driverName?: string;
          clientName?: string;
            departureDate?: string;
              revenueCurrency?: string;
              }

              export interface TripAlertMetadata {
                trip_id: string;
                  trip_number: string;
                    issue_type: 'duplicate_pod' | 'missing_revenue' | 'flagged_costs' | 'no_costs' | 'unverified_costs' | 'missing_documents' | 'long_running' | 'flagged_trip';
                      fleet_number?: string;
                        driver_name?: string;
                          client_name?: string;
                            duplicate_count?: number;
                              flagged_count?: number;
                                unverified_count?: number;
                                  missing_document_count?: number;
                                    days_in_progress?: number;
                                      revenue_amount?: number;
                                        flag_reason?: string;
                                          is_flagged?: boolean;
                                            needs_review?: boolean;
                                              // Additional metadata fields
                                                pod_number?: string;
                                                  duplicate_trip_ids?: string[];
                                                  }

                                                  export interface TripAlert {
                                                    id: string;
                                                      source_type: string;        // Will be 'trip'
                                                        source_id: string;           // The trip UUID
                                                          source_label: string;        // Human-readable label like "Trip TN-123"
                                                            title: string;
                                                              message: string;
                                                                category: 'duplicate_pod' | 'load_exception' | 'trip_delay' | 'fuel_anomaly';
                                                                  severity: 'critical' | 'high' | 'medium' | 'low';
                                                                    metadata: TripAlertMetadata;  // All trip-specific data goes here
                                                                      status: 'active' | 'resolved';
                                                                        triggered_at: string;        // Required field in your schema
                                                                          resolved_at?: string;
                                                                            created_at: string;
                                                                              // Optional fields from schema
                                                                                config_id?: string | null;
                                                                                  acknowledged_by?: string | null;  // Keep for schema compatibility but don't use
                                                                                    acknowledged_at?: string | null;  // Keep for schema compatibility but don't use
                                                                                      resolution_note?: string | null;
                                                                                        expires_at?: string | null;
                                                                                        }