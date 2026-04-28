-- Manageable cost categories and subcategories for trip costs / expenses.
-- Replaces the hard-coded COST_CATEGORIES constant with a DB-backed list
-- that operators can CRUD from the Operational Costs > Categories tab.

CREATE TABLE IF NOT EXISTS public.cost_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.cost_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cost_subcategories_category
    ON public.cost_subcategories(category_id);

ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read cost_categories" ON public.cost_categories;
CREATE POLICY "Authenticated read cost_categories"
    ON public.cost_categories FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated write cost_categories" ON public.cost_categories;
CREATE POLICY "Authenticated write cost_categories"
    ON public.cost_categories FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read cost_subcategories" ON public.cost_subcategories;
CREATE POLICY "Authenticated read cost_subcategories"
    ON public.cost_subcategories FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated write cost_subcategories" ON public.cost_subcategories;
CREATE POLICY "Authenticated write cost_subcategories"
    ON public.cost_subcategories FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- Seed from current hard-coded COST_CATEGORIES constant so existing dropdowns
-- keep working immediately after the migration is applied.
DO $$
DECLARE
    cat_id UUID;
    cat RECORD;
    sub TEXT;
    sub_idx INTEGER;
    cat_idx INTEGER := 0;
BEGIN
    FOR cat IN
        SELECT * FROM (
            VALUES
                ('Border Costs', ARRAY[
                    'Beitbridge Border Fee','Gate Pass','Coupon','Carbon Tax Horse','CVG Horse','CVG Trailer',
                    'Insurance (1 Month Horse)','Insurance (3 Months Trailer)','Insurance (2 Months Trailer)',
                    'Insurance (1 Month Trailer)','Carbon Tax (3 Months Horse)','Carbon Tax (2 Months Horse)',
                    'Carbon Tax (1 Month Horse)','Carbon Tax (3 Months Trailer)','Carbon Tax (2 Months Trailer)',
                    'Carbon Tax (1 Month Trailer)','Road Access','Bridge Fee','Road Toll Fee','Counseling Leavy',
                    'Transit Permit Horse','Transit Permit Trailer','National Road Safety Fund Horse',
                    'National Road Safety Fund Trailer','Electronic Seal','EME Permit','Zim Clearing',
                    'Zim Supervision','SA Clearing','Runner Fee Beitbridge','Runner Fee Zambia Kazungula',
                    'Runner Fee Chirundu'
                ]),
                ('Parking', ARRAY[
                    'Bubi','Lunde','Mvuma','Gweru','Kadoma','Chegutu','Norton','Harare','Ruwa','Marondera',
                    'Rusape','Mutare','Nyanga','Bindura','Shamva','Centenary','Guruve','Karoi','Chinhoyi',
                    'Kariba','Hwange','Victoria Falls','Bulawayo','Gwanda','Beitbridge','Masvingo','Zvishavane',
                    'Shurugwi','Kwekwe'
                ]),
                ('Diesel', ARRAY[
                    'ACM Petroleum Chirundu - Reefer','ACM Petroleum Chirundu - Horse','RAM Petroleum Harare - Reefer',
                    'RAM Petroleum Harare - Horse','Engen Beitbridge - Reefer','Engen Beitbridge - Horse',
                    'Shell Mutare - Reefer','Shell Mutare - Horse','BP Bulawayo - Reefer','BP Bulawayo - Horse',
                    'Total Gweru - Reefer','Total Gweru - Horse','Puma Masvingo - Reefer','Puma Masvingo - Horse',
                    'Zuva Petroleum Kadoma - Reefer','Zuva Petroleum Kadoma - Horse','Mobil Chinhoyi - Reefer',
                    'Mobil Chinhoyi - Horse','Caltex Kwekwe - Reefer','Caltex Kwekwe - Horse'
                ]),
                ('Non-Value-Added Costs', ARRAY[
                    'Fines','Penalties','Passport Stamping','Push Documents','Jump Queue',
                    'Dismiss Inspection','Parcels','Labour'
                ]),
                ('Trip Allowances', ARRAY['Food','Airtime','Taxi']),
                ('Tolls', ARRAY[
                    'Tolls BB to JHB','Tolls Cape Town to JHB','Tolls JHB to CPT','Tolls Mutare to BB',
                    'Tolls JHB to Martinsdrift','Tolls BB to Harare','Tolls Zambia','Tolls BV to Bulawayo',
                    'Tolls CBC to Bulawayo','Tolls BV to Harare','Tolls CBC to Harare'
                ]),
                ('System Costs', ARRAY[
                    'Repair & Maintenance per KM','Tyre Cost per KM','GIT Insurance','Short-Term Insurance',
                    'Tracking Cost','Fleet Management System','Licensing','VID / Roadworthy','Wages','Depreciation'
                ])
        ) AS t(name, subs)
    LOOP
        cat_idx := cat_idx + 1;
        INSERT INTO public.cost_categories (name, sort_order)
        VALUES (cat.name, cat_idx)
        ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order
        RETURNING id INTO cat_id;

        sub_idx := 0;
        FOREACH sub IN ARRAY cat.subs
        LOOP
            sub_idx := sub_idx + 1;
            INSERT INTO public.cost_subcategories (category_id, name, sort_order)
            VALUES (cat_id, sub, sub_idx)
            ON CONFLICT (category_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order;
        END LOOP;
    END LOOP;
END $$;
