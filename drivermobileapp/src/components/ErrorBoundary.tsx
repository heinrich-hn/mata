// src/components/ErrorBoundary.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { clearSessionFromIndexedDB } from '@/lib/session-persistence';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to error tracking service if available
    if (import.meta.env.PROD) {
      // You can add error tracking service here (e.g., Sentry)
      console.error('Production error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReset = async () => {
    try {
      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear IndexedDB session
      await clearSessionFromIndexedDB();
      
      // Clear all caches
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }
      
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      
      console.log('App reset complete, reloading...');
      
      // Reload the page
      window.location.reload();
    } catch (error) {
      console.error('Error during reset:', error);
      // Force reload even if cleanup fails
      window.location.reload();
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
              Something went wrong
            </h2>
            
            <p className="text-gray-600 text-center mb-6">
              The app encountered an unexpected error. This might be due to connection issues or corrupted data.
            </p>
            
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-3 bg-gray-100 rounded text-sm">
                <p className="font-semibold text-red-600 mb-1">{this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="text-xs overflow-auto max-h-40 text-gray-700">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}
            
            <div className="space-y-3">
              <Button 
                onClick={this.handleRetry} 
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
              
              <Button 
                onClick={this.handleReset} 
                variant="outline"
                className="w-full"
              >
                Reset App Data
              </Button>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}