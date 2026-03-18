import React, { createContext, useCallback, useState } from 'react';

// Interface for updates
interface LoadUpdate {
  id: string;
  timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
}

// Define the context type
interface LoadRealtimeContextType {
  recentUpdates: LoadUpdate[];
  addUpdate: (update: LoadUpdate) => void;
  clearUpdates: () => void;
  getLoadUpdates: (loadId: string) => LoadUpdate[];
}

const LoadRealtimeContext = createContext<LoadRealtimeContextType | undefined>(undefined);

const MAX_UPDATES = 100; // Keep last 100 updates in memory

export const LoadRealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [recentUpdates, setRecentUpdates] = useState<LoadUpdate[]>([]);

  const addUpdate = useCallback((update: LoadUpdate) => {
    setRecentUpdates((prev) => {
      const newUpdates = [update, ...prev];
      // Keep only the most recent MAX_UPDATES
      return newUpdates.slice(0, MAX_UPDATES);
    });
  }, []);

  const clearUpdates = useCallback(() => {
    setRecentUpdates([]);
  }, []);

  const getLoadUpdates = useCallback(
    (loadId: string) => {
      return recentUpdates.filter((update) => update.id === loadId);
    },
    [recentUpdates]
  );

  return (
    <LoadRealtimeContext.Provider
      value={{
        recentUpdates,
        addUpdate,
        clearUpdates,
        getLoadUpdates,
      }}
    >
      {children}
    </LoadRealtimeContext.Provider>
  );
};

export { LoadRealtimeContext };