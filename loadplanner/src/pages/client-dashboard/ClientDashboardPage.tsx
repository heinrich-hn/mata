import { ClientDashboardLayout } from '@/components/clients/ClientDashboardLayout';
import { useParams, Route, Routes, Navigate, useLocation } from 'react-router-dom';
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
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">Invalid portal link. Please contact your logistics provider.</p>
          </div>
        </div>
      );
    }
    return <Navigate to="/customers" replace />;
  }

  return (
    <ClientDashboardLayout>
      <Routes>
        <Route index element={<ClientOverviewPage key={clientId} />} />
        <Route path="live-map" element={<ClientLiveMapPage key={clientId} />} />
        <Route path="loads" element={<ClientDeliveriesPage key={clientId} />} />
        <Route path="deliveries" element={<ClientDeliveriesPage key={clientId} />} />
        <Route path="past-deliveries" element={<ClientServiceHistoryPage key={clientId} />} />
        <Route path="documents" element={<ClientDocumentsPage key={clientId} />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </ClientDashboardLayout>
  );
}