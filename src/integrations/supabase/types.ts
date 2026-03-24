export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
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
      additional_notes: {
        Row: {
          created_at: string | null
          id: number
          notes: string | null
          report_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          notes?: string | null
          report_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          notes?: string | null
          report_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "additional_notes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "inspection_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_comments: {
        Row: {
          alert_id: string
          comment: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          alert_id: string
          comment: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          comment?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_comments_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_configurations: {
        Row: {
          category: string
          conditions: Json
          cooldown_minutes: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          notify_email: boolean
          notify_in_app: boolean
          notify_push: boolean
          severity: string
          updated_at: string
        }
        Insert: {
          category: string
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notify_email?: boolean
          notify_in_app?: boolean
          notify_push?: boolean
          severity: string
          updated_at?: string
        }
        Update: {
          category?: string
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notify_email?: boolean
          notify_in_app?: boolean
          notify_push?: boolean
          severity?: string
          updated_at?: string
        }
        Relationships: []
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
      alert_subscriptions: {
        Row: {
          categories: string[] | null
          created_at: string
          device_label: string | null
          id: string
          is_active: boolean
          last_seen_at: string
          min_severity: string
          push_subscription: Json
          user_id: string
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          device_label?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          min_severity?: string
          push_subscription: Json
          user_id: string
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          device_label?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          min_severity?: string
          push_subscription?: Json
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          category: string
          config_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          message: string
          metadata: Json
          resolution_note: string | null
          resolved_at: string | null
          severity: string
          source_id: string | null
          source_label: string | null
          source_type: string
          status: string
          title: string
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category: string
          config_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          severity: string
          source_id?: string | null
          source_label?: string | null
          source_type: string
          status?: string
          title: string
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: string
          config_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          source_id?: string | null
          source_label?: string | null
          source_type?: string
          status?: string
          title?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "alert_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          dimensions: Json
          event_type: string
          id: string
          metrics: Json
          occurred_at: string
          source_id: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          dimensions?: Json
          event_type: string
          id?: string
          metrics?: Json
          occurred_at?: string
          source_id?: string | null
          source_type: string
        }
        Update: {
          created_at?: string
          dimensions?: Json
          event_type?: string
          id?: string
          metrics?: Json
          occurred_at?: string
          source_id?: string | null
          source_type?: string
        }
        Relationships: []
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
        Relationships: []
      }
      calendar_events: {
        Row: {
          assigned_vehicle_id: string | null
          created_at: string | null
          end_time: string
          event_type: string
          id: string
          load_id: string | null
          notes: string | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          assigned_vehicle_id?: string | null
          created_at?: string | null
          end_time: string
          event_type: string
          id?: string
          load_id?: string | null
          notes?: string | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          assigned_vehicle_id?: string | null
          created_at?: string | null
          end_time?: string
          event_type?: string
          id?: string
          load_id?: string | null
          notes?: string | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "calendar_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "calendar_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
        ]
      }
      candidate_evaluation_history: {
        Row: {
          candidate_id: string
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          evaluation_step: Database["public"]["Enums"]["evaluation_step"]
          evaluator_name: string | null
          feedback: string | null
          id: string
          new_status: Database["public"]["Enums"]["evaluation_status"]
          notes: string | null
          previous_status:
          | Database["public"]["Enums"]["evaluation_status"]
          | null
          scheduled_date: string | null
          score: number | null
        }
        Insert: {
          candidate_id: string
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          evaluation_step: Database["public"]["Enums"]["evaluation_step"]
          evaluator_name?: string | null
          feedback?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["evaluation_status"]
          notes?: string | null
          previous_status?:
          | Database["public"]["Enums"]["evaluation_status"]
          | null
          scheduled_date?: string | null
          score?: number | null
        }
        Update: {
          candidate_id?: string
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          evaluation_step?: Database["public"]["Enums"]["evaluation_step"]
          evaluator_name?: string | null
          feedback?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["evaluation_status"]
          notes?: string | null
          previous_status?:
          | Database["public"]["Enums"]["evaluation_status"]
          | null
          scheduled_date?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_evaluation_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "driver_candidates"
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
      checklist_items: {
        Row: {
          category_id: number | null
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          category_id?: number | null
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inspection_categories"
            referencedColumns: ["id"]
          },
        ]
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
      coaching_sessions: {
        Row: {
          action_plan: string | null
          behavior_event_id: string | null
          coaching_notes: string | null
          conducted_by: string
          created_at: string | null
          debriefer_signature: string | null
          driver_acknowledged: boolean | null
          driver_name: string
          driver_signature: string | null
          id: string
          session_date: string
          updated_at: string | null
          witness_name: string | null
          witness_signature: string | null
        }
        Insert: {
          action_plan?: string | null
          behavior_event_id?: string | null
          coaching_notes?: string | null
          conducted_by: string
          created_at?: string | null
          debriefer_signature?: string | null
          driver_acknowledged?: boolean | null
          driver_name: string
          driver_signature?: string | null
          id?: string
          session_date: string
          updated_at?: string | null
          witness_name?: string | null
          witness_signature?: string | null
        }
        Update: {
          action_plan?: string | null
          behavior_event_id?: string | null
          coaching_notes?: string | null
          conducted_by?: string
          created_at?: string | null
          debriefer_signature?: string | null
          driver_acknowledged?: boolean | null
          driver_name?: string
          driver_signature?: string | null
          id?: string
          session_date?: string
          updated_at?: string | null
          witness_name?: string | null
          witness_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_behavior_event_id_fkey"
            columns: ["behavior_event_id"]
            isOneToOne: false
            referencedRelation: "driver_behavior_events"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          department: string | null
          email: string | null
          employee_number: string | null
          first_name: string | null
          hourly_rate: number | null
          id: string
          image_url: string | null
          is_employee: boolean | null
          is_technician: boolean | null
          is_vehicle_operator: boolean | null
          job_title: string | null
          last_name: string | null
          license_class: string | null
          license_expiry_date: string | null
          license_number: string | null
          mobile_number: string | null
          name: string
          notes: string | null
          phone_number: string | null
          postal_code: string | null
          start_date: string | null
          state: string | null
          street_address: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          department?: string | null
          email?: string | null
          employee_number?: string | null
          first_name?: string | null
          hourly_rate?: number | null
          id?: string
          image_url?: string | null
          is_employee?: boolean | null
          is_technician?: boolean | null
          is_vehicle_operator?: boolean | null
          job_title?: string | null
          last_name?: string | null
          license_class?: string | null
          license_expiry_date?: string | null
          license_number?: string | null
          mobile_number?: string | null
          name: string
          notes?: string | null
          phone_number?: string | null
          postal_code?: string | null
          start_date?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          department?: string | null
          email?: string | null
          employee_number?: string | null
          first_name?: string | null
          hourly_rate?: number | null
          id?: string
          image_url?: string | null
          is_employee?: boolean | null
          is_technician?: boolean | null
          is_vehicle_operator?: boolean | null
          job_title?: string | null
          last_name?: string | null
          license_class?: string | null
          license_expiry_date?: string | null
          license_number?: string | null
          mobile_number?: string | null
          name?: string
          notes?: string | null
          phone_number?: string | null
          postal_code?: string | null
          start_date?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      corrective_actions: {
        Row: {
          assigned_to: string | null
          car_number: string
          completed_date: string | null
          corrective_action: string
          cost_estimate: number | null
          created_at: string | null
          driver_id: string | null
          driver_name: string
          due_date: string | null
          event_id: string | null
          id: string
          notes: string | null
          priority: string | null
          root_cause: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          car_number: string
          completed_date?: string | null
          corrective_action: string
          cost_estimate?: number | null
          created_at?: string | null
          driver_id?: string | null
          driver_name: string
          due_date?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          root_cause?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          car_number?: string
          completed_date?: string | null
          corrective_action?: string
          cost_estimate?: number | null
          created_at?: string | null
          driver_id?: string | null
          driver_name?: string
          due_date?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          root_cause?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "driver_behavior_events"
            referencedColumns: ["id"]
          },
        ]
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
          diesel_record_id: string | null
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
          vehicle_identifier: string | null
        }
        Insert: {
          amount: number
          attachments?: Json | null
          category: string
          created_at?: string | null
          currency?: string | null
          date: string
          diesel_record_id?: string | null
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
          vehicle_identifier?: string | null
        }
        Update: {
          amount?: number
          attachments?: Json | null
          category?: string
          created_at?: string | null
          currency?: string | null
          date?: string
          diesel_record_id?: string | null
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
          vehicle_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_diesel_record_id_fkey"
            columns: ["diesel_record_id"]
            isOneToOne: false
            referencedRelation: "diesel_records"
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
      customer_delivery_analytics: {
        Row: {
          average_cost_per_delivery: number | null
          average_delivery_time_minutes: number | null
          average_distance_km: number | null
          average_profit_margin: number | null
          average_rating: number | null
          complaints: number | null
          created_at: string | null
          customer_name: string
          days_since_last_delivery: number | null
          failed_deliveries: number | null
          fastest_delivery_minutes: number | null
          id: string
          last_delivery_date: string | null
          late_deliveries: number | null
          on_time_deliveries: number | null
          on_time_percentage: number | null
          period_end: string
          period_start: string
          slowest_delivery_minutes: number | null
          total_cost: number | null
          total_deliveries: number | null
          total_distance_km: number | null
          total_ratings: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          average_cost_per_delivery?: number | null
          average_delivery_time_minutes?: number | null
          average_distance_km?: number | null
          average_profit_margin?: number | null
          average_rating?: number | null
          complaints?: number | null
          created_at?: string | null
          customer_name: string
          days_since_last_delivery?: number | null
          failed_deliveries?: number | null
          fastest_delivery_minutes?: number | null
          id?: string
          last_delivery_date?: string | null
          late_deliveries?: number | null
          on_time_deliveries?: number | null
          on_time_percentage?: number | null
          period_end: string
          period_start: string
          slowest_delivery_minutes?: number | null
          total_cost?: number | null
          total_deliveries?: number | null
          total_distance_km?: number | null
          total_ratings?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          average_cost_per_delivery?: number | null
          average_delivery_time_minutes?: number | null
          average_distance_km?: number | null
          average_profit_margin?: number | null
          average_rating?: number | null
          complaints?: number | null
          created_at?: string | null
          customer_name?: string
          days_since_last_delivery?: number | null
          failed_deliveries?: number | null
          fastest_delivery_minutes?: number | null
          id?: string
          last_delivery_date?: string | null
          late_deliveries?: number | null
          on_time_deliveries?: number | null
          on_time_percentage?: number | null
          period_end?: string
          period_start?: string
          slowest_delivery_minutes?: number | null
          total_cost?: number | null
          total_deliveries?: number | null
          total_distance_km?: number | null
          total_ratings?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_templates: {
        Row: {
          cargo_type: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_name: string
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          id: string
          last_used_at: string | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          quoted_price: number | null
          saved_route_id: string | null
          special_requirements: string | null
          template_name: string
          typical_volume_m3: number | null
          typical_weight_kg: number | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          cargo_type?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_name: string
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          id?: string
          last_used_at?: string | null
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          quoted_price?: number | null
          saved_route_id?: string | null
          special_requirements?: string | null
          template_name: string
          typical_volume_m3?: number | null
          typical_weight_kg?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          cargo_type?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_name?: string
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          id?: string
          last_used_at?: string | null
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          quoted_price?: number | null
          saved_route_id?: string | null
          special_requirements?: string | null
          template_name?: string
          typical_volume_m3?: number | null
          typical_weight_kg?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_templates_saved_route_id_fkey"
            columns: ["saved_route_id"]
            isOneToOne: false
            referencedRelation: "saved_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_dip_records: {
        Row: {
          bunker_id: string
          closing_dip_cm: number | null
          closing_pump_reading: number | null
          closing_volume_liters: number | null
          created_at: string
          edit_history: Json | null
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          notes: string | null
          opening_dip_cm: number | null
          opening_pump_reading: number | null
          opening_volume_liters: number
          pump_issued_liters: number | null
          record_date: string
          recorded_by: string | null
          status: string
          tank_usage_liters: number | null
          updated_at: string
          variance_liters: number | null
        }
        Insert: {
          bunker_id: string
          closing_dip_cm?: number | null
          closing_pump_reading?: number | null
          closing_volume_liters?: number | null
          created_at?: string
          edit_history?: Json | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          notes?: string | null
          opening_dip_cm?: number | null
          opening_pump_reading?: number | null
          opening_volume_liters: number
          pump_issued_liters?: number | null
          record_date: string
          recorded_by?: string | null
          status?: string
          tank_usage_liters?: number | null
          updated_at?: string
          variance_liters?: number | null
        }
        Update: {
          bunker_id?: string
          closing_dip_cm?: number | null
          closing_pump_reading?: number | null
          closing_volume_liters?: number | null
          created_at?: string
          edit_history?: Json | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          notes?: string | null
          opening_dip_cm?: number | null
          opening_pump_reading?: number | null
          opening_volume_liters?: number
          pump_issued_liters?: number | null
          record_date?: string
          recorded_by?: string | null
          status?: string
          tank_usage_liters?: number | null
          updated_at?: string
          variance_liters?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_dip_records_bunker_id_fkey"
            columns: ["bunker_id"]
            isOneToOne: false
            referencedRelation: "fuel_bunkers"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_kpi_snapshots: {
        Row: {
          created_at: string
          dimensions: Json | null
          id: string
          kpi_name: string
          period: string
          snapshot_date: string
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string
          dimensions?: Json | null
          id?: string
          kpi_name: string
          period: string
          snapshot_date: string
          unit?: string | null
          value: number
        }
        Update: {
          created_at?: string
          dimensions?: Json | null
          id?: string
          kpi_name?: string
          period?: string
          snapshot_date?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      delivery_costs: {
        Row: {
          cost_per_km: number | null
          cost_per_ton: number | null
          created_at: string | null
          delivery_revenue: number | null
          driver_hourly_rate: number | null
          driver_hours: number | null
          driver_overtime_hours: number | null
          fuel_consumed_liters: number | null
          fuel_cost_per_km: number | null
          fuel_price_per_liter: number | null
          id: string
          insurance_cost: number | null
          load_id: string
          maintenance_cost: number | null
          notes: string | null
          permit_fees: number | null
          profit_margin: number | null
          profit_percentage: number | null
          tire_wear_cost: number | null
          toll_gates_passed: number | null
          toll_locations: string[] | null
          total_cost: number | null
          total_driver_cost: number | null
          total_fuel_cost: number | null
          total_toll_cost: number | null
          updated_at: string | null
          vehicle_depreciation: number | null
          vehicle_id: string
        }
        Insert: {
          cost_per_km?: number | null
          cost_per_ton?: number | null
          created_at?: string | null
          delivery_revenue?: number | null
          driver_hourly_rate?: number | null
          driver_hours?: number | null
          driver_overtime_hours?: number | null
          fuel_consumed_liters?: number | null
          fuel_cost_per_km?: number | null
          fuel_price_per_liter?: number | null
          id?: string
          insurance_cost?: number | null
          load_id: string
          maintenance_cost?: number | null
          notes?: string | null
          permit_fees?: number | null
          profit_margin?: number | null
          profit_percentage?: number | null
          tire_wear_cost?: number | null
          toll_gates_passed?: number | null
          toll_locations?: string[] | null
          total_cost?: number | null
          total_driver_cost?: number | null
          total_fuel_cost?: number | null
          total_toll_cost?: number | null
          updated_at?: string | null
          vehicle_depreciation?: number | null
          vehicle_id: string
        }
        Update: {
          cost_per_km?: number | null
          cost_per_ton?: number | null
          created_at?: string | null
          delivery_revenue?: number | null
          driver_hourly_rate?: number | null
          driver_hours?: number | null
          driver_overtime_hours?: number | null
          fuel_consumed_liters?: number | null
          fuel_cost_per_km?: number | null
          fuel_price_per_liter?: number | null
          id?: string
          insurance_cost?: number | null
          load_id?: string
          maintenance_cost?: number | null
          notes?: string | null
          permit_fees?: number | null
          profit_margin?: number | null
          profit_percentage?: number | null
          tire_wear_cost?: number | null
          toll_gates_passed?: number | null
          toll_locations?: string[] | null
          total_cost?: number | null
          total_driver_cost?: number | null
          total_fuel_cost?: number | null
          total_toll_cost?: number | null
          updated_at?: string | null
          vehicle_depreciation?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_costs_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "delivery_costs_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "delivery_costs_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_costs_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_costs_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
          {
            foreignKeyName: "delivery_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_eta: {
        Row: {
          actual_arrival: string | null
          average_speed_kmh: number | null
          calculated_at: string | null
          calculation_method: string | null
          confidence_level: number | null
          estimated_arrival: string
          estimated_duration_minutes: number | null
          factors: Json | null
          id: string
          is_current: boolean | null
          load_id: string
          optimistic_eta: string | null
          pessimistic_eta: string | null
          remaining_distance_km: number | null
          rest_stop_minutes: number | null
          traffic_delay_minutes: number | null
          weather_delay_minutes: number | null
        }
        Insert: {
          actual_arrival?: string | null
          average_speed_kmh?: number | null
          calculated_at?: string | null
          calculation_method?: string | null
          confidence_level?: number | null
          estimated_arrival: string
          estimated_duration_minutes?: number | null
          factors?: Json | null
          id?: string
          is_current?: boolean | null
          load_id: string
          optimistic_eta?: string | null
          pessimistic_eta?: string | null
          remaining_distance_km?: number | null
          rest_stop_minutes?: number | null
          traffic_delay_minutes?: number | null
          weather_delay_minutes?: number | null
        }
        Update: {
          actual_arrival?: string | null
          average_speed_kmh?: number | null
          calculated_at?: string | null
          calculation_method?: string | null
          confidence_level?: number | null
          estimated_arrival?: string
          estimated_duration_minutes?: number | null
          factors?: Json | null
          id?: string
          is_current?: boolean | null
          load_id?: string
          optimistic_eta?: string | null
          pessimistic_eta?: string | null
          remaining_distance_km?: number | null
          rest_stop_minutes?: number | null
          traffic_delay_minutes?: number | null
          weather_delay_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_eta_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "delivery_eta_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "delivery_eta_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_eta_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_eta_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
        ]
      }
      delivery_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_timestamp: string
          event_type: string
          id: string
          latitude: number | null
          load_id: string
          location_name: string | null
          longitude: number | null
          notes: string | null
          photo_url: string | null
          recorded_by: string | null
          signature_url: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_timestamp?: string
          event_type: string
          id?: string
          latitude?: number | null
          load_id: string
          location_name?: string | null
          longitude?: number | null
          notes?: string | null
          photo_url?: string | null
          recorded_by?: string | null
          signature_url?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_timestamp?: string
          event_type?: string
          id?: string
          latitude?: number | null
          load_id?: string
          location_name?: string | null
          longitude?: number | null
          notes?: string | null
          photo_url?: string | null
          recorded_by?: string | null
          signature_url?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "delivery_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "delivery_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
          {
            foreignKeyName: "delivery_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_performance: {
        Row: {
          actual_delivery_time: string | null
          actual_distance_km: number | null
          actual_pickup_time: string | null
          average_speed_kmh: number | null
          cost_per_km: number | null
          created_at: string | null
          customer_feedback: string | null
          customer_rating: number | null
          deviation_distance_km: number | null
          driver_cost: number | null
          driving_duration_minutes: number | null
          early_minutes: number | null
          fuel_cost: number | null
          fuel_efficiency_score: number | null
          geofence_violations: number | null
          harsh_acceleration_count: number | null
          harsh_braking_count: number | null
          id: string
          idle_duration_minutes: number | null
          late_minutes: number | null
          load_id: string
          loading_duration_minutes: number | null
          max_speed_kmh: number | null
          on_time: boolean | null
          overall_performance_score: number | null
          planned_distance_km: number | null
          rest_stop_duration_minutes: number | null
          route_efficiency_score: number | null
          scheduled_delivery_time: string | null
          scheduled_pickup_time: string | null
          speeding_incidents: number | null
          time_efficiency_score: number | null
          time_overspeeding_minutes: number | null
          toll_cost: number | null
          total_delivery_cost: number | null
          total_duration_minutes: number | null
          unauthorized_stops: number | null
          unloading_duration_minutes: number | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          actual_delivery_time?: string | null
          actual_distance_km?: number | null
          actual_pickup_time?: string | null
          average_speed_kmh?: number | null
          cost_per_km?: number | null
          created_at?: string | null
          customer_feedback?: string | null
          customer_rating?: number | null
          deviation_distance_km?: number | null
          driver_cost?: number | null
          driving_duration_minutes?: number | null
          early_minutes?: number | null
          fuel_cost?: number | null
          fuel_efficiency_score?: number | null
          geofence_violations?: number | null
          harsh_acceleration_count?: number | null
          harsh_braking_count?: number | null
          id?: string
          idle_duration_minutes?: number | null
          late_minutes?: number | null
          load_id: string
          loading_duration_minutes?: number | null
          max_speed_kmh?: number | null
          on_time?: boolean | null
          overall_performance_score?: number | null
          planned_distance_km?: number | null
          rest_stop_duration_minutes?: number | null
          route_efficiency_score?: number | null
          scheduled_delivery_time?: string | null
          scheduled_pickup_time?: string | null
          speeding_incidents?: number | null
          time_efficiency_score?: number | null
          time_overspeeding_minutes?: number | null
          toll_cost?: number | null
          total_delivery_cost?: number | null
          total_duration_minutes?: number | null
          unauthorized_stops?: number | null
          unloading_duration_minutes?: number | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          actual_delivery_time?: string | null
          actual_distance_km?: number | null
          actual_pickup_time?: string | null
          average_speed_kmh?: number | null
          cost_per_km?: number | null
          created_at?: string | null
          customer_feedback?: string | null
          customer_rating?: number | null
          deviation_distance_km?: number | null
          driver_cost?: number | null
          driving_duration_minutes?: number | null
          early_minutes?: number | null
          fuel_cost?: number | null
          fuel_efficiency_score?: number | null
          geofence_violations?: number | null
          harsh_acceleration_count?: number | null
          harsh_braking_count?: number | null
          id?: string
          idle_duration_minutes?: number | null
          late_minutes?: number | null
          load_id?: string
          loading_duration_minutes?: number | null
          max_speed_kmh?: number | null
          on_time?: boolean | null
          overall_performance_score?: number | null
          planned_distance_km?: number | null
          rest_stop_duration_minutes?: number | null
          route_efficiency_score?: number | null
          scheduled_delivery_time?: string | null
          scheduled_pickup_time?: string | null
          speeding_incidents?: number | null
          time_efficiency_score?: number | null
          time_overspeeding_minutes?: number | null
          toll_cost?: number | null
          total_delivery_cost?: number | null
          total_duration_minutes?: number | null
          unauthorized_stops?: number | null
          unloading_duration_minutes?: number | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_performance_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "delivery_performance_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "delivery_performance_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_performance_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_performance_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
          {
            foreignKeyName: "delivery_performance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_tracking: {
        Row: {
          accuracy: number | null
          altitude: number | null
          battery_level: number | null
          created_at: string | null
          data_source: string | null
          distance_from_origin_km: number | null
          distance_to_destination_km: number | null
          distance_traveled_km: number | null
          engine_hours: number | null
          fuel_level: number | null
          heading: number | null
          id: string
          idle_duration_minutes: number | null
          is_moving: boolean | null
          latitude: number
          load_id: string
          longitude: number
          odometer: number | null
          recorded_at: string
          signal_strength: number | null
          speed: number | null
          temperature: number | null
          vehicle_id: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          battery_level?: number | null
          created_at?: string | null
          data_source?: string | null
          distance_from_origin_km?: number | null
          distance_to_destination_km?: number | null
          distance_traveled_km?: number | null
          engine_hours?: number | null
          fuel_level?: number | null
          heading?: number | null
          id?: string
          idle_duration_minutes?: number | null
          is_moving?: boolean | null
          latitude: number
          load_id: string
          longitude: number
          odometer?: number | null
          recorded_at?: string
          signal_strength?: number | null
          speed?: number | null
          temperature?: number | null
          vehicle_id: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          battery_level?: number | null
          created_at?: string | null
          data_source?: string | null
          distance_from_origin_km?: number | null
          distance_to_destination_km?: number | null
          distance_traveled_km?: number | null
          engine_hours?: number | null
          fuel_level?: number | null
          heading?: number | null
          id?: string
          idle_duration_minutes?: number | null
          is_moving?: boolean | null
          latitude?: number
          load_id?: string
          longitude?: number
          odometer?: number | null
          recorded_at?: string
          signal_strength?: number | null
          speed?: number | null
          temperature?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "delivery_tracking_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "delivery_tracking_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tracking_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tracking_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
          {
            foreignKeyName: "delivery_tracking_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
          cost_entry_ids: string[] | null
          cost_per_litre: number | null
          created_at: string | null
          currency: string | null
          date: string
          debrief_date: string | null
          debrief_notes: string | null
          debrief_signed: boolean | null
          debrief_signed_at: string | null
          debrief_signed_by: string | null
          debrief_trigger_reason: string | null
          distance_travelled: number | null
          driver_name: string | null
          fleet_number: string
          fuel_station: string
          id: string
          is_probe_verified: boolean | null
          km_per_litre: number | null
          km_reading: number
          linked_trailers: string[] | null
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
          requires_debrief: boolean | null
          signed_at: string | null
          signed_by: string | null
          total_cost: number
          trailer_fuel_cost: number | null
          trailer_fuel_data: Json | null
          trailer_litres_total: number | null
          trip_id: string | null
          updated_at: string | null
          vehicle_fuel_cost: number | null
          vehicle_litres_only: number | null
        }
        Insert: {
          cost_entry_ids?: string[] | null
          cost_per_litre?: number | null
          created_at?: string | null
          currency?: string | null
          date: string
          debrief_date?: string | null
          debrief_notes?: string | null
          debrief_signed?: boolean | null
          debrief_signed_at?: string | null
          debrief_signed_by?: string | null
          debrief_trigger_reason?: string | null
          distance_travelled?: number | null
          driver_name?: string | null
          fleet_number: string
          fuel_station: string
          id?: string
          is_probe_verified?: boolean | null
          km_per_litre?: number | null
          km_reading: number
          linked_trailers?: string[] | null
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
          requires_debrief?: boolean | null
          signed_at?: string | null
          signed_by?: string | null
          total_cost: number
          trailer_fuel_cost?: number | null
          trailer_fuel_data?: Json | null
          trailer_litres_total?: number | null
          trip_id?: string | null
          updated_at?: string | null
          vehicle_fuel_cost?: number | null
          vehicle_litres_only?: number | null
        }
        Update: {
          cost_entry_ids?: string[] | null
          cost_per_litre?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string
          debrief_date?: string | null
          debrief_notes?: string | null
          debrief_signed?: boolean | null
          debrief_signed_at?: string | null
          debrief_signed_by?: string | null
          debrief_trigger_reason?: string | null
          distance_travelled?: number | null
          driver_name?: string | null
          fleet_number?: string
          fuel_station?: string
          id?: string
          is_probe_verified?: boolean | null
          km_per_litre?: number | null
          km_reading?: number
          linked_trailers?: string[] | null
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
          requires_debrief?: boolean | null
          signed_at?: string | null
          signed_by?: string | null
          total_cost?: number
          trailer_fuel_cost?: number | null
          trailer_fuel_data?: Json | null
          trailer_litres_total?: number | null
          trip_id?: string | null
          updated_at?: string | null
          vehicle_fuel_cost?: number | null
          vehicle_litres_only?: number | null
        }
        Relationships: []
      }
      diesel_suppliers: {
        Row: {
          address: string | null
          avoid_reason: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          current_price_per_liter: number
          fuel_type: string | null
          google_maps_url: string | null
          has_truck_facilities: boolean | null
          id: string
          is_active: boolean | null
          is_avoided: boolean | null
          is_preferred: boolean | null
          latitude: number | null
          location: string
          longitude: number | null
          min_purchase_liters: number | null
          name: string
          notes: string | null
          operating_hours: string | null
          province: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          avoid_reason?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          current_price_per_liter: number
          fuel_type?: string | null
          google_maps_url?: string | null
          has_truck_facilities?: boolean | null
          id?: string
          is_active?: boolean | null
          is_avoided?: boolean | null
          is_preferred?: boolean | null
          latitude?: number | null
          location: string
          longitude?: number | null
          min_purchase_liters?: number | null
          name: string
          notes?: string | null
          operating_hours?: string | null
          province?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          avoid_reason?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          current_price_per_liter?: number
          fuel_type?: string | null
          google_maps_url?: string | null
          has_truck_facilities?: boolean | null
          id?: string
          is_active?: boolean | null
          is_avoided?: boolean | null
          is_preferred?: boolean | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          min_purchase_liters?: number | null
          name?: string
          notes?: string | null
          operating_hours?: string | null
          province?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      driver_behavior: {
        Row: {
          average_speed: number | null
          continuous_driving_minutes: number | null
          created_at: string | null
          driver_name: string | null
          excessive_idle_events: number | null
          fatigue_risk_score: number | null
          fuel_efficiency_rating: string | null
          harsh_acceleration_events: number | null
          harsh_braking_events: number | null
          harsh_cornering_events: number | null
          id: string
          load_id: string
          max_speed_recorded: number | null
          night_driving_minutes: number | null
          overall_safety_score: number | null
          rest_breaks_taken: number | null
          route_adherence_percentage: number | null
          speed_limit_violations: number | null
          speeding_duration_minutes: number | null
          total_idle_minutes: number | null
          trip_duration_minutes: number | null
          trip_end: string | null
          trip_start: string
          vehicle_id: string
        }
        Insert: {
          average_speed?: number | null
          continuous_driving_minutes?: number | null
          created_at?: string | null
          driver_name?: string | null
          excessive_idle_events?: number | null
          fatigue_risk_score?: number | null
          fuel_efficiency_rating?: string | null
          harsh_acceleration_events?: number | null
          harsh_braking_events?: number | null
          harsh_cornering_events?: number | null
          id?: string
          load_id: string
          max_speed_recorded?: number | null
          night_driving_minutes?: number | null
          overall_safety_score?: number | null
          rest_breaks_taken?: number | null
          route_adherence_percentage?: number | null
          speed_limit_violations?: number | null
          speeding_duration_minutes?: number | null
          total_idle_minutes?: number | null
          trip_duration_minutes?: number | null
          trip_end?: string | null
          trip_start: string
          vehicle_id: string
        }
        Update: {
          average_speed?: number | null
          continuous_driving_minutes?: number | null
          created_at?: string | null
          driver_name?: string | null
          excessive_idle_events?: number | null
          fatigue_risk_score?: number | null
          fuel_efficiency_rating?: string | null
          harsh_acceleration_events?: number | null
          harsh_braking_events?: number | null
          harsh_cornering_events?: number | null
          id?: string
          load_id?: string
          max_speed_recorded?: number | null
          night_driving_minutes?: number | null
          overall_safety_score?: number | null
          rest_breaks_taken?: number | null
          route_adherence_percentage?: number | null
          speed_limit_violations?: number | null
          speeding_duration_minutes?: number | null
          total_idle_minutes?: number | null
          trip_duration_minutes?: number | null
          trip_end?: string | null
          trip_start?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_behavior_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "driver_behavior_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "driver_behavior_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_behavior_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_behavior_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
          {
            foreignKeyName: "driver_behavior_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_behavior_events: {
        Row: {
          attachments: Json | null
          car_report_id: string | null
          coaching_action_plan: string | null
          corrective_action_taken: string | null
          created_at: string | null
          debrief_conducted_by: string | null
          debrief_date: string | null
          debrief_notes: string | null
          debriefed_at: string | null
          debriefer_signature: string | null
          description: string
          driver_acknowledged: boolean | null
          driver_name: string
          driver_signature: string | null
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
          witness_signature: string | null
          witness_statement: string | null
        }
        Insert: {
          attachments?: Json | null
          car_report_id?: string | null
          coaching_action_plan?: string | null
          corrective_action_taken?: string | null
          created_at?: string | null
          debrief_conducted_by?: string | null
          debrief_date?: string | null
          debrief_notes?: string | null
          debriefed_at?: string | null
          debriefer_signature?: string | null
          description: string
          driver_acknowledged?: boolean | null
          driver_name: string
          driver_signature?: string | null
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
          witness_signature?: string | null
          witness_statement?: string | null
        }
        Update: {
          attachments?: Json | null
          car_report_id?: string | null
          coaching_action_plan?: string | null
          corrective_action_taken?: string | null
          created_at?: string | null
          debrief_conducted_by?: string | null
          debrief_date?: string | null
          debrief_notes?: string | null
          debriefed_at?: string | null
          debriefer_signature?: string | null
          description?: string
          driver_acknowledged?: boolean | null
          driver_name?: string
          driver_signature?: string | null
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
          witness_signature?: string | null
          witness_statement?: string | null
        }
        Relationships: []
      }
      driver_candidates: {
        Row: {
          address: string | null
          application_date: string
          candidate_number: string
          city: string | null
          created_at: string | null
          created_by: string | null
          current_step: Database["public"]["Enums"]["evaluation_step"]
          email: string | null
          first_name: string
          id: string
          interview_result: Json | null
          last_name: string
          license_class: string
          license_expiry: string
          license_number: string
          notes: string | null
          phone: string
          previous_employer: string | null
          rejection_reason: string | null
          road_test_result: Json | null
          status: Database["public"]["Enums"]["candidate_status"]
          updated_at: string | null
          yard_test_result: Json | null
          years_experience: number | null
        }
        Insert: {
          address?: string | null
          application_date?: string
          candidate_number: string
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          current_step?: Database["public"]["Enums"]["evaluation_step"]
          email?: string | null
          first_name: string
          id?: string
          interview_result?: Json | null
          last_name: string
          license_class: string
          license_expiry: string
          license_number: string
          notes?: string | null
          phone: string
          previous_employer?: string | null
          rejection_reason?: string | null
          road_test_result?: Json | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string | null
          yard_test_result?: Json | null
          years_experience?: number | null
        }
        Update: {
          address?: string | null
          application_date?: string
          candidate_number?: string
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          current_step?: Database["public"]["Enums"]["evaluation_step"]
          email?: string | null
          first_name?: string
          id?: string
          interview_result?: Json | null
          last_name?: string
          license_class?: string
          license_expiry?: string
          license_number?: string
          notes?: string | null
          phone?: string
          previous_employer?: string | null
          rejection_reason?: string | null
          road_test_result?: Json | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string | null
          yard_test_result?: Json | null
          years_experience?: number | null
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          created_at: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["driver_document_type"]
          driver_id: string
          expiry_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          notes: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_number?: string | null
          document_type: Database["public"]["Enums"]["driver_document_type"]
          driver_id: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["driver_document_type"]
          driver_id?: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_vehicle_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          driver_id: string
          id: string
          is_active: boolean
          notes: string | null
          unassigned_at: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          driver_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          unassigned_at?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          driver_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          unassigned_at?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          auth_user_id: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          driver_number: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          license_class: string | null
          license_expiry: string | null
          license_number: string
          notes: string | null
          phone: string | null
          state: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          driver_number: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          hire_date?: string | null
          id?: string
          last_name: string
          license_class?: string | null
          license_expiry?: string | null
          license_number: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          driver_number?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          license_class?: string | null
          license_expiry?: string | null
          license_number?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string | null
          zip_code?: string | null
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
      fleet_1h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_21h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_23h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_24h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_26h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_29h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_30h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_31h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_32h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_33h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_4h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_6h_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_7f_positions: {
        Row: {
          brand: string | null
          condition: string | null
          id: string
          model: string | null
          position: string
          registration_no: string
          size: string | null
          tread_depth: number | null
          tyre_code: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position: string
          registration_no: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          condition?: string | null
          id?: string
          model?: string | null
          position?: string
          registration_no?: string
          size?: string | null
          tread_depth?: number | null
          tyre_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_breakdowns: {
        Row: {
          breakdown_date: string
          call_out_completed_time: string | null
          call_out_departure_time: string | null
          call_out_mechanic: string | null
          call_out_start_time: string | null
          category: string
          created_at: string
          description: string
          driver_name: string | null
          id: string
          linked_inspection_id: string | null
          linked_job_card_id: string | null
          load_number: string | null
          location: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          source_app: string
          source_breakdown_id: string | null
          source_breakdown_number: string | null
          status: string
          updated_at: string
          vehicle_fleet_number: string | null
          vehicle_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_registration: string | null
          workshop_notes: string | null
        }
        Insert: {
          breakdown_date: string
          call_out_completed_time?: string | null
          call_out_departure_time?: string | null
          call_out_mechanic?: string | null
          call_out_start_time?: string | null
          category?: string
          created_at?: string
          description: string
          driver_name?: string | null
          id?: string
          linked_inspection_id?: string | null
          linked_job_card_id?: string | null
          load_number?: string | null
          location?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_app?: string
          source_breakdown_id?: string | null
          source_breakdown_number?: string | null
          status?: string
          updated_at?: string
          vehicle_fleet_number?: string | null
          vehicle_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string | null
          workshop_notes?: string | null
        }
        Update: {
          breakdown_date?: string
          call_out_completed_time?: string | null
          call_out_departure_time?: string | null
          call_out_mechanic?: string | null
          call_out_start_time?: string | null
          category?: string
          created_at?: string
          description?: string
          driver_name?: string | null
          id?: string
          linked_inspection_id?: string | null
          linked_job_card_id?: string | null
          load_number?: string | null
          location?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_app?: string
          source_breakdown_id?: string | null
          source_breakdown_number?: string | null
          status?: string
          updated_at?: string
          vehicle_fleet_number?: string | null
          vehicle_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string | null
          workshop_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_breakdowns_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_tyre_positions: {
        Row: {
          created_at: string | null
          fleet_number: string
          id: string
          position: string
          position_label: string | null
          registration_no: string
          tyre_code: string | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          fleet_number: string
          id?: string
          position: string
          position_label?: string | null
          registration_no: string
          tyre_code?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          fleet_number?: string
          id?: string
          position?: string
          position_label?: string | null
          registration_no?: string
          tyre_code?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_tyre_positions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_bunker_adjustments: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          adjustment_quantity: number
          bunker_id: string
          created_at: string | null
          id: string
          new_level: number
          old_level: number
          reason: string | null
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_quantity: number
          bunker_id: string
          created_at?: string | null
          id?: string
          new_level: number
          old_level: number
          reason?: string | null
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_quantity?: number
          bunker_id?: string
          created_at?: string | null
          id?: string
          new_level?: number
          old_level?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_bunker_adjustments_bunker_id_fkey"
            columns: ["bunker_id"]
            isOneToOne: false
            referencedRelation: "fuel_bunkers"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_bunkers: {
        Row: {
          capacity_liters: number
          created_at: string | null
          current_level_liters: number
          fuel_type: string
          id: string
          is_active: boolean | null
          location: string | null
          min_level_alert: number | null
          name: string
          notes: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          capacity_liters?: number
          created_at?: string | null
          current_level_liters?: number
          fuel_type?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          min_level_alert?: number | null
          name: string
          notes?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          capacity_liters?: number
          created_at?: string | null
          current_level_liters?: number
          fuel_type?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          min_level_alert?: number | null
          name?: string
          notes?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fuel_route_analytics: {
        Row: {
          actual_fuel_cost: number | null
          actual_fuel_liters: number | null
          created_at: string | null
          driver_name: string | null
          fuel_stops_used: Json | null
          id: string
          notes: string | null
          optimized_cost_would_be: number | null
          route_id: string
          savings_achieved: number | null
          trip_date: string
          vehicle_id: string | null
        }
        Insert: {
          actual_fuel_cost?: number | null
          actual_fuel_liters?: number | null
          created_at?: string | null
          driver_name?: string | null
          fuel_stops_used?: Json | null
          id?: string
          notes?: string | null
          optimized_cost_would_be?: number | null
          route_id: string
          savings_achieved?: number | null
          trip_date: string
          vehicle_id?: string | null
        }
        Update: {
          actual_fuel_cost?: number | null
          actual_fuel_liters?: number | null
          created_at?: string | null
          driver_name?: string | null
          fuel_stops_used?: Json | null
          id?: string
          notes?: string | null
          optimized_cost_would_be?: number | null
          route_id?: string
          savings_achieved?: number | null
          trip_date?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_route_analytics_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fuel_saved_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_route_notes: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          distance_from_origin_km: number | null
          id: string
          is_important: boolean | null
          latitude: number | null
          location_description: string | null
          longitude: number | null
          note_type: string
          route_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          distance_from_origin_km?: number | null
          id?: string
          is_important?: boolean | null
          latitude?: number | null
          location_description?: string | null
          longitude?: number | null
          note_type?: string
          route_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          distance_from_origin_km?: number | null
          id?: string
          is_important?: boolean | null
          latitude?: number | null
          location_description?: string | null
          longitude?: number | null
          note_type?: string
          route_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_route_notes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fuel_saved_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_route_recommendations: {
        Row: {
          calculated_at: string | null
          distance_from_origin_km: number | null
          distance_to_destination_km: number | null
          estimated_cost: number | null
          id: string
          is_mandatory: boolean | null
          price_at_calculation: number | null
          reason: string | null
          recommended_liters: number | null
          route_id: string
          savings_vs_average: number | null
          sequence_order: number
          supplier_id: string
        }
        Insert: {
          calculated_at?: string | null
          distance_from_origin_km?: number | null
          distance_to_destination_km?: number | null
          estimated_cost?: number | null
          id?: string
          is_mandatory?: boolean | null
          price_at_calculation?: number | null
          reason?: string | null
          recommended_liters?: number | null
          route_id: string
          savings_vs_average?: number | null
          sequence_order: number
          supplier_id: string
        }
        Update: {
          calculated_at?: string | null
          distance_from_origin_km?: number | null
          distance_to_destination_km?: number | null
          estimated_cost?: number | null
          id?: string
          is_mandatory?: boolean | null
          price_at_calculation?: number | null
          reason?: string | null
          recommended_liters?: number | null
          route_id?: string
          savings_vs_average?: number | null
          sequence_order?: number
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_route_recommendations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fuel_saved_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_route_recommendations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "diesel_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_route_waypoints: {
        Row: {
          created_at: string | null
          distance_from_origin_km: number | null
          distance_to_next_km: number | null
          google_maps_url: string | null
          id: string
          is_fuel_stop: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          route_id: string
          sequence_order: number
          supplier_id: string | null
        }
        Insert: {
          created_at?: string | null
          distance_from_origin_km?: number | null
          distance_to_next_km?: number | null
          google_maps_url?: string | null
          id?: string
          is_fuel_stop?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          route_id: string
          sequence_order: number
          supplier_id?: string | null
        }
        Update: {
          created_at?: string | null
          distance_from_origin_km?: number | null
          distance_to_next_km?: number | null
          google_maps_url?: string | null
          id?: string
          is_fuel_stop?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          route_id?: string
          sequence_order?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_route_waypoints_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fuel_saved_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_route_waypoints_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "diesel_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_routes: {
        Row: {
          avg_fuel_consumption_per_km: number | null
          best_fuel_strategy: string | null
          created_at: string | null
          created_by: string | null
          destination: string
          destination_latitude: number | null
          destination_longitude: number | null
          driver_tips: string | null
          estimated_duration_hours: number | null
          id: string
          is_active: boolean | null
          is_favorite: boolean | null
          is_round_trip: boolean | null
          last_used_at: string | null
          name: string
          notes: string | null
          origin: string
          origin_latitude: number | null
          origin_longitude: number | null
          total_distance_km: number | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          avg_fuel_consumption_per_km?: number | null
          best_fuel_strategy?: string | null
          created_at?: string | null
          created_by?: string | null
          destination: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          driver_tips?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          is_round_trip?: boolean | null
          last_used_at?: string | null
          name: string
          notes?: string | null
          origin: string
          origin_latitude?: number | null
          origin_longitude?: number | null
          total_distance_km?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          avg_fuel_consumption_per_km?: number | null
          best_fuel_strategy?: string | null
          created_at?: string | null
          created_by?: string | null
          destination?: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          driver_tips?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          is_round_trip?: boolean | null
          last_used_at?: string | null
          name?: string
          notes?: string | null
          origin?: string
          origin_latitude?: number | null
          origin_longitude?: number | null
          total_distance_km?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      fuel_saved_routes: {
        Row: {
          avg_fuel_consumption_per_km: number | null
          best_fuel_strategy: string | null
          created_at: string | null
          created_by: string | null
          destination: string
          destination_latitude: number | null
          destination_longitude: number | null
          driver_tips: string | null
          estimated_duration_hours: number | null
          id: string
          is_active: boolean | null
          is_favorite: boolean | null
          is_round_trip: boolean | null
          last_used_at: string | null
          name: string
          notes: string | null
          origin: string
          origin_latitude: number | null
          origin_longitude: number | null
          total_distance_km: number | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          avg_fuel_consumption_per_km?: number | null
          best_fuel_strategy?: string | null
          created_at?: string | null
          created_by?: string | null
          destination: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          driver_tips?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          is_round_trip?: boolean | null
          last_used_at?: string | null
          name: string
          notes?: string | null
          origin: string
          origin_latitude?: number | null
          origin_longitude?: number | null
          total_distance_km?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          avg_fuel_consumption_per_km?: number | null
          best_fuel_strategy?: string | null
          created_at?: string | null
          created_by?: string | null
          destination?: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          driver_tips?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          is_round_trip?: boolean | null
          last_used_at?: string | null
          name?: string
          notes?: string | null
          origin?: string
          origin_latitude?: number | null
          origin_longitude?: number | null
          total_distance_km?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      fuel_stations: {
        Row: {
          address: string | null
          created_at: string | null
          currency: string | null
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          price_per_litre: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          price_per_litre?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          price_per_litre?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fuel_strategy_analysis: {
        Row: {
          analysis_date: string
          analysis_type: string
          created_at: string | null
          current_spend: number | null
          details: Json | null
          id: string
          optimized_spend: number | null
          potential_savings: number | null
          recommendation: string
          route_name: string | null
          supplier_id: string | null
        }
        Insert: {
          analysis_date?: string
          analysis_type: string
          created_at?: string | null
          current_spend?: number | null
          details?: Json | null
          id?: string
          optimized_spend?: number | null
          potential_savings?: number | null
          recommendation: string
          route_name?: string | null
          supplier_id?: string | null
        }
        Update: {
          analysis_date?: string
          analysis_type?: string
          created_at?: string | null
          current_spend?: number | null
          details?: Json | null
          id?: string
          optimized_spend?: number | null
          potential_savings?: number | null
          recommendation?: string
          route_name?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_strategy_analysis_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "diesel_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_transactions: {
        Row: {
          bunker_id: string
          created_at: string | null
          created_by: string | null
          driver_name: string | null
          id: string
          notes: string | null
          odometer_reading: number | null
          quantity_liters: number
          reference_number: string | null
          total_cost: number | null
          transaction_date: string | null
          transaction_type: string
          unit_cost: number | null
          vehicle_fleet_number: string | null
          vehicle_id: string | null
        }
        Insert: {
          bunker_id: string
          created_at?: string | null
          created_by?: string | null
          driver_name?: string | null
          id?: string
          notes?: string | null
          odometer_reading?: number | null
          quantity_liters: number
          reference_number?: string | null
          total_cost?: number | null
          transaction_date?: string | null
          transaction_type: string
          unit_cost?: number | null
          vehicle_fleet_number?: string | null
          vehicle_id?: string | null
        }
        Update: {
          bunker_id?: string
          created_at?: string | null
          created_by?: string | null
          driver_name?: string | null
          id?: string
          notes?: string | null
          odometer_reading?: number | null
          quantity_liters?: number
          reference_number?: string | null
          total_cost?: number | null
          transaction_date?: string | null
          transaction_type?: string
          unit_cost?: number | null
          vehicle_fleet_number?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_transactions_bunker_id_fkey"
            columns: ["bunker_id"]
            isOneToOne: false
            referencedRelation: "fuel_bunkers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_events: {
        Row: {
          created_at: string | null
          dwell_duration_minutes: number | null
          event_timestamp: string
          event_type: string
          geofence_zone_id: string
          id: string
          latitude: number
          load_id: string
          longitude: number
          notification_sent: boolean | null
          notification_sent_at: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          dwell_duration_minutes?: number | null
          event_timestamp?: string
          event_type: string
          geofence_zone_id: string
          id?: string
          latitude: number
          load_id: string
          longitude: number
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          dwell_duration_minutes?: number | null
          event_timestamp?: string
          event_type?: string
          geofence_zone_id?: string
          id?: string
          latitude?: number
          load_id?: string
          longitude?: number
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_geofence_zone_id_fkey"
            columns: ["geofence_zone_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
          {
            foreignKeyName: "geofence_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_zones: {
        Row: {
          alert_on_dwell: boolean | null
          alert_on_entry: boolean | null
          alert_on_exit: boolean | null
          center_lat: number
          center_lng: number
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          location_id: string | null
          max_dwell_minutes: number | null
          name: string
          notification_emails: string[] | null
          notify_customer: boolean | null
          notify_dispatcher: boolean | null
          radius_meters: number
          updated_at: string | null
          zone_type: string
        }
        Insert: {
          alert_on_dwell?: boolean | null
          alert_on_entry?: boolean | null
          alert_on_exit?: boolean | null
          center_lat: number
          center_lng: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          max_dwell_minutes?: number | null
          name: string
          notification_emails?: string[] | null
          notify_customer?: boolean | null
          notify_dispatcher?: boolean | null
          radius_meters: number
          updated_at?: string | null
          zone_type: string
        }
        Update: {
          alert_on_dwell?: boolean | null
          alert_on_entry?: boolean | null
          alert_on_exit?: boolean | null
          center_lat?: number
          center_lng?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          max_dwell_minutes?: number | null
          name?: string
          notification_emails?: string[] | null
          notify_customer?: boolean | null
          notify_dispatcher?: boolean | null
          radius_meters?: number
          updated_at?: string | null
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_zones_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "predefined_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      geofences: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          color: string | null
          coordinates: Json | null
          created_at: string | null
          description: string | null
          groups: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          radius: number | null
          type: string
          updated_at: string | null
          wialon_resource_id: number | null
          wialon_zone_id: number | null
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          color?: string | null
          coordinates?: Json | null
          created_at?: string | null
          description?: string | null
          groups?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          radius?: number | null
          type: string
          updated_at?: string | null
          wialon_resource_id?: number | null
          wialon_zone_id?: number | null
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          color?: string | null
          coordinates?: Json | null
          created_at?: string | null
          description?: string | null
          groups?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          radius?: number | null
          type?: string
          updated_at?: string | null
          wialon_resource_id?: number | null
          wialon_zone_id?: number | null
        }
        Relationships: []
      }
      incident_checklists: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          incident_id: string
          responses: Json
          started_at: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          incident_id: string
          responses?: Json
          started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          incident_id?: string
          responses?: Json
          started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_checklists_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_documents: {
        Row: {
          created_at: string | null
          description: string | null
          document_type: Database["public"]["Enums"]["incident_document_type"]
          file_path: string | null
          file_size: number | null
          file_url: string
          id: string
          incident_id: string
          mime_type: string | null
          name: string
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          document_type?: Database["public"]["Enums"]["incident_document_type"]
          file_path?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          incident_id: string
          mime_type?: string | null
          name: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          document_type?: Database["public"]["Enums"]["incident_document_type"]
          file_path?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          incident_id?: string
          mime_type?: string | null
          name?: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_documents_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_timeline: {
        Row: {
          created_at: string | null
          document_id: string | null
          event_description: string | null
          event_title: string
          event_type: string
          id: string
          incident_id: string
          metadata: Json | null
          new_status: string | null
          old_status: string | null
          performed_by: string
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          event_description?: string | null
          event_title: string
          event_type: string
          id?: string
          incident_id: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          performed_by: string
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          event_description?: string | null
          event_title?: string
          event_type?: string
          id?: string
          incident_id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_timeline_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "incident_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_timeline_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          driver_id: string | null
          driver_name: string | null
          id: string
          images: Json | null
          incident_date: string
          incident_number: string
          incident_time: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          insurance_claim_amount: number | null
          insurance_number: string | null
          latitude: number | null
          location: string
          location_id: string | null
          longitude: number | null
          notes: string | null
          reported_by: string
          resolution_notes: string | null
          severity_rating: number | null
          status: Database["public"]["Enums"]["incident_status"]
          total_cost: number | null
          updated_at: string | null
          vehicle_id: string | null
          vehicle_number: string | null
          weather_condition:
          | Database["public"]["Enums"]["weather_condition"]
          | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          images?: Json | null
          incident_date: string
          incident_number?: string
          incident_time: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          insurance_claim_amount?: number | null
          insurance_number?: string | null
          latitude?: number | null
          location: string
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          reported_by: string
          resolution_notes?: string | null
          severity_rating?: number | null
          status?: Database["public"]["Enums"]["incident_status"]
          total_cost?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_number?: string | null
          weather_condition?:
          | Database["public"]["Enums"]["weather_condition"]
          | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          images?: Json | null
          incident_date?: string
          incident_number?: string
          incident_time?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          insurance_claim_amount?: number | null
          insurance_number?: string | null
          latitude?: number | null
          location?: string
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          reported_by?: string
          resolution_notes?: string | null
          severity_rating?: number | null
          status?: Database["public"]["Enums"]["incident_status"]
          total_cost?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_number?: string | null
          weather_condition?:
          | Database["public"]["Enums"]["weather_condition"]
          | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_incidents_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incidents_location"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "predefined_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incidents_vehicle"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_action_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          inspection_id: string
          inspection_item_id: string | null
          priority: string | null
          related_work_order_id: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          inspection_id: string
          inspection_item_id?: string | null
          priority?: string | null
          related_work_order_id?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          inspection_id?: string
          inspection_item_id?: string | null
          priority?: string | null
          related_work_order_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_action_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_categories: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
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
      inspection_item_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          item_code: string
          item_name: string
          sort_order: number | null
          template_code: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          item_code: string
          item_name: string
          sort_order?: number | null
          template_code: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          item_code?: string
          item_name?: string
          sort_order?: number | null
          template_code?: string
        }
        Relationships: []
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
      inspection_reports: {
        Row: {
          created_at: string | null
          id: number
          inspection_date: string
          inspector_name: string
          location: string
          report_number: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          inspection_date: string
          inspector_name: string
          location: string
          report_number: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          inspection_date?: string
          inspector_name?: string
          location?: string
          report_number?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      inspection_results: {
        Row: {
          created_at: string | null
          id: number
          item_id: number | null
          notes: string | null
          report_id: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          item_id?: number | null
          notes?: string | null
          report_id?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          item_id?: number | null
          notes?: string | null
          report_id?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_results_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "inspection_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_template_items: {
        Row: {
          acceptance_criteria: string | null
          created_at: string | null
          default_value: string | null
          description: string
          help_text: string | null
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
          item_code: string
          item_order: number
          item_type: string
          max_value: number | null
          min_value: number | null
          options: Json | null
          section_name: string | null
          template_id: string
          unit_of_measure: string | null
          updated_at: string | null
        }
        Insert: {
          acceptance_criteria?: string | null
          created_at?: string | null
          default_value?: string | null
          description: string
          help_text?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          item_code: string
          item_order?: number
          item_type: string
          max_value?: number | null
          min_value?: number | null
          options?: Json | null
          section_name?: string | null
          template_id: string
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Update: {
          acceptance_criteria?: string | null
          created_at?: string | null
          default_value?: string | null
          description?: string
          help_text?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          item_code?: string
          item_order?: number
          item_type?: string
          max_value?: number | null
          min_value?: number | null
          options?: Json | null
          section_name?: string | null
          template_id?: string
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_template_items_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_template_items_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_template_details"
            referencedColumns: ["template_id"]
          },
        ]
      }
      inspection_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          payload: Json
          template_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payload: Json
          template_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payload?: Json
          template_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          additional_notes: string | null
          additional_signature_1: string | null
          additional_signature_2: string | null
          created_at: string
          id: string
          inspection_date: string
          inspector_name: string | null
          inspector_signature: string | null
          location: string | null
          maintenance_priority: string | null
          meter_reading: number | null
          model_year: string | null
          prepared_by: string | null
          report_number: string | null
          updated_at: string
          vehicle_category: string | null
          vehicle_id: string | null
          vehicle_name: string | null
          vehicle_safe_to_use: boolean | null
          vehicle_status: string | null
        }
        Insert: {
          additional_notes?: string | null
          additional_signature_1?: string | null
          additional_signature_2?: string | null
          created_at?: string
          id?: string
          inspection_date?: string
          inspector_name?: string | null
          inspector_signature?: string | null
          location?: string | null
          maintenance_priority?: string | null
          meter_reading?: number | null
          model_year?: string | null
          prepared_by?: string | null
          report_number?: string | null
          updated_at?: string
          vehicle_category?: string | null
          vehicle_id?: string | null
          vehicle_name?: string | null
          vehicle_safe_to_use?: boolean | null
          vehicle_status?: string | null
        }
        Update: {
          additional_notes?: string | null
          additional_signature_1?: string | null
          additional_signature_2?: string | null
          created_at?: string
          id?: string
          inspection_date?: string
          inspector_name?: string | null
          inspector_signature?: string | null
          location?: string | null
          maintenance_priority?: string | null
          meter_reading?: number | null
          model_year?: string | null
          prepared_by?: string | null
          report_number?: string | null
          updated_at?: string
          vehicle_category?: string | null
          vehicle_id?: string | null
          vehicle_name?: string | null
          vehicle_safe_to_use?: boolean | null
          vehicle_status?: string | null
        }
        Relationships: []
      }
      inspector_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          category: string
          created_at: string | null
          has_warranty: boolean | null
          id: string
          location: string | null
          min_quantity: number
          name: string
          part_number: string
          quantity: number
          supplier: string | null
          unit_price: number | null
          updated_at: string | null
          vendor_id: string | null
          warranty_claim_contact: string | null
          warranty_end_date: string | null
          warranty_notes: string | null
          warranty_period_months: number | null
          warranty_provider: string | null
          warranty_start_date: string | null
          warranty_terms: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          has_warranty?: boolean | null
          id?: string
          location?: string | null
          min_quantity?: number
          name: string
          part_number: string
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string | null
          vendor_id?: string | null
          warranty_claim_contact?: string | null
          warranty_end_date?: string | null
          warranty_notes?: string | null
          warranty_period_months?: number | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_terms?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          has_warranty?: boolean | null
          id?: string
          location?: string | null
          min_quantity?: number
          name?: string
          part_number?: string
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string | null
          vendor_id?: string | null
          warranty_claim_contact?: string | null
          warranty_end_date?: string | null
          warranty_notes?: string | null
          warranty_period_months?: number | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_serialized: boolean | null
          location: string | null
          manufacturer: string | null
          manufacturer_part_number: string | null
          name: string
          notes: string | null
          part_number: string | null
          quantity_on_hand: number | null
          reorder_point: number | null
          reorder_quantity: number | null
          selling_price: number | null
          unit_cost: number | null
          unit_of_measure: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_serialized?: boolean | null
          location?: string | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          name: string
          notes?: string | null
          part_number?: string | null
          quantity_on_hand?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          selling_price?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_serialized?: boolean | null
          location?: string | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          name?: string
          notes?: string | null
          part_number?: string | null
          quantity_on_hand?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          selling_price?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          created_at: string | null
          id: string
          inventory_id: string | null
          notes: string | null
          parts_request_id: string | null
          performed_by: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_id?: string | null
          notes?: string | null
          parts_request_id?: string | null
          performed_by?: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_id?: string | null
          notes?: string | null
          parts_request_id?: string | null
          performed_by?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_parts_request_id_fkey"
            columns: ["parts_request_id"]
            isOneToOne: false
            referencedRelation: "parts_requests"
            referencedColumns: ["id"]
          },
        ]
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
          invoice_date: string
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
        Relationships: []
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
          odometer_reading: number | null
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
          odometer_reading?: number | null
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
          odometer_reading?: number | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
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
      labor_time_entries: {
        Row: {
          active: boolean | null
          clock_in_latitude: number | null
          clock_in_longitude: number | null
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          contact_id: string
          contact_name: string | null
          created_at: string | null
          duration_in_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          updated_at: string | null
          work_order_id: string | null
          work_order_line_item_id: string | null
          work_order_sub_line_item_id: string | null
        }
        Insert: {
          active?: boolean | null
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          contact_id: string
          contact_name?: string | null
          created_at?: string | null
          duration_in_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at: string
          updated_at?: string | null
          work_order_id?: string | null
          work_order_line_item_id?: string | null
          work_order_sub_line_item_id?: string | null
        }
        Update: {
          active?: boolean | null
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          contact_id?: string
          contact_name?: string | null
          created_at?: string | null
          duration_in_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          updated_at?: string | null
          work_order_id?: string | null
          work_order_line_item_id?: string | null
          work_order_sub_line_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labor_time_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_time_entries_work_order_line_item_id_fkey"
            columns: ["work_order_line_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_time_entries_work_order_sub_line_item_id_fkey"
            columns: ["work_order_sub_line_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_sub_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      load_assignment_history: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          from_trip_id: string | null
          from_vehicle_id: string | null
          id: string
          load_id: string
          notes: string | null
          reason: string
          to_trip_id: string | null
          to_vehicle_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          from_trip_id?: string | null
          from_vehicle_id?: string | null
          id?: string
          load_id: string
          notes?: string | null
          reason: string
          to_trip_id?: string | null
          to_vehicle_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          from_trip_id?: string | null
          from_vehicle_id?: string | null
          id?: string
          load_id?: string
          notes?: string | null
          reason?: string
          to_trip_id?: string | null
          to_vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_history_from_vehicle"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_history_to_vehicle"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_assignment_history_from_trip_id_fkey"
            columns: ["from_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_assignment_history_from_trip_id_fkey"
            columns: ["from_trip_id"]
            isOneToOne: false
            referencedRelation: "trips_validation_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_assignment_history_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "load_assignment_history_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "load_assignment_history_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_assignment_history_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_assignment_history_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
          {
            foreignKeyName: "load_assignment_history_to_trip_id_fkey"
            columns: ["to_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_assignment_history_to_trip_id_fkey"
            columns: ["to_trip_id"]
            isOneToOne: false
            referencedRelation: "trips_validation_status"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          actual_delivery_datetime: string | null
          actual_pickup_datetime: string | null
          arrived_at_delivery: string | null
          arrived_at_pickup: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_trip_id: string | null
          assigned_vehicle_id: string | null
          attachments: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cargo_type: string
          channel: string | null
          completed_at: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string
          delivered_at: string | null
          delivery_datetime: string
          delivery_window_end: string | null
          delivery_window_start: string | null
          departure_time: string | null
          destination: string
          destination_address: string | null
          destination_lat: number | null
          destination_lng: number | null
          expected_arrival_at_delivery: string | null
          expected_arrival_at_pickup: string | null
          expected_departure_from_delivery: string | null
          expected_departure_from_pickup: string | null
          final_price: number | null
          id: string
          load_number: string
          loading_completed_at: string | null
          loading_started_at: string | null
          notes: string | null
          offloading_completed_at: string | null
          offloading_started_at: string | null
          origin: string
          origin_address: string | null
          origin_lat: number | null
          origin_lng: number | null
          packaging_type: string | null
          pallet_count: number | null
          pickup_date: string | null
          pickup_datetime: string
          pickup_window_end: string | null
          pickup_window_start: string | null
          priority: Database["public"]["Enums"]["load_priority"] | null
          quoted_price: number | null
          route_id: string | null
          special_instructions: string | null
          special_requirements: string[] | null
          status: Database["public"]["Enums"]["load_status"] | null
          updated_at: string | null
          value_amount: number | null
          value_currency: string | null
          volume_m3: number | null
          weight_kg: number
        }
        Insert: {
          actual_delivery_datetime?: string | null
          actual_pickup_datetime?: string | null
          arrived_at_delivery?: string | null
          arrived_at_pickup?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_trip_id?: string | null
          assigned_vehicle_id?: string | null
          attachments?: Json | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cargo_type: string
          channel?: string | null
          completed_at?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name: string
          delivered_at?: string | null
          delivery_datetime: string
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          departure_time?: string | null
          destination: string
          destination_address?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          expected_arrival_at_delivery?: string | null
          expected_arrival_at_pickup?: string | null
          expected_departure_from_delivery?: string | null
          expected_departure_from_pickup?: string | null
          final_price?: number | null
          id?: string
          load_number: string
          loading_completed_at?: string | null
          loading_started_at?: string | null
          notes?: string | null
          offloading_completed_at?: string | null
          offloading_started_at?: string | null
          origin: string
          origin_address?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          packaging_type?: string | null
          pallet_count?: number | null
          pickup_date?: string | null
          pickup_datetime: string
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          priority?: Database["public"]["Enums"]["load_priority"] | null
          quoted_price?: number | null
          route_id?: string | null
          special_instructions?: string | null
          special_requirements?: string[] | null
          status?: Database["public"]["Enums"]["load_status"] | null
          updated_at?: string | null
          value_amount?: number | null
          value_currency?: string | null
          volume_m3?: number | null
          weight_kg: number
        }
        Update: {
          actual_delivery_datetime?: string | null
          actual_pickup_datetime?: string | null
          arrived_at_delivery?: string | null
          arrived_at_pickup?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_trip_id?: string | null
          assigned_vehicle_id?: string | null
          attachments?: Json | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cargo_type?: string
          channel?: string | null
          completed_at?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string
          delivered_at?: string | null
          delivery_datetime?: string
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          departure_time?: string | null
          destination?: string
          destination_address?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          expected_arrival_at_delivery?: string | null
          expected_arrival_at_pickup?: string | null
          expected_departure_from_delivery?: string | null
          expected_departure_from_pickup?: string | null
          final_price?: number | null
          id?: string
          load_number?: string
          loading_completed_at?: string | null
          loading_started_at?: string | null
          notes?: string | null
          offloading_completed_at?: string | null
          offloading_started_at?: string | null
          origin?: string
          origin_address?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          packaging_type?: string | null
          pallet_count?: number | null
          pickup_date?: string | null
          pickup_datetime?: string
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          priority?: Database["public"]["Enums"]["load_priority"] | null
          quoted_price?: number | null
          route_id?: string | null
          special_instructions?: string | null
          special_requirements?: string[] | null
          status?: Database["public"]["Enums"]["load_status"] | null
          updated_at?: string | null
          value_amount?: number | null
          value_currency?: string | null
          volume_m3?: number | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_assigned_vehicle"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_assigned_trip_id_fkey"
            columns: ["assigned_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_assigned_trip_id_fkey"
            columns: ["assigned_trip_id"]
            isOneToOne: false
            referencedRelation: "trips_validation_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "saved_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_time: string
          alert_type: Database["public"]["Enums"]["maintenance_alert_type"]
          created_at: string | null
          delivery_status:
          | Database["public"]["Enums"]["maintenance_delivery_status"]
          | null
          due_date: string
          error_message: string | null
          hours_until_due: number | null
          id: string
          message: string | null
          notification_method: Database["public"]["Enums"]["maintenance_notification_method"]
          priority: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          schedule_id: string
          sent_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_time?: string
          alert_type: Database["public"]["Enums"]["maintenance_alert_type"]
          created_at?: string | null
          delivery_status?:
          | Database["public"]["Enums"]["maintenance_delivery_status"]
          | null
          due_date: string
          error_message?: string | null
          hours_until_due?: number | null
          id?: string
          message?: string | null
          notification_method?: Database["public"]["Enums"]["maintenance_notification_method"]
          priority?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          schedule_id: string
          sent_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_time?: string
          alert_type?: Database["public"]["Enums"]["maintenance_alert_type"]
          created_at?: string | null
          delivery_status?:
          | Database["public"]["Enums"]["maintenance_delivery_status"]
          | null
          due_date?: string
          error_message?: string | null
          hours_until_due?: number | null
          id?: string
          message?: string | null
          notification_method?: Database["public"]["Enums"]["maintenance_notification_method"]
          priority?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          schedule_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_alerts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedule_history: {
        Row: {
          completed_by: string | null
          completed_date: string
          created_at: string | null
          duration_hours: number | null
          id: string
          inspection_id: number | null
          job_card_id: string | null
          labor_hours: number | null
          linked_faults: Json | null
          notes: string | null
          odometer_reading: number | null
          parts_used: Json | null
          schedule_id: string | null
          scheduled_date: string | null
          status: string
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          completed_by?: string | null
          completed_date: string
          created_at?: string | null
          duration_hours?: number | null
          id?: string
          inspection_id?: number | null
          job_card_id?: string | null
          labor_hours?: number | null
          linked_faults?: Json | null
          notes?: string | null
          odometer_reading?: number | null
          parts_used?: Json | null
          schedule_id?: string | null
          scheduled_date?: string | null
          status: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_by?: string | null
          completed_date?: string
          created_at?: string | null
          duration_hours?: number | null
          id?: string
          inspection_id?: number | null
          job_card_id?: string | null
          labor_hours?: number | null
          linked_faults?: Json | null
          notes?: string | null
          odometer_reading?: number | null
          parts_used?: Json | null
          schedule_id?: string | null
          scheduled_date?: string | null
          status?: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedule_history_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedule_history_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedule_history_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          alert_before_hours: number[] | null
          assigned_team: string | null
          assigned_to: string | null
          auto_create_job_card: boolean | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          estimated_duration_hours: number | null
          frequency: string | null
          frequency_value: number | null
          id: string
          is_active: boolean | null
          last_completed_date: string | null
          last_odometer_reading: number | null
          maintenance_type: string | null
          next_due_date: string
          notes: string | null
          notification_channels: Json | null
          notification_recipients: Json | null
          odometer_based: boolean | null
          odometer_interval_km: number | null
          priority: string | null
          related_template_id: string | null
          schedule_type: string | null
          service_type: string
          start_date: string | null
          title: string | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          alert_before_hours?: number[] | null
          assigned_team?: string | null
          assigned_to?: string | null
          auto_create_job_card?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          estimated_duration_hours?: number | null
          frequency?: string | null
          frequency_value?: number | null
          id?: string
          is_active?: boolean | null
          last_completed_date?: string | null
          last_odometer_reading?: number | null
          maintenance_type?: string | null
          next_due_date: string
          notes?: string | null
          notification_channels?: Json | null
          notification_recipients?: Json | null
          odometer_based?: boolean | null
          odometer_interval_km?: number | null
          priority?: string | null
          related_template_id?: string | null
          schedule_type?: string | null
          service_type: string
          start_date?: string | null
          title?: string | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          alert_before_hours?: number[] | null
          assigned_team?: string | null
          assigned_to?: string | null
          auto_create_job_card?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          estimated_duration_hours?: number | null
          frequency?: string | null
          frequency_value?: number | null
          id?: string
          is_active?: boolean | null
          last_completed_date?: string | null
          last_odometer_reading?: number | null
          maintenance_type?: string | null
          next_due_date?: string
          notes?: string | null
          notification_channels?: Json | null
          notification_recipients?: Json | null
          odometer_based?: boolean | null
          odometer_interval_km?: number | null
          priority?: string | null
          related_template_id?: string | null
          schedule_type?: string | null
          service_type?: string
          start_date?: string | null
          title?: string | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_related_template_id_fkey"
            columns: ["related_template_id"]
            isOneToOne: false
            referencedRelation: "job_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_entries: {
        Row: {
          auto_voided_at: string | null
          category: string
          created_at: string | null
          date: string | null
          entry_type: string | null
          id: string
          meter_type: string
          notes: string | null
          updated_at: string | null
          value: number
          vehicle_id: string | null
          void: boolean | null
          work_order_id: string | null
        }
        Insert: {
          auto_voided_at?: string | null
          category: string
          created_at?: string | null
          date?: string | null
          entry_type?: string | null
          id?: string
          meter_type: string
          notes?: string | null
          updated_at?: string | null
          value: number
          vehicle_id?: string | null
          void?: boolean | null
          work_order_id?: string | null
        }
        Update: {
          auto_voided_at?: string | null
          category?: string
          created_at?: string | null
          date?: string | null
          entry_type?: string | null
          id?: string
          meter_type?: string
          notes?: string | null
          updated_at?: string | null
          value?: number
          vehicle_id?: string | null
          void?: boolean | null
          work_order_id?: string | null
        }
        Relationships: []
      }
      missed_loads: {
        Row: {
          actual_loss: number | null
          client_name: string | null
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
          load_reference: string | null
          load_request_date: string | null
          missed_date: string | null
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
          scheduled_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_loss?: number | null
          client_name?: string | null
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
          load_reference?: string | null
          load_request_date?: string | null
          missed_date?: string | null
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
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_loss?: number | null
          client_name?: string | null
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
          load_reference?: string | null
          load_request_date?: string | null
          missed_date?: string | null
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
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      monitor_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      overall_condition: {
        Row: {
          created_at: string | null
          id: number
          maintenance_priority: string | null
          report_id: number | null
          updated_at: string | null
          vehicle_safe_to_use: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          maintenance_priority?: string | null
          report_id?: number | null
          updated_at?: string | null
          vehicle_safe_to_use?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: number
          maintenance_priority?: string | null
          report_id?: number | null
          updated_at?: string | null
          vehicle_safe_to_use?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "overall_condition_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "inspection_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      part_location_details: {
        Row: {
          bin_number: string | null
          created_at: string | null
          id: string
          inventory_item_id: string | null
          notes: string | null
          part_location_id: string | null
          quantity: number | null
          updated_at: string | null
        }
        Insert: {
          bin_number?: string | null
          created_at?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          part_location_id?: string | null
          quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          bin_number?: string | null
          created_at?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          part_location_id?: string | null
          quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_location_details_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_location_details_part_location_id_fkey"
            columns: ["part_location_id"]
            isOneToOne: false
            referencedRelation: "part_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      part_locations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          location_type: string | null
          name: string
          parent_location_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string | null
          name: string
          parent_location_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string | null
          name?: string
          parent_location_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "part_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_requests: {
        Row: {
          allocated_at: string | null
          allocated_to_job_card: boolean | null
          approved_at: string | null
          approved_by: string | null
          cash_manager_approval_date: string | null
          cash_manager_approved_by: string | null
          cash_manager_reference: string | null
          created_at: string | null
          document_name: string | null
          document_url: string | null
          expected_delivery_date: string | null
          id: string
          inventory_id: string | null
          ir_number: string | null
          is_from_inventory: boolean | null
          is_service: boolean | null
          job_card_id: string | null
          make_brand: string | null
          notes: string | null
          ordered_at: string | null
          ordered_by: string | null
          part_name: string
          part_number: string | null
          procurement_started: boolean | null
          quantity: number
          quotes: Json | null
          received_by: string | null
          received_date: string | null
          received_quantity: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_by: string | null
          sage_requisition_by: string | null
          sage_requisition_date: string | null
          sage_requisition_number: string | null
          service_description: string | null
          status: string
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
          urgency_level: string | null
          vendor_id: string | null
        }
        Insert: {
          allocated_at?: string | null
          allocated_to_job_card?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          cash_manager_approval_date?: string | null
          cash_manager_approved_by?: string | null
          cash_manager_reference?: string | null
          created_at?: string | null
          document_name?: string | null
          document_url?: string | null
          expected_delivery_date?: string | null
          id?: string
          inventory_id?: string | null
          ir_number?: string | null
          is_from_inventory?: boolean | null
          is_service?: boolean | null
          job_card_id?: string | null
          make_brand?: string | null
          notes?: string | null
          ordered_at?: string | null
          ordered_by?: string | null
          part_name: string
          part_number?: string | null
          procurement_started?: boolean | null
          quantity: number
          quotes?: Json | null
          received_by?: string | null
          received_date?: string | null
          received_quantity?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          sage_requisition_by?: string | null
          sage_requisition_date?: string | null
          sage_requisition_number?: string | null
          service_description?: string | null
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
          urgency_level?: string | null
          vendor_id?: string | null
        }
        Update: {
          allocated_at?: string | null
          allocated_to_job_card?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          cash_manager_approval_date?: string | null
          cash_manager_approved_by?: string | null
          cash_manager_reference?: string | null
          created_at?: string | null
          document_name?: string | null
          document_url?: string | null
          expected_delivery_date?: string | null
          id?: string
          inventory_id?: string | null
          ir_number?: string | null
          is_from_inventory?: boolean | null
          is_service?: boolean | null
          job_card_id?: string | null
          make_brand?: string | null
          notes?: string | null
          ordered_at?: string | null
          ordered_by?: string | null
          part_name?: string
          part_number?: string | null
          procurement_started?: boolean | null
          quantity?: number
          quotes?: Json | null
          received_by?: string | null
          received_date?: string | null
          received_quantity?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          sage_requisition_by?: string | null
          sage_requisition_date?: string | null
          sage_requisition_number?: string | null
          service_description?: string | null
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
          urgency_level?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_requests_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_requests_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_requests_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      position_type: {
        Row: {
          pos_type_code: string
        }
        Insert: {
          pos_type_code: string
        }
        Update: {
          pos_type_code?: string
        }
        Relationships: []
      }
      predefined_locations: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          has_accommodation: boolean | null
          has_fuel: boolean | null
          has_parking: boolean | null
          has_restaurant: boolean | null
          has_weighbridge: boolean | null
          id: string
          is_active: boolean | null
          is_favorite: boolean | null
          latitude: number
          location_type: Database["public"]["Enums"]["location_type"] | null
          longitude: number
          name: string
          notes: string | null
          operating_hours: string | null
          short_code: string | null
          state_province: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          has_accommodation?: boolean | null
          has_fuel?: boolean | null
          has_parking?: boolean | null
          has_restaurant?: boolean | null
          has_weighbridge?: boolean | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          latitude: number
          location_type?: Database["public"]["Enums"]["location_type"] | null
          longitude: number
          name: string
          notes?: string | null
          operating_hours?: string | null
          short_code?: string | null
          state_province?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          has_accommodation?: boolean | null
          has_fuel?: boolean | null
          has_parking?: boolean | null
          has_restaurant?: boolean | null
          has_weighbridge?: boolean | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          latitude?: number
          location_type?: Database["public"]["Enums"]["location_type"] | null
          longitude?: number
          name?: string
          notes?: string | null
          operating_hours?: string | null
          short_code?: string | null
          state_province?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
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
      recurring_schedules: {
        Row: {
          channel: string | null
          created_at: string | null
          days_of_week: number[] | null
          destination: string
          frequency: string | null
          id: string
          is_active: boolean | null
          name: string
          origin: string
          packaging_type: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          days_of_week?: number[] | null
          destination: string
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          origin: string
          packaging_type?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          days_of_week?: number[] | null
          destination?: string
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          origin?: string
          packaging_type?: string | null
        }
        Relationships: []
      }
      reefer_diesel_records: {
        Row: {
          cost_entry_ids: string[] | null
          cost_per_litre: number | null
          created_at: string | null
          currency: string | null
          date: string
          driver_name: string | null
          fuel_station: string
          hours_operated: number | null
          id: string
          linked_diesel_record_id: string | null
          linked_horse: string | null
          linked_horse_id: string | null
          litres_filled: number
          litres_per_hour: number | null
          notes: string | null
          operating_hours: number | null
          previous_operating_hours: number | null
          reefer_unit: string
          total_cost: number
          trip_id: string | null
          updated_at: string | null
        }
        Insert: {
          cost_entry_ids?: string[] | null
          cost_per_litre?: number | null
          created_at?: string | null
          currency?: string | null
          date: string
          driver_name?: string | null
          fuel_station: string
          hours_operated?: number | null
          id?: string
          linked_diesel_record_id?: string | null
          linked_horse?: string | null
          linked_horse_id?: string | null
          litres_filled: number
          litres_per_hour?: number | null
          notes?: string | null
          operating_hours?: number | null
          previous_operating_hours?: number | null
          reefer_unit: string
          total_cost: number
          trip_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cost_entry_ids?: string[] | null
          cost_per_litre?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string
          driver_name?: string | null
          fuel_station?: string
          hours_operated?: number | null
          id?: string
          linked_diesel_record_id?: string | null
          linked_horse?: string | null
          linked_horse_id?: string | null
          litres_filled?: number
          litres_per_hour?: number | null
          notes?: string | null
          operating_hours?: number | null
          previous_operating_hours?: number | null
          reefer_unit?: string
          total_cost?: number
          trip_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reefer_diesel_records_linked_horse_id_fkey"
            columns: ["linked_horse_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reefer_diesel_records_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reefer_diesel_records_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips_validation_status"
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
      root_cause_analysis: {
        Row: {
          completed_at: string | null
          conducted_by: string
          created_at: string | null
          id: string
          inspection_id: string
          notes: string
          responsible_person: string | null
          root_cause: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          conducted_by: string
          created_at?: string | null
          id?: string
          inspection_id: string
          notes: string
          responsible_person?: string | null
          root_cause: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          conducted_by?: string
          created_at?: string | null
          id?: string
          inspection_id?: string
          notes?: string
          responsible_person?: string | null
          root_cause?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "root_cause_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      route_analytics: {
        Row: {
          actual_fuel_cost: number | null
          actual_fuel_liters: number | null
          created_at: string | null
          driver_name: string | null
          fuel_stops_used: Json | null
          id: string
          notes: string | null
          optimized_cost_would_be: number | null
          route_id: string
          savings_achieved: number | null
          trip_date: string
          vehicle_id: string | null
        }
        Insert: {
          actual_fuel_cost?: number | null
          actual_fuel_liters?: number | null
          created_at?: string | null
          driver_name?: string | null
          fuel_stops_used?: Json | null
          id?: string
          notes?: string | null
          optimized_cost_would_be?: number | null
          route_id: string
          savings_achieved?: number | null
          trip_date: string
          vehicle_id?: string | null
        }
        Update: {
          actual_fuel_cost?: number | null
          actual_fuel_liters?: number | null
          created_at?: string | null
          driver_name?: string | null
          fuel_stops_used?: Json | null
          id?: string
          notes?: string | null
          optimized_cost_would_be?: number | null
          route_id?: string
          savings_achieved?: number | null
          trip_date?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_analytics_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fuel_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_efficiency: {
        Row: {
          actual_duration_minutes: number | null
          actual_route_km: number | null
          actual_waypoints_visited: number | null
          alternative_routes_available: boolean | null
          border_crossing_minutes: number | null
          created_at: string | null
          deviation_km: number | null
          deviation_percentage: number | null
          estimated_duration_minutes: number | null
          estimated_savings_km: number | null
          estimated_savings_minutes: number | null
          id: string
          load_id: string
          missed_waypoints: string[] | null
          planned_route_km: number | null
          planned_waypoints: number | null
          route_optimization_score: number | null
          time_variance_minutes: number | null
          traffic_delay_minutes: number | null
          unauthorized_detour_minutes: number | null
          vehicle_breakdown_minutes: number | null
          weather_delay_minutes: number | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          actual_route_km?: number | null
          actual_waypoints_visited?: number | null
          alternative_routes_available?: boolean | null
          border_crossing_minutes?: number | null
          created_at?: string | null
          deviation_km?: number | null
          deviation_percentage?: number | null
          estimated_duration_minutes?: number | null
          estimated_savings_km?: number | null
          estimated_savings_minutes?: number | null
          id?: string
          load_id: string
          missed_waypoints?: string[] | null
          planned_route_km?: number | null
          planned_waypoints?: number | null
          route_optimization_score?: number | null
          time_variance_minutes?: number | null
          traffic_delay_minutes?: number | null
          unauthorized_detour_minutes?: number | null
          vehicle_breakdown_minutes?: number | null
          weather_delay_minutes?: number | null
        }
        Update: {
          actual_duration_minutes?: number | null
          actual_route_km?: number | null
          actual_waypoints_visited?: number | null
          alternative_routes_available?: boolean | null
          border_crossing_minutes?: number | null
          created_at?: string | null
          deviation_km?: number | null
          deviation_percentage?: number | null
          estimated_duration_minutes?: number | null
          estimated_savings_km?: number | null
          estimated_savings_minutes?: number | null
          id?: string
          load_id?: string
          missed_waypoints?: string[] | null
          planned_route_km?: number | null
          planned_waypoints?: number | null
          route_optimization_score?: number | null
          time_variance_minutes?: number | null
          traffic_delay_minutes?: number | null
          unauthorized_detour_minutes?: number | null
          vehicle_breakdown_minutes?: number | null
          weather_delay_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_efficiency_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "route_efficiency_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "route_efficiency_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_efficiency_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_efficiency_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
        ]
      }
      route_expense_configs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          route: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          route: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          route?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      route_expense_items: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          currency: string
          description: string | null
          display_order: number | null
          id: string
          is_required: boolean | null
          route_config_id: string
          sub_category: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string | null
          currency?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          route_config_id: string
          sub_category: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          route_config_id?: string
          sub_category?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_expense_items_route_config_id_fkey"
            columns: ["route_config_id"]
            isOneToOne: false
            referencedRelation: "route_expense_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      route_fuel_recommendations: {
        Row: {
          calculated_at: string | null
          distance_from_origin_km: number | null
          distance_to_destination_km: number | null
          estimated_cost: number | null
          id: string
          is_mandatory: boolean | null
          price_at_calculation: number | null
          reason: string | null
          recommended_liters: number | null
          route_id: string
          savings_vs_average: number | null
          sequence_order: number
          supplier_id: string
        }
        Insert: {
          calculated_at?: string | null
          distance_from_origin_km?: number | null
          distance_to_destination_km?: number | null
          estimated_cost?: number | null
          id?: string
          is_mandatory?: boolean | null
          price_at_calculation?: number | null
          reason?: string | null
          recommended_liters?: number | null
          route_id: string
          savings_vs_average?: number | null
          sequence_order: number
          supplier_id: string
        }
        Update: {
          calculated_at?: string | null
          distance_from_origin_km?: number | null
          distance_to_destination_km?: number | null
          estimated_cost?: number | null
          id?: string
          is_mandatory?: boolean | null
          price_at_calculation?: number | null
          reason?: string | null
          recommended_liters?: number | null
          route_id?: string
          savings_vs_average?: number | null
          sequence_order?: number
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_fuel_recommendations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fuel_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_fuel_recommendations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "diesel_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      route_fuel_stops: {
        Row: {
          created_at: string | null
          destination: string
          distance_from_origin_km: number | null
          distance_to_next_stop_km: number | null
          estimated_cost: number | null
          id: string
          is_mandatory: boolean | null
          is_recommended: boolean | null
          notes: string | null
          origin: string
          recommended_liters: number | null
          route_name: string
          skip_reason: string | null
          stop_order: number
          supplier_id: string
          total_distance_km: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          destination: string
          distance_from_origin_km?: number | null
          distance_to_next_stop_km?: number | null
          estimated_cost?: number | null
          id?: string
          is_mandatory?: boolean | null
          is_recommended?: boolean | null
          notes?: string | null
          origin: string
          recommended_liters?: number | null
          route_name: string
          skip_reason?: string | null
          stop_order: number
          supplier_id: string
          total_distance_km?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          destination?: string
          distance_from_origin_km?: number | null
          distance_to_next_stop_km?: number | null
          estimated_cost?: number | null
          id?: string
          is_mandatory?: boolean | null
          is_recommended?: boolean | null
          notes?: string | null
          origin?: string
          recommended_liters?: number | null
          route_name?: string
          skip_reason?: string | null
          stop_order?: number
          supplier_id?: string
          total_distance_km?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_fuel_stops_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "diesel_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      route_notes: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          distance_from_origin_km: number | null
          id: string
          is_important: boolean | null
          latitude: number | null
          location_description: string | null
          longitude: number | null
          note_type: string
          route_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          distance_from_origin_km?: number | null
          id?: string
          is_important?: boolean | null
          latitude?: number | null
          location_description?: string | null
          longitude?: number | null
          note_type?: string
          route_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          distance_from_origin_km?: number | null
          id?: string
          is_important?: boolean | null
          latitude?: number | null
          location_description?: string | null
          longitude?: number | null
          note_type?: string
          route_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_notes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fuel_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_optimizations: {
        Row: {
          alternate_routes: Json | null
          calculation_time_ms: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          estimated_duration_mins: number
          estimated_fuel_cost: number | null
          estimated_fuel_litres: number | null
          id: string
          optimization_algorithm: string | null
          optimized_sequence: number[]
          route_geometry: Json | null
          selected: boolean | null
          selected_at: string | null
          selected_by: string | null
          total_distance_km: number
          trip_id: string | null
          waypoints: Json
        }
        Insert: {
          alternate_routes?: Json | null
          calculation_time_ms?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          estimated_duration_mins: number
          estimated_fuel_cost?: number | null
          estimated_fuel_litres?: number | null
          id?: string
          optimization_algorithm?: string | null
          optimized_sequence: number[]
          route_geometry?: Json | null
          selected?: boolean | null
          selected_at?: string | null
          selected_by?: string | null
          total_distance_km: number
          trip_id?: string | null
          waypoints: Json
        }
        Update: {
          alternate_routes?: Json | null
          calculation_time_ms?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          estimated_duration_mins?: number
          estimated_fuel_cost?: number | null
          estimated_fuel_litres?: number | null
          id?: string
          optimization_algorithm?: string | null
          optimized_sequence?: number[]
          route_geometry?: Json | null
          selected?: boolean | null
          selected_at?: string | null
          selected_by?: string | null
          total_distance_km?: number
          trip_id?: string | null
          waypoints?: Json
        }
        Relationships: [
          {
            foreignKeyName: "route_optimizations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_optimizations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips_validation_status"
            referencedColumns: ["id"]
          },
        ]
      }
      route_toll_costs: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string
          description: string | null
          id: string
          is_active: boolean
          route: string
          toll_fee: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          route: string
          toll_fee: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          route?: string
          toll_fee?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      route_waypoints: {
        Row: {
          created_at: string | null
          distance_from_origin_km: number | null
          distance_to_next_km: number | null
          google_maps_url: string | null
          id: string
          is_fuel_stop: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          route_id: string
          sequence_order: number
          supplier_id: string | null
        }
        Insert: {
          created_at?: string | null
          distance_from_origin_km?: number | null
          distance_to_next_km?: number | null
          google_maps_url?: string | null
          id?: string
          is_fuel_stop?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          route_id: string
          sequence_order: number
          supplier_id?: string | null
        }
        Update: {
          created_at?: string | null
          distance_from_origin_km?: number | null
          distance_to_next_km?: number | null
          google_maps_url?: string | null
          id?: string
          is_fuel_stop?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          route_id?: string
          sequence_order?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_waypoints_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fuel_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_waypoints_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "diesel_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_routes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          estimated_duration_mins: number
          id: string
          is_template: boolean
          name: string
          total_distance_km: number
          updated_at: string
          usage_count: number
          waypoints: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration_mins?: number
          id?: string
          is_template?: boolean
          name: string
          total_distance_km?: number
          updated_at?: string
          usage_count?: number
          waypoints?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration_mins?: number
          id?: string
          is_template?: boolean
          name?: string
          total_distance_km?: number
          updated_at?: string
          usage_count?: number
          waypoints?: Json
        }
        Relationships: []
      }
      signatures: {
        Row: {
          additional_signature_1: string | null
          additional_signature_2: string | null
          created_at: string | null
          id: number
          inspector_signature: string | null
          prepared_by: string | null
          report_id: number | null
          updated_at: string | null
        }
        Insert: {
          additional_signature_1?: string | null
          additional_signature_2?: string | null
          created_at?: string | null
          id?: number
          inspector_signature?: string | null
          prepared_by?: string | null
          report_id?: number | null
          updated_at?: string | null
        }
        Update: {
          additional_signature_1?: string | null
          additional_signature_2?: string | null
          created_at?: string | null
          id?: number
          inspector_signature?: string | null
          prepared_by?: string | null
          report_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "inspection_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_history: {
        Row: {
          created_at: string | null
          effective_date: string
          end_date: string | null
          id: string
          notes: string | null
          price_change: number | null
          price_change_percent: number | null
          price_per_liter: number
          supplier_id: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date: string
          end_date?: string | null
          id?: string
          notes?: string | null
          price_change?: number | null
          price_change_percent?: number | null
          price_per_liter: number
          supplier_id: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          price_change?: number | null
          price_change_percent?: number | null
          price_per_liter?: number
          supplier_id?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "diesel_suppliers"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      trip_cycle_tracker: {
        Row: {
          created_at: string | null
          current_phase: number | null
          driver_id: string | null
          id: string
          is_completed: boolean | null
          p1_inspection_end: string | null
          p1_inspection_start: string | null
          p1_reefer_start_temp: number | null
          p1_reefer_start_time: string | null
          p1_refuel_end: string | null
          p1_refuel_start: string | null
          p1_yard_departure: string | null
          p2_delay_other_detail: string | null
          p2_delay_reason: string[] | null
          p2_farm_arrival: string | null
          p2_farm_departure: string | null
          p2_farm_supervisor: string | null
          p2_loading_end: string | null
          p2_loading_start: string | null
          p4_depot_arrival: string | null
          p4_offloading_end: string | null
          p4_offloading_start: string | null
          p4_reefer_arrival_temp: number | null
          p5_bins_count: number | null
          p5_crates_count: number | null
          p5_damaged_details: string | null
          p5_damaged_packaging: boolean | null
          p5_depot_departure: string | null
          p5_depot_supervisor: string | null
          p6_road_comments: string | null
          p6_unloading_end: string | null
          p6_unloading_start: string | null
          p6_yard_arrival: string | null
          route: string | null
          trip_id: string
          truck_type: string | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_phase?: number | null
          driver_id?: string | null
          id?: string
          is_completed?: boolean | null
          p1_inspection_end?: string | null
          p1_inspection_start?: string | null
          p1_reefer_start_temp?: number | null
          p1_reefer_start_time?: string | null
          p1_refuel_end?: string | null
          p1_refuel_start?: string | null
          p1_yard_departure?: string | null
          p2_delay_other_detail?: string | null
          p2_delay_reason?: string[] | null
          p2_farm_arrival?: string | null
          p2_farm_departure?: string | null
          p2_farm_supervisor?: string | null
          p2_loading_end?: string | null
          p2_loading_start?: string | null
          p4_depot_arrival?: string | null
          p4_offloading_end?: string | null
          p4_offloading_start?: string | null
          p4_reefer_arrival_temp?: number | null
          p5_bins_count?: number | null
          p5_crates_count?: number | null
          p5_damaged_details?: string | null
          p5_damaged_packaging?: boolean | null
          p5_depot_departure?: string | null
          p5_depot_supervisor?: string | null
          p6_road_comments?: string | null
          p6_unloading_end?: string | null
          p6_unloading_start?: string | null
          p6_yard_arrival?: string | null
          route?: string | null
          trip_id: string
          truck_type?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_phase?: number | null
          driver_id?: string | null
          id?: string
          is_completed?: boolean | null
          p1_inspection_end?: string | null
          p1_inspection_start?: string | null
          p1_reefer_start_temp?: number | null
          p1_reefer_start_time?: string | null
          p1_refuel_end?: string | null
          p1_refuel_start?: string | null
          p1_yard_departure?: string | null
          p2_delay_other_detail?: string | null
          p2_delay_reason?: string[] | null
          p2_farm_arrival?: string | null
          p2_farm_departure?: string | null
          p2_farm_supervisor?: string | null
          p2_loading_end?: string | null
          p2_loading_start?: string | null
          p4_depot_arrival?: string | null
          p4_offloading_end?: string | null
          p4_offloading_start?: string | null
          p4_reefer_arrival_temp?: number | null
          p5_bins_count?: number | null
          p5_crates_count?: number | null
          p5_damaged_details?: string | null
          p5_damaged_packaging?: boolean | null
          p5_depot_departure?: string | null
          p5_depot_supervisor?: string | null
          p6_road_comments?: string | null
          p6_unloading_end?: string | null
          p6_unloading_start?: string | null
          p6_yard_arrival?: string | null
          route?: string | null
          trip_id?: string
          truck_type?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_cycle_tracker_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cycle_tracker_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips_validation_status"
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
      trip_transit_stops: {
        Row: {
          created_at: string | null
          duration_mins: number | null
          id: string
          location: string
          reason: string
          sort_order: number | null
          time_in: string
          time_out: string | null
          tracker_id: string
        }
        Insert: {
          created_at?: string | null
          duration_mins?: number | null
          id?: string
          location: string
          reason: string
          sort_order?: number | null
          time_in: string
          time_out?: string | null
          tracker_id: string
        }
        Update: {
          created_at?: string | null
          duration_mins?: number | null
          id?: string
          location?: string
          reason?: string
          sort_order?: number | null
          time_in?: string
          time_out?: string | null
          tracker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_transit_stops_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trip_cycle_tracker"
            referencedColumns: ["id"]
          },
        ]
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
          empty_km: number | null
          empty_km_reason: string | null
          ending_km: number | null
          external_load_ref: string | null
          final_invoice_amount: number | null
          fleet_vehicle_id: string | null
          follow_up_date: string | null
          follow_up_history: Json | null
          follow_up_method: string | null
          follow_up_notes: string | null
          id: string
          import_source: string | null
          invoice_amount: number | null
          invoice_attachments: Json | null
          invoice_currency: string | null
          invoice_date: string | null
          invoice_due_date: string | null
          invoice_number: string | null
          invoice_submitted_date: string | null
          invoice_terms_days: number | null
          last_follow_up_date: string | null
          load_type: string | null
          origin: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_notes: string | null
          payment_received_date: string | null
          payment_status: string | null
          planned_arrival_date: string | null
          planned_departure_date: string | null
          rate_per_km: number | null
          revenue_currency: string | null
          revenue_type: string | null
          route: string | null
          shipped_status: boolean | null
          special_requirements: string[] | null
          starting_km: number | null
          status: string | null
          trip_duration_hours: number | null
          trip_number: string | null
          updated_at: string | null
          validation_notes: string | null
          vehicle_id: string | null
          verified_no_costs: boolean | null
          verified_no_costs_at: string | null
          verified_no_costs_by: string | null
          zero_revenue_comment: string | null
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
          empty_km?: number | null
          empty_km_reason?: string | null
          ending_km?: number | null
          external_load_ref?: string | null
          final_invoice_amount?: number | null
          fleet_vehicle_id?: string | null
          follow_up_date?: string | null
          follow_up_history?: Json | null
          follow_up_method?: string | null
          follow_up_notes?: string | null
          id?: string
          import_source?: string | null
          invoice_amount?: number | null
          invoice_attachments?: Json | null
          invoice_currency?: string | null
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_number?: string | null
          invoice_submitted_date?: string | null
          invoice_terms_days?: number | null
          last_follow_up_date?: string | null
          load_type?: string | null
          origin?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_received_date?: string | null
          payment_status?: string | null
          planned_arrival_date?: string | null
          planned_departure_date?: string | null
          rate_per_km?: number | null
          revenue_currency?: string | null
          revenue_type?: string | null
          route?: string | null
          shipped_status?: boolean | null
          special_requirements?: string[] | null
          starting_km?: number | null
          status?: string | null
          trip_duration_hours?: number | null
          trip_number?: string | null
          updated_at?: string | null
          validation_notes?: string | null
          vehicle_id?: string | null
          verified_no_costs?: boolean | null
          verified_no_costs_at?: string | null
          verified_no_costs_by?: string | null
          zero_revenue_comment?: string | null
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
          empty_km?: number | null
          empty_km_reason?: string | null
          ending_km?: number | null
          external_load_ref?: string | null
          final_invoice_amount?: number | null
          fleet_vehicle_id?: string | null
          follow_up_date?: string | null
          follow_up_history?: Json | null
          follow_up_method?: string | null
          follow_up_notes?: string | null
          id?: string
          import_source?: string | null
          invoice_amount?: number | null
          invoice_attachments?: Json | null
          invoice_currency?: string | null
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_number?: string | null
          invoice_submitted_date?: string | null
          invoice_terms_days?: number | null
          last_follow_up_date?: string | null
          load_type?: string | null
          origin?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_received_date?: string | null
          payment_status?: string | null
          planned_arrival_date?: string | null
          planned_departure_date?: string | null
          rate_per_km?: number | null
          revenue_currency?: string | null
          revenue_type?: string | null
          route?: string | null
          shipped_status?: boolean | null
          special_requirements?: string[] | null
          starting_km?: number | null
          status?: string | null
          trip_duration_hours?: number | null
          trip_number?: string | null
          updated_at?: string | null
          validation_notes?: string | null
          vehicle_id?: string | null
          verified_no_costs?: boolean | null
          verified_no_costs_at?: string | null
          verified_no_costs_by?: string | null
          zero_revenue_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_trips_vehicle"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_fleet_vehicle_id_fkey"
            columns: ["fleet_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_route_locations: {
        Row: {
          address: string | null
          created_at: string | null
          id: number
          latitude: number | null
          longitude: number | null
          name: string
          short_code: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name: string
          short_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name?: string
          short_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tyre_catalogue: {
        Row: {
          brand: string
          is_active: boolean
          pattern: string | null
          pos_type_code: string
          size_code: string
          tyre_cat_id: number
        }
        Insert: {
          brand: string
          is_active?: boolean
          pattern?: string | null
          pos_type_code: string
          size_code: string
          tyre_cat_id?: number
        }
        Update: {
          brand?: string
          is_active?: boolean
          pattern?: string | null
          pos_type_code?: string
          size_code?: string
          tyre_cat_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tyre_catalogue_pos_type_code_fkey"
            columns: ["pos_type_code"]
            isOneToOne: false
            referencedRelation: "position_type"
            referencedColumns: ["pos_type_code"]
          },
        ]
      }
      tyre_catalogue_backup: {
        Row: {
          brand: string | null
          is_active: boolean | null
          pattern: string | null
          pos_type_code: string | null
          size_code: string | null
          tyre_cat_id: number | null
        }
        Insert: {
          brand?: string | null
          is_active?: boolean | null
          pattern?: string | null
          pos_type_code?: string | null
          size_code?: string | null
          tyre_cat_id?: number | null
        }
        Update: {
          brand?: string | null
          is_active?: boolean | null
          pattern?: string | null
          pos_type_code?: string | null
          size_code?: string | null
          tyre_cat_id?: number | null
        }
        Relationships: []
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
          wear_pattern: Database["public"]["Enums"]["wear_pattern"] | null
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
          wear_pattern?: Database["public"]["Enums"]["wear_pattern"] | null
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
          wear_pattern?: Database["public"]["Enums"]["wear_pattern"] | null
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
          brand: string
          created_at: string | null
          dot_code: string | null
          id: string
          initial_tread_depth: number | null
          location: string | null
          min_quantity: number | null
          model: string
          pressure_rating: number | null
          purchase_cost_usd: number | null
          purchase_cost_zar: number | null
          quantity: number | null
          size: string
          status: string | null
          supplier: string | null
          type: string
          unit_price: number | null
          updated_at: string | null
          vendor: string | null
          warranty_km: number | null
          warranty_months: number | null
        }
        Insert: {
          brand: string
          created_at?: string | null
          dot_code?: string | null
          id?: string
          initial_tread_depth?: number | null
          location?: string | null
          min_quantity?: number | null
          model: string
          pressure_rating?: number | null
          purchase_cost_usd?: number | null
          purchase_cost_zar?: number | null
          quantity?: number | null
          size: string
          status?: string | null
          supplier?: string | null
          type: string
          unit_price?: number | null
          updated_at?: string | null
          vendor?: string | null
          warranty_km?: number | null
          warranty_months?: number | null
        }
        Update: {
          brand?: string
          created_at?: string | null
          dot_code?: string | null
          id?: string
          initial_tread_depth?: number | null
          location?: string | null
          min_quantity?: number | null
          model?: string
          pressure_rating?: number | null
          purchase_cost_usd?: number | null
          purchase_cost_zar?: number | null
          quantity?: number | null
          size?: string
          status?: string | null
          supplier?: string | null
          type?: string
          unit_price?: number | null
          updated_at?: string | null
          vendor?: string | null
          warranty_km?: number | null
          warranty_months?: number | null
        }
        Relationships: []
      }
      tyre_layout: {
        Row: {
          description: string
          layout_code: string
        }
        Insert: {
          description: string
          layout_code: string
        }
        Update: {
          description?: string
          layout_code?: string
        }
        Relationships: []
      }
      tyre_layout_position: {
        Row: {
          axle_no: number | null
          dual_slot: string | null
          is_spare: boolean
          layout_code: string
          pair_no: number | null
          pair_slot: string | null
          pos_code: string
          pos_num: number | null
          side: string | null
          spare_index: number | null
        }
        Insert: {
          axle_no?: number | null
          dual_slot?: string | null
          is_spare?: boolean
          layout_code: string
          pair_no?: number | null
          pair_slot?: string | null
          pos_code: string
          pos_num?: number | null
          side?: string | null
          spare_index?: number | null
        }
        Update: {
          axle_no?: number | null
          dual_slot?: string | null
          is_spare?: boolean
          layout_code?: string
          pair_no?: number | null
          pair_slot?: string | null
          pos_code?: string
          pos_num?: number | null
          side?: string | null
          spare_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tyre_layout_position_layout_code_fkey"
            columns: ["layout_code"]
            isOneToOne: false
            referencedRelation: "tyre_layout"
            referencedColumns: ["layout_code"]
          },
        ]
      }
      tyre_lifecycle_events: {
        Row: {
          cost_associated: number | null
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
        Relationships: []
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
          action: string | null
          fleet_position: string | null
          from_position: string | null
          id: string
          km_reading: number | null
          notes: string | null
          performed_at: string | null
          performed_by: string | null
          to_position: string | null
          tyre_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          action?: string | null
          fleet_position?: string | null
          from_position?: string | null
          id?: string
          km_reading?: number | null
          notes?: string | null
          performed_at?: string | null
          performed_by?: string | null
          to_position?: string | null
          tyre_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          action?: string | null
          fleet_position?: string | null
          from_position?: string | null
          id?: string
          km_reading?: number | null
          notes?: string | null
          performed_at?: string | null
          performed_by?: string | null
          to_position?: string | null
          tyre_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
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
        ]
      }
      tyrepositions: {
        Row: {
          fleet_number: string | null
          id: number
          position: string | null
          store: string | null
          tyre_code: string | null
        }
        Insert: {
          fleet_number?: string | null
          id?: number
          position?: string | null
          store?: string | null
          tyre_code?: string | null
        }
        Update: {
          fleet_number?: string | null
          id?: number
          position?: string | null
          store?: string | null
          tyre_code?: string | null
        }
        Relationships: []
      }
      tyres: {
        Row: {
          brand: string
          condition: Database["public"]["Enums"]["tyre_condition"] | null
          created_at: string | null
          current_fleet_position: string | null
          current_tread_depth: number | null
          dot_code: string | null
          id: string
          initial_tread_depth: number | null
          installation_date: string | null
          installation_km: number | null
          installer_name: string | null
          inventory_id: string | null
          km_at_removal: number | null
          km_travelled: number | null
          last_inspection_date: string | null
          model: string
          notes: string | null
          position: string | null
          pressure_health: string | null
          purchase_cost_usd: number | null
          purchase_cost_zar: number | null
          purchase_date: string | null
          purchase_price: number | null
          removal_date: string | null
          removal_reason: string | null
          removed_from_vehicle: string | null
          serial_number: string | null
          size: string
          tread_depth_health: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          brand: string
          condition?: Database["public"]["Enums"]["tyre_condition"] | null
          created_at?: string | null
          current_fleet_position?: string | null
          current_tread_depth?: number | null
          dot_code?: string | null
          id?: string
          initial_tread_depth?: number | null
          installation_date?: string | null
          installation_km?: number | null
          installer_name?: string | null
          inventory_id?: string | null
          km_at_removal?: number | null
          km_travelled?: number | null
          last_inspection_date?: string | null
          model: string
          notes?: string | null
          position?: string | null
          pressure_health?: string | null
          purchase_cost_usd?: number | null
          purchase_cost_zar?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          removal_date?: string | null
          removal_reason?: string | null
          removed_from_vehicle?: string | null
          serial_number?: string | null
          size: string
          tread_depth_health?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          brand?: string
          condition?: Database["public"]["Enums"]["tyre_condition"] | null
          created_at?: string | null
          current_fleet_position?: string | null
          current_tread_depth?: number | null
          dot_code?: string | null
          id?: string
          initial_tread_depth?: number | null
          installation_date?: string | null
          installation_km?: number | null
          installer_name?: string | null
          inventory_id?: string | null
          km_at_removal?: number | null
          km_travelled?: number | null
          last_inspection_date?: string | null
          model?: string
          notes?: string | null
          position?: string | null
          pressure_health?: string | null
          purchase_cost_usd?: number | null
          purchase_cost_zar?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          removal_date?: string | null
          removal_reason?: string | null
          removed_from_vehicle?: string | null
          serial_number?: string | null
          size?: string
          tread_depth_health?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
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
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
      vehicle_availability: {
        Row: {
          available_capacity_kg: number | null
          available_from: string
          available_until: string
          available_volume_m3: number | null
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          current_location: string | null
          id: string
          is_available: boolean | null
          unavailable_reason: string | null
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          available_capacity_kg?: number | null
          available_from: string
          available_until: string
          available_volume_m3?: number | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          current_location?: string | null
          id?: string
          is_available?: boolean | null
          unavailable_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          available_capacity_kg?: number | null
          available_from?: string
          available_until?: string
          available_volume_m3?: number | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          current_location?: string | null
          id?: string
          is_available?: boolean | null
          unavailable_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_availability_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_capacity_snapshots: {
        Row: {
          assigned_loads: number | null
          created_at: string | null
          id: string
          snapshot_date: string
          total_capacity_kg: number | null
          utilization_percentage: number | null
          utilized_capacity_kg: number | null
          vehicle_id: string | null
        }
        Insert: {
          assigned_loads?: number | null
          created_at?: string | null
          id?: string
          snapshot_date: string
          total_capacity_kg?: number | null
          utilization_percentage?: number | null
          utilized_capacity_kg?: number | null
          vehicle_id?: string | null
        }
        Update: {
          assigned_loads?: number | null
          created_at?: string | null
          id?: string
          snapshot_date?: string
          total_capacity_kg?: number | null
          utilization_percentage?: number | null
          utilized_capacity_kg?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_capacity_snapshots_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_details: {
        Row: {
          created_at: string | null
          id: number
          meter_reading: string
          model_year: string
          report_id: number | null
          updated_at: string | null
          vehicle_category: string
          vehicle_name: string
          vehicle_number: string
          vehicle_status: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          meter_reading: string
          model_year: string
          report_id?: number | null
          updated_at?: string | null
          vehicle_category: string
          vehicle_name: string
          vehicle_number: string
          vehicle_status: string
        }
        Update: {
          created_at?: string | null
          id?: number
          meter_reading?: string
          model_year?: string
          report_id?: number | null
          updated_at?: string | null
          vehicle_category?: string
          vehicle_name?: string
          vehicle_number?: string
          vehicle_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_details_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "inspection_reports"
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
          fault_resolved: boolean | null
          has_fault: boolean | null
          id: string
          initiated_via: string | null
          inspection_date: string
          inspection_number: string
          inspection_type: string
          inspector_name: string
          inspector_profile_id: string | null
          location: string | null
          notes: string | null
          odometer_reading: number | null
          root_cause_analysis: Json | null
          scanned_vehicle_qr: string | null
          status: Database["public"]["Enums"]["inspection_status"]
          template_id: string | null
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
          fault_resolved?: boolean | null
          has_fault?: boolean | null
          id?: string
          initiated_via?: string | null
          inspection_date?: string
          inspection_number: string
          inspection_type: string
          inspector_name: string
          inspector_profile_id?: string | null
          location?: string | null
          notes?: string | null
          odometer_reading?: number | null
          root_cause_analysis?: Json | null
          scanned_vehicle_qr?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          template_id?: string | null
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
          fault_resolved?: boolean | null
          has_fault?: boolean | null
          id?: string
          initiated_via?: string | null
          inspection_date?: string
          inspection_number?: string
          inspection_type?: string
          inspector_name?: string
          inspector_profile_id?: string | null
          location?: string | null
          notes?: string | null
          odometer_reading?: number | null
          root_cause_analysis?: Json | null
          scanned_vehicle_qr?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          template_id?: string | null
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
            foreignKeyName: "vehicle_inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_template_details"
            referencedColumns: ["template_id"]
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
          current_odometer: number | null
          engine_specs: string | null
          fleet_number: string | null
          id: string
          make: string
          model: string
          qr_code_value: string | null
          reefer_unit: string | null
          registration_number: string
          tonnage: number | null
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          wialon_id: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          current_odometer?: number | null
          engine_specs?: string | null
          fleet_number?: string | null
          id?: string
          make: string
          model: string
          qr_code_value?: string | null
          reefer_unit?: string | null
          registration_number: string
          tonnage?: number | null
          updated_at?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          wialon_id?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          current_odometer?: number | null
          engine_specs?: string | null
          fleet_number?: string | null
          id?: string
          make?: string
          model?: string
          qr_code_value?: string | null
          reefer_unit?: string | null
          registration_number?: string
          tonnage?: number | null
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          wialon_id?: number | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          id: string
          is_active: boolean | null
          master_email: string | null
          mobile: string | null
          name: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          street_address: string | null
          tax_id: string | null
          updated_at: string | null
          vendor_id: string
          vendor_name: string
          vendor_number: string | null
          website: string | null
          work_email: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          master_email?: string | null
          mobile?: string | null
          name?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          street_address?: string | null
          tax_id?: string | null
          updated_at?: string | null
          vendor_id: string
          vendor_name: string
          vendor_number?: string | null
          website?: string | null
          work_email?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          master_email?: string | null
          mobile?: string | null
          name?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          street_address?: string | null
          tax_id?: string | null
          updated_at?: string | null
          vendor_id?: string
          vendor_name?: string
          vendor_number?: string | null
          website?: string | null
          work_email?: string | null
        }
        Relationships: []
      }
      vmrs_assemblies: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          system_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          system_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          system_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vmrs_assemblies_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "vmrs_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      vmrs_components: {
        Row: {
          assembly_id: string | null
          code: string
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
        }
        Insert: {
          assembly_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
        }
        Update: {
          assembly_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vmrs_components_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "vmrs_assemblies"
            referencedColumns: ["id"]
          },
        ]
      }
      vmrs_reason_for_repair: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          repair_type: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          repair_type?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          repair_type?: string | null
        }
        Relationships: []
      }
      vmrs_repair_priority_class: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      vmrs_system_groups: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      vmrs_systems: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          system_group_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          system_group_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          system_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vmrs_systems_system_group_id_fkey"
            columns: ["system_group_id"]
            isOneToOne: false
            referencedRelation: "vmrs_system_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_items: {
        Row: {
          category: string | null
          claim_date: string | null
          claim_notes: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          inventory_id: string | null
          invoice_number: string | null
          job_card_id: string | null
          name: string
          part_number: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: string | null
          supplier: string | null
          updated_at: string | null
          vehicle_id: string | null
          warranty_claim_contact: string | null
          warranty_end_date: string | null
          warranty_notes: string | null
          warranty_period_months: number | null
          warranty_provider: string | null
          warranty_start_date: string | null
          warranty_terms: string | null
        }
        Insert: {
          category?: string | null
          claim_date?: string | null
          claim_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          inventory_id?: string | null
          invoice_number?: string | null
          job_card_id?: string | null
          name: string
          part_number?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string | null
          supplier?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          warranty_claim_contact?: string | null
          warranty_end_date?: string | null
          warranty_notes?: string | null
          warranty_period_months?: number | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_terms?: string | null
        }
        Update: {
          category?: string | null
          claim_date?: string | null
          claim_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          inventory_id?: string | null
          invoice_number?: string | null
          job_card_id?: string | null
          name?: string
          part_number?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string | null
          supplier?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          warranty_claim_contact?: string | null
          warranty_end_date?: string | null
          warranty_notes?: string | null
          warranty_period_months?: number | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_items_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_items_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_metrics: {
        Row: {
          cpk: number
          created_at: string | null
          gross_profit: number
          id: string
          ipk: number
          last_calculated: string
          profit_margin: number
          total_costs: number
          total_kilometers: number
          total_revenue: number
          trip_count: number
          updated_at: string | null
          week_end: string
          week_number: number
          week_start: string
          year: number
        }
        Insert: {
          cpk?: number
          created_at?: string | null
          gross_profit?: number
          id?: string
          ipk?: number
          last_calculated?: string
          profit_margin?: number
          total_costs?: number
          total_kilometers?: number
          total_revenue?: number
          trip_count?: number
          updated_at?: string | null
          week_end: string
          week_number: number
          week_start: string
          year: number
        }
        Update: {
          cpk?: number
          created_at?: string | null
          gross_profit?: number
          id?: string
          ipk?: number
          last_calculated?: string
          profit_margin?: number
          total_costs?: number
          total_kilometers?: number
          total_revenue?: number
          trip_count?: number
          updated_at?: string | null
          week_end?: string
          week_number?: number
          week_start?: string
          year?: number
        }
        Relationships: []
      }
      wialon_unit_map: {
        Row: {
          load_id: string | null
          unit_id: number
        }
        Insert: {
          load_id?: string | null
          unit_id: number
        }
        Update: {
          load_id?: string | null
          unit_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "wialon_unit_map_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "wialon_unit_map_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "wialon_unit_map_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wialon_unit_map_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wialon_unit_map_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
        ]
      }
      wialon_vehicles: {
        Row: {
          created_at: string | null
          fleet_number: string | null
          id: string
          make: string | null
          model: string | null
          name: string
          registration: string | null
          updated_at: string | null
          vehicle_type: string | null
          wialon_unit_id: number
        }
        Insert: {
          created_at?: string | null
          fleet_number?: string | null
          id?: string
          make?: string | null
          model?: string | null
          name: string
          registration?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
          wialon_unit_id: number
        }
        Update: {
          created_at?: string | null
          fleet_number?: string | null
          id?: string
          make?: string | null
          model?: string | null
          name?: string
          registration?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
          wialon_unit_id?: number
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
      work_order_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
          work_order_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
          work_order_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
          work_order_id?: string
        }
        Relationships: []
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
      work_order_images: {
        Row: {
          caption: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          thumbnail_url: string | null
          uploaded_by_id: string | null
          uploaded_by_name: string | null
          work_order_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          thumbnail_url?: string | null
          uploaded_by_id?: string | null
          uploaded_by_name?: string | null
          work_order_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          thumbnail_url?: string | null
          uploaded_by_id?: string | null
          uploaded_by_name?: string | null
          work_order_id?: string
        }
        Relationships: []
      }
      work_order_issue_assignments: {
        Row: {
          created_at: string | null
          id: string
          issue_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          issue_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          issue_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_issue_assignments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "work_order_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_issues: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          severity: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          severity?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          severity?: string | null
        }
        Relationships: []
      }
      work_order_label_assignments: {
        Row: {
          created_at: string | null
          id: string
          label_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "work_order_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_labels: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      work_order_line_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          item_id: string | null
          item_name: string | null
          item_type: string | null
          labor_cost: number | null
          labor_cost_cents: number | null
          parts_cost: number | null
          parts_cost_cents: number | null
          position: number | null
          subtotal: number | null
          subtotal_cents: number | null
          title: string | null
          updated_at: string | null
          vmrs_assembly_id: string | null
          vmrs_component_id: string | null
          vmrs_reason_for_repair_id: string | null
          vmrs_repair_priority_class_id: string | null
          vmrs_system_group_id: string | null
          vmrs_system_id: string | null
          work_order_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          item_type?: string | null
          labor_cost?: number | null
          labor_cost_cents?: number | null
          parts_cost?: number | null
          parts_cost_cents?: number | null
          position?: number | null
          subtotal?: number | null
          subtotal_cents?: number | null
          title?: string | null
          updated_at?: string | null
          vmrs_assembly_id?: string | null
          vmrs_component_id?: string | null
          vmrs_reason_for_repair_id?: string | null
          vmrs_repair_priority_class_id?: string | null
          vmrs_system_group_id?: string | null
          vmrs_system_id?: string | null
          work_order_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          item_type?: string | null
          labor_cost?: number | null
          labor_cost_cents?: number | null
          parts_cost?: number | null
          parts_cost_cents?: number | null
          position?: number | null
          subtotal?: number | null
          subtotal_cents?: number | null
          title?: string | null
          updated_at?: string | null
          vmrs_assembly_id?: string | null
          vmrs_component_id?: string | null
          vmrs_reason_for_repair_id?: string | null
          vmrs_repair_priority_class_id?: string | null
          vmrs_system_group_id?: string | null
          vmrs_system_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_line_items_vmrs_assembly_id_fkey"
            columns: ["vmrs_assembly_id"]
            isOneToOne: false
            referencedRelation: "vmrs_assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_items_vmrs_component_id_fkey"
            columns: ["vmrs_component_id"]
            isOneToOne: false
            referencedRelation: "vmrs_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_items_vmrs_reason_for_repair_id_fkey"
            columns: ["vmrs_reason_for_repair_id"]
            isOneToOne: false
            referencedRelation: "vmrs_reason_for_repair"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_items_vmrs_repair_priority_class_id_fkey"
            columns: ["vmrs_repair_priority_class_id"]
            isOneToOne: false
            referencedRelation: "vmrs_repair_priority_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_items_vmrs_system_group_id_fkey"
            columns: ["vmrs_system_group_id"]
            isOneToOne: false
            referencedRelation: "vmrs_system_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_items_vmrs_system_id_fkey"
            columns: ["vmrs_system_id"]
            isOneToOne: false
            referencedRelation: "vmrs_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_statuses: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      work_order_sub_line_items: {
        Row: {
          contact_id: string | null
          created_at: string | null
          description: string | null
          id: string
          inventory_item_id: string | null
          item_id: string | null
          item_name: string | null
          item_type: string
          part_location_detail_id: string | null
          part_location_name: string | null
          position: number | null
          quantity: number | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string | null
          work_order_line_item_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inventory_item_id?: string | null
          item_id?: string | null
          item_name?: string | null
          item_type: string
          part_location_detail_id?: string | null
          part_location_name?: string | null
          position?: number | null
          quantity?: number | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          work_order_line_item_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inventory_item_id?: string | null
          item_id?: string | null
          item_name?: string | null
          item_type?: string
          part_location_detail_id?: string | null
          part_location_name?: string | null
          position?: number | null
          quantity?: number | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          work_order_line_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_sub_line_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_sub_line_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_sub_line_items_part_location_detail_id_fkey"
            columns: ["part_location_detail_id"]
            isOneToOne: false
            referencedRelation: "part_location_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_sub_line_items_work_order_line_item_id_fkey"
            columns: ["work_order_line_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_line_items"
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
      ytd_metrics: {
        Row: {
          created_at: string | null
          ebit: number
          ebit_margin: number
          id: string
          ipk: number
          last_updated: string
          net_profit: number
          net_profit_margin: number
          notes: string | null
          operational_cpk: number
          revenue: number
          roe: number
          roic: number
          total_kms: number
          updated_at: string | null
          updated_by: string
          year: number
        }
        Insert: {
          created_at?: string | null
          ebit?: number
          ebit_margin?: number
          id?: string
          ipk?: number
          last_updated?: string
          net_profit?: number
          net_profit_margin?: number
          notes?: string | null
          operational_cpk?: number
          revenue?: number
          roe?: number
          roic?: number
          total_kms?: number
          updated_at?: string | null
          updated_by?: string
          year: number
        }
        Update: {
          created_at?: string | null
          ebit?: number
          ebit_margin?: number
          id?: string
          ipk?: number
          last_updated?: string
          net_profit?: number
          net_profit_margin?: number
          notes?: string | null
          operational_cpk?: number
          revenue?: number
          roe?: number
          roic?: number
          total_kms?: number
          updated_at?: string | null
          updated_by?: string
          year?: number
        }
        Relationships: []
      }
      ytd_metrics_audit: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string
          created_at: string | null
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          updated_at: string | null
          year: number
          ytd_metric_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by: string
          created_at?: string | null
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          updated_at?: string | null
          year: number
          ytd_metric_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string
          created_at?: string | null
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          updated_at?: string | null
          year?: number
          ytd_metric_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ytd_metrics_audit_ytd_metric_id_fkey"
            columns: ["ytd_metric_id"]
            isOneToOne: false
            referencedRelation: "ytd_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      delivery_dashboard_summary: {
        Row: {
          avg_cost_per_delivery: number | null
          avg_cost_per_km: number | null
          avg_customer_rating: number | null
          avg_distance_per_delivery: number | null
          avg_performance_score: number | null
          avg_route_efficiency: number | null
          avg_time_efficiency: number | null
          on_time_count: number | null
          on_time_percentage: number | null
          total_costs: number | null
          total_deliveries: number | null
          total_distance_km: number | null
          total_harsh_braking: number | null
          total_speeding_incidents: number | null
        }
        Relationships: []
      }
      geofence_daily_visits: {
        Row: {
          event_count: number | null
          event_date: string | null
          event_type: string | null
          geofence_zone_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_geofence_zone_id_fkey"
            columns: ["geofence_zone_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_dwell_summary: {
        Row: {
          avg_dwell: number | null
          geofence_zone_id: string | null
          max_dwell: number | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_geofence_zone_id_fkey"
            columns: ["geofence_zone_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_events_with_details: {
        Row: {
          created_at: string | null
          dwell_duration_minutes: number | null
          event_timestamp: string | null
          event_type: string | null
          geofence_name: string | null
          geofence_zone_id: string | null
          id: string | null
          latitude: number | null
          load_id: string | null
          load_number: string | null
          load_status: Database["public"]["Enums"]["load_status"] | null
          longitude: number | null
          notification_sent: boolean | null
          vehicle_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_name: string | null
          vehicle_registration: string | null
          zone_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_geofence_zone_id_fkey"
            columns: ["geofence_zone_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_1_id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_consolidation_opportunities"
            referencedColumns: ["load_2_id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "load_workflow_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_load_events"
            referencedColumns: ["load_id"]
          },
          {
            foreignKeyName: "geofence_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_warranty_status: {
        Row: {
          category: string | null
          days_until_expiry: number | null
          has_warranty: boolean | null
          id: string | null
          name: string | null
          part_number: string | null
          quantity: number | null
          supplier: string | null
          unit_price: number | null
          warranty_claim_contact: string | null
          warranty_end_date: string | null
          warranty_notes: string | null
          warranty_period_months: number | null
          warranty_provider: string | null
          warranty_start_date: string | null
          warranty_status: string | null
          warranty_terms: string | null
        }
        Insert: {
          category?: string | null
          days_until_expiry?: never
          has_warranty?: boolean | null
          id?: string | null
          name?: string | null
          part_number?: string | null
          quantity?: number | null
          supplier?: string | null
          unit_price?: number | null
          warranty_claim_contact?: string | null
          warranty_end_date?: string | null
          warranty_notes?: string | null
          warranty_period_months?: number | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_status?: never
          warranty_terms?: string | null
        }
        Update: {
          category?: string | null
          days_until_expiry?: never
          has_warranty?: boolean | null
          id?: string | null
          name?: string | null
          part_number?: string | null
          quantity?: number | null
          supplier?: string | null
          unit_price?: number | null
          warranty_claim_contact?: string | null
          warranty_end_date?: string | null
          warranty_notes?: string | null
          warranty_period_months?: number | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_status?: never
          warranty_terms?: string | null
        }
        Relationships: []
      }
      job_card_cost_summary: {
        Row: {
          external_items_count: number | null
          external_parts_cost: number | null
          inventory_items_count: number | null
          inventory_parts_cost: number | null
          items_with_documents: number | null
          job_card_id: string | null
          service_items_count: number | null
          services_cost: number | null
          total_items: number | null
          total_parts_cost: number | null
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
      load_consolidation_opportunities: {
        Row: {
          combined_weight: number | null
          common_destination: string | null
          load_1_id: string | null
          load_2_id: string | null
          loads_for_route: number | null
          origin: string | null
          pickup_date: string | null
        }
        Relationships: []
      }
      load_workflow_analytics: {
        Row: {
          actual_delivery_datetime: string | null
          actual_pickup_datetime: string | null
          arrived_at_delivery: string | null
          arrived_at_pickup: string | null
          assigned_at: string | null
          assigned_vehicle_id: string | null
          completed_at: string | null
          created_at: string | null
          customer_name: string | null
          delivered_at: string | null
          departure_time: string | null
          destination: string | null
          fleet_number: string | null
          id: string | null
          is_delayed: boolean | null
          load_number: string | null
          loading_completed_at: string | null
          loading_duration_minutes: number | null
          loading_started_at: string | null
          offloading_completed_at: string | null
          offloading_duration_minutes: number | null
          offloading_started_at: string | null
          origin: string | null
          registration_number: string | null
          scheduled_delivery: string | null
          scheduled_pickup: string | null
          status: Database["public"]["Enums"]["load_status"] | null
          time_variance_minutes: number | null
          total_duration_minutes: number | null
          transit_duration_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_assigned_vehicle"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_dashboard_stats: {
        Row: {
          completed_this_month: number | null
          due_today: number | null
          overdue: number | null
          total_active_schedules: number | null
          total_cost_this_month: number | null
        }
        Relationships: []
      }
      reefer_consumption_by_horse: {
        Row: {
          avg_litres_per_hour: number | null
          fill_count: number | null
          linked_horse: string | null
          reefer_unit: string | null
          total_cost: number | null
          total_hours: number | null
          total_litres: number | null
        }
        Relationships: []
      }
      reefer_consumption_by_truck: {
        Row: {
          combined_cost: number | null
          reefer_cost: number | null
          reefer_litres: number | null
          reefer_lph: number | null
          reefer_unit: string | null
          truck_cost: number | null
          truck_driver: string | null
          truck_fill_date: string | null
          truck_fleet_number: string | null
          truck_litres: number | null
        }
        Relationships: []
      }
      reefer_consumption_summary: {
        Row: {
          avg_litres_per_hour: number | null
          fill_count: number | null
          first_fill_date: string | null
          last_fill_date: string | null
          reefer_unit: string | null
          total_cost: number | null
          total_hours: number | null
          total_litres: number | null
        }
        Relationships: []
      }
      trips_validation_status: {
        Row: {
          completed_at: string | null
          driver_name: string | null
          id: string | null
          resolved_flags: number | null
          status: string | null
          trip_number: string | null
          unresolved_flags: number | null
          validated_by_name: string | null
          validation_date: string | null
          validation_status: string | null
        }
        Insert: {
          completed_at?: string | null
          driver_name?: string | null
          id?: string | null
          resolved_flags?: never
          status?: string | null
          trip_number?: string | null
          unresolved_flags?: never
          validated_by_name?: never
          validation_date?: never
          validation_status?: never
        }
        Update: {
          completed_at?: string | null
          driver_name?: string | null
          id?: string | null
          resolved_flags?: never
          status?: string | null
          trip_number?: string | null
          unresolved_flags?: never
          validated_by_name?: never
          validation_date?: never
          validation_status?: never
        }
        Relationships: []
      }
      v_calendar_load_events: {
        Row: {
          assigned_vehicle_id: string | null
          customer_name: string | null
          delivery_datetime: string | null
          destination: string | null
          end_time: string | null
          event_id: string | null
          event_notes: string | null
          event_type: string | null
          expected_arrival_at_delivery: string | null
          expected_arrival_at_pickup: string | null
          expected_departure_from_delivery: string | null
          expected_departure_from_pickup: string | null
          fleet_number: string | null
          load_id: string | null
          load_number: string | null
          origin: string | null
          pickup_datetime: string | null
          registration: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["load_status"] | null
          vehicle_name: string | null
          weight_kg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_assigned_vehicle"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "wialon_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inspection_template_details: {
        Row: {
          acceptance_criteria: string | null
          help_text: string | null
          is_mandatory: boolean | null
          item_active: boolean | null
          item_code: string | null
          item_description: string | null
          item_id: string | null
          item_order: number | null
          item_type: string | null
          max_value: number | null
          min_value: number | null
          options: Json | null
          section_name: string | null
          template_active: boolean | null
          template_code: string | null
          template_description: string | null
          template_id: string | null
          template_name: string | null
          unit_of_measure: string | null
        }
        Relationships: []
      }
      warranty_items_status: {
        Row: {
          category: string | null
          claim_date: string | null
          claim_notes: string | null
          created_at: string | null
          created_by: string | null
          days_until_expiry: number | null
          description: string | null
          fleet_number: string | null
          id: string | null
          inventory_id: string | null
          inventory_name: string | null
          invoice_number: string | null
          job_card_id: string | null
          job_card_status: string | null
          job_card_title: string | null
          job_number: string | null
          name: string | null
          part_number: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: string | null
          supplier: string | null
          updated_at: string | null
          vehicle_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_registration: string | null
          warranty_claim_contact: string | null
          warranty_end_date: string | null
          warranty_notes: string | null
          warranty_period_months: number | null
          warranty_provider: string | null
          warranty_start_date: string | null
          warranty_status: string | null
          warranty_terms: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_warranty_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_items_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_items_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_reefer_foreign_key_constraint: { Args: never; Returns: undefined }
      add_route_note: {
        Args: {
          p_content: string
          p_created_by?: string
          p_is_important?: boolean
          p_latitude?: number
          p_location_description?: string
          p_longitude?: number
          p_note_type: string
          p_route_id: string
          p_title: string
        }
        Returns: string
      }
      adjust_bunker_level: {
        Args: {
          p_adjusted_by?: string
          p_bunker_id: string
          p_new_level: number
          p_reason?: string
        }
        Returns: Json
      }
      adjust_inventory_quantity: {
        Args: {
          p_inventory_id: string
          p_performed_by?: string
          p_quantity_change: number
          p_reason: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: Json
      }
      analyze_route_fuel_strategy: {
        Args: {
          p_consumption_per_km?: number
          p_destination: string
          p_origin: string
          p_tank_capacity_liters?: number
          p_total_distance_km: number
        }
        Returns: {
          distance_from_origin: number
          estimated_cost: number
          location: string
          price_per_liter: number
          rationale: string
          recommended_liters: number
          stop_order: number
          supplier_id: string
          supplier_name: string
        }[]
      }
      assign_load_safely: {
        Args: { load_id: string; vehicle_name?: string; wialon_unit_id: number }
        Returns: undefined
      }
      calculate_cost_per_km: { Args: { p_load_id: string }; Returns: number }
      calculate_delivery_eta: { Args: { p_load_id: string }; Returns: string }
      calculate_distance_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_loading_duration: {
        Args: { p_load_id: string }
        Returns: string
      }
      calculate_offloading_duration: {
        Args: { p_load_id: string }
        Returns: string
      }
      calculate_performance_score: {
        Args: { p_load_id: string }
        Returns: number
      }
      calculate_route_efficiency: {
        Args: {
          p_end_date: string
          p_route_filter?: string
          p_start_date: string
        }
        Returns: {
          avg_delivery_time_hours: number
          avg_fuel_cost: number
          efficiency_score: number
          on_time_percentage: number
          route: string
          total_loads: number
        }[]
      }
      calculate_route_fuel_stops: {
        Args: {
          p_reserve_liters?: number
          p_route_id: string
          p_tank_capacity_liters?: number
        }
        Returns: {
          distance_from_origin_km: number
          estimated_cost: number
          location: string
          price_per_liter: number
          recommended_liters: number
          savings_vs_avg: number
          supplier_id: string
          supplier_name: string
        }[]
      }
      calculate_transit_time: { Args: { p_load_id: string }; Returns: string }
      cascade_driver_name_update: {
        Args: { p_new_name: string; p_old_name: string }
        Returns: undefined
      }
      check_geofence_entry: {
        Args: { p_latitude: number; p_longitude: number; p_vehicle_id: string }
        Returns: boolean
      }
      check_inventory_availability: {
        Args: { p_inventory_id: string; p_quantity: number }
        Returns: boolean
      }
      decrement_inventory: {
        Args: {
          p_inventory_id: string
          p_quantity: number
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: Json
      }
      deduct_inventory: {
        Args: {
          p_inventory_id: string
          p_parts_request_id: string
          p_performed_by: string
          p_quantity: number
        }
        Returns: boolean
      }
      dispense_fuel: {
        Args: {
          p_bunker_id: string
          p_driver_name?: string
          p_notes?: string
          p_odometer_reading?: number
          p_quantity_liters: number
          p_vehicle_fleet_number?: string
          p_vehicle_id?: string
        }
        Returns: Json
      }
      find_nearby_locations: {
        Args: {
          center_lat: number
          center_lng: number
          filter_type?: Database["public"]["Enums"]["location_type"]
          radius_km?: number
        }
        Returns: {
          address: string
          distance_km: number
          id: string
          latitude: number
          location_type: Database["public"]["Enums"]["location_type"]
          longitude: number
          name: string
          short_code: string
        }[]
      }
      find_nearest_suppliers: {
        Args: {
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_max_distance_km?: number
        }
        Returns: {
          distance_km: number
          google_maps_url: string
          id: string
          is_preferred: boolean
          location: string
          name: string
          price_per_liter: number
        }[]
      }
      find_nearest_vehicles: {
        Args: {
          p_limit?: number
          p_load_id: string
          p_max_distance_km?: number
        }
        Returns: {
          available_capacity_kg: number
          current_location: string
          distance_km: number
          registration_number: string
          vehicle_id: string
        }[]
      }
      forecast_packaging_requirements: {
        Args: { p_forecast_weeks?: number }
        Returns: {
          current_weekly_avg: number
          forecasted_need: number
          packaging_type: string
          trend: string
        }[]
      }
      generate_customer_analytics: {
        Args: {
          p_customer_name: string
          p_period_end: string
          p_period_start: string
        }
        Returns: undefined
      }
      generate_incident_number: { Args: never; Returns: string }
      generate_loads_from_schedule: {
        Args: {
          p_end_date?: string
          p_schedule_id: string
          p_start_date?: string
        }
        Returns: {
          generated_count: number
          load_ids: string[]
        }[]
      }
      get_cheapest_suppliers_by_province: {
        Args: { p_limit?: number }
        Returns: {
          location: string
          price_per_liter: number
          province: string
          rank_in_province: number
          supplier_id: string
          supplier_name: string
        }[]
      }
      get_cost_per_km_breakdown: {
        Args: { p_end_date: string; p_group_by?: string; p_start_date: string }
        Returns: {
          cost_per_km: number
          number_of_deliveries: number
          period_end: string
          period_start: string
          profit_margin_percentage: number
          total_cost: number
          total_distance_km: number
          total_driver_cost: number
          total_fuel_cost: number
          total_maintenance_cost: number
          total_profit: number
          total_revenue: number
        }[]
      }
      get_driver_performance_summary: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          avg_safety_score: number
          driver_name: string
          harsh_acceleration_total: number
          harsh_braking_total: number
          idle_time_total_mins: number
          late_deliveries: number
          on_time_deliveries: number
          on_time_percentage: number
          speeding_total: number
          total_distance_km: number
          total_trips: number
        }[]
      }
      get_route_efficiency_stats: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          avg_efficiency_percentage: number
          efficient_routes: number
          estimated_extra_cost: number
          inefficient_routes: number
          total_extra_km: number
          total_routes: number
        }[]
      }
      get_route_frequency_stats: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          avg_loads_per_week: number
          destination: string
          farm: string
          most_common_packaging: string
          peak_day: string
          total_loads: number
          total_weight_kg: number
        }[]
      }
      get_route_summary: {
        Args: { p_route_id: string }
        Returns: {
          avg_market_price: number
          cheapest_price: number
          cheapest_station_name: string
          cheapest_total_cost: number
          destination: string
          last_trip_date: string
          notes_count: number
          origin: string
          potential_savings: number
          route_name: string
          total_distance_km: number
          total_fuel_needed_liters: number
          usage_count: number
          waypoints_count: number
        }[]
      }
      get_vehicle_performance_metrics: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          avg_delivery_time_mins: number
          avg_speed_kmh: number
          fleet_number: string
          fuel_efficiency_l_per_100km: number
          harsh_acceleration_count: number
          harsh_braking_count: number
          on_time_percentage: number
          registration: string
          safety_score: number
          speeding_incidents: number
          total_distance_km: number
          total_fuel_used_litres: number
          total_trips: number
          vehicle_id: string
        }[]
      }
      increment_inventory: {
        Args: {
          p_inventory_id: string
          p_quantity: number
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: Json
      }
      increment_route_usage: { Args: { route_id: string }; Returns: undefined }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      refill_bunker: {
        Args: {
          p_bunker_id: string
          p_notes?: string
          p_quantity_liters: number
          p_reference_number?: string
          p_unit_cost?: number
        }
        Returns: Json
      }
      release_inventory_reservation: {
        Args: {
          p_inventory_id: string
          p_parts_request_id: string
          p_performed_by: string
          p_quantity: number
          p_reason: string
        }
        Returns: boolean
      }
      reserve_inventory: {
        Args: {
          p_inventory_id: string
          p_parts_request_id: string
          p_performed_by: string
          p_quantity: number
        }
        Returns: boolean
      }
      safe_assign_load: {
        Args: {
          p_load_id: string
          p_vehicle_name?: string
          p_wialon_unit_id: number
        }
        Returns: undefined
      }
      search_locations: {
        Args: {
          filter_country?: string
          filter_type?: Database["public"]["Enums"]["location_type"]
          limit_results?: number
          search_term: string
        }
        Returns: {
          address: string
          city: string
          country: string
          id: string
          latitude: number
          location_type: Database["public"]["Enums"]["location_type"]
          longitude: number
          name: string
          relevance: number
          short_code: string
        }[]
      }
      suggest_load_consolidation: {
        Args: { p_date: string; p_max_combined_weight?: number }
        Returns: {
          combined_weight_kg: number
          consolidation_id: string
          destination: string
          load_ids: string[]
          potential_savings_pct: number
          recommended_vehicle: string
        }[]
      }
      update_supplier_price: {
        Args: {
          p_new_price: number
          p_notes?: string
          p_supplier_id: string
          p_updated_by?: string
        }
        Returns: Json
      }
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
      candidate_status:
      | "new"
      | "in_progress"
      | "hired"
      | "rejected"
      | "withdrawn"
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
      | "license_disk"
      | "roadworthy"
      | "insurance"
      | "mot"
      | "cof"
      | "permit"
      driver_document_type:
      | "license"
      | "pdp"
      | "passport"
      | "medical"
      | "retest"
      | "defensive_driving"
      driver_status: "active" | "inactive" | "suspended" | "terminated"
      evaluation_status: "pending" | "passed" | "failed" | "scheduled"
      evaluation_step: "interview" | "yard_test" | "road_test"
      fault_severity: "critical" | "high" | "medium" | "low"
      fault_status:
      | "identified"
      | "acknowledged"
      | "job_card_created"
      | "in_progress"
      | "resolved"
      | "closed"
      incident_document_type:
      | "incident_report"
      | "police_report"
      | "insurance_application"
      | "insurance_claim"
      | "witness_statement"
      | "damage_assessment"
      | "repair_quote"
      | "medical_report"
      | "photo_evidence"
      | "video_evidence"
      | "correspondence"
      | "other"
      incident_status: "open" | "processing" | "closed" | "claimed"
      incident_type:
      | "collision"
      | "theft"
      | "vandalism"
      | "fire"
      | "mechanical_failure"
      | "tire_blowout"
      | "cargo_damage"
      | "driver_injury"
      | "third_party_injury"
      | "weather_related"
      | "road_hazard"
      | "other"
      inspection_item_status: "pass" | "fail" | "attention" | "not_applicable"
      inspection_status: "pending" | "in_progress" | "completed" | "cancelled"
      load_priority: "low" | "medium" | "high" | "urgent"
      load_status:
      | "pending"
      | "assigned"
      | "in_transit"
      | "delivered"
      | "cancelled"
      | "failed_delivery"
      | "Pending"
      | "Assigned"
      | "arrived_at_loading_point"
      | "Arrived at Loading Point"
      | "Start Loading"
      | "start_loading"
      | "Loading Completed"
      | "loading_completed"
      | "In Transit"
      | "arrived_at_offloading_point"
      | "arrived_at_delivery"
      | "arrived_at_loading"
      | "loading"
      | "offloading"
      | "offloading_completed"
      | "completed"
      | "on_hold"
      location_type:
      | "depot"
      | "customer"
      | "border_post"
      | "truck_stop"
      | "toll_gate"
      | "market"
      | "port"
      | "supplier"
      | "service_center"
      | "other"
      maintenance_alert_type: "upcoming" | "overdue" | "completed" | "cancelled"
      maintenance_delivery_status:
      | "pending"
      | "sent"
      | "delivered"
      | "failed"
      | "acknowledged"
      maintenance_notification_method: "email" | "sms" | "in_app" | "all"
      tyre_condition:
      | "excellent"
      | "good"
      | "fair"
      | "poor"
      | "needs_replacement"
      tyre_position:
      | "front_left"
      | "front_right"
      | "rear_left_outer"
      | "rear_left_inner"
      | "rear_right_inner"
      | "rear_right_outer"
      | "spare"
      tyre_wear_pattern: "even" | "center" | "edge" | "cupping" | "feathering"
      vehicle_type:
      | "truck"
      | "trailer"
      | "van"
      | "bus"
      | "rigid_truck"
      | "horse_truck"
      | "refrigerated_truck"
      | "reefer"
      | "interlink"
      waypoint_type:
      | "pickup"
      | "delivery"
      | "rest_stop"
      | "customs"
      | "weigh_station"
      wear_pattern:
      | "even"
      | "center"
      | "edge"
      | "cupping"
      | "feathering"
      | "flat_spot"
      weather_condition:
      | "clear"
      | "cloudy"
      | "rain"
      | "heavy_rain"
      | "fog"
      | "snow"
      | "hail"
      | "windy"
      | "storm"
      | "unknown"
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
      candidate_status: [
        "new",
        "in_progress",
        "hired",
        "rejected",
        "withdrawn",
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
        "license_disk",
        "roadworthy",
        "insurance",
        "mot",
        "cof",
        "permit",
      ],
      driver_document_type: [
        "license",
        "pdp",
        "passport",
        "medical",
        "retest",
        "defensive_driving",
      ],
      driver_status: ["active", "inactive", "suspended", "terminated"],
      evaluation_status: ["pending", "passed", "failed", "scheduled"],
      evaluation_step: ["interview", "yard_test", "road_test"],
      fault_severity: ["critical", "high", "medium", "low"],
      fault_status: [
        "identified",
        "acknowledged",
        "job_card_created",
        "in_progress",
        "resolved",
        "closed",
      ],
      incident_document_type: [
        "incident_report",
        "police_report",
        "insurance_application",
        "insurance_claim",
        "witness_statement",
        "damage_assessment",
        "repair_quote",
        "medical_report",
        "photo_evidence",
        "video_evidence",
        "correspondence",
        "other",
      ],
      incident_status: ["open", "processing", "closed", "claimed"],
      incident_type: [
        "collision",
        "theft",
        "vandalism",
        "fire",
        "mechanical_failure",
        "tire_blowout",
        "cargo_damage",
        "driver_injury",
        "third_party_injury",
        "weather_related",
        "road_hazard",
        "other",
      ],
      inspection_item_status: ["pass", "fail", "attention", "not_applicable"],
      inspection_status: ["pending", "in_progress", "completed", "cancelled"],
      load_priority: ["low", "medium", "high", "urgent"],
      load_status: [
        "pending",
        "assigned",
        "in_transit",
        "delivered",
        "cancelled",
        "failed_delivery",
        "Pending",
        "Assigned",
        "arrived_at_loading_point",
        "Arrived at Loading Point",
        "Start Loading",
        "start_loading",
        "Loading Completed",
        "loading_completed",
        "In Transit",
        "arrived_at_offloading_point",
        "arrived_at_delivery",
        "arrived_at_loading",
        "loading",
        "offloading",
        "offloading_completed",
        "completed",
        "on_hold",
      ],
      location_type: [
        "depot",
        "customer",
        "border_post",
        "truck_stop",
        "toll_gate",
        "market",
        "port",
        "supplier",
        "service_center",
        "other",
      ],
      maintenance_alert_type: ["upcoming", "overdue", "completed", "cancelled"],
      maintenance_delivery_status: [
        "pending",
        "sent",
        "delivered",
        "failed",
        "acknowledged",
      ],
      maintenance_notification_method: ["email", "sms", "in_app", "all"],
      tyre_condition: [
        "excellent",
        "good",
        "fair",
        "poor",
        "needs_replacement",
      ],
      tyre_position: [
        "front_left",
        "front_right",
        "rear_left_outer",
        "rear_left_inner",
        "rear_right_inner",
        "rear_right_outer",
        "spare",
      ],
      tyre_wear_pattern: ["even", "center", "edge", "cupping", "feathering"],
      vehicle_type: [
        "truck",
        "trailer",
        "van",
        "bus",
        "rigid_truck",
        "horse_truck",
        "refrigerated_truck",
        "reefer",
        "interlink",
      ],
      waypoint_type: [
        "pickup",
        "delivery",
        "rest_stop",
        "customs",
        "weigh_station",
      ],
      wear_pattern: [
        "even",
        "center",
        "edge",
        "cupping",
        "feathering",
        "flat_spot",
      ],
      weather_condition: [
        "clear",
        "cloudy",
        "rain",
        "heavy_rain",
        "fog",
        "snow",
        "hail",
        "windy",
        "storm",
        "unknown",
      ],
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
