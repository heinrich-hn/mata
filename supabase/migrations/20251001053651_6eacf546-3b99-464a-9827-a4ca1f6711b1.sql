-- Create roles table
CREATE TABLE public.roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- Create access_areas table
CREATE TABLE public.access_areas (
    access_area_id SERIAL PRIMARY KEY,
    access_area_name VARCHAR(100) NOT NULL UNIQUE
);

-- Create users table
CREATE TABLE public.users (
    user_id SERIAL PRIMARY KEY,
    shortcode VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    notification_email VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('Active', 'Inactive')),
    role_id INTEGER NOT NULL REFERENCES public.roles(role_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_access_areas junction table
CREATE TABLE public.user_access_areas (
    user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    access_area_id INTEGER NOT NULL REFERENCES public.access_areas(access_area_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, access_area_id)
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_areas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roles
CREATE POLICY "Allow authenticated users to view roles"
ON public.roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage roles"
ON public.roles FOR ALL
TO authenticated
USING (true);

-- Create RLS policies for access_areas
CREATE POLICY "Allow authenticated users to view access areas"
ON public.access_areas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage access areas"
ON public.access_areas FOR ALL
TO authenticated
USING (true);

-- Create RLS policies for users
CREATE POLICY "Allow authenticated users to view users"
ON public.users FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage users"
ON public.users FOR ALL
TO authenticated
USING (true);

-- Create RLS policies for user_access_areas
CREATE POLICY "Allow authenticated users to view user access areas"
ON public.user_access_areas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage user access areas"
ON public.user_access_areas FOR ALL
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert roles
INSERT INTO public.roles (role_name) VALUES
('Operator'), ('Technician'), ('Employee'), ('Sub Admin');

-- Insert access areas
INSERT INTO public.access_areas (access_area_name) VALUES
('Fuel Management'), ('Request'), ('Logbook'), ('Inspection'),
('Incident Report'), ('All technical modules (full access)'),
('Operator Daily Reporting'), ('Labor Code'),
('Full (All modules except PO Approval)'),
('Full (Tech modules + Demand Parts, Tire Inventory)'),
('All modules (Superuser)');

-- Insert users
INSERT INTO public.users (shortcode, name, username, notification_email, status, role_id) VALUES
('H', 'Hein Nel', 'HeinNel', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('AM', 'Adrian Moyo', 'AdrianMoyo', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('PK', 'Phillimon Kwarire', 'PhillimonKwarire', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('LT', 'Luckson Tanyanyiwa', 'LucksonTanyanyiwa', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('BM', 'Biggie Mugwa', 'BiggieMugwa', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('WM', 'Wellington Musumbu', 'WellingtonMusumbu', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('DM', 'Decide Murahwa', 'DecideMurahwa', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('W', 'Workshop', 'Workshop', 'transportmatanuska@gmail.com', 'Active', (SELECT role_id FROM roles WHERE role_name = 'Technician')),
('J', 'Joshua', 'Joshua', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('BM', 'Bradley Milner', 'Bradley', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Technician')),
('WK', 'Witness Kajayi', 'Witness', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Technician')),
('KR', 'Kenneth Rukweza', 'Kenneth', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Technician')),
('DK', 'Doctor Kondwani', 'DoctorKondwani', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('TV', 'Taurayi Vherenaisi', 'TaurayiVherenaisi', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('CC', 'Canaan Chipfurutse', 'CanaanChipfurutse', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('JB', 'Jonathan Bepete', 'JonathanBepete', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('PF', 'Peter Farai', 'PeterFarai', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('EM', 'Enock Mukonyerwa', 'EnockMukonyerwa', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('LQ', 'Lovemore Qochiwe', 'LovemoreQochiwe', NULL, 'Active', (SELECT role_id FROM roles WHERE role_name = 'Operator')),
('AM', 'Alec Maocha', 'AlecMaocha', 'alec@matanuska.co.zw', 'Active', (SELECT role_id FROM roles WHERE role_name = 'Employee')),
('PM', 'Paul Mwanyadza', 'PaulMwanyadza', 'mwanyadzapaul61@gmail.com', 'Active', (SELECT role_id FROM roles WHERE role_name = 'Technician')),
('CJ', 'Cain Jeche', 'CainJeche', 'cain@matanuska.co.zw', 'Active', (SELECT role_id FROM roles WHERE role_name = 'Sub Admin'));

-- Insert user_access_areas mappings
INSERT INTO public.user_access_areas (user_id, access_area_id) VALUES
((SELECT user_id FROM users WHERE username = 'HeinNel'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Fuel Management')),
((SELECT user_id FROM users WHERE username = 'HeinNel'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Request')),
((SELECT user_id FROM users WHERE username = 'HeinNel'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'AdrianMoyo'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Fuel Management')),
((SELECT user_id FROM users WHERE username = 'AdrianMoyo'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'PhillimonKwarire'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Fuel Management')),
((SELECT user_id FROM users WHERE username = 'PhillimonKwarire'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Request')),
((SELECT user_id FROM users WHERE username = 'PhillimonKwarire'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'LucksonTanyanyiwa'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Fuel Management')),
((SELECT user_id FROM users WHERE username = 'LucksonTanyanyiwa'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'BiggieMugwa'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Fuel Management')),
((SELECT user_id FROM users WHERE username = 'BiggieMugwa'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'WellingtonMusumbu'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Inspection')),
((SELECT user_id FROM users WHERE username = 'WellingtonMusumbu'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'DecideMurahwa'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Incident Report')),
((SELECT user_id FROM users WHERE username = 'DecideMurahwa'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'Workshop'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'All technical modules (full access)')),
((SELECT user_id FROM users WHERE username = 'Joshua'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Inspection')),
((SELECT user_id FROM users WHERE username = 'Joshua'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Operator Daily Reporting')),
((SELECT user_id FROM users WHERE username = 'Bradley'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Inspection')),
((SELECT user_id FROM users WHERE username = 'Bradley'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Operator Daily Reporting')),
((SELECT user_id FROM users WHERE username = 'Witness'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Inspection')),
((SELECT user_id FROM users WHERE username = 'Witness'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Operator Daily Reporting')),
((SELECT user_id FROM users WHERE username = 'Witness'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Labor Code')),
((SELECT user_id FROM users WHERE username = 'Kenneth'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Inspection')),
((SELECT user_id FROM users WHERE username = 'Kenneth'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Operator Daily Reporting')),
((SELECT user_id FROM users WHERE username = 'Kenneth'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Labor Code')),
((SELECT user_id FROM users WHERE username = 'DoctorKondwani'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Fuel Management')),
((SELECT user_id FROM users WHERE username = 'DoctorKondwani'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'TaurayiVherenaisi'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'CanaanChipfurutse'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'JonathanBepete'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'PeterFarai'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'EnockMukonyerwa'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'LovemoreQochiwe'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Logbook')),
((SELECT user_id FROM users WHERE username = 'AlecMaocha'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Full (All modules except PO Approval)')),
((SELECT user_id FROM users WHERE username = 'PaulMwanyadza'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'Full (Tech modules + Demand Parts, Tire Inventory)')),
((SELECT user_id FROM users WHERE username = 'CainJeche'), (SELECT access_area_id FROM access_areas WHERE access_area_name = 'All modules (Superuser)'));

-- Create indexes for performance
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_role_id ON public.users(role_id);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_user_access_areas_user_id ON public.user_access_areas(user_id);
CREATE INDEX idx_user_access_areas_access_area_id ON public.user_access_areas(access_area_id);