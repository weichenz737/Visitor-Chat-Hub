import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import VisitorHome from "@/pages/visitor/Home";
import VisitorEntry from "@/pages/visitor/VisitorEntry";
import VisitorChat from "@/pages/visitor/Chat";
import AgentLogin from "@/pages/agent/Login";
import AgentDashboard from "@/pages/agent/Dashboard";

// Setup API auth header injection
setAuthTokenGetter(() => {
  return localStorage.getItem("agent_token");
});

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={VisitorHome} />
      <Route path="/chat/room" component={VisitorChat} />
      <Route path="/chat/:agentId" component={VisitorEntry} />
      <Route path="/chat" component={VisitorEntry} />
      <Route path="/agent" component={AgentLogin} />
      <Route path="/agent/dashboard" component={AgentDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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

export default App;
