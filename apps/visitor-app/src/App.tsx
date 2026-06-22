import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import VisitorHome from "@/pages/visitor/Home";
import VisitorEntry from "@/pages/visitor/VisitorEntry";
import VisitorChat from "@/pages/visitor/Chat";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={VisitorHome} />
      <Route path="/chat/room" component={VisitorChat} />
      <Route path="/chat/:agentId" component={VisitorEntry} />
      <Route path="/chat" component={VisitorEntry} />
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
