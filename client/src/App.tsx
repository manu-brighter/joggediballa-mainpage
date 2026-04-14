import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/NotFound';
import { Route, Switch, useLocation } from 'wouter';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import Home from './pages/Home';
import Shotcounter from './pages/Shotcounter';
import Team from './pages/Team';
import Events from './pages/Events';
import Sponsors from './pages/Sponsors';
import Contact from './pages/Contact';
import Impressum from './pages/Impressum';
import Datenschutz from './pages/Datenschutz';
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import ActivityLog from './pages/admin/ActivityLog';
import Goennermitglieder from './pages/Goennermitglieder';
import Attendance from './pages/Attendance';
import AttendanceStatistics from './pages/AttendanceStatistics';
import Profile from './pages/Profile';
import Dienstleistungen from './pages/Dienstleistungen';
import MaintenancePage from './pages/Maintenance';
import Harassenlauf from './pages/Harassenlauf';
import SdkOverlay from './pages/overlay/SdkOverlay';
import SdkControl from './pages/overlay/SdkControl';
import { createContext, useContext, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

// Overlay routes — rendered without Navigation/Footer/background
const OVERLAY_ROUTES = ['/overlay/sdk'];

// Beamer Mode Context
interface BeamerModeContextType {
  isBeamerMode: boolean;
  setBeamerMode: (value: boolean) => void;
}

const BeamerModeContext = createContext<BeamerModeContextType>({
  isBeamerMode: false,
  setBeamerMode: () => {},
});

export const useBeamerMode = () => useContext(BeamerModeContext);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shotcounter" component={Shotcounter} />
      <Route path="/team" component={Team} />
      <Route path="/events" component={Events} />
      <Route path="/sponsors" component={Sponsors} />
      <Route path="/contact" component={Contact} />
      <Route path="/impressum" component={Impressum} />
      <Route path="/datenschutz" component={Datenschutz} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={UserManagement} />
      <Route path="/admin/activity" component={ActivityLog} />
      <Route path="/goennermitglieder" component={Goennermitglieder} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/attendance/statistics" component={AttendanceStatistics} />
      <Route path="/profile" component={Profile} />
      <Route path="/dienstleistungen" component={Dienstleistungen} />
      <Route path="/harassenlauf" component={Harassenlauf} />
      {/* SDK Overlay routes — not linked, not indexed */}
      <Route path="/overlay/sdk" component={SdkOverlay} />
      <Route path="/overlay/sdk/control" component={SdkControl} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [isBeamerMode, setBeamerMode] = useState(false);
  const [location] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Overlay mode: no nav, no footer, transparent bg
  const isOverlayRoute = OVERLAY_ROUTES.some(r => location === r);

  // Check maintenance mode
  const { data: maintenanceMode } = trpc.features.get.useQuery(
    { featureName: 'maintenance_mode' },
    {
      staleTime: 30000, // Cache for 30 seconds
      refetchOnWindowFocus: false,
    },
  );

  // Exit beamer mode when navigating away from shotcounter
  useEffect(() => {
    if (location !== '/shotcounter' && isBeamerMode) {
      setBeamerMode(false);
    }
  }, [location, isBeamerMode]);

  // Handle escape key to exit beamer mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBeamerMode) {
        setBeamerMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBeamerMode]);

  // Show maintenance page for non-authenticated users when maintenance mode is enabled
  const showMaintenancePage =
    !authLoading && maintenanceMode?.isEnabled && !isAuthenticated;

  if (showMaintenancePage) {
    return <MaintenancePage />;
  }

  // Overlay route: render completely bare with transparent background
  if (isOverlayRoute) {
    return (
      <div style={{ background: 'transparent' }}>
        <Router />
      </div>
    );
  }

  return (
    <BeamerModeContext.Provider value={{ isBeamerMode, setBeamerMode }}>
      <div
        className={`min-h-screen flex flex-col ${isBeamerMode ? 'beamer-mode' : ''}`}
      >
        {!isBeamerMode && <Navigation />}
        <main className={`flex-1 ${isBeamerMode ? 'p-0' : ''}`}>
          <Router />
        </main>
        {!isBeamerMode && <Footer />}
      </div>
      <Toaster richColors position="top-center" />
    </BeamerModeContext.Provider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" switchable>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
