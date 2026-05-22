import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ScanProvider } from "@/contexts/ScanContext";
import { AuthModal } from "@/components/AuthModal";
import { Layout } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

const Home = lazy(() => import("@/pages/Home"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DocumentLab = lazy(() => import("@/pages/DocumentLab"));
const IntelligenceVault = lazy(() => import("@/pages/IntelligenceVault"));
const ScanDetail = lazy(() => import("@/pages/ScanDetail"));
const TheBar = lazy(() => import("@/pages/TheBar"));
const ClauseArmory = lazy(() => import("@/pages/ClauseArmory"));
const ShadowNegotiator = lazy(() => import("@/pages/ShadowNegotiator"));
const EscrowLock = lazy(() => import("@/pages/EscrowLock"));
const LegalStrategy = lazy(() => import("@/pages/LegalStrategy"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public routes */}
        <Route path="/" component={Home} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/auth/callback" component={AuthCallback} />

        {/* Semi-public: guests can paste text before signing in */}
        <Route path="/scan" component={DocumentLab} />

        {/* Auth-required routes — ProtectedRoute prevents flash during loading */}
        <Route path="/dashboard">
          {() => <ProtectedRoute><Dashboard /></ProtectedRoute>}
        </Route>
        <Route path="/history">
          {() => <ProtectedRoute><IntelligenceVault /></ProtectedRoute>}
        </Route>
        <Route path="/scan/:scanId">
          {() => <ProtectedRoute><ScanDetail /></ProtectedRoute>}
        </Route>

        {/* Premium routes — ProtectedRoute handles auth; FeatureGate inside handles plan */}
        <Route path="/bar">
          {() => <ProtectedRoute><TheBar /></ProtectedRoute>}
        </Route>
        <Route path="/armory">
          {() => <ProtectedRoute><ClauseArmory /></ProtectedRoute>}
        </Route>
        <Route path="/negotiator">
          {() => <ProtectedRoute><ShadowNegotiator /></ProtectedRoute>}
        </Route>
        <Route path="/escrow">
          {() => <ProtectedRoute><EscrowLock /></ProtectedRoute>}
        </Route>
        <Route path="/legal-strategy">
          {() => <ProtectedRoute><LegalStrategy /></ProtectedRoute>}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ScanProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ErrorBoundary>
                <Layout>
                  <Router />
                </Layout>
              </ErrorBoundary>
              <ErrorBoundary fallback={null}>
                <AuthModal />
              </ErrorBoundary>
            </WouterRouter>
            <Toaster />
          </ScanProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
