import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/protected-route";
import { AppLayout } from "@/components/app-layout";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ResetPasswordPage from "@/pages/reset-password";
import DashboardPage from "@/pages/dashboard";
import AdminUsersPage from "@/pages/admin-users";
import IntegrationsPage from "@/pages/integrations";
import IntegrationDetailPage from "@/pages/integration-detail";
import KpiLibraryPage from "@/pages/kpi-library";
import KpiDetailPage from "@/pages/kpi-detail";
import KpiGoalsPage from "@/pages/kpi-goals";
import PipelinePage from "@/pages/pipeline";
import LeadsPage from "@/pages/leads";
import SchoolDashboardPage from "@/pages/school-dashboard";
import ExecDashboardPage from "@/pages/exec-dashboard";
import ChurnRulesPage from "@/pages/churn-rules";
import ChurnEventsPage from "@/pages/churn-events";
import MonitoringDashboard from "@/pages/monitoring";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/error-boundary";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      <Route path="/">
        <ProtectedRoute>
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/kpis">
        <ProtectedRoute allowedRoles={["admin", "ops", "exec", "director"]}>
          <AppLayout>
            <KpiLibraryPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/kpis/:id">
        <ProtectedRoute allowedRoles={["admin", "ops", "exec", "director"]}>
          <AppLayout>
            <KpiDetailPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/goals">
        <ProtectedRoute allowedRoles={["admin", "director"]}>
          <AppLayout>
            <KpiGoalsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/pipeline">
        <ProtectedRoute allowedRoles={["admin", "ops", "exec", "director", "seller"]}>
          <AppLayout>
            <PipelinePage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/leads">
        <ProtectedRoute allowedRoles={["admin", "ops", "exec", "director", "seller"]}>
          <AppLayout>
            <LeadsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/school-dashboard">
        <ProtectedRoute allowedRoles={["admin", "director", "finance", "exec"]}>
          <AppLayout>
            <SchoolDashboardPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/exec-dashboard">
        <ProtectedRoute allowedRoles={["admin", "exec"]}>
          <AppLayout>
            <ExecDashboardPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/users">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AppLayout>
            <AdminUsersPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/integrations">
        <ProtectedRoute allowedRoles={["admin", "ops"]}>
          <AppLayout>
            <IntegrationsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/integrations/:id">
        <ProtectedRoute allowedRoles={["admin", "ops"]}>
          <AppLayout>
            <IntegrationDetailPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/churn-rules">
        <ProtectedRoute allowedRoles={["admin", "director", "ops", "analytics"] as any}>
          <AppLayout>
            <ChurnRulesPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/churn-events">
        <ProtectedRoute allowedRoles={["admin", "director", "ops", "analytics"] as any}>
          <AppLayout>
            <ChurnEventsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/monitoring">
        <ProtectedRoute allowedRoles={["admin", "ops"]}>
          <AppLayout>
            <MonitoringDashboard />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
