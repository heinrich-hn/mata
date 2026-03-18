// src/integrations/wialon/useWialonContext.ts
import { useContext } from 'react';
import { WialonContext } from './WialonContext';
import { UseWialonResult } from './useWialon';

export const useWialonContext = (): UseWialonResult => {
  const context = useContext(WialonContext);

  if (context === undefined) {
    throw new Error('useWialonContext must be used within a WialonProvider');
  }

  return context;
};