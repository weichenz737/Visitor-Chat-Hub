import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import { AdminRequireAuth } from "@/components/AdminRequireAuth";
import AdminLogin from "@/pages/Login";
import AdminLayout from "@/layouts/AdminLayout";
import DashboardPage from "@/pages/Dashboard";
import AgentsPage from "@/pages/Agents";
import PermissionsPage from "@/pages/Permissions";
import SessionsPage from "@/pages/Sessions";
import QuickRepliesPage from "@/pages/QuickReplies";
import TransfersPage from "@/pages/Transfers";
import LogsPage from "@/pages/Logs";
import ProfilePage from "@/pages/Profile";

setAuthTokenGetter(() => localStorage.getItem("admin_token"));

const queryClient = new QueryClient();

function AdminRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/agents" component={AgentsPage} />
        <Route path="/permissions" component={PermissionsPage} />
        <Route path="/sessions" component={SessionsPage} />
        <Route path="/quick-replies" component={QuickRepliesPage} />
        <Route path="/transfers" component={TransfersPage} />
        <Route path="/logs" component={LogsPage} />
        <Route path="/profile" component={ProfilePage} />
      </Switch>
    </AdminLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/login" component={AdminLogin} />
          <Route>
            <AdminRequireAuth>
              <AdminRoutes />
            </AdminRequireAuth>
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
