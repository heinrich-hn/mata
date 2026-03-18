import { WialonProvider } from "@/integrations/wialon";
import 'leaflet/dist/leaflet.css'; // ← Add this line
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA functionality
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a prompt to the user to refresh
    if (confirm('New content available. Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
  onRegistered(registration) {
    console.log('Service worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('Service worker registration error:', error);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WialonProvider>
      <App />
    </WialonProvider>
  </StrictMode>
);