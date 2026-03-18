/**
 * QR Code Validation Utility
 * Validates and parses different QR code formats used in the application
 */

export type QRCodeType = 'vehicle' | 'tyre' | 'position' | 'unknown';

export interface QRValidationResult {
  isValid: boolean;
  type: QRCodeType;
  error?: string;
  data?: {
    vehicleId?: string;
    registration?: string;
    fleetNumber?: string;
    position?: string;
    tyreCode?: string;
    tin?: string;
  };
}

/**
 * Validates a QR code value and returns structured information
 */
export const validateQRCode = (qrValue: string): QRValidationResult => {
  if (!qrValue || typeof qrValue !== 'string') {
    return {
      isValid: false,
      type: 'unknown',
      error: 'QR code value is empty or invalid',
    };
  }

  // URL-based vehicle QR code validation
  if (qrValue.includes('/inspections/mobile')) {
    try {
      const url = new URL(qrValue);
      const vehicle = url.searchParams.get('vehicle');
      const registration = url.searchParams.get('registration');
      const fleetNumber = url.searchParams.get('fleetNumber');

      if (!vehicle) {
        return {
          isValid: false,
          type: 'vehicle',
          error: 'Missing vehicle parameter in URL',
        };
      }

      return {
        isValid: true,
        type: 'vehicle',
        data: {
          vehicleId: vehicle,
          registration: registration || undefined,
          fleetNumber: fleetNumber || undefined,
        },
      };
    } catch {
      return {
        isValid: false,
        type: 'unknown',
        error: 'Invalid URL format',
      };
    }
  }

  // Legacy vehicle QR format: "VEHICLE:FLEET-REG"
  if (qrValue.startsWith('VEHICLE:')) {
    const parts = qrValue.replace('VEHICLE:', '').split('-');
    if (parts.length === 2) {
      return {
        isValid: true,
        type: 'vehicle',
        data: {
          fleetNumber: parts[0],
          registration: parts[1],
        },
      };
    }
    return {
      isValid: false,
      type: 'vehicle',
      error: 'Invalid legacy vehicle QR format',
    };
  }

  // Position QR format (URL-based)
  if (qrValue.includes('/position/')) {
    try {
      const url = new URL(qrValue);
      const position = url.searchParams.get('position');
      const vehicle = url.searchParams.get('vehicle');

      if (!position || !vehicle) {
        return {
          isValid: false,
          type: 'position',
          error: 'Missing position or vehicle parameter',
        };
      }

      return {
        isValid: true,
        type: 'position',
        data: {
          position,
          vehicleId: vehicle,
        },
      };
    } catch {
      return {
        isValid: false,
        type: 'unknown',
        error: 'Invalid position QR URL format',
      };
    }
  }

  // Tyre QR format (TIN-based or direct code)
  if (qrValue.startsWith('TIN:') || qrValue.startsWith('TYRE:')) {
    const code = qrValue.replace(/^(TIN:|TYRE:)/, '');
    if (code.length > 0) {
      return {
        isValid: true,
        type: 'tyre',
        data: {
          tyreCode: code,
          tin: qrValue.startsWith('TIN:') ? code : undefined,
        },
      };
    }
    return {
      isValid: false,
      type: 'tyre',
      error: 'Invalid tyre code format',
    };
  }

  // Generic tyre code (alphanumeric)
  if (/^[A-Z0-9-]+$/.test(qrValue) && qrValue.length >= 4) {
    return {
      isValid: true,
      type: 'tyre',
      data: {
        tyreCode: qrValue,
      },
    };
  }

  return {
    isValid: false,
    type: 'unknown',
    error: 'Unrecognized QR code format',
  };
};

/**
 * Formats QR validation error for display
 */
export const formatQRError = (result: QRValidationResult): string => {
  if (result.isValid) return '';
  
  const baseError = result.error || 'Invalid QR code';
  return `${baseError}. Please scan a valid ${result.type !== 'unknown' ? result.type : ''} QR code or enter manually.`;
};