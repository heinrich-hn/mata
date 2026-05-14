import React from 'react';
import { useParams, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientDashboardLayout } from '@/components/clients/ClientDashboardLayout';

// Page Components
import ClientOverviewPage from './ClientOverviewPage';
import ClientLiveMapPage from './ClientLiveMapPage';
import ClientDeliveriesPage from './ClientDeliveriesPage';
import ClientServiceHistoryPage from './ClientServiceHistoryPage';
import ClientDocumentsPage from './ClientDocumentsPage';

/**
 * Reusable page transition wrapper for consistent, professional routing animations.
 * Using a subtle vertical slide (y-axis) is standard for enterprise dashboards.
 */
const PageTransition = ({ children, pageKey }: { children: React.ReactNode; pageKey: string }) => (
  <motion.div
    key={pageKey}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

export default function ClientDashboardPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/portal');

  if (!clientId) {
    // Portal users must never be redirected to admin routes.
    // Present a clean, professional restricted access screen.
    if (isPortal) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-10 max-w-lg w-full"
          >
            <div className="flex flex-col items-center text-center space-y-6">
              
              {/* Professional Icon Indicator */}
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700"
              >
                <ShieldAlert className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </motion.div>
              
              {/* Refined Copy */}
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Access Restricted
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                  We couldn't verify your credentials. Please ensure you are using the complete portal link provided by your logistics partner.
                </p>
              </div>
              
              {/* Contextual Warning Callout */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 flex items-start gap-3 text-left"
              >
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  If you continue to experience issues, please contact your account manager or technical support for a secure access link.
                </p>
              </motion.div>
              
              {/* Action Area */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="pt-2 w-full"
              >
                <Button 
                  variant="outline"
                  className="w-full sm:w-auto gap-2 text-slate-600 dark:text-slate-300"
                  onClick={() => window.location.reload()}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Try Again
                </Button>
              </motion.div>

            </div>
          </motion.div>
        </div>
      );
    }
    return <Navigate to="/customers" replace />;
  }

  return (
    <ClientDashboardLayout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route 
            index 
            element={
              <PageTransition pageKey={`${clientId}-overview`}>
                <ClientOverviewPage key={clientId} />
              </PageTransition>
            } 
          />
          <Route 
            path="live-map" 
            element={
              <PageTransition pageKey={`${clientId}-live-map`}>
                <ClientLiveMapPage key={clientId} />
              </PageTransition>
            } 
          />
          <Route 
            path="loads" 
            element={
              <PageTransition pageKey={`${clientId}-loads`}>
                <ClientDeliveriesPage key={clientId} />
              </PageTransition>
            } 
          />
          <Route 
            path="deliveries" 
            element={
              <PageTransition pageKey={`${clientId}-deliveries`}>
                <ClientDeliveriesPage key={clientId} />
              </PageTransition>
            } 
          />
          <Route 
            path="past-deliveries" 
            element={
              <PageTransition pageKey={`${clientId}-past-deliveries`}>
                <ClientServiceHistoryPage key={clientId} />
              </PageTransition>
            } 
          />
          <Route 
            path="documents" 
            element={
              <PageTransition pageKey={`${clientId}-documents`}>
                <ClientDocumentsPage key={clientId} />
              </PageTransition>
            } 
          />
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </AnimatePresence>
    </ClientDashboardLayout>
  );
}
