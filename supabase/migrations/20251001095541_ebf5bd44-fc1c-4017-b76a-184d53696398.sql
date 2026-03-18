-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    active boolean DEFAULT true,
    notes text
);

-- Create client_types table (DEBTOR/CREDITOR)
CREATE TABLE IF NOT EXISTS public.client_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('DEBTOR', 'CREDITOR')),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(client_id, type)
);

-- Create client_addresses table
CREATE TABLE IF NOT EXISTS public.client_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    address_type text DEFAULT 'primary' CHECK (address_type IN ('primary', 'billing', 'shipping', 'other')),
    street_address text,
    city text,
    province_state text,
    postal_code text,
    country text DEFAULT 'South Africa',
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create client_contacts table
CREATE TABLE IF NOT EXISTS public.client_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    contact_name text NOT NULL,
    phone text,
    email text,
    position text,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add client_id to trips table
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_types_client_id ON public.client_types(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON public.client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_trips_client_id ON public.trips(client_id);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for clients
CREATE POLICY "Allow authenticated users to view clients"
ON public.clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage clients"
ON public.clients FOR ALL
TO authenticated
USING (true);

-- Create RLS Policies for client_types
CREATE POLICY "Allow authenticated users to view client types"
ON public.client_types FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage client types"
ON public.client_types FOR ALL
TO authenticated
USING (true);

-- Create RLS Policies for client_addresses
CREATE POLICY "Allow authenticated users to view client addresses"
ON public.client_addresses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage client addresses"
ON public.client_addresses FOR ALL
TO authenticated
USING (true);

-- Create RLS Policies for client_contacts
CREATE POLICY "Allow authenticated users to view client contacts"
ON public.client_contacts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage client contacts"
ON public.client_contacts FOR ALL
TO authenticated
USING (true);

-- Create triggers for updated_at columns
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_addresses_updated_at
BEFORE UPDATE ON public.client_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert client data
DO $$
DECLARE
    v_apl_id uuid;
    v_aspen_id uuid;
    v_aspen_logistics_id uuid;
    v_bulawayo_id uuid;
    v_burma_valley_id uuid;
    v_steinweg_id uuid;
    v_chipinge_id uuid;
    v_crake_valley_id uuid;
    v_crystal_candy_id uuid;
    v_deep_catch_id uuid;
    v_dp_world_id uuid;
    v_fx_logistics_id uuid;
    v_frightco_id uuid;
    v_gundo_id uuid;
    v_hfr_id uuid;
    v_healthcare_id uuid;
    v_jacksons_id uuid;
    v_kroots_id uuid;
    v_lloyds_id uuid;
    v_marketing_id uuid;
    v_marketing_export_id uuid;
    v_mega_market_id uuid;
    v_nyamagay_id uuid;
    v_plus_zero_id uuid;
    v_procurement_id uuid;
    v_rezende_id uuid;
    v_spf_export_id uuid;
    v_tarondale_id uuid;
    v_trade_clearing_id uuid;
    v_willowton_id uuid;
BEGIN
    -- Insert APL
    INSERT INTO public.clients (name) VALUES ('APL') RETURNING id INTO v_apl_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_apl_id, 'DEBTOR'), (v_apl_id, 'CREDITOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_apl_id, '13 Sim Rd, Kempton Park', 'Kempton Park, Johannesburg', 'Gauteng', '1619', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_apl_id, 'Frikkie Smook', '+27 82 870 5186', true);

    -- Insert Aspen
    INSERT INTO public.clients (name) VALUES ('Aspen') RETURNING id INTO v_aspen_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_aspen_id, 'DEBTOR'), (v_aspen_id, 'CREDITOR');

    -- Insert Aspen Logistics
    INSERT INTO public.clients (name) VALUES ('Aspen Logistics') RETURNING id INTO v_aspen_logistics_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_aspen_logistics_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_aspen_logistics_id, '1 Indianapolis Blvd, Gosforth Park', 'Germiston, Johannesburg', 'Gauteng', '1401', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_aspen_logistics_id, 'Sydwell Mduli', '+27 72 456 6467', true);

    -- Insert Bulawayo Depot
    INSERT INTO public.clients (name) VALUES ('Bulawayo Depot') RETURNING id INTO v_bulawayo_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_bulawayo_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, city, country, is_primary)
    VALUES (v_bulawayo_id, 'Bulawayo', 'Zimbabwe', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_bulawayo_id, 'Lynne Ashborne', '+263 776 118 208', true);

    -- Insert Burma Valley
    INSERT INTO public.clients (name) VALUES ('Burma Valley') RETURNING id INTO v_burma_valley_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_burma_valley_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, city, country, is_primary)
    VALUES (v_burma_valley_id, 'Mutare', 'Zimbabwe', true);
    INSERT INTO public.client_contacts (client_id, contact_name, is_primary)
    VALUES (v_burma_valley_id, 'Gorden', true);

    -- Insert C. Steinweg Bridge
    INSERT INTO public.clients (name) VALUES ('C. Steinweg Bridge') RETURNING id INTO v_steinweg_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_steinweg_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_steinweg_id, '1 Bridge Cl, City Deep', 'Johannesburg', 'Gauteng', '2049', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_steinweg_id, 'Chantel Mare', '+27 11 625 3368', true);

    -- Insert Chipinge Banana Company
    INSERT INTO public.clients (name) VALUES ('Chipinge Banana Company') RETURNING id INTO v_chipinge_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_chipinge_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, country, is_primary)
    VALUES (v_chipinge_id, 'Waterfalls Farm', 'Chipinge', 'Zimbabwe', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_chipinge_id, 'Maryna Joubert', '+263 772 551 626', true);

    -- Insert Crake Valley
    INSERT INTO public.clients (name) VALUES ('Crake Valley') RETURNING id INTO v_crake_valley_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_crake_valley_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, country, is_primary)
    VALUES (v_crake_valley_id, 'Po Box 3025', 'Mutare', 'Zimbabwe', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_crake_valley_id, 'Rob Boswell Brown', '+263 71 221 8727', true);

    -- Insert Crystal Candy
    INSERT INTO public.clients (name) VALUES ('Crystal Candy') RETURNING id INTO v_crystal_candy_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_crystal_candy_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, country, is_primary)
    VALUES (v_crystal_candy_id, '12 Burnley Road', 'Harare', 'Zimbabwe', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_crystal_candy_id, 'Demetri Psillos', '+263772234678', true);

    -- Insert Deep Catch
    INSERT INTO public.clients (name) VALUES ('Deep Catch') RETURNING id INTO v_deep_catch_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_deep_catch_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_deep_catch_id, '12 Sapphire Street, Voglevlei, Bellville South', 'Cape Town', 'Western Province', '7550', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_deep_catch_id, 'Nicole Kyriacou', '+27798734283', true);

    -- Insert Dp World
    INSERT INTO public.clients (name) VALUES ('Dp World') RETURNING id INTO v_dp_world_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_dp_world_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_dp_world_id, 'PPLE Building, Second Floor, 10 Skeen Boulevard Bedfordview', 'Johannesburg', 'Gauteng', '2007', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_dp_world_id, 'Karabelo Motloung', '+27 60 970 5932', true);

    -- Insert FX Logistics
    INSERT INTO public.clients (name) VALUES ('FX Logistics') RETURNING id INTO v_fx_logistics_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_fx_logistics_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, country, is_primary)
    VALUES (v_fx_logistics_id, 'Airport Rd', 'Harare', 'Zimbabwe', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_fx_logistics_id, 'Sandhya Kad', '+971 555 834 224', true);

    -- Insert FrightCO
    INSERT INTO public.clients (name) VALUES ('FrightCO') RETURNING id INTO v_frightco_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_frightco_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_frightco_id, 'Unit 1 Duville Industrial Park, 4 Arum Lily Street, Fisantekraal', 'Cape Town', 'Western Cape', '7550', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_frightco_id, 'Pieter Labuschagne', '+27 78 358 9930', true);

    -- Insert Gundo Frieght
    INSERT INTO public.clients (name) VALUES ('Gundo Frieght') RETURNING id INTO v_gundo_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_gundo_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_gundo_id, '38 Osborn Rd, Wadeville', 'Germiston, Johannesburg', 'Gauteng', '1428', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, is_primary)
    VALUES (v_gundo_id, 'Gift Misiza', true);

    -- Insert HFR
    INSERT INTO public.clients (name) VALUES ('HFR') RETURNING id INTO v_hfr_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_hfr_id, 'DEBTOR'), (v_hfr_id, 'CREDITOR');

    -- Insert Healthcare Distribution Solutions
    INSERT INTO public.clients (name) VALUES ('Healthcare Distribution Solutions') RETURNING id INTO v_healthcare_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_healthcare_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_healthcare_id, 'N Reef Road & Barbara Rd', 'Germiston, Johannesburg', 'Gauteng', '1429', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, is_primary)
    VALUES (v_healthcare_id, 'Jacques', true);

    -- Insert Jacksons Transport
    INSERT INTO public.clients (name) VALUES ('Jacksons Transport') RETURNING id INTO v_jacksons_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_jacksons_id, 'CREDITOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_jacksons_id, '224 4th Rd, Witpoort Estates', 'Brakpan, Johannesburg', 'Gauteng', '1540', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_jacksons_id, 'Nick Van Rooyen', '+27 83 655 2767', true);

    -- Insert Kroots
    INSERT INTO public.clients (name) VALUES ('Kroots') RETURNING id INTO v_kroots_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_kroots_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, postal_code, country, is_primary)
    VALUES (v_kroots_id, '20 Bubesi House, Wellington Office Park, Wellington Road', 'Durbanville, Cape Town', 'Western Cape', '7550', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_kroots_id, 'Anika Daniel', '0720266121', true);

    -- Insert Lloyds
    INSERT INTO public.clients (name) VALUES ('Lloyds') RETURNING id INTO v_lloyds_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_lloyds_id, 'DEBTOR'), (v_lloyds_id, 'CREDITOR');

    -- Insert Marketing
    INSERT INTO public.clients (name) VALUES ('Marketing') RETURNING id INTO v_marketing_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_marketing_id, 'DEBTOR');

    -- Insert Marketing Export
    INSERT INTO public.clients (name) VALUES ('Marketing Export') RETURNING id INTO v_marketing_export_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_marketing_export_id, 'DEBTOR');
    INSERT INTO public.client_contacts (client_id, contact_name, is_primary)
    VALUES (v_marketing_export_id, 'Izack Venter', true);

    -- Insert Mega Market
    INSERT INTO public.clients (name) VALUES ('Mega Market') RETURNING id INTO v_mega_market_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_mega_market_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, country, is_primary)
    VALUES (v_mega_market_id, '2 Aberdeen Road Nyakamete', 'Mutare', 'Zimbabwe', true);
    INSERT INTO public.client_contacts (client_id, contact_name, is_primary)
    VALUES (v_mega_market_id, 'Brian White', true);

    -- Insert Nyamagay
    INSERT INTO public.clients (name) VALUES ('Nyamagay') RETURNING id INTO v_nyamagay_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_nyamagay_id, 'DEBTOR');

    -- Insert Plus Zero
    INSERT INTO public.clients (name) VALUES ('Plus Zero') RETURNING id INTO v_plus_zero_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_plus_zero_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, country, is_primary)
    VALUES (v_plus_zero_id, 'South Africa', true);

    -- Insert Procurement
    INSERT INTO public.clients (name) VALUES ('Procurement') RETURNING id INTO v_procurement_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_procurement_id, 'DEBTOR');
    INSERT INTO public.client_contacts (client_id, contact_name, is_primary)
    VALUES (v_procurement_id, 'Eslie Badenhorst', true);

    -- Insert Rezende Depot
    INSERT INTO public.clients (name) VALUES ('Rezende Depot') RETURNING id INTO v_rezende_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_rezende_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, country, is_primary)
    VALUES (v_rezende_id, '1 Abercorn Street', 'Harare', 'Zimbabwe', true);

    -- Insert SPF Export
    INSERT INTO public.clients (name) VALUES ('SPF Export') RETURNING id INTO v_spf_export_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_spf_export_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, province_state, country, is_primary)
    VALUES (v_spf_export_id, '12 Sapphire Street, Vogelvlei, Bellville South', 'Cape Town', 'Western Cape', 'South Africa', true);
    INSERT INTO public.client_contacts (client_id, contact_name, is_primary)
    VALUES (v_spf_export_id, 'Marco Visser', true);

    -- Insert Tarondale
    INSERT INTO public.clients (name) VALUES ('Tarondale') RETURNING id INTO v_tarondale_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_tarondale_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, city, country, is_primary)
    VALUES (v_tarondale_id, 'Chipinge', 'Zimbabwe', true);

    -- Insert Trade Clearing Logistics
    INSERT INTO public.clients (name) VALUES ('Trade Clearing Logistics (Pty) Ltd') RETURNING id INTO v_trade_clearing_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_trade_clearing_id, 'DEBTOR');
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_trade_clearing_id, 'Rajiv Poolaraj', '+27 72 187 0732', true);

    -- Insert Willowton Group
    INSERT INTO public.clients (name) VALUES ('Willowton Group (Zimbabwe)') RETURNING id INTO v_willowton_id;
    INSERT INTO public.client_types (client_id, type) VALUES (v_willowton_id, 'DEBTOR');
    INSERT INTO public.client_addresses (client_id, street_address, city, country, is_primary)
    VALUES (v_willowton_id, '6 Durban Rd', 'Mutare', 'Zimbabwe', true);
    INSERT INTO public.client_contacts (client_id, contact_name, phone, is_primary)
    VALUES (v_willowton_id, 'Elias Nyamukondiwa', '+263 77 307 781', true);
END $$;