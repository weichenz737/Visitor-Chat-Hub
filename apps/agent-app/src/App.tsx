import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import AgentLogin from "@/pages/agent/Login";
import AgentDashboard from "@/pages/agent/Dashboard";
import AgentProfile from "@/pages/agent/Profile";
import AgentVisitorChatRedirect from "@/pages/agent/VisitorChatRedirect";

setAuthTokenGetter(() => localStorage.getItem("agent_token"));

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/chat/:agentId" component={AgentVisitorChatRedirect} />
      <Route path="/" component={() => <Redirect to="/agent" />} />
      <Route path="/agent" component={AgentLogin} />
      <Route path="/agent/dashboard" component={AgentDashboard} />
      <Route path="/agent/profile" component={AgentProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
