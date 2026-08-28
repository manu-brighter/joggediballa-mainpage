import { Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation } from 'wouter';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import NotFound from '@/pages/NotFound';
import { Spinner } from '@/components/ui/spinner';
import { createContext, useContext, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useCookieConsent } from '@/_core/hooks/useCookieConsent';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import {
  loadGoogleAnalyticsScript,
  disableGoogleAnalytics,
} from '@/_core/googleAnalytics';

// C-P0-01: Route-level code splitting. Every page below is lazy-loaded so the
// initial bundle only carries the shell + Home (eagerly imported as the
// landing route). Admin/Goennermitglieder/Shotcounter/etc. get their own
// chunks instead of bloating the entry chunk.
const Home = lazy(() => import('./pages/Home'));
const Shotcounter = lazy(() => import('./pages/Shotcounter'));
const Team = lazy(() => import('./pages/Team'));
const Events = lazy(() => import('./pages/Events'));
const Sponsors = lazy(() => import('./pages/Sponsors'));
const Contact = lazy(() => import('./pages/Contact'));
const Impressum = lazy(() => import('./pages/Impressum'));
const Datenschutz = lazy(() => import('./pages/Datenschutz'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const ActivityLog = lazy(() => import('./pages/admin/ActivityLog'));
const Goennermitglieder = lazy(() => import('./pages/Goennermitglieder'));
const Attendance = lazy(() => import('./pages/Attendance'));
const AttendanceStatistics = lazy(() => import('./pages/AttendanceStatistics'));
const Profile = lazy(() => import('./pages/Profile'));
const Dienstleistungen = lazy(() => import('./pages/Dienstleistungen'));
const MaintenancePage = lazy(() => import('./pages/Maintenance'));
const Harassenlauf = lazy(() => import('./pages/Harassenlauf'));
const SdkOverlay = lazy(() => import('./pages/overlay/SdkOverlay'));
const SdkControl = lazy(() => import('./pages/overlay/SdkControl'));
const Diashow = lazy(() => import('./pages/diashow/Diashow'));
const DiashowUpload = lazy(() => import('./pages/diashow/DiashowUpload'));
const DiashowControl = lazy(() => import('./pages/diashow/DiashowControl'));
const KasseControl = lazy(() => import('./pages/kasse/KasseControl'));
const KasseService = lazy(() => import('./pages/kasse/KasseService'));
const KasseKueche = lazy(() => import('./pages/kasse/KasseKueche'));

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

type LayoutMode = 'overlay-transparent' | 'bare-black' | 'bare-app' | 'normal';

function getLayoutMode(location: string): LayoutMode {
  if (location === '/overlay/sdk') return 'overlay-transparent';
  // /diashow/<token> und /diashow/<token>/upload sind bare; /diashow/control normal.
  if (location.startsWith('/diashow/') && location !== '/diashow/control') {
    return 'bare-black';
  }
  // Kassensystem: Service (Handy) und Küche (Tablet) laufen ohne Nav/Footer,
  // sie brauchen die volle Höhe. /kasse/control bleibt eine normale Seite.
  if (location.startsWith('/kasse/') && location !== '/kasse/control') {
    return 'bare-app';
  }
  return 'normal';
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-8 text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
        {/* Live-Diashow — nicht verlinkt, nicht indexiert */}
        <Route path="/diashow/control" component={DiashowControl} />
        <Route path="/diashow/:token/upload" component={DiashowUpload} />
        <Route path="/diashow/:token" component={Diashow} />
        {/* Kassensystem, nicht verlinkt, nicht indexiert */}
        <Route path="/kasse/control" component={KasseControl} />
        <Route path="/kasse/service/:token" component={KasseService} />
        <Route path="/kasse/kueche/:token" component={KasseKueche} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppContent() {
  const [isBeamerMode, setBeamerMode] = useState(false);
  const [location] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    consent,
    showBanner,
    isLoaded,
    acceptAll,
    rejectAll,
    setCustomConsent,
  } = useCookieConsent();

  // Load Google Analytics based on consent
  useEffect(() => {
    if (!isLoaded) return;

    const gaId = 'G-W5PQHY4GNN';
    if (consent.analytics) {
      loadGoogleAnalyticsScript(gaId);
    } else {
      disableGoogleAnalytics();
    }
  }, [consent.analytics, isLoaded]);

  const layoutMode = getLayoutMode(location);

  // C-P1-11: Derive maintenance mode from the cached `features.list` query
  // (which Navigation already fetches) via `select`, instead of issuing a
  // second `features.get` request on every mount. QueryClient defaults
  // (staleTime: 30s, refetchOnWindowFocus: false) live in main.tsx.
  const { data: maintenanceEnabled = false } = trpc.features.list.useQuery(
    undefined,
    {
      select: features =>
        features.find(f => f.featureName === 'maintenance_mode')?.isEnabled ??
        false,
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
    !authLoading && maintenanceEnabled && !isAuthenticated;

  if (showMaintenancePage) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <MaintenancePage />
      </Suspense>
    );
  }

  // Transparent overlay (OBS) — unverändert.
  if (layoutMode === 'overlay-transparent') {
    return (
      <div style={{ background: 'transparent' }}>
        <Router />
      </div>
    );
  }

  // Bare routes (Diashow + Upload): kein Nav/Footer; die Seite setzt ihren eigenen Hintergrund.
  if (layoutMode === 'bare-black') {
    return (
      <div className="min-h-screen">
        <Router />
      </div>
    );
  }

  // Kassen-Seiten: ebenfalls ohne Nav/Footer, aber mit Toaster. Service und
  // Küche melden Fehler und Statuswechsel über Toasts.
  if (layoutMode === 'bare-app') {
    return (
      <div className="min-h-screen">
        <Router />
        <Toaster richColors position="top-center" />
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
      {/* Cookie Consent Banner */}
      {isLoaded && (
        <CookieConsentBanner
          isVisible={showBanner}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onCustom={(analytics, marketing) =>
            setCustomConsent({ analytics, marketing })
          }
        />
      )}
    </BeamerModeContext.Provider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
