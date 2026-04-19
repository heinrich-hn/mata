import { ClientDashboardLayout } from '@/components/clients/ClientDashboardLayout';
import { useParams, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientOverviewPage from './ClientOverviewPage';
import ClientLiveMapPage from './ClientLiveMapPage';
import ClientDeliveriesPage from './ClientDeliveriesPage';
import ClientServiceHistoryPage from './ClientServiceHistoryPage';
import ClientDocumentsPage from './ClientDocumentsPage';

export default function ClientDashboardPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/portal');

  if (!clientId) {
    // Portal users must never be redirected to admin routes
    if (isPortal) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 p-8 md:p-12 max-w-md mx-4"
          >
            {/* Decorative background elements */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl" />
            
            <div className="relative">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20 mb-6 rotate-3"
              >
                <Shield className="w-8 h-8 text-white" />
              </motion.div>
              
              <div className="text-center space-y-3">
                <motion.h1 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
                >
                  Access Denied
                </motion.h1>
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800"
                >
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200 text-left">
                    Invalid portal link. Please contact your logistics provider for assistance.
                  </p>
                </motion.div>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-slate-600 dark:text-slate-400 text-sm pt-2"
                >
                  If you believe this is an error, please verify your portal link or reach out to support.
                </motion.p>
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="pt-6"
                >
                  <Button 
                    variant="outline"
                    className="gap-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                    onClick={() => window.location.reload()}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Try Again
                  </Button>
                </motion.div>
              </div>
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
        <Routes>
          <Route 
            index 
            element={
              <motion.div
                key={clientId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <ClientOverviewPage key={clientId} />
              </motion.div>
            } 
          />
          <Route 
            path="live-map" 
            element={
              <motion.div
                key={`${clientId}-live-map`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <ClientLiveMapPage key={clientId} />
              </motion.div>
            } 
          />
          <Route 
            path="loads" 
            element={
              <motion.div
                key={`${clientId}-loads`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <ClientDeliveriesPage key={clientId} />
              </motion.div>
            } 
          />
          <Route 
            path="deliveries" 
            element={
              <motion.div
                key={`${clientId}-deliveries`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <ClientDeliveriesPage key={clientId} />
              </motion.div>
            } 
          />
          <Route 
            path="past-deliveries" 
            element={
              <motion.div
                key={`${clientId}-past-deliveries`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <ClientServiceHistoryPage key={clientId} />
              </motion.div>
            } 
          />
          <Route 
            path="documents" 
            element={
              <motion.div
                key={`${clientId}-documents`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <ClientDocumentsPage key={clientId} />
              </motion.div>
            } 
          />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </AnimatePresence>
    </ClientDashboardLayout>
  );
}