import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";

import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import DocumentLab from "@/pages/DocumentLab";
import IntelligenceVault from "@/pages/IntelligenceVault";
import ScanDetail from "@/pages/ScanDetail";
import TheBar from "@/pages/TheBar";
import ClauseArmory from "@/pages/ClauseArmory";
import ShadowNegotiator from "@/pages/ShadowNegotiator";
import EscrowLock from "@/pages/EscrowLock";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/scan" component={DocumentLab} />
      <Route path="/history" component={IntelligenceVault} />
      <Route path="/scan/:scanId" component={ScanDetail} />
      <Route path="/bar" component={TheBar} />
      <Route path="/armory" component={ClauseArmory} />
      <Route path="/negotiator" component={ShadowNegotiator} />
      <Route path="/escrow" component={EscrowLock} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Layout>
            <Router />
          </Layout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
