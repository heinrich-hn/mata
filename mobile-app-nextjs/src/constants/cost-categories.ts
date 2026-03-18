// Cost categories and types for trip cost management
// Mirrors the dashboard app's cost categories for consistency

export const COST_CATEGORIES = {
  'Border Costs': [
    'Beitbridge Border Fee', 'Gate Pass', 'Coupon', 'Carbon Tax Horse', 'CVG Horse', 'CVG Trailer',
    'Insurance (1 Month Horse)', 'Insurance (3 Months Trailer)', 'Insurance (2 Months Trailer)',
    'Insurance (1 Month Trailer)', 'Carbon Tax (3 Months Horse)', 'Carbon Tax (2 Months Horse)',
    'Carbon Tax (1 Month Horse)', 'Carbon Tax (3 Months Trailer)', 'Carbon Tax (2 Months Trailer)',
    'Carbon Tax (1 Month Trailer)', 'Road Access', 'Bridge Fee', 'Road Toll Fee', 'Counseling Leavy',
    'Transit Permit Horse', 'Transit Permit Trailer', 'National Road Safety Fund Horse',
    'National Road Safety Fund Trailer', 'Electronic Seal', 'EME Permit', 'Zim Clearing',
    'Zim Supervision', 'SA Clearing', 'Runner Fee Beitbridge', 'Runner Fee Zambia Kazungula',
    'Runner Fee Chirundu'
  ],
  'Parking': [
    'Bubi', 'Lunde', 'Mvuma', 'Gweru', 'Kadoma', 'Chegutu', 'Norton', 'Harare', 'Ruwa',
    'Marondera', 'Rusape', 'Mutare', 'Nyanga', 'Bindura', 'Shamva', 'Centenary', 'Guruve',
    'Karoi', 'Chinhoyi', 'Kariba', 'Hwange', 'Victoria Falls', 'Bulawayo', 'Gwanda',
    'Beitbridge', 'Masvingo', 'Zvishavane', 'Shurugwi', 'Kwekwe'
  ],
  'Diesel': [
    'ACM Petroleum Chirundu - Reefer', 'ACM Petroleum Chirundu - Horse', 'RAM Petroleum Harare - Reefer',
    'RAM Petroleum Harare - Horse', 'Engen Beitbridge - Reefer', 'Engen Beitbridge - Horse',
    'Shell Mutare - Reefer', 'Shell Mutare - Horse', 'BP Bulawayo - Reefer', 'BP Bulawayo - Horse',
    'Total Gweru - Reefer', 'Total Gweru - Horse', 'Puma Masvingo - Reefer', 'Puma Masvingo - Horse',
    'Zuva Petroleum Kadoma - Reefer', 'Zuva Petroleum Kadoma - Horse', 'Mobil Chinhoyi - Reefer',
    'Mobil Chinhoyi - Horse', 'Caltex Kwekwe - Reefer', 'Caltex Kwekwe - Horse'
  ],
  'Non-Value-Added Costs': [
    'Fines', 'Penalties', 'Passport Stamping', 'Push Documents', 'Jump Queue', 'Dismiss Inspection',
    'Parcels', 'Labour'
  ],
  'Trip Allowances': ['Food', 'Airtime', 'Taxi'],
  'Tolls': [
    'Tolls BB to JHB', 'Tolls Cape Town to JHB', 'Tolls JHB to CPT', 'Tolls Mutare to BB',
    'Tolls JHB to Martinsdrift', 'Tolls BB to Harare', 'Tolls Zambia'
  ],
} as const;

// High-risk categories that auto-flag for review
export const HIGH_RISK_CATEGORIES = ['Non-Value-Added Costs', 'Border Costs'] as const;

// Currency options
export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'ZAR', label: 'ZAR (R)', symbol: 'R' },
] as const;

// Type helpers
export type CostCategory = keyof typeof COST_CATEGORIES;
export type Currency = typeof CURRENCY_OPTIONS[number]['value'];