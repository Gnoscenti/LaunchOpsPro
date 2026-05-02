/**
 * Atlas Orchestrator — "The Forge" Design System
 * Full dashboard application with sidebar navigation.
 * Dark graphite surfaces, molten gold accents, industrial craft aesthetic.
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Orchestrator from "./pages/Orchestrator";
import WorkflowEditor from "./pages/WorkflowEditor";
import PilotScope from "./pages/PilotScope";
import Runbook from "./pages/Runbook";
import Metrics from "./pages/Metrics";
import TrustScore from "./pages/TrustScore";
import Agents from "./pages/Agents";
import Configuration from "./pages/Configuration";
import BrandArchitect from "./pages/BrandArchitect";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/orchestrator" component={Orchestrator} />
        <Route path="/editor" component={WorkflowEditor} />
        <Route path="/pilot" component={PilotScope} />
        <Route path="/runbook" component={Runbook} />
        <Route path="/metrics" component={Metrics} />
        <Route path="/trust" component={TrustScore} />
        <Route path="/agents" component={Agents} />
        <Route path="/config" component={Configuration} />
        <Route path="/brand" component={BrandArchitect} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
