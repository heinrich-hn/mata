export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_areas: {
        Row: {
          access_area_id: number
          access_area_name: string
        }
        Insert: {
          access_area_id?: number
          access_area_name: string
        }
        Update: {
          access_area_id?: number
          access_area_name?: string
        }
        Relationships: []
      }
      action_items: {
        Row: {
          assigned_to: string | null
          category: string | null
          comments: Json | null
          completed_date: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          comments?: Json | null
          completed_date?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          comments?: Json | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      additional_cost_documents: {
        Row: {
          additional_cost_id: string
          created_at: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          filename: string
          id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          additional_cost_id: string
          created_at?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          filename: string
          id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          additional_cost_id?: string
          created_at?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          filename?: string
          id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "additional_cost_documents_additional_cost_id_fkey"
            columns: ["additional_cost_id"]
            isOneToOne: false
            referencedRelation: "trip_additional_costs"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_notifications: {
        Row: {
          alert_id: string
          delivered_at: string | null
          delivery_status: string | null
          error_message: string | null
          id: string
          notification_method: string
          read_at: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_role: string
          sent_at: string | null
        }
        Insert: {
          alert_id: string
          delivered_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          notification_method: string
          read_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_role: string
          sent_at?: string | null
        }
        Update: {
          alert_id?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          notification_method?: string
          read_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_role?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "vehicle_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      axle_configurations: {
        Row: {
          axle_number: number
          axle_type: string
          created_at: string | null
          description: string | null
          id: string
          position_count: number
          vehicle_id: string | null
        }
        Insert: {
          axle_number: number
          axle_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          position_count: number
          vehicle_id?: string | null
        }
        Update: {
          axle_number?: number
          axle_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          position_count?: number
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "axle_configurations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      car_reports: {
        Row: {
          actual_completion_date: string | null
          attachments: Json | null
          corrective_actions: string | null
          created_at: string | null
          description: string
          driver_name: string
          fleet_number: string | null
          id: string
          immediate_action_taken: string | null
          incident_date: string
          incident_location: string | null
          incident_time: string | null
          incident_type: string
          preventive_measures: string | null
          reference_event_id: string | null
          report_number: string
          responsible_person: string | null
          root_cause_analysis: string | null
          severity: string | null
          status: string | null
          target_completion_date: string | null
          updated_at: string | null
        }
        Insert: {
          actual_completion_date?: string | null
          attachments?: Json | null
          corrective_actions?: string | null
          created_at?: string | null
          description: string
          driver_name: string
          fleet_number?: string | null
          id?: string
          immediate_action_taken?: string | null
          incident_date: string
          incident_location?: string | null
          incident_time?: string | null
          incident_type: string
          preventive_measures?: string | null
          reference_event_id?: string | null
          report_number: string
          responsible_person?: string | null
          root_cause_analysis?: string | null
          severity?: string | null
          status?: string | null
          target_completion_date?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_completion_date?: string | null
          attachments?: Json | null
          corrective_actions?: string | null
          created_at?: string | null
          description?: string
          driver_name?: string
          fleet_number?: string | null
          id?: string
          immediate_action_taken?: string | null
          incident_date?: string
          incident_location?: string | null
          incident_time?: string | null
          incident_type?: string
          preventive_measures?: string | null
          reference_event_id?: string | null
          report_number?: string
          responsible_person?: string | null
          root_cause_analysis?: string | null
          severity?: string | null
          status?: string | null
          target_completion_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_addresses: {
        Row: {
          address_type: string | null
          city: string | null
          client_id: string
          country: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          postal_code: string | null
          province_state: string | null
          street_address: string | null
          updated_at: string | null
        }
        Insert: {
          address_type?: string | null
          city?: string | null
          client_id: string
          country?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          postal_code?: string | null
          province_state?: string | null
          street_address?: string | null
          updated_at?: string | null
        }
        Update: {
          address_type?: string | null
          city?: string | null
          client_id?: string
          country?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          postal_code?: string | null
          province_state?: string | null
          street_address?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          contact_name: string
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          phone: string | null
          position: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          contact_name: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          contact_name?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_types: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          type: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_types_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cost_attachments: {
        Row: {
          cost_id: string
          created_at: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          filename: string
          id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          cost_id: string
          created_at?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          filename: string
          id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          cost_id?: string
          created_at?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          filename?: string
          id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_attachments_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "cost_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_entries: {
        Row: {
          amount: number
          attachments: Json | null
          category: string
          created_at: string | null
          currency: string | null
          date: string
          flag_reason: string | null
          id: string
          investigation_notes: string | null
          investigation_status: string | null
          is_flagged: boolean | null
          is_system_generated: boolean | null
          notes: string | null
          reference_number: string | null
          resolved_at: string | null
          resolved_by: string | null
          sub_category: string | null
          trip_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          attachments?: Json | null
          category: string
          created_at?: string | null
          currency?: string | null
          date: string
          flag_reason?: string | null
          id?: string
          investigation_notes?: string | null
          investigation_status?: string | null
          is_flagged?: boolean | null
          is_system_generated?: boolean | null
          notes?: string | null
          reference_number?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sub_category?: string | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          attachments?: Json | null
          category?: string
          created_at?: string | null
          currency?: string | null
          date?: string
          flag_reason?: string | null
          id?: string
          investigation_notes?: string | null
          investigation_status?: string | null
          is_flagged?: boolean | null
          is_system_generated?: boolean | null
          notes?: string | null
          reference_number?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sub_category?: string | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      cra_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contributing_factors: string | null
          corrective_actions_taken: string
          cra_number: string
          created_at: string | null
          discovered_by: string
          discovery_date: string
          follow_up_requirements: string | null
          id: string
          issue_category: string
          issue_description: string
          preventive_measures: string
          reviewed_at: string | null
          reviewed_by: string | null
          risk_assessment: string | null
          root_cause: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          testing_results: string | null
          updated_at: string | null
          vehicle_id: string
          verification_date: string | null
          verification_method: string | null
          verified_by: string | null
          work_order_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contributing_factors?: string | null
          corrective_actions_taken: string
          cra_number: string
          created_at?: string | null
          discovered_by: string
          discovery_date: string
          follow_up_requirements?: string | null
          id?: string
          issue_category: string
          issue_description: string
          preventive_measures: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_assessment?: string | null
          root_cause: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          testing_results?: string | null
          updated_at?: string | null
          vehicle_id: string
          verification_date?: string | null
          verification_method?: string | null
          verified_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contributing_factors?: string | null
          corrective_actions_taken?: string
          cra_number?: string
          created_at?: string | null
          discovered_by?: string
          discovery_date?: string
          follow_up_requirements?: string | null
          id?: string
          issue_category?: string
          issue_description?: string
          preventive_measures?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_assessment?: string | null
          root_cause?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          testing_results?: string | null
          updated_at?: string | null
          vehicle_id?: string
          verification_date?: string | null
          verification_method?: string | null
          verified_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cra_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cra_reports_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_norms: {
        Row: {
          created_at: string | null
          expected_km_per_litre: number
          fleet_number: string
          id: string
          last_updated: string
          max_acceptable: number
          min_acceptable: number
          tolerance_percentage: number
          updated_at: string | null
          updated_by: string
        }
        Insert: {
          created_at?: string | null
          expected_km_per_litre: number
          fleet_number: string
          id?: string
          last_updated?: string
          max_acceptable: number
          min_acceptable: number
          tolerance_percentage?: number
          updated_at?: string | null
          updated_by: string
        }
        Update: {
          created_at?: string | null
          expected_km_per_litre?: number
          fleet_number?: string
          id?: string
          last_updated?: string
          max_acceptable?: number
          min_acceptable?: number
          tolerance_percentage?: number
          updated_at?: string | null
          updated_by?: string
        }
        Relationships: []
      }
      diesel_records: {
        Row: {
          cost_per_litre: number | null
          created_at: string | null
          currency: string | null
          date: string
          debrief_date: string | null
          debrief_notes: string | null
          debrief_signed: boolean | null
          debrief_signed_at: string | null
          debrief_signed_by: string | null
          distance_travelled: number | null
          driver_name: string | null
          fleet_number: string
          fuel_station: string
          id: string
          is_probe_verified: boolean | null
          km_per_litre: number | null
          km_reading: number
          litres_filled: number
          notes: string | null
          previous_km_reading: number | null
          probe_action_taken: string | null
          probe_attachments: Json | null
          probe_discrepancy: number | null
          probe_reading: number | null
          probe_verification_date: string | null
          probe_verification_notes: string | null
          probe_verified: boolean | null
          probe_verified_at: string | null
          probe_verified_by: string | null
          signed_at: string | null
          signed_by: string | null
          total_cost: number
          trip_id: string | null
          updated_at: string | null
        }
        Insert: {
          cost_per_litre?: number | null
          created_at?: string | null
          currency?: string | null
          date: string
          debrief_date?: string | null
          debrief_notes?: string | null
          debrief_signed?: boolean | null
          debrief_signed_at?: string | null
          debrief_signed_by?: string | null
          distance_travelled?: number | null
          driver_name?: string | null
          fleet_number: string
          fuel_station: string
          id?: string
          is_probe_verified?: boolean | null
          km_per_litre?: number | null
          km_reading: number
          litres_filled: number
          notes?: string | null
          previous_km_reading?: number | null
          probe_action_taken?: string | null
          probe_attachments?: Json | null
          probe_discrepancy?: number | null
          probe_reading?: number | null
          probe_verification_date?: string | null
          probe_verification_notes?: string | null
          probe_verified?: boolean | null
          probe_verified_at?: string | null
          probe_verified_by?: string | null
          signed_at?: string | null
          signed_by?: string | null
          total_cost: number
          trip_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cost_per_litre?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string
          debrief_date?: string | null
          debrief_notes?: string | null
          debrief_signed?: boolean | null
          debrief_signed_at?: string | null
          debrief_signed_by?: string | null
          distance_travelled?: number | null
          driver_name?: string | null
          fleet_number?: string
          fuel_station?: string
          id?: string
          is_probe_verified?: boolean | null
          km_per_litre?: number | null
          km_reading?: number
          litres_filled?: number
          notes?: string | null
          previous_km_reading?: number | null
          probe_action_taken?: string | null
          probe_attachments?: Json | null
          probe_discrepancy?: number | null
          probe_reading?: number | null
          probe_verification_date?: string | null
          probe_verification_notes?: string | null
          probe_verified?: boolean | null
          probe_verified_at?: string | null
          probe_verified_by?: string | null
          signed_at?: string | null
          signed_by?: string | null
          total_cost?: number
          trip_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_records_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      document_approvals: {
        Row: {
          approval_level: Database["public"]["Enums"]["approval_level"]
          approval_sequence: number
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          created_at: string | null
          document_id: string
          due_date: string | null
          id: string
          notified_at: string | null
          rejection_reason: string | null
          reminder_sent_at: string | null
          required_role: string
          revision_notes: string | null
          status: Database["public"]["Enums"]["document_approval_status"]
          updated_at: string | null
        }
        Insert: {
          approval_level: Database["public"]["Enums"]["approval_level"]
          approval_sequence: number
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string | null
          document_id: string
          due_date?: string | null
          id?: string
          notified_at?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          required_role: string
          revision_notes?: string | null
          status?: Database["public"]["Enums"]["document_approval_status"]
          updated_at?: string | null
        }
        Update: {
          approval_level?: Database["public"]["Enums"]["approval_level"]
          approval_sequence?: number
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string | null
          document_id?: string
          due_date?: string | null
          id?: string
          notified_at?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          required_role?: string
          revision_notes?: string | null
          status?: Database["public"]["Enums"]["document_approval_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_approvals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "work_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_behavior_events: {
        Row: {
          attachments: Json | null
          car_report_id: string | null
          corrective_action_taken: string | null
          created_at: string | null
          description: string
          driver_name: string
          event_date: string
          event_time: string | null
          event_type: string
          fleet_number: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          location: string | null
          points: number | null
          severity: string | null
          status: string | null
          updated_at: string | null
          witness_name: string | null
          witness_statement: string | null
        }
        Insert: {
          attachments?: Json | null
          car_report_id?: string | null
          corrective_action_taken?: string | null
          created_at?: string | null
          description: string
          driver_name: string
          event_date: string
          event_time?: string | null
          event_type: string
          fleet_number?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          location?: string | null
          points?: number | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          witness_name?: string | null
          witness_statement?: string | null
        }
        Update: {
          attachments?: Json | null
          car_report_id?: string | null
          corrective_action_taken?: string | null
          created_at?: string | null
          description?: string
          driver_name?: string
          event_date?: string
          event_time?: string | null
          event_type?: string
          fleet_number?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          location?: string | null
          points?: number | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          witness_name?: string | null
          witness_statement?: string | null
        }
        Relationships: []
      }
      fault_history: {
        Row: {
          component: string | null
          cost: number | null
          created_at: string | null
          days_since_last_repair: number | null
          fault_category: string
          fault_id: string
          id: string
          job_card_id: string | null
          notes: string | null
          recurrence_count: number | null
          repair_date: string | null
          technician_name: string | null
          vehicle_id: string
          work_order_id: string | null
        }
        Insert: {
          component?: string | null
          cost?: number | null
          created_at?: string | null
          days_since_last_repair?: number | null
          fault_category: string
          fault_id: string
          id?: string
          job_card_id?: string | null
          notes?: string | null
          recurrence_count?: number | null
          repair_date?: string | null
          technician_name?: string | null
          vehicle_id: string
          work_order_id?: string | null
        }
        Update: {
          component?: string | null
          cost?: number | null
          created_at?: string | null
          days_since_last_repair?: number | null
          fault_category?: string
          fault_id?: string
          id?: string
          job_card_id?: string | null
          notes?: string | null
          recurrence_count?: number | null
          repair_date?: string | null
          technician_name?: string | null
          vehicle_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fault_history_fault_id_fkey"
            columns: ["fault_id"]
            isOneToOne: false
            referencedRelation: "vehicle_faults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_history_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_14l_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_15l_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_33h_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_3t_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_6f_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_6h_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_7f_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_8f_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_ud_tyres: {
        Row: {
          id: string
          position: string
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          position: string
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          position?: string
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inspection_faults: {
        Row: {
          corrective_action_by: string | null
          corrective_action_date: string | null
          corrective_action_notes: string | null
          corrective_action_status: string | null
          created_at: string | null
          estimated_cost: number | null
          fault_description: string
          id: string
          inspection_id: string
          inspection_item_id: string | null
          job_card_id: string | null
          requires_immediate_attention: boolean | null
          severity: Database["public"]["Enums"]["fault_severity"]
        }
        Insert: {
          corrective_action_by?: string | null
          corrective_action_date?: string | null
          corrective_action_notes?: string | null
          corrective_action_status?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          fault_description: string
          id?: string
          inspection_id: string
          inspection_item_id?: string | null
          job_card_id?: string | null
          requires_immediate_attention?: boolean | null
          severity?: Database["public"]["Enums"]["fault_severity"]
        }
        Update: {
          corrective_action_by?: string | null
          corrective_action_date?: string | null
          corrective_action_notes?: string | null
          corrective_action_status?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          fault_description?: string
          id?: string
          inspection_id?: string
          inspection_item_id?: string | null
          job_card_id?: string | null
          requires_immediate_attention?: boolean | null
          severity?: Database["public"]["Enums"]["fault_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "inspection_faults_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_faults_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_faults_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          action_required: boolean | null
          category: string
          created_at: string | null
          id: string
          inspection_id: string
          item_name: string
          notes: string | null
          status: Database["public"]["Enums"]["inspection_item_status"] | null
          updated_at: string | null
        }
        Insert: {
          action_required?: boolean | null
          category: string
          created_at?: string | null
          id?: string
          inspection_id: string
          item_name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["inspection_item_status"] | null
          updated_at?: string | null
        }
        Update: {
          action_required?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          inspection_id?: string
          item_name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["inspection_item_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          caption: string | null
          file_size: number | null
          id: string
          inspection_id: string
          inspection_item_id: string | null
          photo_type: string | null
          photo_url: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          file_size?: number | null
          id?: string
          inspection_id: string
          inspection_item_id?: string | null
          photo_type?: string | null
          photo_url: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          file_size?: number | null
          id?: string
          inspection_id?: string
          inspection_item_id?: string | null
          photo_type?: string | null
          photo_url?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_photos_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          employee_id: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          category: string
          created_at: string | null
          id: string
          location: string | null
          min_quantity: number
          name: string
          part_number: string
          quantity: number
          supplier: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          location?: string | null
          min_quantity?: number
          name: string
          part_number: string
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          location?: string | null
          min_quantity?: number
          name?: string
          part_number?: string
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          sent_at: string | null
          status: string | null
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          sent_at?: string | null
          status?: string | null
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          sent_at?: string | null
          status?: string | null
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      job_card_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          job_card_id: string | null
          note: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          job_card_id?: string | null
          note: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          job_card_id?: string | null
          note?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_card_notes_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      job_card_templates: {
        Row: {
          created_at: string | null
          default_parts: Json | null
          default_priority: string | null
          default_tasks: Json | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_parts?: Json | null
          default_priority?: string | null
          default_tasks?: Json | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_parts?: Json | null
          default_priority?: string | null
          default_tasks?: Json | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      job_cards: {
        Row: {
          assignee: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          inspection_id: string | null
          job_number: string
          priority: string
          status: string
          title: string
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          assignee?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          inspection_id?: string | null
          job_number: string
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          assignee?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          inspection_id?: string | null
          job_number?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_entries: {
        Row: {
          created_at: string | null
          description: string | null
          hourly_rate: number
          hours_worked: number
          id: string
          job_card_id: string | null
          task_id: string | null
          technician_name: string
          total_cost: number | null
          updated_at: string | null
          work_date: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hourly_rate?: number
          hours_worked?: number
          id?: string
          job_card_id?: string | null
          task_id?: string | null
          technician_name: string
          total_cost?: number | null
          updated_at?: string | null
          work_date?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hourly_rate?: number
          hours_worked?: number
          id?: string
          job_card_id?: string | null
          task_id?: string | null
          technician_name?: string
          total_cost?: number | null
          updated_at?: string | null
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labor_entries_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      missed_loads: {
        Row: {
          actual_loss: number | null
          client_name: string
          compensation_notes: string | null
          compensation_offered: number | null
          competitor_won: boolean | null
          created_at: string | null
          currency: string | null
          customer_name: string | null
          estimated_loss: number | null
          estimated_revenue: number | null
          follow_up_required: boolean | null
          id: string
          impact: string | null
          load_reference: string
          load_request_date: string | null
          missed_date: string
          notes: string | null
          reason: string
          reason_category: string | null
          reason_description: string | null
          recorded_at: string | null
          recorded_by: string | null
          recovery_plan: string | null
          requested_delivery_date: string | null
          requested_pickup_date: string | null
          resolution_notes: string | null
          resolution_status: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_date: string | null
          responsible_party: string | null
          route: string | null
          scheduled_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_loss?: number | null
          client_name: string
          compensation_notes?: string | null
          compensation_offered?: number | null
          competitor_won?: boolean | null
          created_at?: string | null
          currency?: string | null
          customer_name?: string | null
          estimated_loss?: number | null
          estimated_revenue?: number | null
          follow_up_required?: boolean | null
          id?: string
          impact?: string | null
          load_reference: string
          load_request_date?: string | null
          missed_date: string
          notes?: string | null
          reason: string
          reason_category?: string | null
          reason_description?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
          recovery_plan?: string | null
          requested_delivery_date?: string | null
          requested_pickup_date?: string | null
          resolution_notes?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_date?: string | null
          responsible_party?: string | null
          route?: string | null
          scheduled_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_loss?: number | null
          client_name?: string
          compensation_notes?: string | null
          compensation_offered?: number | null
          competitor_won?: boolean | null
          created_at?: string | null
          currency?: string | null
          customer_name?: string | null
          estimated_loss?: number | null
          estimated_revenue?: number | null
          follow_up_required?: boolean | null
          id?: string
          impact?: string | null
          load_reference?: string
          load_request_date?: string | null
          missed_date?: string
          notes?: string | null
          reason?: string
          reason_category?: string | null
          reason_description?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
          recovery_plan?: string | null
          requested_delivery_date?: string | null
          requested_pickup_date?: string | null
          resolution_notes?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_date?: string | null
          responsible_party?: string | null
          route?: string | null
          scheduled_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      parts_requests: {
        Row: {
          created_at: string | null
          id: string
          job_card_id: string | null
          notes: string | null
          part_name: string
          part_number: string | null
          quantity: number
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_card_id?: string | null
          notes?: string | null
          part_name: string
          part_number?: string | null
          quantity: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_card_id?: string | null
          notes?: string | null
          part_name?: string
          part_number?: string | null
          quantity?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_requests_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_checks: {
        Row: {
          check_sequence: number
          checked_at: string | null
          checked_by: string | null
          checkpoint_description: string | null
          checkpoint_name: string
          created_at: string | null
          id: string
          notes: string | null
          requires_action: boolean | null
          status: string
          work_order_id: string
        }
        Insert: {
          check_sequence: number
          checked_at?: string | null
          checked_by?: string | null
          checkpoint_description?: string | null
          checkpoint_name: string
          created_at?: string | null
          id?: string
          notes?: string | null
          requires_action?: boolean | null
          status?: string
          work_order_id: string
        }
        Update: {
          check_sequence?: number
          checked_at?: string | null
          checked_by?: string | null
          checkpoint_description?: string | null
          checkpoint_name?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          requires_action?: boolean | null
          status?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_checks_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_issue_patterns: {
        Row: {
          average_days_between_occurrences: number | null
          component: string | null
          created_at: string | null
          fault_category: string | null
          first_occurrence_date: string
          id: string
          investigation_notes: string | null
          investigation_status: string | null
          last_occurrence_date: string
          occurrence_count: number
          pattern_severity: string
          pattern_type: string
          related_fault_ids: Json | null
          related_work_order_ids: Json | null
          requires_investigation: boolean | null
          total_cost: number | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          average_days_between_occurrences?: number | null
          component?: string | null
          created_at?: string | null
          fault_category?: string | null
          first_occurrence_date: string
          id?: string
          investigation_notes?: string | null
          investigation_status?: string | null
          last_occurrence_date: string
          occurrence_count?: number
          pattern_severity?: string
          pattern_type: string
          related_fault_ids?: Json | null
          related_work_order_ids?: Json | null
          requires_investigation?: boolean | null
          total_cost?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          average_days_between_occurrences?: number | null
          component?: string | null
          created_at?: string | null
          fault_category?: string | null
          first_occurrence_date?: string
          id?: string
          investigation_notes?: string | null
          investigation_status?: string | null
          last_occurrence_date?: string
          occurrence_count?: number
          pattern_severity?: string
          pattern_type?: string
          related_fault_ids?: Json | null
          related_work_order_ids?: Json | null
          requires_investigation?: boolean | null
          total_cost?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_issue_patterns_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          role_id: number
          role_name: string
        }
        Insert: {
          role_id?: number
          role_name: string
        }
        Update: {
          role_id?: number
          role_name?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assignee: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          job_card_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assignee?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          job_card_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assignee?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          job_card_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_additional_costs: {
        Row: {
          added_by: string | null
          amount: number
          cost_type: string
          created_at: string | null
          currency: string
          id: string
          notes: string | null
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          added_by?: string | null
          amount: number
          cost_type: string
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          added_by?: string | null
          amount?: number
          cost_type?: string
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_additional_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_deletions: {
        Row: {
          confirmation_text: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string
          deletion_reason: string
          id: string
          trip_data: Json
          trip_id: string
          trip_number: string
        }
        Insert: {
          confirmation_text: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by: string
          deletion_reason: string
          id?: string
          trip_data: Json
          trip_id: string
          trip_number: string
        }
        Update: {
          confirmation_text?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string
          deletion_reason?: string
          id?: string
          trip_data?: Json
          trip_id?: string
          trip_number?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          actual_arrival_date: string | null
          actual_departure_date: string | null
          additional_costs: Json | null
          arrival_date: string | null
          auto_completed_at: string | null
          auto_completed_reason: string | null
          bank_reference: string | null
          base_revenue: number | null
          client_id: string | null
          client_name: string | null
          client_type: string | null
          completed_at: string | null
          completed_by: string | null
          completion_validation: Json | null
          created_at: string | null
          delay_reasons: Json | null
          delivered_status: boolean | null
          departure_date: string | null
          description: string | null
          destination: string | null
          distance_km: number | null
          driver_name: string | null
          edit_history: Json | null
          external_load_ref: string | null
          final_invoice_amount: number | null
          follow_up_history: Json | null
          id: string
          import_source: string | null
          invoice_attachments: Json | null
          invoice_number: string | null
          invoice_submitted_date: string | null
          load_type: string | null
          origin: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_notes: string | null
          payment_received_date: string | null
          payment_status: string | null
          planned_arrival_date: string | null
          planned_departure_date: string | null
          revenue_currency: string | null
          route: string | null
          shipped_status: boolean | null
          status: string | null
          trip_duration_hours: number | null
          trip_number: string
          updated_at: string | null
          validation_notes: string | null
          vehicle_id: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          actual_departure_date?: string | null
          additional_costs?: Json | null
          arrival_date?: string | null
          auto_completed_at?: string | null
          auto_completed_reason?: string | null
          bank_reference?: string | null
          base_revenue?: number | null
          client_id?: string | null
          client_name?: string | null
          client_type?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_validation?: Json | null
          created_at?: string | null
          delay_reasons?: Json | null
          delivered_status?: boolean | null
          departure_date?: string | null
          description?: string | null
          destination?: string | null
          distance_km?: number | null
          driver_name?: string | null
          edit_history?: Json | null
          external_load_ref?: string | null
          final_invoice_amount?: number | null
          follow_up_history?: Json | null
          id?: string
          import_source?: string | null
          invoice_attachments?: Json | null
          invoice_number?: string | null
          invoice_submitted_date?: string | null
          load_type?: string | null
          origin?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_received_date?: string | null
          payment_status?: string | null
          planned_arrival_date?: string | null
          planned_departure_date?: string | null
          revenue_currency?: string | null
          route?: string | null
          shipped_status?: boolean | null
          status?: string | null
          trip_duration_hours?: number | null
          trip_number: string
          updated_at?: string | null
          validation_notes?: string | null
          vehicle_id?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          actual_departure_date?: string | null
          additional_costs?: Json | null
          arrival_date?: string | null
          auto_completed_at?: string | null
          auto_completed_reason?: string | null
          bank_reference?: string | null
          base_revenue?: number | null
          client_id?: string | null
          client_name?: string | null
          client_type?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_validation?: Json | null
          created_at?: string | null
          delay_reasons?: Json | null
          delivered_status?: boolean | null
          departure_date?: string | null
          description?: string | null
          destination?: string | null
          distance_km?: number | null
          driver_name?: string | null
          edit_history?: Json | null
          external_load_ref?: string | null
          final_invoice_amount?: number | null
          follow_up_history?: Json | null
          id?: string
          import_source?: string | null
          invoice_attachments?: Json | null
          invoice_number?: string | null
          invoice_submitted_date?: string | null
          load_type?: string | null
          origin?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_received_date?: string | null
          payment_status?: string | null
          planned_arrival_date?: string | null
          planned_departure_date?: string | null
          revenue_currency?: string | null
          route?: string | null
          shipped_status?: boolean | null
          status?: string | null
          trip_duration_hours?: number | null
          trip_number?: string
          updated_at?: string | null
          validation_notes?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tyre_configs: {
        Row: {
          aspect_ratio: number
          brand: string
          config_name: string
          construction: string | null
          created_at: string | null
          factory_tread_depth: number
          id: string
          life_expectancy: number | null
          load_index: number | null
          max_pressure: number | null
          metric_type: string | null
          minimum_tread_depth: number
          model: string
          notes: string | null
          recommended_pressure: number | null
          rim_diameter: number
          speed_rating: string | null
          updated_at: string | null
          width: number
        }
        Insert: {
          aspect_ratio: number
          brand: string
          config_name: string
          construction?: string | null
          created_at?: string | null
          factory_tread_depth: number
          id?: string
          life_expectancy?: number | null
          load_index?: number | null
          max_pressure?: number | null
          metric_type?: string | null
          minimum_tread_depth: number
          model: string
          notes?: string | null
          recommended_pressure?: number | null
          rim_diameter: number
          speed_rating?: string | null
          updated_at?: string | null
          width: number
        }
        Update: {
          aspect_ratio?: number
          brand?: string
          config_name?: string
          construction?: string | null
          created_at?: string | null
          factory_tread_depth?: number
          id?: string
          life_expectancy?: number | null
          load_index?: number | null
          max_pressure?: number | null
          metric_type?: string | null
          minimum_tread_depth?: number
          model?: string
          notes?: string | null
          recommended_pressure?: number | null
          rim_diameter?: number
          speed_rating?: string | null
          updated_at?: string | null
          width?: number
        }
        Relationships: []
      }
      tyre_inspections: {
        Row: {
          condition: Database["public"]["Enums"]["tyre_condition"]
          created_at: string | null
          id: string
          inspection_date: string | null
          inspector_name: string | null
          notes: string | null
          photos: string[] | null
          position: Database["public"]["Enums"]["tyre_position"]
          pressure: number | null
          tread_depth: number | null
          tyre_id: string | null
          vehicle_id: string
          wear_pattern: Database["public"]["Enums"]["tyre_wear_pattern"] | null
        }
        Insert: {
          condition: Database["public"]["Enums"]["tyre_condition"]
          created_at?: string | null
          id?: string
          inspection_date?: string | null
          inspector_name?: string | null
          notes?: string | null
          photos?: string[] | null
          position: Database["public"]["Enums"]["tyre_position"]
          pressure?: number | null
          tread_depth?: number | null
          tyre_id?: string | null
          vehicle_id: string
          wear_pattern?: Database["public"]["Enums"]["tyre_wear_pattern"] | null
        }
        Update: {
          condition?: Database["public"]["Enums"]["tyre_condition"]
          created_at?: string | null
          id?: string
          inspection_date?: string | null
          inspector_name?: string | null
          notes?: string | null
          photos?: string[] | null
          position?: Database["public"]["Enums"]["tyre_position"]
          pressure?: number | null
          tread_depth?: number | null
          tyre_id?: string | null
          vehicle_id?: string
          wear_pattern?: Database["public"]["Enums"]["tyre_wear_pattern"] | null
        }
        Relationships: [
          {
            foreignKeyName: "tyre_inspections_tyre_id_fkey"
            columns: ["tyre_id"]
            isOneToOne: false
            referencedRelation: "tyres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tyre_inventory: {
        Row: {
          barcode: string | null
          brand: string
          created_at: string | null
          dot_code: string | null
          id: string
          initial_tread_depth: number | null
          location: string | null
          min_quantity: number | null
          model: string
          part_id: string | null
          pressure_rating: number | null
          purchase_cost_usd: number | null
          purchase_cost_zar: number | null
          qr_code: string | null
          quantity: number
          size: string
          status: string | null
          supplier: string | null
          type: string
          tyre_config_id: string | null
          unit_price: number | null
          updated_at: string | null
          vendor: string | null
          warranty_km: number | null
          warranty_months: number | null
        }
        Insert: {
          barcode?: string | null
          brand: string
          created_at?: string | null
          dot_code?: string | null
          id?: string
          initial_tread_depth?: number | null
          location?: string | null
          min_quantity?: number | null
          model: string
          part_id?: string | null
          pressure_rating?: number | null
          purchase_cost_usd?: number | null
          purchase_cost_zar?: number | null
          qr_code?: string | null
          quantity?: number
          size: string
          status?: string | null
          supplier?: string | null
          type: string
          tyre_config_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          vendor?: string | null
          warranty_km?: number | null
          warranty_months?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string
          created_at?: string | null
          dot_code?: string | null
          id?: string
          initial_tread_depth?: number | null
          location?: string | null
          min_quantity?: number | null
          model?: string
          part_id?: string | null
          pressure_rating?: number | null
          purchase_cost_usd?: number | null
          purchase_cost_zar?: number | null
          qr_code?: string | null
          quantity?: number
          size?: string
          status?: string | null
          supplier?: string | null
          type?: string
          tyre_config_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          vendor?: string | null
          warranty_km?: number | null
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tyre_inventory_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_inventory_tyre_config_id_fkey"
            columns: ["tyre_config_id"]
            isOneToOne: false
            referencedRelation: "tyre_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      tyre_lifecycle_events: {
        Row: {
          cost_associated: number | null
          created_at: string | null
          event_date: string | null
          event_type: string | null
          fleet_position: string | null
          id: string
          km_reading: number | null
          metadata: Json | null
          notes: string | null
          performed_by: string | null
          pressure_at_event: number | null
          tread_depth_at_event: number | null
          tyre_code: string
          tyre_id: string
          vehicle_id: string | null
        }
        Insert: {
          cost_associated?: number | null
          created_at?: string | null
          event_date?: string | null
          event_type?: string | null
          fleet_position?: string | null
          id?: string
          km_reading?: number | null
          metadata?: Json | null
          notes?: string | null
          performed_by?: string | null
          pressure_at_event?: number | null
          tread_depth_at_event?: number | null
          tyre_code: string
          tyre_id: string
          vehicle_id?: string | null
        }
        Update: {
          cost_associated?: number | null
          created_at?: string | null
          event_date?: string | null
          event_type?: string | null
          fleet_position?: string | null
          id?: string
          km_reading?: number | null
          metadata?: Json | null
          notes?: string | null
          performed_by?: string | null
          pressure_at_event?: number | null
          tread_depth_at_event?: number | null
          tyre_code?: string
          tyre_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tyre_lifecycle_events_tyre_id_fkey"
            columns: ["tyre_id"]
            isOneToOne: false
            referencedRelation: "tyres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_lifecycle_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tyre_performance: {
        Row: {
          cost_per_km: number | null
          created_at: string | null
          estimated_remaining_km: number | null
          id: string
          km_travelled: number | null
          measurement_date: string | null
          replacement_date: string | null
          tread_wear_rate: number | null
          tyre_id: string
          vehicle_id: string | null
        }
        Insert: {
          cost_per_km?: number | null
          created_at?: string | null
          estimated_remaining_km?: number | null
          id?: string
          km_travelled?: number | null
          measurement_date?: string | null
          replacement_date?: string | null
          tread_wear_rate?: number | null
          tyre_id: string
          vehicle_id?: string | null
        }
        Update: {
          cost_per_km?: number | null
          created_at?: string | null
          estimated_remaining_km?: number | null
          id?: string
          km_travelled?: number | null
          measurement_date?: string | null
          replacement_date?: string | null
          tread_wear_rate?: number | null
          tyre_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tyre_performance_tyre_id_fkey"
            columns: ["tyre_id"]
            isOneToOne: false
            referencedRelation: "tyres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_performance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tyre_position_history: {
        Row: {
          action: string
          created_at: string | null
          fleet_position: string
          from_position: string | null
          id: string
          km_reading: number
          notes: string | null
          performed_at: string | null
          performed_by: string
          to_position: string | null
          tyre_id: string
          vehicle_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          fleet_position: string
          from_position?: string | null
          id?: string
          km_reading: number
          notes?: string | null
          performed_at?: string | null
          performed_by: string
          to_position?: string | null
          tyre_id: string
          vehicle_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          fleet_position?: string
          from_position?: string | null
          id?: string
          km_reading?: number
          notes?: string | null
          performed_at?: string | null
          performed_by?: string
          to_position?: string | null
          tyre_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tyre_position_history_tyre_id_fkey"
            columns: ["tyre_id"]
            isOneToOne: false
            referencedRelation: "tyres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_position_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tyre_positions: {
        Row: {
          active: boolean | null
          created_at: string | null
          dismounted_at: string | null
          id: string
          km_at_dismount: number | null
          km_at_mount: number | null
          mounted_at: string | null
          position: Database["public"]["Enums"]["tyre_position"]
          tyre_id: string | null
          vehicle_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          dismounted_at?: string | null
          id?: string
          km_at_dismount?: number | null
          km_at_mount?: number | null
          mounted_at?: string | null
          position: Database["public"]["Enums"]["tyre_position"]
          tyre_id?: string | null
          vehicle_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          dismounted_at?: string | null
          id?: string
          km_at_dismount?: number | null
          km_at_mount?: number | null
          mounted_at?: string | null
          position?: Database["public"]["Enums"]["tyre_position"]
          tyre_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tyre_positions_tyre_id_fkey"
            columns: ["tyre_id"]
            isOneToOne: false
            referencedRelation: "tyres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_positions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tyre_positions_detailed: {
        Row: {
          axle_config_id: string | null
          created_at: string | null
          current_tyre_id: string | null
          id: string
          is_active: boolean | null
          position_code: string
          position_label: string
          vehicle_id: string | null
        }
        Insert: {
          axle_config_id?: string | null
          created_at?: string | null
          current_tyre_id?: string | null
          id?: string
          is_active?: boolean | null
          position_code: string
          position_label: string
          vehicle_id?: string | null
        }
        Update: {
          axle_config_id?: string | null
          created_at?: string | null
          current_tyre_id?: string | null
          id?: string
          is_active?: boolean | null
          position_code?: string
          position_label?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tyre_positions_detailed_axle_config_id_fkey"
            columns: ["axle_config_id"]
            isOneToOne: false
            referencedRelation: "axle_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_positions_detailed_current_tyre_id_fkey"
            columns: ["current_tyre_id"]
            isOneToOne: false
            referencedRelation: "tyres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_positions_detailed_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tyres: {
        Row: {
          axle_config_id: string | null
          brand: string
          condition: Database["public"]["Enums"]["tyre_condition"] | null
          created_at: string | null
          current_fleet_position: string | null
          current_meter: number | null
          current_tread_depth: number | null
          id: string
          initial_tread_depth: number | null
          installation_date: string | null
          installation_km: number | null
          installed_at: string | null
          installer_name: string | null
          inventory_id: string | null
          km_travelled: number | null
          last_inspection_date: string | null
          model: string
          notes: string | null
          part_id: string | null
          pressure_health: string | null
          purchase_cost_zar: number | null
          purchase_date: string | null
          purchase_price: number | null
          replacement_due_km: number | null
          rotation_due_date: string | null
          serial_number: string | null
          size: string
          tin: string | null
          tread_depth_health: string | null
          type: string
          tyre_config_id: string | null
          updated_at: string | null
        }
        Insert: {
          axle_config_id?: string | null
          brand: string
          condition?: Database["public"]["Enums"]["tyre_condition"] | null
          created_at?: string | null
          current_fleet_position?: string | null
          current_meter?: number | null
          current_tread_depth?: number | null
          id?: string
          initial_tread_depth?: number | null
          installation_date?: string | null
          installation_km?: number | null
          installed_at?: string | null
          installer_name?: string | null
          inventory_id?: string | null
          km_travelled?: number | null
          last_inspection_date?: string | null
          model: string
          notes?: string | null
          part_id?: string | null
          pressure_health?: string | null
          purchase_cost_zar?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          replacement_due_km?: number | null
          rotation_due_date?: string | null
          serial_number?: string | null
          size: string
          tin?: string | null
          tread_depth_health?: string | null
          type: string
          tyre_config_id?: string | null
          updated_at?: string | null
        }
        Update: {
          axle_config_id?: string | null
          brand?: string
          condition?: Database["public"]["Enums"]["tyre_condition"] | null
          created_at?: string | null
          current_fleet_position?: string | null
          current_meter?: number | null
          current_tread_depth?: number | null
          id?: string
          initial_tread_depth?: number | null
          installation_date?: string | null
          installation_km?: number | null
          installed_at?: string | null
          installer_name?: string | null
          inventory_id?: string | null
          km_travelled?: number | null
          last_inspection_date?: string | null
          model?: string
          notes?: string | null
          part_id?: string | null
          pressure_health?: string | null
          purchase_cost_zar?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          replacement_due_km?: number | null
          rotation_due_date?: string | null
          serial_number?: string | null
          size?: string
          tin?: string | null
          tread_depth_health?: string | null
          type?: string
          tyre_config_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tyres_axle_config_id_fkey"
            columns: ["axle_config_id"]
            isOneToOne: false
            referencedRelation: "axle_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyres_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "tyre_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyres_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyres_tyre_config_id_fkey"
            columns: ["tyre_config_id"]
            isOneToOne: false
            referencedRelation: "tyre_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access_areas: {
        Row: {
          access_area_id: number
          user_id: number
        }
        Insert: {
          access_area_id: number
          user_id: number
        }
        Update: {
          access_area_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_access_areas_access_area_id_fkey"
            columns: ["access_area_id"]
            isOneToOne: false
            referencedRelation: "access_areas"
            referencedColumns: ["access_area_id"]
          },
          {
            foreignKeyName: "user_access_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          name: string
          notification_email: string | null
          role_id: number
          shortcode: string
          status: string
          updated_at: string | null
          user_id: number
          username: string
        }
        Insert: {
          created_at?: string | null
          name: string
          notification_email?: string | null
          role_id: number
          shortcode: string
          status: string
          updated_at?: string | null
          user_id?: number
          username: string
        }
        Update: {
          created_at?: string | null
          name?: string
          notification_email?: string | null
          role_id?: number
          shortcode?: string
          status?: string
          updated_at?: string | null
          user_id?: number
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      vehicle_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_number: string
          alert_priority: Database["public"]["Enums"]["alert_priority"]
          alert_type: Database["public"]["Enums"]["alert_type"]
          assigned_to: string | null
          created_at: string | null
          description: string
          id: string
          related_fault_id: string | null
          related_job_card_id: string | null
          related_work_order_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          response_required_by: string | null
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          trigger_details: Json | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_number: string
          alert_priority?: Database["public"]["Enums"]["alert_priority"]
          alert_type: Database["public"]["Enums"]["alert_type"]
          assigned_to?: string | null
          created_at?: string | null
          description: string
          id?: string
          related_fault_id?: string | null
          related_job_card_id?: string | null
          related_work_order_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_required_by?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          trigger_details?: Json | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_number?: string
          alert_priority?: Database["public"]["Enums"]["alert_priority"]
          alert_type?: Database["public"]["Enums"]["alert_type"]
          assigned_to?: string | null
          created_at?: string | null
          description?: string
          id?: string
          related_fault_id?: string | null
          related_job_card_id?: string | null
          related_work_order_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_required_by?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          trigger_details?: Json | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_alerts_related_fault_id_fkey"
            columns: ["related_fault_id"]
            isOneToOne: false
            referencedRelation: "vehicle_faults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_alerts_related_job_card_id_fkey"
            columns: ["related_job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_alerts_related_work_order_id_fkey"
            columns: ["related_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_faults: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          component: string | null
          created_at: string | null
          fault_category: string
          fault_description: string
          fault_number: string
          id: string
          inspection_fault_id: string | null
          inspection_id: string | null
          reported_by: string
          reported_date: string
          resolution_notes: string | null
          resolved_date: string | null
          severity: Database["public"]["Enums"]["fault_severity"]
          status: Database["public"]["Enums"]["fault_status"]
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          component?: string | null
          created_at?: string | null
          fault_category: string
          fault_description: string
          fault_number: string
          id?: string
          inspection_fault_id?: string | null
          inspection_id?: string | null
          reported_by: string
          reported_date?: string
          resolution_notes?: string | null
          resolved_date?: string | null
          severity?: Database["public"]["Enums"]["fault_severity"]
          status?: Database["public"]["Enums"]["fault_status"]
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          component?: string | null
          created_at?: string | null
          fault_category?: string
          fault_description?: string
          fault_number?: string
          id?: string
          inspection_fault_id?: string | null
          inspection_id?: string | null
          reported_by?: string
          reported_date?: string
          resolution_notes?: string | null
          resolved_date?: string | null
          severity?: Database["public"]["Enums"]["fault_severity"]
          status?: Database["public"]["Enums"]["fault_status"]
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_faults_inspection_fault_id_fkey"
            columns: ["inspection_fault_id"]
            isOneToOne: false
            referencedRelation: "inspection_faults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_faults_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_faults_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_inspections: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          digital_signature: string | null
          id: string
          initiated_via: string | null
          inspection_date: string
          inspection_number: string
          inspection_type: string
          inspector_name: string
          inspector_profile_id: string | null
          notes: string | null
          odometer_reading: number | null
          scanned_vehicle_qr: string | null
          status: Database["public"]["Enums"]["inspection_status"]
          updated_at: string | null
          vehicle_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_registration: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          digital_signature?: string | null
          id?: string
          initiated_via?: string | null
          inspection_date?: string
          inspection_number: string
          inspection_type: string
          inspector_name: string
          inspector_profile_id?: string | null
          notes?: string | null
          odometer_reading?: number | null
          scanned_vehicle_qr?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          digital_signature?: string | null
          id?: string
          initiated_via?: string | null
          inspection_date?: string
          inspection_number?: string
          inspection_type?: string
          inspector_name?: string
          inspector_profile_id?: string | null
          notes?: string | null
          odometer_reading?: number | null
          scanned_vehicle_qr?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_inspector_profile_id_fkey"
            columns: ["inspector_profile_id"]
            isOneToOne: false
            referencedRelation: "inspector_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean | null
          created_at: string | null
          engine_specs: string | null
          fleet_number: string | null
          id: string
          make: string
          model: string
          qr_code_value: string | null
          registration_number: string
          tonnage: number | null
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          engine_specs?: string | null
          fleet_number?: string | null
          id?: string
          make: string
          model: string
          qr_code_value?: string | null
          registration_number: string
          tonnage?: number | null
          updated_at?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          engine_specs?: string | null
          fleet_number?: string | null
          id?: string
          make?: string
          model?: string
          qr_code_value?: string | null
          registration_number?: string
          tonnage?: number | null
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      work_completion_checklist: {
        Row: {
          checklist_item: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          document_id: string | null
          id: string
          is_completed: boolean | null
          is_mandatory: boolean | null
          item_type: string
          notes: string | null
          work_order_id: string
        }
        Insert: {
          checklist_item: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          document_id?: string | null
          id?: string
          is_completed?: boolean | null
          is_mandatory?: boolean | null
          item_type: string
          notes?: string | null
          work_order_id: string
        }
        Update: {
          checklist_item?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          document_id?: string | null
          id?: string
          is_completed?: boolean | null
          is_mandatory?: boolean | null
          item_type?: string
          notes?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_completion_checklist_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "work_order_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_completion_checklist_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_documents: {
        Row: {
          access_count: number | null
          archive_date: string | null
          cra_report_id: string | null
          created_at: string | null
          description: string | null
          document_category: string | null
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_format: string
          file_hash: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_archived: boolean | null
          job_card_id: string | null
          last_accessed_at: string | null
          metadata: Json | null
          quality_validated: boolean | null
          retention_period_days: number | null
          title: string
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string
          validation_notes: string | null
          vehicle_id: string | null
          work_order_id: string | null
        }
        Insert: {
          access_count?: number | null
          archive_date?: string | null
          cra_report_id?: string | null
          created_at?: string | null
          description?: string | null
          document_category?: string | null
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_format: string
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_archived?: boolean | null
          job_card_id?: string | null
          last_accessed_at?: string | null
          metadata?: Json | null
          quality_validated?: boolean | null
          retention_period_days?: number | null
          title: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by: string
          validation_notes?: string | null
          vehicle_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          access_count?: number | null
          archive_date?: string | null
          cra_report_id?: string | null
          created_at?: string | null
          description?: string | null
          document_category?: string | null
          document_number?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_format?: string
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_archived?: boolean | null
          job_card_id?: string | null
          last_accessed_at?: string | null
          metadata?: Json | null
          quality_validated?: boolean | null
          retention_period_days?: number | null
          title?: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
          validation_notes?: string | null
          vehicle_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_documents_cra_report_id_fkey"
            columns: ["cra_report_id"]
            isOneToOne: false
            referencedRelation: "cra_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_documents_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_documents_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_documents: {
        Row: {
          approval_status:
            | Database["public"]["Enums"]["document_approval_status"]
            | null
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_format: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_mandatory: boolean | null
          metadata: Json | null
          rejection_reason: string | null
          uploaded_at: string | null
          uploaded_by: string
          verified_at: string | null
          verified_by: string | null
          work_order_id: string
        }
        Insert: {
          approval_status?:
            | Database["public"]["Enums"]["document_approval_status"]
            | null
          description?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_format?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_mandatory?: boolean | null
          metadata?: Json | null
          rejection_reason?: string | null
          uploaded_at?: string | null
          uploaded_by: string
          verified_at?: string | null
          verified_by?: string | null
          work_order_id: string
        }
        Update: {
          approval_status?:
            | Database["public"]["Enums"]["document_approval_status"]
            | null
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_format?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_mandatory?: boolean | null
          metadata?: Json | null
          rejection_reason?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
          verified_at?: string | null
          verified_by?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_documents_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_completion_date: string | null
          actual_hours: number | null
          actual_labor_cost: number | null
          actual_parts_cost: number | null
          actual_start_date: string | null
          actual_total_cost: number | null
          approved_at: string | null
          approved_by: string | null
          assigned_technician: string | null
          cra_report_id: string | null
          created_at: string | null
          created_by: string
          currency: string | null
          description: string | null
          documentation_complete: boolean | null
          estimated_hours: number | null
          estimated_labor_cost: number | null
          estimated_parts_cost: number | null
          estimated_total_cost: number | null
          fault_id: string | null
          id: string
          job_card_id: string | null
          priority: string
          quality_check_completed: boolean | null
          requires_cra_report: boolean | null
          scheduled_end_date: string | null
          scheduled_start_date: string | null
          scope_of_work: string
          status: Database["public"]["Enums"]["work_order_status"]
          submitted_for_approval_at: string | null
          title: string
          updated_at: string | null
          vehicle_id: string
          work_order_number: string
        }
        Insert: {
          actual_completion_date?: string | null
          actual_hours?: number | null
          actual_labor_cost?: number | null
          actual_parts_cost?: number | null
          actual_start_date?: string | null
          actual_total_cost?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_technician?: string | null
          cra_report_id?: string | null
          created_at?: string | null
          created_by: string
          currency?: string | null
          description?: string | null
          documentation_complete?: boolean | null
          estimated_hours?: number | null
          estimated_labor_cost?: number | null
          estimated_parts_cost?: number | null
          estimated_total_cost?: number | null
          fault_id?: string | null
          id?: string
          job_card_id?: string | null
          priority?: string
          quality_check_completed?: boolean | null
          requires_cra_report?: boolean | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          scope_of_work: string
          status?: Database["public"]["Enums"]["work_order_status"]
          submitted_for_approval_at?: string | null
          title: string
          updated_at?: string | null
          vehicle_id: string
          work_order_number: string
        }
        Update: {
          actual_completion_date?: string | null
          actual_hours?: number | null
          actual_labor_cost?: number | null
          actual_parts_cost?: number | null
          actual_start_date?: string | null
          actual_total_cost?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_technician?: string | null
          cra_report_id?: string | null
          created_at?: string | null
          created_by?: string
          currency?: string | null
          description?: string | null
          documentation_complete?: boolean | null
          estimated_hours?: number | null
          estimated_labor_cost?: number | null
          estimated_parts_cost?: number | null
          estimated_total_cost?: number | null
          fault_id?: string | null
          id?: string
          job_card_id?: string | null
          priority?: string
          quality_check_completed?: boolean | null
          requires_cra_report?: boolean | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          scope_of_work?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          submitted_for_approval_at?: string | null
          title?: string
          updated_at?: string | null
          vehicle_id?: string
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_fault_id_fkey"
            columns: ["fault_id"]
            isOneToOne: false
            referencedRelation: "vehicle_faults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fleet_position_analytics: {
        Row: {
          avg_km_per_tyre: number | null
          fleet_number: string | null
          last_change_date: string | null
          position: string | null
          registration_number: string | null
          removal_count: number | null
          tyres_used: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_priority: "critical" | "high" | "medium" | "low"
      alert_status:
        | "active"
        | "acknowledged"
        | "investigating"
        | "resolved"
        | "dismissed"
      alert_type:
        | "repeat_repair_3month"
        | "similar_component"
        | "similar_category"
        | "fleet_pattern"
        | "quality_issue"
        | "cost_overrun"
      approval_level:
        | "technician"
        | "quality_control"
        | "supervisor"
        | "final_approval"
      document_approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revision_required"
      document_type:
        | "before_photo"
        | "after_photo"
        | "progress_photo"
        | "receipt"
        | "invoice"
        | "cra_report"
        | "quality_check"
        | "completion_certificate"
        | "other"
      fault_severity: "critical" | "high" | "medium" | "low"
      fault_status:
        | "identified"
        | "acknowledged"
        | "job_card_created"
        | "in_progress"
        | "resolved"
        | "closed"
      inspection_item_status: "pass" | "fail" | "attention" | "not_applicable"
      inspection_status: "pending" | "in_progress" | "completed" | "cancelled"
      tyre_condition: "excellent" | "good" | "fair" | "poor" | "replace"
      tyre_position:
        | "front_left"
        | "front_right"
        | "rear_left_outer"
        | "rear_left_inner"
        | "rear_right_outer"
        | "rear_right_inner"
        | "spare"
      tyre_wear_pattern: "even" | "center" | "edge" | "cupping" | "feathering"
      vehicle_type: "rigid_truck" | "horse_truck" | "refrigerated_truck"
      work_order_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "in_progress"
        | "pending_documentation"
        | "pending_closure"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      alert_priority: ["critical", "high", "medium", "low"],
      alert_status: [
        "active",
        "acknowledged",
        "investigating",
        "resolved",
        "dismissed",
      ],
      alert_type: [
        "repeat_repair_3month",
        "similar_component",
        "similar_category",
        "fleet_pattern",
        "quality_issue",
        "cost_overrun",
      ],
      approval_level: [
        "technician",
        "quality_control",
        "supervisor",
        "final_approval",
      ],
      document_approval_status: [
        "pending",
        "approved",
        "rejected",
        "revision_required",
      ],
      document_type: [
        "before_photo",
        "after_photo",
        "progress_photo",
        "receipt",
        "invoice",
        "cra_report",
        "quality_check",
        "completion_certificate",
        "other",
      ],
      fault_severity: ["critical", "high", "medium", "low"],
      fault_status: [
        "identified",
        "acknowledged",
        "job_card_created",
        "in_progress",
        "resolved",
        "closed",
      ],
      inspection_item_status: ["pass", "fail", "attention", "not_applicable"],
      inspection_status: ["pending", "in_progress", "completed", "cancelled"],
      tyre_condition: ["excellent", "good", "fair", "poor", "replace"],
      tyre_position: [
        "front_left",
        "front_right",
        "rear_left_outer",
        "rear_left_inner",
        "rear_right_outer",
        "rear_right_inner",
        "spare",
      ],
      tyre_wear_pattern: ["even", "center", "edge", "cupping", "feathering"],
      vehicle_type: ["rigid_truck", "horse_truck", "refrigerated_truck"],
      work_order_status: [
        "draft",
        "pending_approval",
        "approved",
        "in_progress",
        "pending_documentation",
        "pending_closure",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
