// Fleet-specific tyre position configurations

export interface FleetTyrePosition {
  position: string;
  label: string;
  axle?: string;
}

export interface FleetConfig {
  fleetNumber: string;
  fleetType: 'horse' | 'trailer' | 'reefer';
  tableName: string;
  positions: FleetTyrePosition[];
}

export const FLEET_CONFIGURATIONS: Record<string, FleetConfig> = {
  // 33H-type horse fleets (V1-V10 + SP)
  '33H': {
    fleetNumber: '33H',
    fleetType: 'horse',
    tableName: 'fleet_33h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '34H': {
    fleetNumber: '34H',
    fleetType: 'horse',
    tableName: 'fleet_34h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '21H': {
    fleetNumber: '21H',
    fleetType: 'horse',
    tableName: 'fleet_21h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '22H': {
    fleetNumber: '22H',
    fleetType: 'horse',
    tableName: 'fleet_22h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '23H': {
    fleetNumber: '23H',
    fleetType: 'horse',
    tableName: 'fleet_23h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '24H': {
    fleetNumber: '24H',
    fleetType: 'horse',
    tableName: 'fleet_24h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '26H': {
    fleetNumber: '26H',
    fleetType: 'horse',
    tableName: 'fleet_26h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '28H': {
    fleetNumber: '28H',
    fleetType: 'horse',
    tableName: 'fleet_28h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '29H': {
    fleetNumber: '29H',
    fleetType: 'horse',
    tableName: 'fleet_29h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '30H': {
    fleetNumber: '30H',
    fleetType: 'horse',
    tableName: 'fleet_30h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '31H': {
    fleetNumber: '31H',
    fleetType: 'horse',
    tableName: 'fleet_31h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '32H': {
    fleetNumber: '32H',
    fleetType: 'horse',
    tableName: 'fleet_32h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  // 6H-type horse fleets (V1-V6 + SP)
  '1H': {
    fleetNumber: '1H',
    fleetType: 'horse',
    tableName: 'fleet_1h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left Outer', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Left Inner', axle: 'Rear' },
      { position: 'V5', label: 'V5 - Rear Right Inner', axle: 'Rear' },
      { position: 'V6', label: 'V6 - Rear Right Outer', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '4H': {
    fleetNumber: '4H',
    fleetType: 'horse',
    tableName: 'fleet_4h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left Outer', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Left Inner', axle: 'Rear' },
      { position: 'V5', label: 'V5 - Rear Right Inner', axle: 'Rear' },
      { position: 'V6', label: 'V6 - Rear Right Outer', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '6H': {
    fleetNumber: '6H',
    fleetType: 'horse',
    tableName: 'fleet_6h_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left Outer', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Left Inner', axle: 'Rear' },
      { position: 'V5', label: 'V5 - Rear Right Inner', axle: 'Rear' },
      { position: 'V6', label: 'V6 - Rear Right Outer', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  'UD': {
    fleetNumber: 'UD',
    fleetType: 'horse',
    tableName: 'fleet_ud_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left Outer', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Left Inner', axle: 'Rear' },
      { position: 'V5', label: 'V5 - Rear Right Inner', axle: 'Rear' },
      { position: 'V6', label: 'V6 - Rear Right Outer', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '14L': {
    fleetNumber: '14L',
    fleetType: 'horse',
    tableName: 'fleet_14l_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Right', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '15L': {
    fleetNumber: '15L',
    fleetType: 'horse',
    tableName: 'fleet_15l_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Right', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '16L': {
    fleetNumber: '16L',
    fleetType: 'horse',
    tableName: 'fleet_16l_tyres',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Right', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  // Interlink trailer fleets (T1-T16 + SP)
  '1T': {
    fleetNumber: '1T',
    fleetType: 'trailer',
    tableName: 'fleet_1t_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left Outer', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Left Inner', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 1 Right Inner', axle: 'Axle 1' },
      { position: 'T4', label: 'T4 - Axle 1 Right Outer', axle: 'Axle 1' },
      { position: 'T5', label: 'T5 - Axle 2 Left Outer', axle: 'Axle 2' },
      { position: 'T6', label: 'T6 - Axle 2 Left Inner', axle: 'Axle 2' },
      { position: 'T7', label: 'T7 - Axle 2 Right Inner', axle: 'Axle 2' },
      { position: 'T8', label: 'T8 - Axle 2 Right Outer', axle: 'Axle 2' },
      { position: 'T9', label: 'T9 - Axle 3 Left Outer', axle: 'Axle 3' },
      { position: 'T10', label: 'T10 - Axle 3 Left Inner', axle: 'Axle 3' },
      { position: 'T11', label: 'T11 - Axle 3 Right Inner', axle: 'Axle 3' },
      { position: 'T12', label: 'T12 - Axle 3 Right Outer', axle: 'Axle 3' },
      { position: 'T13', label: 'T13 - Axle 4 Left Outer', axle: 'Axle 4' },
      { position: 'T14', label: 'T14 - Axle 4 Left Inner', axle: 'Axle 4' },
      { position: 'T15', label: 'T15 - Axle 4 Right Inner', axle: 'Axle 4' },
      { position: 'T16', label: 'T16 - Axle 4 Right Outer', axle: 'Axle 4' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '2T': {
    fleetNumber: '2T',
    fleetType: 'trailer',
    tableName: 'fleet_2t_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left Outer', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Left Inner', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 1 Right Inner', axle: 'Axle 1' },
      { position: 'T4', label: 'T4 - Axle 1 Right Outer', axle: 'Axle 1' },
      { position: 'T5', label: 'T5 - Axle 2 Left Outer', axle: 'Axle 2' },
      { position: 'T6', label: 'T6 - Axle 2 Left Inner', axle: 'Axle 2' },
      { position: 'T7', label: 'T7 - Axle 2 Right Inner', axle: 'Axle 2' },
      { position: 'T8', label: 'T8 - Axle 2 Right Outer', axle: 'Axle 2' },
      { position: 'T9', label: 'T9 - Axle 3 Left Outer', axle: 'Axle 3' },
      { position: 'T10', label: 'T10 - Axle 3 Left Inner', axle: 'Axle 3' },
      { position: 'T11', label: 'T11 - Axle 3 Right Inner', axle: 'Axle 3' },
      { position: 'T12', label: 'T12 - Axle 3 Right Outer', axle: 'Axle 3' },
      { position: 'T13', label: 'T13 - Axle 4 Left Outer', axle: 'Axle 4' },
      { position: 'T14', label: 'T14 - Axle 4 Left Inner', axle: 'Axle 4' },
      { position: 'T15', label: 'T15 - Axle 4 Right Inner', axle: 'Axle 4' },
      { position: 'T16', label: 'T16 - Axle 4 Right Outer', axle: 'Axle 4' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '3T': {
    fleetNumber: '3T',
    fleetType: 'trailer',
    tableName: 'fleet_3t_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left Outer', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Left Inner', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 1 Right Inner', axle: 'Axle 1' },
      { position: 'T4', label: 'T4 - Axle 1 Right Outer', axle: 'Axle 1' },
      { position: 'T5', label: 'T5 - Axle 2 Left Outer', axle: 'Axle 2' },
      { position: 'T6', label: 'T6 - Axle 2 Left Inner', axle: 'Axle 2' },
      { position: 'T7', label: 'T7 - Axle 2 Right Inner', axle: 'Axle 2' },
      { position: 'T8', label: 'T8 - Axle 2 Right Outer', axle: 'Axle 2' },
      { position: 'T9', label: 'T9 - Axle 3 Left Outer', axle: 'Axle 3' },
      { position: 'T10', label: 'T10 - Axle 3 Left Inner', axle: 'Axle 3' },
      { position: 'T11', label: 'T11 - Axle 3 Right Inner', axle: 'Axle 3' },
      { position: 'T12', label: 'T12 - Axle 3 Right Outer', axle: 'Axle 3' },
      { position: 'T13', label: 'T13 - Axle 4 Left Outer', axle: 'Axle 4' },
      { position: 'T14', label: 'T14 - Axle 4 Left Inner', axle: 'Axle 4' },
      { position: 'T15', label: 'T15 - Axle 4 Right Inner', axle: 'Axle 4' },
      { position: 'T16', label: 'T16 - Axle 4 Right Outer', axle: 'Axle 4' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '4T': {
    fleetNumber: '4T',
    fleetType: 'trailer',
    tableName: 'fleet_4t_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left Outer', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Left Inner', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 1 Right Inner', axle: 'Axle 1' },
      { position: 'T4', label: 'T4 - Axle 1 Right Outer', axle: 'Axle 1' },
      { position: 'T5', label: 'T5 - Axle 2 Left Outer', axle: 'Axle 2' },
      { position: 'T6', label: 'T6 - Axle 2 Left Inner', axle: 'Axle 2' },
      { position: 'T7', label: 'T7 - Axle 2 Right Inner', axle: 'Axle 2' },
      { position: 'T8', label: 'T8 - Axle 2 Right Outer', axle: 'Axle 2' },
      { position: 'T9', label: 'T9 - Axle 3 Left Outer', axle: 'Axle 3' },
      { position: 'T10', label: 'T10 - Axle 3 Left Inner', axle: 'Axle 3' },
      { position: 'T11', label: 'T11 - Axle 3 Right Inner', axle: 'Axle 3' },
      { position: 'T12', label: 'T12 - Axle 3 Right Outer', axle: 'Axle 3' },
      { position: 'T13', label: 'T13 - Axle 4 Left Outer', axle: 'Axle 4' },
      { position: 'T14', label: 'T14 - Axle 4 Left Inner', axle: 'Axle 4' },
      { position: 'T15', label: 'T15 - Axle 4 Right Inner', axle: 'Axle 4' },
      { position: 'T16', label: 'T16 - Axle 4 Right Outer', axle: 'Axle 4' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  
  // Reefer Trailer Fleets - Super Single configuration (T1-T6 + SP)
  // 3 axles × 2 tyres (Left/Right) per axle
  '4F': {
    fleetNumber: '4F',
    fleetType: 'reefer',
    tableName: 'fleet_4f_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Right', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 2 Left', axle: 'Axle 2' },
      { position: 'T4', label: 'T4 - Axle 2 Right', axle: 'Axle 2' },
      { position: 'T5', label: 'T5 - Axle 3 Left', axle: 'Axle 3' },
      { position: 'T6', label: 'T6 - Axle 3 Right', axle: 'Axle 3' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '5F': {
    fleetNumber: '5F',
    fleetType: 'reefer',
    tableName: 'fleet_5f_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Right', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 2 Left', axle: 'Axle 2' },
      { position: 'T4', label: 'T4 - Axle 2 Right', axle: 'Axle 2' },
      { position: 'T5', label: 'T5 - Axle 3 Left', axle: 'Axle 3' },
      { position: 'T6', label: 'T6 - Axle 3 Right', axle: 'Axle 3' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '6F': {
    fleetNumber: '6F',
    fleetType: 'reefer',
    tableName: 'fleet_6f_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Right', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 2 Left', axle: 'Axle 2' },
      { position: 'T4', label: 'T4 - Axle 2 Right', axle: 'Axle 2' },
      { position: 'T5', label: 'T5 - Axle 3 Left', axle: 'Axle 3' },
      { position: 'T6', label: 'T6 - Axle 3 Right', axle: 'Axle 3' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '7F': {
    fleetNumber: '7F',
    fleetType: 'reefer',
    tableName: 'fleet_7f_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Right', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 2 Left', axle: 'Axle 2' },
      { position: 'T4', label: 'T4 - Axle 2 Right', axle: 'Axle 2' },
      { position: 'T5', label: 'T5 - Axle 3 Left', axle: 'Axle 3' },
      { position: 'T6', label: 'T6 - Axle 3 Right', axle: 'Axle 3' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '8F': {
    fleetNumber: '8F',
    fleetType: 'reefer',
    tableName: 'fleet_8f_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Right', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 2 Left', axle: 'Axle 2' },
      { position: 'T4', label: 'T4 - Axle 2 Right', axle: 'Axle 2' },
      { position: 'T5', label: 'T5 - Axle 3 Left', axle: 'Axle 3' },
      { position: 'T6', label: 'T6 - Axle 3 Right', axle: 'Axle 3' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  '9F': {
    fleetNumber: '9F',
    fleetType: 'reefer',
    tableName: 'fleet_9f_tyres',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Right', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 2 Left', axle: 'Axle 2' },
      { position: 'T4', label: 'T4 - Axle 2 Right', axle: 'Axle 2' },
      { position: 'T5', label: 'T5 - Axle 3 Left', axle: 'Axle 3' },
      { position: 'T6', label: 'T6 - Axle 3 Right', axle: 'Axle 3' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
};

/**
 * Get fleet configuration based on registration number or fleet number
 */
export function getFleetConfig(identifier: string): FleetConfig | null {
  // First, try to extract fleet number from registration (e.g., "33H JFK963FS" -> "33H")
  const fleetMatch = identifier.match(/^(\d+[A-Z]+)/);
  const fleetNumber = fleetMatch ? fleetMatch[1] : identifier;
  
  return FLEET_CONFIGURATIONS[fleetNumber] || null;
}

/**
 * Extract registration number without fleet prefix
 */
export function extractRegistrationNumber(fullRegistration: string): string {
  // Remove fleet prefix (e.g., "33H JFK963FS" -> "JFK963FS")
  return fullRegistration.replace(/^\d+[A-Z]+\s+/, '');
}

/**
 * Get fleet number from full registration
 */
export function extractFleetNumber(fullRegistration: string): string | null {
  const match = fullRegistration.match(/^(\d+[A-Z]+)/);
  return match ? match[1] : null;
}