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
        <Route path="/" component={Home} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/scan" component={DocumentLab} />
        <Route path="/history" component={IntelligenceVault} />
        <Route path="/scan/:scanId" component={ScanDetail} />
        <Route path="/bar" component={TheBar} />
        <Route path="/armory" component={ClauseArmory} />
        <Route path="/negotiator" component={ShadowNegotiator} />
        <Route path="/escrow" component={EscrowLock} />
        <Route path="/legal-strategy" component={LegalStrategy} />
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
