// Vendor management types
// Maps to existing vendors table in database

export interface Vendor {
  id: string;
  vendor_id: string;                // Required field
  vendor_name: string;              // Required field
  vendor_number: string | null;    // Legacy/alternative field
  name: string | null;              // Legacy/alternative field
  contact_person: string | null;
  email: string | null;
  work_email: string | null;       // Alternative email field
  phone: string | null;
  mobile: string | null;           // Alternative phone field
  street_address: string | null;
  address: string | null;          // Alternative address field
  city: string | null;
  country: string | null;
  state: string | null;
  postal_code: string | null;
  website: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean | null;
  custom_fields: unknown | null;   // Json type
  master_email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type VendorInsert = Omit<Vendor, 'id' | 'created_at' | 'updated_at'>;
export type VendorUpdate = Partial<VendorInsert> & { id: string };