// Route Pre-defined Expenses Configuration
// Allows multiple expense types to be automatically suggested for specific routes

import { COST_CATEGORIES } from './costCategories';

export interface RouteExpense {
  id?: string;
  category: string;
  sub_category: string;
  amount: number;
  currency: string;
  description?: string;
  is_required: boolean; // Required expenses are auto-added, optional ones are suggestions
}

export interface RoutePredefinedExpenses {
  id?: string;
  route: string;
  description?: string;
  expenses: RouteExpense[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Get all available sub-categories for a category
export const getSubCategories = (category: string): string[] => {
  const categories = COST_CATEGORIES[category as keyof typeof COST_CATEGORIES];
  return categories ? [...categories] : [];
};

// Get all main categories
export const getMainCategories = (): string[] => {
  return Object.keys(COST_CATEGORIES);
};

// Default pre-defined expenses for common routes
export const DEFAULT_ROUTE_EXPENSES: RoutePredefinedExpenses[] = [
  {
    route: 'CBC - BV',
    description: 'Chirundu Border to Beitbridge via Harare',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 15, currency: 'USD', is_required: true },
      { category: 'Parking', sub_category: 'Harare', amount: 5, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'BV - HRE',
    description: 'Beitbridge to Harare',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 60, currency: 'USD', is_required: true },
      { category: 'Border Costs', sub_category: 'Beitbridge Border Fee', amount: 25, currency: 'USD', is_required: true },
      { category: 'Border Costs', sub_category: 'Gate Pass', amount: 10, currency: 'USD', is_required: false },
      { category: 'Parking', sub_category: 'Harare', amount: 5, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'HRE - BV',
    description: 'Harare to Beitbridge',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 60, currency: 'USD', is_required: true },
      { category: 'Parking', sub_category: 'Beitbridge', amount: 8, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'BV - BYO',
    description: 'Beitbridge to Bulawayo',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 80, currency: 'USD', is_required: true },
      { category: 'Border Costs', sub_category: 'Beitbridge Border Fee', amount: 25, currency: 'USD', is_required: true },
      { category: 'Parking', sub_category: 'Bulawayo', amount: 5, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'BYO - BV',
    description: 'Bulawayo to Beitbridge',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 75, currency: 'USD', is_required: true },
      { category: 'Parking', sub_category: 'Beitbridge', amount: 8, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'BYO - CBC',
    description: 'Bulawayo to Chirundu Border',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 60, currency: 'USD', is_required: true },
      { category: 'Parking', sub_category: 'Harare', amount: 5, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'CBC - BYO',
    description: 'Chirundu Border to Bulawayo',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 60, currency: 'USD', is_required: true },
      { category: 'Border Costs', sub_category: 'Road Access', amount: 15, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'HRE - MUTARE',
    description: 'Harare to Mutare',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 35, currency: 'USD', is_required: true },
      { category: 'Parking', sub_category: 'Mutare', amount: 5, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'MUTARE - HRE',
    description: 'Mutare to Harare',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 35, currency: 'USD', is_required: true },
      { category: 'Parking', sub_category: 'Harare', amount: 5, currency: 'USD', is_required: false },
    ],
  },
  {
    route: 'BYO - VICFALLS',
    description: 'Bulawayo to Victoria Falls',
    is_active: true,
    expenses: [
      { category: 'Tolls', sub_category: 'Route Toll Fee', amount: 30, currency: 'USD', is_required: true },
      { category: 'Parking', sub_category: 'Victoria Falls', amount: 10, currency: 'USD', is_required: false },
    ],
  },
];

// Helper to format currency display
export const formatExpenseAmount = (amount: number, currency: string): string => {
  const symbol = currency === 'USD' ? '$' : 'R';
  return `${symbol}${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Calculate total for required expenses
export const calculateRequiredTotal = (expenses: RouteExpense[]): { usd: number; zar: number } => {
  return expenses
    .filter((e) => e.is_required)
    .reduce(
      (acc, e) => {
        if (e.currency === 'USD') acc.usd += e.amount;
        else acc.zar += e.amount;
        return acc;
      },
      { usd: 0, zar: 0 }
    );
};

// Calculate total for all expenses (including optional)
export const calculateAllTotal = (expenses: RouteExpense[]): { usd: number; zar: number } => {
  return expenses.reduce(
    (acc, e) => {
      if (e.currency === 'USD') acc.usd += e.amount;
      else acc.zar += e.amount;
      return acc;
    },
    { usd: 0, zar: 0 }
  );
};

// Find route expenses by route name (case-insensitive)
export const findRouteExpenses = (route: string): RoutePredefinedExpenses | undefined => {
  return DEFAULT_ROUTE_EXPENSES.find(
    (r) => r.route.toUpperCase() === route.toUpperCase() && r.is_active
  );
};

// Get expense badge color based on category
export const getExpenseBadgeColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    'Tolls': 'bg-blue-100 text-blue-800 border-blue-200',
    'Border Costs': 'bg-amber-100 text-amber-800 border-amber-200',
    'Parking': 'bg-green-100 text-green-800 border-green-200',
    'Diesel': 'bg-red-100 text-red-800 border-red-200',
    'Non-Value-Added Costs': 'bg-orange-100 text-orange-800 border-orange-200',
    'Trip Allowances': 'bg-purple-100 text-purple-800 border-purple-200',
    'System Costs': 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colorMap[category] || 'bg-gray-100 text-gray-800 border-gray-200';
};