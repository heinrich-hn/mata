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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      breakdowns: {
        Row: {
          breakdown_date: string
          breakdown_number: string
          category: string
          created_at: string
          description: string
          driver_id: string | null
          fleet_vehicle_id: string | null
          id: string
          load_id: string | null
          location: string | null
          main_app_breakdown_id: string | null
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          sent_at: string | null
          sent_to_main_app: boolean
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          breakdown_date?: string
          breakdown_number: string
          category?: string
          created_at?: string
          description: string
          driver_id?: string | null
          fleet_vehicle_id?: string | null
          id?: string
          load_id?: string | null
          location?: string | null
          main_app_breakdown_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          sent_at?: string | null
          sent_to_main_app?: boolean
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          breakdown_date?: string
          breakdown_number?: string
          category?: string
          created_at?: string
          description?: string
          driver_id?: string | null
          fleet_vehicle_id?: string | null
          id?: string
          load_id?: string | null
          location?: string | null
          main_app_breakdown_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          sent_at?: string | null
          sent_to_main_app?: boolean
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breakdowns_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breakdowns_fleet_vehicle_id_fkey"
            columns: ["fleet_vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breakdowns_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_feedback: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          id: string
          load_id: string
          rating: string
          updated_at: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          load_id: string
          rating: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          load_id?: string
          rating?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          id: string
          client_id: string
          load_id: string | null
          category: string
          title: string
          file_name: string
          file_url: string
          file_size: number | null
          mime_type: string | null
          notes: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          load_id?: string | null
          category: string
          title: string
          file_name: string
          file_url: string
          file_size?: number | null
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          load_id?: string | null
          category?: string
          title?: string
          file_name?: string
          file_url?: string
          file_size?: number | null
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          loading_address: string | null
          loading_place_name: string | null
          name: string
          notes: string | null
          offloading_address: string | null
          offloading_place_name: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          loading_address?: string | null
          loading_place_name?: string | null
          name: string
          notes?: string | null
          offloading_address?: string | null
          offloading_place_name?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          loading_address?: string | null
          loading_place_name?: string | null
          name?: string
          notes?: string | null
          offloading_address?: string | null
          offloading_place_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_locations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          province: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          province?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          province?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      diesel_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cost_per_liter: number | null
          created_at: string | null
          created_by: string | null
          driver_id: string | null
          fleet_vehicle_id: string | null
          fuel_station: string
          fulfilled_at: string | null
          id: string
          load_id: string
          notes: string | null
          order_number: string
          quantity_liters: number
          recipient_name: string | null
          recipient_phone: string | null
          status: string | null
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cost_per_liter?: number | null
          created_at?: string | null
          created_by?: string | null
          driver_id?: string | null
          fleet_vehicle_id?: string | null
          fuel_station: string
          fulfilled_at?: string | null
          id?: string
          load_id: string
          notes?: string | null
          order_number: string
          quantity_liters: number
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string | null
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cost_per_liter?: number | null
          created_at?: string | null
          created_by?: string | null
          driver_id?: string | null
          fleet_vehicle_id?: string | null
          fuel_station?: string
          fulfilled_at?: string | null
          id?: string
          load_id?: string
          notes?: string | null
          order_number?: string
          quantity_liters?: number
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string | null
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_orders_fleet_vehicle_id_fkey"
            columns: ["fleet_vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_orders_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          available: boolean
          contact: string
          created_at: string
          defensive_driving_permit_doc_url: string | null
          defensive_driving_permit_expiry: string | null
          drivers_license: string | null
          drivers_license_doc_url: string | null
          drivers_license_expiry: string | null
          id: string
          id_doc_url: string | null
          id_number: string | null
          international_driving_permit_doc_url: string | null
          international_driving_permit_expiry: string | null
          medical_certificate_doc_url: string | null
          medical_certificate_expiry: string | null
          name: string
          passport_doc_url: string | null
          passport_expiry: string | null
          passport_number: string | null
          photo_url: string | null
          retest_certificate_doc_url: string | null
          retest_certificate_expiry: string | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          contact: string
          created_at?: string
          defensive_driving_permit_doc_url?: string | null
          defensive_driving_permit_expiry?: string | null
          drivers_license?: string | null
          drivers_license_doc_url?: string | null
          drivers_license_expiry?: string | null
          id?: string
          id_doc_url?: string | null
          id_number?: string | null
          international_driving_permit_doc_url?: string | null
          international_driving_permit_expiry?: string | null
          medical_certificate_doc_url?: string | null
          medical_certificate_expiry?: string | null
          name: string
          passport_doc_url?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          photo_url?: string | null
          retest_certificate_doc_url?: string | null
          retest_certificate_expiry?: string | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          contact?: string
          created_at?: string
          defensive_driving_permit_doc_url?: string | null
          defensive_driving_permit_expiry?: string | null
          drivers_license?: string | null
          drivers_license_doc_url?: string | null
          drivers_license_expiry?: string | null
          id?: string
          id_doc_url?: string | null
          id_number?: string | null
          international_driving_permit_doc_url?: string | null
          international_driving_permit_expiry?: string | null
          medical_certificate_doc_url?: string | null
          medical_certificate_expiry?: string | null
          name?: string
          passport_doc_url?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          photo_url?: string | null
          retest_certificate_doc_url?: string | null
          retest_certificate_expiry?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fleet_vehicles: {
        Row: {
          available: boolean
          capacity: number
          cof_active: boolean | null
          cof_expiry: string | null
          created_at: string
          engine_number: string | null
          engine_size: string | null
          id: string
          insurance_expiry: string | null
          license_expiry: string | null
          make_model: string | null
          radio_license_expiry: string | null
          svg_expiry: string | null
          telematics_asset_id: string | null
          type: string
          updated_at: string
          vehicle_id: string
          vin_number: string | null
        }
        Insert: {
          available?: boolean
          capacity: number
          cof_active?: boolean | null
          cof_expiry?: string | null
          created_at?: string
          engine_number?: string | null
          engine_size?: string | null
          id?: string
          insurance_expiry?: string | null
          license_expiry?: string | null
          make_model?: string | null
          radio_license_expiry?: string | null
          svg_expiry?: string | null
          telematics_asset_id?: string | null
          type: string
          updated_at?: string
          vehicle_id: string
          vin_number?: string | null
        }
        Update: {
          available?: boolean
          capacity?: number
          cof_active?: boolean | null
          cof_expiry?: string | null
          created_at?: string
          engine_number?: string | null
          engine_size?: string | null
          id?: string
          insurance_expiry?: string | null
          license_expiry?: string | null
          make_model?: string | null
          radio_license_expiry?: string | null
          svg_expiry?: string | null
          telematics_asset_id?: string | null
          type?: string
          updated_at?: string
          vehicle_id?: string
          vin_number?: string | null
        }
        Relationships: []
      }
      load_consignments: {
        Row: {
          agreed_rate: number | null
          assigned_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cargo_type: string | null
          completed_at: string | null
          consignment_number: string
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          destination: string
          id: string
          invoice_amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          invoice_received: boolean | null
          loading_date: string | null
          notes: string | null
          offloading_date: string | null
          origin: string
          payment_date: string | null
          payment_due_date: string | null
          payment_status: string | null
          picked_up_at: string | null
          pod_received: boolean | null
          pod_url: string | null
          quantity: number | null
          rate_currency: string | null
          rate_type: string | null
          source_load_id: string | null
          special_handling: string[] | null
          status: string | null
          supplier_driver_license: string | null
          supplier_driver_name: string | null
          supplier_driver_phone: string | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_reference: string | null
          supplier_vehicle_id: string | null
          supplier_vehicle_reg: string | null
          total_amount: number | null
          total_distance_km: number | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          agreed_rate?: number | null
          assigned_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cargo_type?: string | null
          completed_at?: string | null
          consignment_number: string
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          destination: string
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_received?: boolean | null
          loading_date?: string | null
          notes?: string | null
          offloading_date?: string | null
          origin: string
          payment_date?: string | null
          payment_due_date?: string | null
          payment_status?: string | null
          picked_up_at?: string | null
          pod_received?: boolean | null
          pod_url?: string | null
          quantity?: number | null
          rate_currency?: string | null
          rate_type?: string | null
          source_load_id?: string | null
          special_handling?: string[] | null
          status?: string | null
          supplier_driver_license?: string | null
          supplier_driver_name?: string | null
          supplier_driver_phone?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_reference?: string | null
          supplier_vehicle_id?: string | null
          supplier_vehicle_reg?: string | null
          total_amount?: number | null
          total_distance_km?: number | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          agreed_rate?: number | null
          assigned_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cargo_type?: string | null
          completed_at?: string | null
          consignment_number?: string
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          destination?: string
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_received?: boolean | null
          loading_date?: string | null
          notes?: string | null
          offloading_date?: string | null
          origin?: string
          payment_date?: string | null
          payment_due_date?: string | null
          payment_status?: string | null
          picked_up_at?: string | null
          pod_received?: boolean | null
          pod_url?: string | null
          quantity?: number | null
          rate_currency?: string | null
          rate_type?: string | null
          source_load_id?: string | null
          special_handling?: string[] | null
          status?: string | null
          supplier_driver_license?: string | null
          supplier_driver_name?: string | null
          supplier_driver_phone?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_reference?: string | null
          supplier_vehicle_id?: string | null
          supplier_vehicle_reg?: string | null
          total_amount?: number | null
          total_distance_km?: number | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "load_consignments_source_load_id_fkey"
            columns: ["source_load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_consignments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          actual_loading_arrival: string | null
          actual_loading_arrival_source:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_loading_arrival_verified: boolean | null
          actual_loading_departure: string | null
          actual_loading_departure_source:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_loading_departure_verified: boolean | null
          actual_offloading_arrival: string | null
          actual_offloading_arrival_source:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_offloading_arrival_verified: boolean | null
          actual_offloading_departure: string | null
          actual_offloading_departure_source:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_offloading_departure_verified: boolean | null
          cargo_type: Database["public"]["Enums"]["cargo_type"]
          client_id: string | null
          co_driver_id: string | null
          created_at: string
          destination: string
          driver_id: string | null
          fleet_vehicle_id: string | null
          id: string
          load_id: string
          loading_date: string
          notes: string | null
          offloading_date: string
          origin: string
          priority: Database["public"]["Enums"]["priority_level"]
          quantity: number
          special_handling: string[] | null
          status: Database["public"]["Enums"]["load_status"]
          time_window: string
          updated_at: string
          weight: number
        }
        Insert: {
          actual_loading_arrival?: string | null
          actual_loading_arrival_source?:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_loading_arrival_verified?: boolean | null
          actual_loading_departure?: string | null
          actual_loading_departure_source?:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_loading_departure_verified?: boolean | null
          actual_offloading_arrival?: string | null
          actual_offloading_arrival_source?:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_offloading_arrival_verified?: boolean | null
          actual_offloading_departure?: string | null
          actual_offloading_departure_source?:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_offloading_departure_verified?: boolean | null
          cargo_type: Database["public"]["Enums"]["cargo_type"]
          client_id?: string | null
          co_driver_id?: string | null
          created_at?: string
          destination: string
          driver_id?: string | null
          fleet_vehicle_id?: string | null
          id?: string
          load_id: string
          loading_date: string
          notes?: string | null
          offloading_date: string
          origin: string
          priority?: Database["public"]["Enums"]["priority_level"]
          quantity?: number
          special_handling?: string[] | null
          status?: Database["public"]["Enums"]["load_status"]
          time_window: string
          updated_at?: string
          weight?: number
        }
        Update: {
          actual_loading_arrival?: string | null
          actual_loading_arrival_source?:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_loading_arrival_verified?: boolean | null
          actual_loading_departure?: string | null
          actual_loading_departure_source?:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_loading_departure_verified?: boolean | null
          actual_offloading_arrival?: string | null
          actual_offloading_arrival_source?:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_offloading_arrival_verified?: boolean | null
          actual_offloading_departure?: string | null
          actual_offloading_departure_source?:
          | Database["public"]["Enums"]["load_time_source"]
          | null
          actual_offloading_departure_verified?: boolean | null
          cargo_type?: Database["public"]["Enums"]["cargo_type"]
          client_id?: string | null
          co_driver_id?: string | null
          created_at?: string
          destination?: string
          driver_id?: string | null
          fleet_vehicle_id?: string | null
          id?: string
          load_id?: string
          loading_date?: string
          notes?: string | null
          offloading_date?: string
          origin?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          quantity?: number
          special_handling?: string[] | null
          status?: Database["public"]["Enums"]["load_status"]
          time_window?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "loads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_co_driver_id_fkey"
            columns: ["co_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_fleet_vehicle_id_fkey"
            columns: ["fleet_vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_branch: string | null
          bank_name: string | null
          city: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          rating: number | null
          state: string | null
          status: string | null
          supplier_number: string
          swift_code: string | null
          tax_id: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          rating?: number | null
          state?: string | null
          status?: string | null
          supplier_number: string
          swift_code?: string | null
          tax_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          rating?: number | null
          state?: string | null
          status?: string | null
          supplier_number?: string
          swift_code?: string | null
          tax_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      tracking_share_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          last_viewed_at: string | null
          load_id: string | null
          telematics_asset_id: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          last_viewed_at?: string | null
          load_id?: string | null
          telematics_asset_id: string
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          load_id?: string | null
          telematics_asset_id?: string
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracking_share_links_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      cargo_type:
      | "VanSalesRetail"
      | "Retail"
      | "Vendor"
      | "RetailVendor"
      | "Fertilizer"
      | "BV"
      | "CBC"
      | "Packaging"
      | "Vansales"
      | "Vansales/Vendor"
      | "Export"
      load_status: "scheduled" | "in-transit" | "pending" | "delivered"
      load_time_source: "auto" | "manual"
      priority_level: "high" | "medium" | "low"
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
      cargo_type: [
        "VanSalesRetail",
        "Retail",
        "Vendor",
        "RetailVendor",
        "Fertilizer",
        "BV",
        "CBC",
        "Packaging",
        "Vansales",
        "Vansales/Vendor",
        "Export",
      ],
      load_status: ["scheduled", "in-transit", "pending", "delivered"],
      load_time_source: ["auto", "manual"],
      priority_level: ["high", "medium", "low"],
    },
  },
} as const
