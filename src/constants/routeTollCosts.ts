// Predefined route toll costs for automatic expense allocation
// These are the default values - actual values can be edited in the database

export interface RouteTollCost {
  route: string;
  toll_fee: number;
  currency: 'USD' | 'ZAR';
  description?: string;
}

// Default predefined routes with toll fees (in USD)
export const DEFAULT_ROUTE_TOLL_COSTS: RouteTollCost[] = [
  { route: 'CBC - BV', toll_fee: 15, currency: 'USD', description: 'Chirundu Border to Beitbridge' },
  { route: 'BV - HRE', toll_fee: 60, currency: 'USD', description: 'Beitbridge to Harare' },
  { route: 'CHIPINGE - HRE', toll_fee: 75, currency: 'USD', description: 'Chipinge to Harare' },
  { route: 'BV - BYO', toll_fee: 80, currency: 'USD', description: 'Beitbridge to Bulawayo' },
  { route: 'BYO - CBC', toll_fee: 60, currency: 'USD', description: 'Bulawayo to Chirundu Border' },
  { route: 'BYO - VICFALLS', toll_fee: 30, currency: 'USD', description: 'Bulawayo to Victoria Falls' },
  { route: 'BYO - BV', toll_fee: 75, currency: 'USD', description: 'Bulawayo to Beitbridge' },
  { route: 'CBC - BYO', toll_fee: 60, currency: 'USD', description: 'Chirundu Border to Bulawayo' },
  { route: 'HRE - NYANGA', toll_fee: 40, currency: 'USD', description: 'Harare to Nyanga' },
  { route: 'HRE - MARONDERA', toll_fee: 20, currency: 'USD', description: 'Harare to Marondera' },
];

// Helper function to format route display with toll fee
export const formatRouteWithToll = (route: string, tollFee: number, currency: string = 'USD'): string => {
  const symbol = currency === 'USD' ? '$' : 'R';
  return `${route} (${symbol}${tollFee})`;
};

// Category for toll expenses
export const TOLL_COST_CATEGORY = 'Tolls';
export const TOLL_COST_SUBCATEGORY = 'Route Toll Fee';