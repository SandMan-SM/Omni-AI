import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProfileProvider } from "@/hooks/use-profile";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Details from "@/pages/details";
import Dashboard from "@/pages/dashboard";
import Join from "@/pages/join";
import Admin from "@/pages/admin";
import Interlinked from "@/pages/interlinked";
import Sponsor from "@/pages/sponsor";
import SponsorInfo from "@/pages/sponsor-info";
import SponsorApplication from "@/pages/sponsor-application";
import Campaigns from "@/pages/campaigns";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/details" component={Details} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/join" component={Join} />
      <Route path="/admin" component={Admin} />
      <Route path="/interlinked" component={Interlinked} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/sponsor" component={Sponsor} />
      <Route path="/sponsor/info" component={SponsorInfo} />
      <Route path="/sponsor/application" component={SponsorApplication} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProfileProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ProfileProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
