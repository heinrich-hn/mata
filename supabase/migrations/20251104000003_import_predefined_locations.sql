-- ============================================================================
-- IMPORT PREDEFINED LOCATIONS DATA
-- Import route waypoints from Explain.COde CSV file
-- ============================================================================

-- Insert all predefined locations
INSERT INTO public.predefined_locations (name, short_code, address, latitude, longitude, location_type, country, is_active) VALUES
-- Zambia locations
('ACM PETROLEUM LIMITED', 'ACM PETROLEUM LIMITED', '2548 Lusaka, Chirundu Rd, Chirundu, Zambia', -16.0337714, 28.8143331, 'truck_stop', 'Zambia', true),
('Brands Africa - Zambia', 'Brands Africa - Zambia', 'York Commercial Park Kafue Road, G7C6+M8G, Makeni Road, Lusaka, Zambia', -15.4783134, 28.260813, 'supplier', 'Zambia', true),
('Chirundu Border Post', 'CBP', 'T2 Southern Province Zambia', -16.033751, 28.845583, 'border_post', 'Zambia', true),
('Chirundu Porste Post (Zambia Side)', 'Chirundu Porste Post (Zambia Side)', 'Chirundu, Zambia', -16.03362619, 28.84640962, 'border_post', 'Zambia', true),
('Choma Truckstop Zambia', 'Choma Truckstop', '52X2+J69, T1, Choma, Zambia', -16.8009511, 27.0005982, 'truck_stop', 'Zambia', true),
('Gatbro International Limited', 'Gatbro International Limited (Lusaka)', '35285-7 Off Mwembeshi Road Chinika Industrial Area, Lusaka, Zambia', -15.4042205, 28.2482166, 'supplier', 'Zambia', true),
('Korridor Kafue Truck Stop Zambia', 'Kafue Truck Stop', 'Plot 1847 Turn Pike Chirundu/Mazabuka Road Junction, Chikankata, Zambia', -15.8569662, 28.2474073, 'truck_stop', 'Zambia', true),
('Korridor Chingola Truck Stop Zambia', 'Korridor Chingola Truck Stop Zambia', 'CVHX+VQR, Kasompe Airfield Rd, Chingola, Zambia', -12.5702698, 27.8993997, 'truck_stop', 'Zambia', true),
('Korridor Kapiri Mposhi Truck Stop Zambia', 'Korridor Kapiri Mposhi Truck Stop Zambia', '3MG9+X3, Kapiri Mposhi, Zambia', -13.9225151, 28.6676341, 'truck_stop', 'Zambia', true),
('Korridor Ndola Truck Stop', 'Korridor Ndola Truck Stop', 'Plot 8084 Nakambala Rd, Ndola, Zambia', -13.0223679, 28.6428276, 'truck_stop', 'Zambia', true),
('Korridor Truck Stop Zambia Lusaka', 'Korridor Truck Stop Zambia Lusaka', 'G762+M57, Lusaka, Zambia', -15.4883375, 28.2504219, 'truck_stop', 'Zambia', true),
('Lake Petroleum Kabwe', 'Lake Petroleum Kabwe', 'JF6W+MC, Kabwe, Zambia', -14.3883496, 28.4960115, 'truck_stop', 'Zambia', true),
('Lusaka', 'Lusaka', 'Lusaka, Zambia', -15.4154677, 28.2773267, 'other', 'Zambia', true),
('Lusaka Korridor Truck Stop', 'Lusaka Korridor Truck Stop', 'G762+M57, Lusaka, Zambia', -15.4883195, 28.2503882, 'truck_stop', 'Zambia', true),
('Mount meru - chirndu', 'Mount meru - chirndu', 'XR8Q+76, T2, Chirundu, Zambia', -16.0338486, 28.8352168, 'truck_stop', 'Zambia', true),
('Plasma truck stop Zambia Chirundu Border', 'Plasma truck stop Zambia Chirundu Border', 'XR8V+246, Chirundu, Zambia', -16.0348407, 28.842758, 'truck_stop', 'Zambia', true),
('Seapride Foods Zambia', 'Seapride Foods Zambia', 'Farm No, 397A Kafue Rd, Lusaka, Zambia', -15.4772684, 28.2619005, 'supplier', 'Zambia', true),
('Trade Kings Limited', 'Trade Kings', 'Plot No. 29381 Nampundwe Road Light Industrial Area Zambia, Lusaka, Zambia', -15.4185935, 28.2706048, 'supplier', 'Zambia', true),
('Milangu OPTIMA', 'Zambia Truck Stop - Livingstone', 'Livingstone / Lusaka Road, T1, Senkobo, Zambia', -17.5923072, 25.9805073, 'truck_stop', 'Zambia', true),

-- South Africa locations
('African Truck Stop', 'African Truck Stop', '12 Pomona Rd, Pomona AH, Kempton Park, 1619, South Africa', -26.09256217, 28.26210178, 'truck_stop', 'South Africa', true),
('Anchor Chandling', 'Anchor Chandling', 'Alternator Ave, Montague Gardens, Cape Town, 7441, South Africa', -33.8630966, 18.5223046, 'supplier', 'South Africa', true),
('Aspen Pharmaceuticals', 'Aspen Pharmaceuticals', '79 Burman Rd, Deal Party, Gqeberha, 6210, South Africa', -33.90164672, 25.61698807, 'customer', 'South Africa', true),
('Africa Truck Stop Brakpan', 'ATB', 'Brakpan South Africa', -26.3011025, 28.3350613, 'truck_stop', 'South Africa', true),
('Atlantis Seafood Products.', 'Atlantis Seafood Products.', '145 Neil Hare Rd, Atlantis Industrial, Cape Town, 7349, South Africa', -33.6101527, 18.4672231, 'customer', 'South Africa', true),
('Africa Truck Stop Pomona', 'ATP', 'Pomona Rd Kempton Park 1619', -26.0928259, 28.2641068, 'truck_stop', 'South Africa', true),
('B BRAUN', 'B BRAUN', 'Hoogland, Ext 41, 253 Aintree Ave, Northriding, Johannesburg, 2194, South Africa', -26.0400206, 27.9535729, 'customer', 'South Africa', true),
('B Braun (SA)', 'B Braun (SA)', 'Aintree Ave, Hoogland, Randburg, 2162, South Africa', -26.0394836, 27.9530391, 'customer', 'South Africa', true),
('BCG Supply Chain', 'BCG Supply Chain', 'Longlake 19 Heaton Lane Linbro Park, Modderfontein, Johannesburg, 2090, South Africa', -26.0818361, 28.1325123, 'depot', 'South Africa', true),
('Beitbridge Border South Bound,  South Africa', 'Beitbridge Border South Africa Side', 'QX8M+CF Beitbridge, South Africa', -22.23385903, 29.98378498, 'border_post', 'South Africa', true),
('Breco Seafoods', 'Breco Seafoods', '4 Printers Way, Milnerton, Cape Town, 7442, South Africa', -33.8751928, 18.5127551, 'customer', 'South Africa', true),
('Beitbridge SA Border', 'BSB', 'Beitbridge Border Post South Africa', -22.225476, 29.982789, 'border_post', 'South Africa', true),
('Cape Town Market', 'Cape Town Market', '110 Gunners Cir, Epping, Cape Town, 7475, South Africa', -33.9310343, 18.5306736, 'market', 'South Africa', true),
('Carara Agro Processing', 'Carara Agro', '2 Froude St, Makhanda, 6139, South Africa', -33.300414, 26.534902, 'customer', 'South Africa', true),
('CHEP Jet Park', 'CHEP Jet Park', '19 Yaldwyn Rd, Jet Park, Boksburg, 1459, South Africa', -26.1738279, 28.2156529, 'depot', 'South Africa', true),
('Chilleweni Cold Store', 'Chilleweni Cold Store', '1 Suzuka Rd, Gosforth Park, Germiston, 1401, South Africa', -26.236725, 28.1298919, 'depot', 'South Africa', true),
('Close The Loop', 'Close The Loop', '20 Van Wyk Rd, Brentwood Park, Benoni, 1501', -26.129965, 28.287332, 'depot', 'South Africa', true),
('Clover Roodepoort', 'Clover Roodepoort', '200 Constantia Dr, Constantia Kloof, Roodepoort, 1709, South Africa', -26.1444158, 27.9182114, 'customer', 'South Africa', true),
('Clover SA Clayville', 'Clover SA Clayville', '36 Spanner Rd, Clayville Industrial, Olifantsfontein, 1666, South Africa', -25.9662485, 28.2287515, 'customer', 'South Africa', true),
('Cape Town', 'CPT', 'Cape Town, South Africa', -33.922087, 18.4231418, 'other', 'South Africa', true),
('Cruise Ship Cape Town Harbour', 'Cruise Ship CPT', '0A S Arm Rd, Victoria & Alfred Waterfront, Cape Town, 8001, South Africa', -33.9058362, 18.4315187, 'port', 'South Africa', true),
('DACHSER Intelligent Logistics - South Africa (PTY) Ltd', 'DACHSER', '9 Sim Rd, Kempton Park AH, Kempton Park, 1619, South Africa', -26.0952229, 28.25428, 'depot', 'South Africa', true),
('Dapper Market Agents', 'Dapper Market Agents', 'Fortune Street, City Deep, Johannesburg South, 2197, South Africa', -26.2320022, 28.0824127, 'market', 'South Africa', true),
('De Aar', 'De Aar', 'De Aar, 7000, South Africa', -30.6441756, 24.0105678, 'other', 'South Africa', true),
('De Rust Farm', 'De Rust Farm', 'De Rust Farm Farm', -34.0079266, 19.2686749, 'customer', 'South Africa', true),
('dRK Logistics', 'DRK Logistics', 'Pomona AH, Kempton Park, 1619, South Africa', -26.0908705, 28.2698361, 'depot', 'South Africa', true),
('Engen Airport Convenience Centre', 'EAC', 'East London South Africa', -33.0386917, 27.8331171, 'truck_stop', 'South Africa', true),
('Easy Store', 'Easy Store', '11 Highview Blvd, Ferndale, Randburg, 2169', -26.06867292, 27.97783866, 'depot', 'South Africa', true),
('Engen Highway Garage', 'EHG', 'Randfontein South Africa', -26.2356066, 27.6103889, 'truck_stop', 'South Africa', true),
('Engen Settlers Way', 'ESW', 'East London South Africa', -33.0353517, 27.8668326, 'truck_stop', 'South Africa', true),
('Engen Truck Stop & Eat', 'ETS', 'East London South Africa', -33.034532, 27.8822074, 'truck_stop', 'South Africa', true),
('Farmers Trust', 'Farmers Trust', '3rd Floor Agents Building Tshwane Fresh Produce Market, Pretoria West, Pretoria, 0002, South Africa', -25.7402845, 28.1702523, 'market', 'South Africa', true),
('Farmwise Cape (Pty) Ltd', 'Farmwise Klapmuntz', 'Bronkhorst farm, Klapmuts, 7625, South Africa', -33.8131547, 18.8761052, 'customer', 'South Africa', true),
('F P T Group (Pty) Ltd', 'FPT', 'Duncan Dock D''Berth Port Of, S Arm Rd, Cape Town, 8001, South Africa', -33.9075185, 18.4274659, 'port', 'South Africa', true),
('Zire Fresh Produce Distribution Centre Pretoria', 'Fresh Approach Pta', '904 Haarlem St, Roseville, Pretoria, 0084, South Africa', -25.7149123, 28.1680889, 'depot', 'South Africa', true),
('Freshmark Polokwane', 'Freshmark Polokwane', '2 Michelle Crescent N1 Industrial Park Magna Via, Polokwane Ext 42, Polokwane, 0699, South Africa', -23.8594826, 29.4747646, 'depot', 'South Africa', true),
('Freshmark Division, Shoprite Group', 'Freshmark Pta', 'Brakfontein Rd, Louwlardia, Centurion, 1683, South Africa', -25.9133944, 28.1664809, 'depot', 'South Africa', true),
('Fuel 1 Retail (Pty) Ltd Bellville ', 'Fuel 1 Retail (Pty) Ltd Bellville ', '6 Mill Rd, Bellville South, Cape Town, 7530, South Africa', -33.9241403, 18.6467967, 'truck_stop', 'South Africa', true),
('Fuel 1 Retail Kraaifontein', 'Fuel 1 Retail Kraaifontein', '12 Acacia Rd, Kraaifontein Industria, Cape Town, 7570, South Africa', -33.837619, 18.7321145, 'truck_stop', 'South Africa', true),
('Grahamstown', 'Grahamstown', 'Makhanda, South Africa', -33.3093952, 26.5284328, 'other', 'South Africa', true),
('Groblersbrug Border Post', 'Groblersbrug Border Post', 'N11, South Africa', -22.9996417, 27.9440528, 'border_post', 'South Africa', true),
('Gateway Truckstop', 'GTS', 'N1 Beit Bridge 0904 Limpopo', -22.240373, 29.985063, 'truck_stop', 'South Africa', true),
('Its Chilleweni City Deep ', 'Its Chilleweni City Deep ', '10 Merino Ave, City Deep, Johannesburg South, 2197, South Africa', -26.22767, 28.08472, 'depot', 'South Africa', true),
('Johannesburg', 'JHB', 'Johannesburg, South Africa', -26.205647, 28.0337185, 'other', 'South Africa', true),
('Kopfontein Border SA', 'Kopfontein Border', 'South Africa', -24.70760065, 26.09592984, 'border_post', 'South Africa', true),
('Lemba Truck Stop', 'Lemba Truck Stop', '8 Industrial Road Industrial Area, Louis Trichardt, 0920, South Africa', -23.0651054, 29.9123573, 'truck_stop', 'South Africa', true),
('Lemba Truck Stop', 'LTS', 'Industria St Louis Trichardt 0920', -23.064228, 29.911803, 'truck_stop', 'South Africa', true),
('Multiflora Flower Market', 'Market', 'Multiflora Building, Cnr Fig Place &, Vickers Rd, City Deep, Johannesburg, 2001, South Africa', -26.2338816, 28.0730446, 'market', 'South Africa', true),
('MBT Zeerust Truck Stop', 'MBT Zeerust Truck Stop', '1214 Krans St, Zeerust, 2865, South Africa', -25.5426277, 26.106755, 'truck_stop', 'South Africa', true),
('Meat N Pie Shop', 'Meat N Pie Shop', 'Cnr of Jenny and Stasie Street 7000 De Aar - De Aar Northern Cape - SouthAfrica', -30.65282152, 24.0115924, 'truck_stop', 'South Africa', true),
('Minx Marketing', 'Minx', '139 Houtbaai St, Elandshaven, Germiston, 1449, South Africa', -26.2442212, 28.132425, 'depot', 'South Africa', true),
('Morgan Cargo', 'Morgan Cargo', '1 Northern Perimeter Rd, O.R. Tambo, Kempton Park, 1627, South Africa', -26.1073531, 28.2428408, 'port', 'South Africa', true),
('Mzantsi Solutions', 'Mzantsi Solutions', 'Unit 18, Blue Drop Business Park, 105 E.P. Malan Rd, Pomona, Kempton Park, 1619, South Africa', -26.1024293, 28.2632832, 'depot', 'South Africa', true),
('OBC GROUP (Pty) Ltd.', 'OBC GROUP (Pty) Ltd.', '1158 Louwlardia Dr, Louwlardia, Centurion, 1683, South Africa', -25.9171194, 28.1792403, 'depot', 'South Africa', true),
('Paarl', 'Paarl', 'Paarl, South Africa', -33.7311297, 18.9628342, 'other', 'South Africa', true),
('Port Elizabeth', 'PE', 'Gqeberha, South Africa', -33.913693, 25.5826876, 'other', 'South Africa', true),
('P & E Truck and Trailer Services', 'PET', 'Germiston South Africa', -26.2625781, 28.3596504, 'service_center', 'South Africa', true),
('Pioneer Hi-Bred', 'Pioneer Hi-Bred', '97 Sloan St, Rosslyn, Akasia, 0200, South Africa', -25.6165459, 28.0926625, 'supplier', 'South Africa', true),
('Polokwane Truck Stop', 'Polokwane Truck Stop', 'Plot 140 Orpen Rd, Ivydale, Polokwane, 0699, South Africa', -23.9412266, 29.4338448, 'truck_stop', 'South Africa', true),
('Quest Fuel Beaufort West', 'Quest Fuel Beaufort West', 'Fabriek St, Beaufort West, 6970, South Africa', -32.3615517, 22.5589368, 'truck_stop', 'South Africa', true),
('Randfontein Truck Stop', 'Randfontein Truck Stop', '1 Protea St, Aureus, Randfontein, 1760, South Africa', -26.1909952, 27.6900876, 'truck_stop', 'South Africa', true),
('Rangel', 'Rangel', 'Unit 5, Growthpoint Industrial Estate, 1 Bell St, Meadowdale, Germiston, 1614', -26.14751755, 28.18384552, 'depot', 'South Africa', true),
('Ropax Truckstop East London', 'RTE', 'East London South Africa', -32.9664307, 27.8985251, 'truck_stop', 'South Africa', true),
('S & S Petroleum', 'S & S Petroleum', 'S & S Petroleum', -21.18980644, 27.50618362, 'truck_stop', 'South Africa', true),
('SAFT Killarney', 'Saft Killarney', 'Sati Rd, Killarney Gardens, Cape Town, 7441, South Africa', -33.819259, 18.530028, 'depot', 'South Africa', true),
('Sediba Clearing JHB', 'Sediba Clearing JHB', '14c Toronto St, Apex, Benoni, 1540, South Africa', -26.2109659, 28.3389111, 'depot', 'South Africa', true),
('Sequence Logistics', 'Sequence Logistics', '31 O''Conner Place, Aeroton, Johannesburg South, 2013, South Africa', -26.2571976, 27.9716605, 'depot', 'South Africa', true),
('Silver Solutions Intermodal', 'Silver Solutions', 'Gate A, 2 Baker Street Montague Gardens, 30 Sacks Circle, Bellville South, Cape Town, 7447, South Africa', -33.8778533, 18.5127581, 'depot', 'South Africa', true),
('Silver Solutions Intermodal', 'Silver Solutions Intermodal', 'Sacks Cir, Sacks Circle Industrial, Cape Town, 7530, South Africa', -33.9275582, 18.6607321, 'depot', 'South Africa', true),
('Skilpadshek Border Post', 'Skilpadshek Border Post', 'South Africa', -25.2782944, 25.7158596, 'border_post', 'South Africa', true),
('Sterk Water', 'Sterk Water', 'SterkWater', -33.228425, 19.2394316, 'other', 'South Africa', true),
('TotalEnergies Rand', 'TER', 'Randfontein South Africa', -26.1746961, 27.7075497, 'truck_stop', 'South Africa', true),
('Teralco Logistics', 'Teralco Logistics', 'Eastport Logistics Park, R21, Glen marais, Kempton Park, 1619', -26.0236916, 28.26324, 'depot', 'South Africa', true),
('TotalEnergies Randgate', 'TRG', 'Randgate South Africa', -26.1725873, 27.6854549, 'truck_stop', 'South Africa', true),
('Two Oceans Commercial Cold Store', 'Two Oceans Commercial Cold Store', '12 Sapphire Street, Vogelvlei, South, Kuils River, Cape Town, 7580, South Africa', -33.9183613, 18.662988, 'depot', 'South Africa', true),
('Upd Courier', 'UPD CPT', '20 Railway Rd, Montague Gardens, Cape Town, 7441, South Africa', -33.8653602, 18.5264661, 'depot', 'South Africa', true),
('UPD warehouse', 'UPD JHB', '14 Tamar Ave, Lea Glen, Johannesburg, 1709, South Africa', -26.190302, 27.911574, 'depot', 'South Africa', true),
('Vector Logistics Linbro Park', 'Vector Logistics Linbro Park', 'Corner Frankenwald, and, Mastiff Rd, Linbro Business Park, Sandton, 2090, South Africa', -26.0637852, 28.1167615, 'depot', 'South Africa', true),
('Vector Logistics SRCH MIdrand', 'Vector Logistics SRCH MIdrand', 'Ext 38, PO Box 46, 80 Olievenhoutbosch Rd, Louwlardia, Centurion, 0157, South Africa', -25.9163793, 28.1667722, 'depot', 'South Africa', true),
('Willowton Group CPT', 'Willowton Group Margarine CPT', 'Bax St, Ndabeni, Cape Town, 7405, South Africa', -33.9258862, 18.4911136, 'customer', 'South Africa', true),
('Wine Route Truck Stop,  Klapmuts', 'Wine Route Truck Stop', '80 Old Paarl Rd, Klapmuts, 7625, South Africa', -33.80475861, 18.86888254, 'truck_stop', 'South Africa', true),
('Wilmar SA Truck Area', 'WST', 'Randfontein South Africa', -26.1615148, 27.7116783, 'truck_stop', 'South Africa', true),

-- Zimbabwe locations
('Andrew''s Sarsfields', 'Andrew''s Sarsfields', 'Harare, Could not confirm exact address', -17.829, 31.052, 'customer', 'Zimbabwe', true),
('Antima (Arundel Village)', 'Antima (Arundel Village)', 'Shop V3 Arundel Village, 51 Quorn Ave, Mt Pleasant, Harare', -17.785, 31.05, 'customer', 'Zimbabwe', true),
('B Braun Zimbabwe', 'B Braun Zimbabwe', '6X7R+R59, Harare, Zimbabwe', -17.7854644, 30.9904866, 'customer', 'Zimbabwe', true),
('Beitbridge Border North Bound,  Zimbabwe', 'Beitbridge Border (Zim Side) Border', 'Beitbridge, Zimbabwe', -22.21760192, 29.98530312, 'border_post', 'Zimbabwe', true),
('Bon Marché Borrowdale', 'Bon Marché Borrowdale', 'Bond St Shopping Centre, The Chase, Mt Pleasant, Harare', -17.753, 31.096, 'customer', 'Zimbabwe', true),
('Bon Marché Chisipite', 'Bon Marché Chisipite', 'Chisipite Shopping Centre, Enterprise Rd, Harare', -17.794, 31.088, 'customer', 'Zimbabwe', true),
('Bon Marché Westgate', 'Bon Marché Westgate', '1642/30 Westgate Shopping Centre, Harare', -17.783, 30.966, 'customer', 'Zimbabwe', true),
('Brain scope investments', 'Brain scope investments', '54 Plymouth Rd, Harare, Zimbabwe', -17.8609815, 31.022956, 'customer', 'Zimbabwe', true),
('Burma Valley Entry', 'Burma Valley', 'RM9X+FQ Rowa, Zimbabwe', -19.18134742, 32.6994949, 'other', 'Zimbabwe', true),
('Bulawayo Depot', 'BYO Depot', '5 Woodbury Rd, Bulawayo, Zimbabwe', -20.14704034, 28.56972715, 'depot', 'Zimbabwe', true),
('Beitbridge ZIM Border', 'BZB', 'Harare-Beitbridge Highway Zimbabwe', -22.21177, 29.983518, 'border_post', 'Zimbabwe', true),
('Chipinge Banana Company', 'CBC', 'WJ6F+25 Chipinge, Zimbabwe', -20.08999732, 32.62297647, 'customer', 'Zimbabwe', true),
('CHEP Harare', 'CHEP Harare', 'Aspindale Road, & Gleneagles Rd, Harare, Zimbabwe', -17.8739814, 30.9726435, 'depot', 'Zimbabwe', true),
('Chipinge', 'Chipinge', 'Chipinge, Zimbabwe', -20.1938273, 32.6205674, 'other', 'Zimbabwe', true),
('Chirundu Border Post (Zimbabwe Side)', 'Chirundu Border Post (Zimbabwe Side)', 'Chirundu,, Zimbabwe', -16.0426243, 28.8582503, 'border_post', 'Zimbabwe', true),
('COMOX TRADING PRIVATE LIMITED', 'COMOX TRADING PRIVATE LIMITED', 'ARLINGTON ESTATES, SEKE ROAD STAND 2449, HARARE ZW', -17.9050983, 31.0703866, 'customer', 'Zimbabwe', true),
('Crake Valley ', 'Crake Valley', 'Unnamed Road, Zimbabwe', -19.19386274, 32.72227322, 'other', 'Zimbabwe', true),
('Crystal Candy', 'Crystal Candy', '12 Burnley Rd, Harare, Zimbabwe', -17.8478714, 31.0215627, 'customer', 'Zimbabwe', true),
('ETG Inputs Zimbabwe (Loading Point)', 'Etg', '489 Goodwin Rd, Harare, Zimbabwe', -17.87919438, 30.96731945, 'depot', 'Zimbabwe', true),
('ETG Agri Inputs Zimbabwe', 'ETG', '1 Robert Dr, Harare, Zimbabwe', -17.8393598, 31.1037351, 'depot', 'Zimbabwe', true),
('Food Lover's Market Greendale', 'FL Greendale', '54F2+FPC Honeydew Lifestyle Centre, 16 Greendale Ave, Harare, Zimbabwe', -17.8267684, 31.1034027, 'customer', 'Zimbabwe', true),
('Food Emporium (Marimba)', 'Food Emporium (Marimba)', 'Marimba Suburb (see site), Harare', -17.848, 30.957, 'customer', 'Zimbabwe', true),
('Food Lover''s Market Greendale', 'Food Lover''s Market Greendale', '100 Greendale Ave, Greendale, Harare', -17.824, 31.11, 'customer', 'Zimbabwe', true),
('FreshCo Market Chisipite', 'FreshCo Market Chisipite', '155 ED Mnangagwa Rd (formerly Enterprise Rd), Chisipite, Harare', -17.794, 31.088, 'customer', 'Zimbabwe', true),
('Freshpro', 'Freshpro', '310 Hillside Rd, Harare, Zimbabwe', -17.8423515, 31.1036324, 'customer', 'Zimbabwe', true),
('FX Logistics Zimbabwe (Europort Cold Storage Facility)', 'Fx', 'Airport Rd, Harare, Zimbabwe', -17.9145851, 31.0928058, 'depot', 'Zimbabwe', true),
('Fx Offloading Point CPT', 'Fx Offloading Point CPT', 'Hero Berry', -34.07236, 18.7707833, 'depot', 'Zimbabwe', true),
('Gweru Toll Plaza', 'GTP', 'R2 Gweru Midlands Zimbabwe', -19.311952, 29.794109, 'toll_gate', 'Zimbabwe', true),
('Gweru Truck Stop (Zim)', 'Gweru Truck Stop (Zim)', '62 Brackenhurst Gweru Harare Road, Gweru, Zimbabwe', -19.3863953, 29.8186479, 'truck_stop', 'Zimbabwe', true),
('Harare', 'Harare', 'Harare, Zimbabwe', -17.8262928, 31.0503723, 'other', 'Zimbabwe', true),
('Harare Truckstop', 'Harare Truckstop', '4X8G+VCC, Dagenham Rd, Harare, Zimbabwe', -17.8828193, 30.976006, 'truck_stop', 'Zimbabwe', true),
('Harare Truck Stop', 'HTS', 'Barking Road Harare Zimbabwe', -17.88143, 30.975151, 'truck_stop', 'Zimbabwe', true),
('Innscor', 'Innscor', 'Innscor', -17.9051633, 31.0721066, 'customer', 'Zimbabwe', true),
('Ipex Petroleum', 'Ipex Petroleum', '42 Sussex St, Mokopane, 0601, South Africa', -24.169146, 29.011769, 'truck_stop', 'Zimbabwe', true),
('LANGA FARM', 'LANGA FARM', 'LANGA FARM', -18.07278852, 30.21677336, 'customer', 'Zimbabwe', true),
('Lymington Tollgate', 'LTG', 'Mutare-Masvingo Highway Zimbabwe', -20.070389, 31.181793, 'toll_gate', 'Zimbabwe', true),
('Marondera', 'Marondera', 'Marondera, Zimbabwe', -18.1885141, 31.5487439, 'other', 'Zimbabwe', true),
('Mega Market', 'Mega Market', 'Aberdeen Rd, Mutare, Zimbabwe', -19.00519335, 32.64361042, 'market', 'Zimbabwe', true),
('Morris rock resources', 'Morris rock resources', 'Morris rock resources', -17.88898242, 31.2295415, 'customer', 'Zimbabwe', true),
('Mutare Tollgate', 'MTG', 'R5 Mutasa Manicaland Zimbabwe', -18.929365, 32.54348, 'toll_gate', 'Zimbabwe', true),
('Mudiwa Farming (Pvt) Ltd Blueberry Farm', 'Mudiwa Farming (Pvt) Ltd Blueberry Farm', 'Mudiwa Farming (Pvt) Ltd Blueberry Farm', -17.75152763, 31.27072713, 'customer', 'Zimbabwe', true),
('Mutare Depot', 'Mutare Depot', '5173 Tameside Nyakamete, Mutare, Zimbabwe', -19.00251415, 32.6388758, 'depot', 'Zimbabwe', true),
('Nyamapanda Border Post', 'NBP', 'A2 Mudzi Mashonaland East Zimbabwe', -16.962091, 32.850441, 'border_post', 'Zimbabwe', true),
('Ngezi Vansale - Nyasha', 'Ngezi Vansale - Nyasha', 'Ngezi, Customer drop – add exact stop', -18.665, 29.383, 'customer', 'Zimbabwe', true),
('Norton Toll Gate', 'NTG', 'R2 Chegutu Mashonaland West Zimbabwe', -17.938765, 30.649133, 'toll_gate', 'Zimbabwe', true),
('Nutri Master', 'Nutri Master', '17 Foundry Rd, Harare, Zimbabwe', -17.870155, 30.9633817, 'customer', 'Zimbabwe', true),
('Nyamagaya Orchards and shop', 'Nyamagay', 'Troutbeck, RRJF+MX7, Nyanga, Zimbabwe', -18.1683306, 32.8249126, 'customer', 'Zimbabwe', true),
('Nyazura,  Zimbabwe', 'Nyazura ', 'Nyazura ', -18.72872356, 32.1650226, 'other', 'Zimbabwe', true),
('OK Bindura', 'OK Bindura', 'Lot 1, Thurlows Paddock / 15 Main St (see notes), Bindura, OK site lists Lot 1 Thurlows Paddock', -17.3, 31.333, 'customer', 'Zimbabwe', true),
('OK Mabelreign', 'OK Mabelreign', 'Stand 386 Mabelreign, Harare', -17.798, 30.996, 'customer', 'Zimbabwe', true),
('OKmart Chiremba Rd', 'OKmart Chiremba Rd', '268 Chiremba Rd, Cranborne, Harare', -17.865, 31.075, 'customer', 'Zimbabwe', true),
('Pick n Pay Arundel', 'Pick n Pay Arundel', 'Shop 31, Arundel Shopping Complex, Quorn Ave, Mt Pleasant, Harare', -17.785, 31.05, 'customer', 'Zimbabwe', true),
('Pro Tyre Harare', 'Pro Tyre Harare', '8 Portland Rd, Harare, Zimbabwe', -17.85732549, 30.99965629, 'service_center', 'Zimbabwe', true),
('Pulse Diesel Depot Truck Stop', 'Pulse Diesel Depot Truck Stop', 'Pulse Diesel Depot Truck Stop', -22.36156889, 30.03178806, 'truck_stop', 'Zimbabwe', true),
('Red Range Filling Station', 'Red Range Filling Station', '8 Wingrove Rd, Bulawayo, Zimbabwe', -20.1464108, 28.5714421, 'truck_stop', 'Zimbabwe', true),
('Rezende Depot', 'Rezende Depot', '1 Abercorn Street. Harare, Zimbabwe', -17.83969405, 31.04586039, 'depot', 'Zimbabwe', true),
('Rock Chemical Fillers Pvt Ltd', 'Rock Chemical Fillers Pvt Ltd', '19 Seke Rd, Harare, Zimbabwe', -17.8743961, 31.0661186, 'customer', 'Zimbabwe', true),
('Rusape Tollgate', 'RTG', 'R5 Makoni Manicaland Zimbabwe', -18.407712, 32.145355, 'toll_gate', 'Zimbabwe', true),
('Sai Mart Longcheng', 'Sai Mart Longcheng', 'Longcheng Plaza, Belvedere, Harare', -17.843, 31, 'customer', 'Zimbabwe', true),
('Selbourne', 'Selbourne', 'FM95+RQG, Honde Valley, Zimbabwe', -18.5304375, 32.6594531, 'other', 'Zimbabwe', true),
('SPAR Bridge (Groombridge)', 'SPAR Bridge (Groombridge)', '216 The Chase, Mt Pleasant, Harare', -17.781, 31.06, 'customer', 'Zimbabwe', true),
('SPAR Greencroft', 'SPAR Greencroft', '13 Lomagundi Rd, Greencroft, Harare', -17.785, 31.014, 'customer', 'Zimbabwe', true),
('SPAR The Village (Bridge Spar)', 'SPAR The Village (Bridge Spar)', '216 The Chase, Groombridge, Harare', -17.781, 31.06, 'customer', 'Zimbabwe', true),
('Skyline Tollgate', 'STG', 'Simon Mazorodze Road Harare Zimbabwe', -17.969929, 30.969888, 'toll_gate', 'Zimbabwe', true),
('Sunray Corporation', 'Sunray Corporation', '36 Douglas Rd, Harare, Zimbabwe', -17.8517241, 31.0092068, 'customer', 'Zimbabwe', true),
('Tarondale Pack house', 'Tarondale', 'RQFR+29, Junction Gate, Zimbabwe', -20.1773524, 32.7909666, 'customer', 'Zimbabwe', true),
('TM Pick n Pay Kadoma', 'TM Pick n Pay Kadoma', 'Hebert Chitepo St, Kadoma', -18.333, 29.915, 'customer', 'Zimbabwe', true),
('TM Pick n Pay Msasa', 'TM Pick n Pay Msasa', 'Loreley Crescent, Msasa, Harare', -17.818, 31.121, 'customer', 'Zimbabwe', true),
('Willowton', 'Willowton', '6 Durban Rd, Mutare, Zimbabwe', -18.99767778, 32.65295316, 'customer', 'Zimbabwe', true),
('Zimbabwe Phosphate Industries -Zimphos', 'Zimphos', 'Unnamed Road, Harare, Zimbabwe', -17.8521763, 31.1325613, 'customer', 'Zimbabwe', true),

-- Botswana locations
('Kazungula', 'Kazungula Border', 'Kazungula, Zambia', -17.7806088, 25.2778317, 'border_post', 'Botswana', true),
('Kazungula Border, Botswana', 'Kazungula Border, Botswana', 'Botswana', -17.79990276, 25.25746578, 'border_post', 'Botswana', true),
('Kazungula BW Truck In, Botswana', 'Kazungula BW Truck In', '6725+RR Kasane, Botswana', -17.79795813, 25.25952239, 'border_post', 'Botswana', true),
('Kwa Nokeng - Kazungula', 'Kwa Nokeng - Kazungula', 'Kwa nokeng oil', -17.80051031, 25.24082725, 'truck_stop', 'Botswana', true),
('Kwa Nokeng Martinsdrift', 'Kwa Nokeng Martinsdrift', 'Kwa Nokeng Martinsdrift', -22.9962159, 27.93502625, 'truck_stop', 'Botswana', true),
('Tlokweng Border, Botswana', 'Tlokweng Border, Botswana', 'Botswana', -24.70252478, 26.08877313, 'border_post', 'Botswana', true),

-- DRC locations
('Kasumbalesa Border Post', 'Kasumbalesa Border Post', 'Kasumbalesa, Democratic Republic of the Congo', -12.26650463, 27.79599542, 'border_post', 'DRC', true),
('Kasumbalesa Truck Stop Zambia Border', 'Kasumbalesa Truck Stop Zambia Border', 'PQPW+JMJ, Kasumbalesa, Congo - Kinshasa', -12.26405984, 27.79728203, 'truck_stop', 'DRC', true),
('Karan Kolwezi 1', 'KK1', 'Kolwezi DRC', -10.6915744, 25.5234205, 'customer', 'DRC', true),

-- Namibia locations
('Windhoek', 'Windhoek', 'Windhoek, Namibia', -22.5649344, 17.0842147, 'other', 'Namibia', true);

-- Mark commonly used locations as favorites
UPDATE public.predefined_locations
SET is_favorite = true
WHERE short_code IN (
  'Harare', 'HTS', 'JHB', 'CPT', 'BYO Depot', 'Mutare Depot',
  'BSB', 'BZB', 'CBP', 'Lusaka', 'ATP', 'GTS'
);

-- Update amenities for truck stops
UPDATE public.predefined_locations
SET
  has_parking = true,
  has_fuel = true,
  has_restaurant = true
WHERE location_type = 'truck_stop';

-- Update amenities for border posts
UPDATE public.predefined_locations
SET has_parking = true
WHERE location_type = 'border_post';

-- Add notes for key locations
UPDATE public.predefined_locations
SET notes = 'Major truck stop with full amenities - parking, fuel, food, rest facilities'
WHERE location_type = 'truck_stop' AND is_favorite = true;

UPDATE public.predefined_locations
SET notes = 'Border crossing - allow extra time for customs and immigration'
WHERE location_type = 'border_post';

UPDATE public.predefined_locations
SET notes = 'Toll gate - ensure toll payment method available'
WHERE location_type = 'toll_gate';

-- Statistics
DO $$
DECLARE
  total_count INTEGER;
  by_country RECORD;
  by_type RECORD;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.predefined_locations;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PREDEFINED LOCATIONS IMPORT COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total locations imported: %', total_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Locations by country:';

  FOR by_country IN
    SELECT country, COUNT(*) as count
    FROM public.predefined_locations
    GROUP BY country
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  % - % locations', by_country.country, by_country.count;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Locations by type:';

  FOR by_type IN
    SELECT location_type, COUNT(*) as count
    FROM public.predefined_locations
    GROUP BY location_type
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  % - % locations', by_type.location_type, by_type.count;
  END LOOP;

  RAISE NOTICE '========================================';
END $$;
