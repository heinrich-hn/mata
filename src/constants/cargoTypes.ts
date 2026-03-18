// Cargo type constants for trip management

export const CARGO_TYPES = [
    // General
    'General Cargo',
    'General Goods',
    'Mixed Goods',

    // Temperature Controlled
    'Refrigerated',
    'Perishables',
    'Frozen Foods',
    'Dairy Products',

    // Hazardous & Special
    'Hazardous Materials',
    'Oversized',

    // Bulk & Containers
    'Bulk',
    'Containers',
    'Empty Crates',
    'Chep Crates',
    'Bins',
    'Bines and Crates',

    // Vehicles & Equipment
    'Vehicles',

    // Agricultural
    'Livestock',
    'Fertilizer',
    'Hay',
    'Grains',
    'Cereals',
    'Timber',
    'Logs',
    'Wood Chips',

    // Construction
    'Construction Materials',
    'Pipes',

    // Electronics
    'Electronics',

    // Fruits
    'Fruits',
    'Bananas',
    'Apples',
    'Citrus',
    'Avocados',
    'Mangoes',
    'Berries',
    'Grapes',

    // Vegetables
    'Vegetables',
    'Potatoes',
    'Onions',
    'Tomatoes',
    'Lettuce',

    // Other Perishables
    'Flowers',
    'Eggs',
    'Seafood',

    // Other
    'Other',
] as const;

export type CargoType = typeof CARGO_TYPES[number];
