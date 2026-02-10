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
import NotFound from "@/pages/not-found";

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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
