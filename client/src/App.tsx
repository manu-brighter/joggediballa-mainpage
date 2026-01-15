import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Navigation } from "./components/Navigation";
import { Footer } from "./components/Footer";
import Home from "./pages/Home";
import Shotcounter from "./pages/Shotcounter";
import Team from "./pages/Team";
import Events from "./pages/Events";
import Sponsors from "./pages/Sponsors";
import Contact from "./pages/Contact";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import AdminDashboard from "./pages/admin/Dashboard";
import Goennermitglieder from "./pages/Goennermitglieder";
import Profile from "./pages/Profile";
import { createContext, useContext, useState, useEffect } from "react";

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
      <Route path="/goennermitglieder" component={Goennermitglieder} />
      <Route path="/profile" component={Profile} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [isBeamerMode, setBeamerMode] = useState(false);
  const [location] = useLocation();

  // Exit beamer mode when navigating away from shotcounter
  useEffect(() => {
    if (location !== "/shotcounter" && isBeamerMode) {
      setBeamerMode(false);
    }
  }, [location, isBeamerMode]);

  // Handle escape key to exit beamer mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isBeamerMode) {
        setBeamerMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBeamerMode]);

  return (
    <BeamerModeContext.Provider value={{ isBeamerMode, setBeamerMode }}>
      <div className={`min-h-screen flex flex-col ${isBeamerMode ? 'beamer-mode' : ''}`}>
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
