/**
 * Wialon Context
 * React context for Wialon state management
 */

import { createContext } from 'react';
import { UseWialonResult } from './useWialon';

export const WialonContext = createContext<UseWialonResult | undefined>(undefined);