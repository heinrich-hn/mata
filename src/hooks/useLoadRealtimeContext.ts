// src/hooks/useLoadRealtimeContext.ts

import { LoadRealtimeContext } from '@/contexts/LoadRealtimeContext';
import { useContext } from 'react';

export const useLoadRealtimeContext = () => {
  const context = useContext(LoadRealtimeContext);
  if (!context) {
    throw new Error('useLoadRealtimeContext must be used within LoadRealtimeProvider');
  }
  return context;
};