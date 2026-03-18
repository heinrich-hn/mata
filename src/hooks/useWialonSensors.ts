import { supabase } from '@/integrations/supabase/client'; // Ensure this is a runtime import
import { useWialonContext } from '@/integrations/wialon/useWialonContext';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

/**
 * Wialon Sensor Types
 * Reference: Wialon SDK documentation
 */
export interface WialonSensor {
  id: string;           // Sensor ID
  n: string;            // Sensor name
  t: string;            // Sensor type (temperature, fuel, ignition, mileage, etc.)
  d: string;            // Description
  m: string;            // Measurement unit (%, km, °C, etc.)
  p: string;            // Parameter (sensor reads from)
  f: number;            // Flags
  c: string;            // Calculation formula/table
  vs: number;           // Validation type
  tbl?: Array<{        // Calibration table (for fuel sensors, etc.)
    x: number;          // Input value
    y: number;          // Output value
  }>;
}

export interface SensorValue {
  sensorId: string;
  sensorName: string;
  sensorType: string;
  value: number | string;
  formattedValue: string;
  unit: string;
  timestamp: Date;
  isValid: boolean;
  rawValue?: number;
}

interface LastMessage {
  t: number;
  pos: {
    y: number;
    x: number;
    z?: number;
    s: number;
    c: number;
    sc?: number;
  };
  p: Record<string, unknown>;
}

interface UseWialonSensorsOptions {
  unitId?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  useUniqueId?: boolean; // Set to true if unitId is unique_id (IMEI) instead of internal id
}

const INVALID_SENSOR_VALUE = -348201.3876; // Wialon's magic number for N/A

/**
 * Hook for managing Wialon unit sensors
 *
 * @param options.unitId - The Wialon unit ID to fetch sensors for
 * @param options.useUniqueId - If true, treats unitId as IMEI/unique_id; if false (default), treats as internal Wialon ID
 * @param options.autoRefresh - Enable automatic refresh of sensor data
 * @param options.refreshInterval - Refresh interval in milliseconds (default: 30000)
 *
 * @example
 * // Using internal Wialon ID (from wialon_vehicles.wialon_unit_id)
 * const { sensorValues } = useWialonSensors({ unitId: 600695231 }); // For vehicle "29H - AGJ 3466"
 *
 * @example
 * // Using IMEI/unique ID
 * const { sensorValues } = useWialonSensors({
 *   unitId: 123456789012345,
 *   useUniqueId: true
 * });
 *
 * @note If you get "No unit found" warnings, check:
 * 1. The unit exists in Wialon and is accessible
 * 2. You're using the correct ID type (internal vs IMEI)
 * 3. The wialon_vehicles table has the correct wialon_unit_id mapping
 */
export const useWialonSensors = (options: UseWialonSensorsOptions = {}) => {
  const { unitId, autoRefresh = false, refreshInterval = 30000, useUniqueId = false } = options;
  const { isConnected, callAPI } = useWialonContext();

  // Fetch available units from wialon_vehicles table
  const { data: units = [], isLoading: unitsLoading, refetch: refetchUnits } = useQuery({
    queryKey: ['wialon-units-for-sensors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wialon_vehicles')
        .select('id, wialon_unit_id, name, registration')
        .order('name');

      if (error) throw error;

      return data.map(v => ({
        id: v.wialon_unit_id,
        name: v.name || v.registration || `Unit ${v.wialon_unit_id}`,
        registration: v.registration,
      }));
    },
  });

  // Fetch unit with sensors and last message
  const { data: unitData, isLoading: sensorsLoading, error: sensorsError, refetch: refetchSensors } = useQuery({
    queryKey: ['wialon-unit-sensors', unitId, isConnected],
    queryFn: async () => {
      if (!unitId || !isConnected) return null;

      console.log(`Fetching unit and sensors for ID: ${unitId}`);

      try {
        const updateResult = await callAPI('core/update_data_flags', {
          spec: [
            {
              type: 'type',
              data: 'avl_unit',
              flags: 0x0001 | 0x1000 | 0x0400, // BASE + SENSORS + LAST_MESSAGE
              mode: 0, // 0 = set flags, 1 = add flags
            }
          ]
        });

        console.log('Data flags updated:', updateResult);

        // Search for the specific unit to get it into the session
        const searchResult = await callAPI('core/search_items', {
          spec: {
            itemsType: 'avl_unit',
            propName: useUniqueId ? 'sys_unique_id' : 'sys_id',
            propValueMask: String(unitId),
            sortType: 'sys_name',
          },
          force: 1,
          flags: 0x0001 | 0x1000 | 0x0400, // BASE + SENSORS + LAST_MESSAGE
          from: 0,
          to: 0,
        }) as {
          items: Array<{
            id: number;
            nm: string;
            sens?: Record<string, WialonSensor>;
            lmsg?: LastMessage;
          }>;
        };

        if (!searchResult.items || searchResult.items.length === 0) {
          console.warn(
            `⚠️ No Wialon unit found with ${useUniqueId ? 'unique ID (IMEI)' : 'internal ID'}: ${unitId}`,
            useUniqueId
              ? '\nTip: Try without useUniqueId option to search by internal Wialon ID'
              : '\nTip: Try with useUniqueId: true option to search by IMEI/unique ID'
          );
          return { sensors: [], lastMessage: null, unitName: null, unitId: null };
        }

        const unit = searchResult.items[0];
        const sensors = Object.values(unit.sens || {});
        const lastMessage = unit.lmsg || null;

        console.log(`✓ Found unit "${unit.nm}" (ID: ${unit.id}) with ${sensors.length} sensors`);

        return { sensors, lastMessage, unitName: unit.nm, unitId: unit.id };
      } catch (err) {
        console.error('❌ Unit fetch error:', err);
        throw err;
      }
    },
    enabled: !!unitId && isConnected,
    retry: 2,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchOnWindowFocus: false,
  });

  /**
   * Calculate sensor value from last message
   * Mimics Wialon's unit.calculateSensorValue()
   */
  const calculateSensorValue = useCallback(
    (sensor: WialonSensor): SensorValue => {
      const defaultValue: SensorValue = {
        sensorId: sensor.id.toString(),
        sensorName: sensor.n,
        sensorType: sensor.t,
        value: 'N/A',
        formattedValue: 'N/A',
        unit: sensor.m,
        timestamp: new Date(),
        isValid: false,
      };

      const message = unitData?.lastMessage ?? null;
      if (!message || !message.p) {
        return defaultValue;
      }

      try {
        const rawValue = message.p[sensor.p];
        if (rawValue === undefined || rawValue === null) {
          return defaultValue;
        }

        const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);

        if (numericValue === INVALID_SENSOR_VALUE || isNaN(numericValue)) {
          return defaultValue;
        }

        let calculatedValue = numericValue;
        if (sensor.tbl && sensor.tbl.length > 0) {
          calculatedValue = interpolateFromTable(numericValue, sensor.tbl);
        }

        const formattedValue = formatSensorValue(calculatedValue, sensor.t, sensor.m);

        return {
          sensorId: sensor.id.toString(),
          sensorName: sensor.n,
          sensorType: sensor.t,
          value: calculatedValue,
          formattedValue,
          unit: sensor.m,
          timestamp: new Date(message.t * 1000),
          isValid: true,
          rawValue: numericValue,
        };
      } catch (err) {
        console.error('Sensor calculation error:', err);
        return defaultValue;
      }
    },
    [unitData?.lastMessage]
  );

  /**
   * Get all sensor values for current unit
   */
  const sensorValues = useMemo(() => {
    if (!unitData?.sensors || unitData.sensors.length === 0) {
      return [];
    }

    return unitData.sensors.map(sensor => calculateSensorValue(sensor));
  }, [unitData?.sensors, calculateSensorValue]);

  /**
   * Get sensor value by ID
   */
  const getSensorValue = useCallback(
    (sensorId: string): SensorValue | undefined => {
      return sensorValues.find(sv => sv.sensorId === sensorId);
    },
    [sensorValues]
  );

  /**
   * Get sensors by type
   */
  const getSensorsByType = useCallback(
    (type: string): WialonSensor[] => {
      if (!unitData?.sensors) return [];
      return unitData.sensors.filter(s => s.t === type);
    },
    [unitData?.sensors]
  );

  return {
    // Connection state (from global context)
    isConnected,
    isLoading: unitsLoading || sensorsLoading,
    error: sensorsError instanceof Error ? sensorsError.message : null,

    // Data
    units,
    sensors: unitData?.sensors || [],
    sensorValues,
    lastMessage: unitData?.lastMessage,

    // Methods
    refetchSensors,
    refetchUnits,
    getSensorValue,
    getSensorsByType,
    calculateSensorValue,
  };
};

/**
 * Helper: Interpolate value from calibration table
 * Supports both linear formula (a,b coefficients) and direct lookup (x,y pairs)
 */
function interpolateFromTable(
  input: number,
  table: Array<{ x: number; a?: number; b?: number; y?: number }>
): number {
  if (table.length === 0) return input;

  // Validate input
  if (input === undefined || input === null || isNaN(input)) {
    console.warn('Invalid input to interpolateFromTable:', input);
    return 0;
  }

  try {
    // Sort table by x values
    const sortedTable = [...table].sort((a, b) => a.x - b.x);

    // Check if table uses linear formula (a, b coefficients) - typical for fuel sensors
    if (sortedTable[0].a !== undefined && sortedTable[0].b !== undefined) {
      // Find the appropriate segment based on input value
      for (let i = 0; i < sortedTable.length; i++) {
        const segment = sortedTable[i];

        // Check if this segment applies to our input
        // If it's the last segment or input is less than next segment's x
        if (i === sortedTable.length - 1 || input < sortedTable[i + 1].x) {
          // Apply linear formula: y = a * x + b
          const result = (segment.a! * input) + segment.b!;

          // Validate result
          if (isNaN(result) || !isFinite(result)) {
            console.warn('Invalid calibration result:', result, 'for input:', input, 'segment:', segment);
            return 0;
          }

          return result;
        }
      }
    }

    // Fallback to traditional x,y interpolation
    if (sortedTable[0].y !== undefined) {
      // Below minimum
      if (input <= sortedTable[0].x) {
        return sortedTable[0].y!;
      }

      // Above maximum
      if (input >= sortedTable[sortedTable.length - 1].x) {
        return sortedTable[sortedTable.length - 1].y!;
      }

      // Linear interpolation between points
      for (let i = 0; i < sortedTable.length - 1; i++) {
        const p1 = sortedTable[i];
        const p2 = sortedTable[i + 1];

        if (input >= p1.x && input <= p2.x) {
          const ratio = (input - p1.x) / (p2.x - p1.x);
          const result = p1.y! + ratio * (p2.y! - p1.y!);

          // Validate result
          if (isNaN(result) || !isFinite(result)) {
            console.warn('Invalid interpolation result:', result);
            return 0;
          }

          return result;
        }
      }
    }

    // No valid calibration found, return raw input
    return input;
  } catch (err) {
    console.error('Interpolation error:', err);
    return 0;
  }
}

/**
 * Format sensor value for display based on type
 */
function formatSensorValue(value: number, type: string, unit: string): string {
  // Safety check for undefined/null/NaN values
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }

  try {
    switch (type) {
      case 'fuel': // Fuel level
      case 'fuel consumption': // Fuel consumption rate
      case 'temperature': // Temperature
        return `${value.toFixed(1)} ${unit}`;

      case 'engine operation': // Engine hours
      case 'counter': // Counter (km, hours, etc.)
        return `${value.toFixed(2)} ${unit}`;

      case 'odometer': // Odometer
        return `${Math.round(value)} ${unit}`;

      case 'custom':
      case 'digital': // Digital sensors (binary)
        return value === 1 ? 'ON' : 'OFF';

      case 'voltage': // Voltage
        return `${value.toFixed(2)} V`;

      case 'percentage': // Percentage
        return `${value.toFixed(0)}%`;

      default:
        return `${value.toFixed(2)} ${unit}`;
    }
  } catch (err) {
    console.error('Format error:', err, 'value:', value);
    return 'N/A';
  }
}

export default useWialonSensors;