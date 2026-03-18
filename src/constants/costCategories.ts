// Cost categories and types for trip cost management

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
    'Tolls JHB to Martinsdrift', 'Tolls BB to Harare', 'Tolls Zambia', 'Tolls BV to Bulawayo',
    'Tolls CBC to Bulawayo', 'Tolls BV to Harare', 'Tolls CBC to Harare'
  ],
  'System Costs': [
    'Repair & Maintenance per KM', 'Tyre Cost per KM', 'GIT Insurance', 'Short-Term Insurance',
    'Tracking Cost', 'Fleet Management System', 'Licensing', 'VID / Roadworthy', 'Wages', 'Depreciation'
  ]
} as const;

export const ADDITIONAL_COST_TYPES = [
  'Loading/Offloading Fees',
  'Storage Fees',
  'Cleaning Fees',
  'Escort Services',
  'Special Equipment Rental',
  'Emergency Response',
  'Cargo Handling',
  'Security Services',
  'Communication Costs',
  'Other',
] as const;

export interface SystemCostRates {
  currency: 'USD' | 'ZAR';
  perKmCosts: {
    repairMaintenance: number;
    tyreCost: number;
  };
  perDayCosts: {
    gitInsurance: number;
    shortTermInsurance: number;
    trackingCost: number;
    fleetManagementSystem: number;
    licensing: number;
    vidRoadworthy: number;
    wages: number;
    depreciation: number;
  };
  lastUpdated: string;
  updatedBy: string;
  effectiveDate: string;
}

export const DEFAULT_SYSTEM_COST_RATES: Record<'USD' | 'ZAR', SystemCostRates> = {
  USD: {
    currency: 'USD',
    perKmCosts: {
      repairMaintenance: 0.11,
      tyreCost: 0.03
    },
    perDayCosts: {
      gitInsurance: 10.21,
      shortTermInsurance: 7.58,
      trackingCost: 2.47,
      fleetManagementSystem: 1.34,
      licensing: 1.32,
      vidRoadworthy: 0.41,
      wages: 16.88,
      depreciation: 321.17
    },
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System Default',
    effectiveDate: new Date().toISOString()
  },
  ZAR: {
    currency: 'ZAR',
    perKmCosts: {
      repairMaintenance: 2.05,
      tyreCost: 0.64
    },
    perDayCosts: {
      gitInsurance: 134.82,
      shortTermInsurance: 181.52,
      trackingCost: 49.91,
      fleetManagementSystem: 23.02,
      licensing: 23.52,
      vidRoadworthy: 11.89,
      wages: 300.15,
      depreciation: 634.45
    },
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System Default',
    effectiveDate: new Date().toISOString()
  }
};