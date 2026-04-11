// src/integrations/wialon/WialonProvider.tsx
import '@/integrations/wialon/types'; // Window augmentation for wialon SDK
import { ReactNode, useEffect, useState } from 'react';
import { WialonContext } from './WialonContext';
import { useWialon } from './useWialon';

interface WialonProviderProps {
  children: ReactNode;
}

export const WialonProvider = ({ children }: WialonProviderProps) => {
  const [_sdkLoaded, setSdkLoaded] = useState(false);
  const wialon = useWialon();

  useEffect(() => {
    // Load Wialon SDK if not already loaded
    if (window.wialon) {
      console.log('Wialon SDK already loaded');
      console.log('SDK structure check:', {
        hasWialon: !!window.wialon,
        hasCore: !!window.wialon?.core,
        hasSession: !!window.wialon?.core?.Session,
        hasGetInstance: typeof window.wialon?.core?.Session?.getInstance === 'function'
      });
      setSdkLoaded(true);
      return;
    }

    console.log('Loading Wialon SDK...');
    const script = document.createElement('script');
    const host = import.meta.env.VITE_WIALON_HOST || 'https://hst-api.wialon.com';
    script.src = `${host}/wsdk/script/wialon.js`;
    script.async = true;

    script.onload = () => {
      console.log('Wialon SDK script loaded');

      // Wait for SDK to be fully initialized
      const checkSDKReady = () => {
        const wialonSdk = window.wialon;
        if (wialonSdk && wialonSdk.core && wialonSdk.core.Session) {
          console.log('Wialon SDK fully initialized and ready');
          console.log('SDK structure:', {
            hasCore: !!wialonSdk.core,
            hasSession: !!wialonSdk.core.Session,
            hasGetInstance: typeof wialonSdk.core.Session.getInstance === 'function',
            sessionMethods: wialonSdk.core.Session.getInstance ? Object.keys(wialonSdk.core.Session.getInstance()).slice(0, 10) : []
          });
          setSdkLoaded(true);
        } else {
          console.log('Waiting for SDK to initialize...');
          setTimeout(checkSDKReady, 50);
        }
      };

      checkSDKReady();
    };

    script.onerror = (error) => {
      console.error('Failed to load Wialon SDK:', error);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <WialonContext.Provider value={wialon}>
      {children}
    </WialonContext.Provider>
  );
};

export default WialonProvider;