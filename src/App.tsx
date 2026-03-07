import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import LandingPage from "./pages/LandingPage";
import FeaturesPage from "./pages/FeaturesPage";
import PricingPage from "./pages/PricingPage";
import SecurityPage from "./pages/SecurityPage";
import DocsPage from "./pages/DocsPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/app/DashboardPage";
import HostsPage from "./pages/app/HostsPage";
import HostDetailPage from "./pages/app/HostDetailPage";
import ContainersPage from "./pages/app/ContainersPage";
import ContainerDetailPage from "./pages/app/ContainerDetailPage";
import MonitoringPage from "./pages/app/MonitoringPage";
import LogsPage from "./pages/app/LogsPage";
import AlertsPage from "./pages/app/AlertsPage";
import IncidentsPage from "./pages/app/IncidentsPage";
import DeploymentsPage from "./pages/app/DeploymentsPage";
import MembersPage from "./pages/app/MembersPage";
import BillingPage from "./pages/app/BillingPage";
import SettingsPage from "./pages/app/SettingsPage";
import OrganizationsPage from "./pages/app/OrganizationsPage";
import AdminPage from "./pages/app/AdminPage";
import HelpPage from "./pages/app/HelpPage";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

const queryClient = new QueryClient();

const DarkModeInit = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    if (!document.documentElement.classList.contains("light")) {
      document.documentElement.classList.add("dark");
    }
  }, []);
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DarkModeInit>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Marketing */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            {/* App Shell */}
            <Route path="/app" element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="organizations" element={<OrganizationsPage />} />
              <Route path="hosts" element={<HostsPage />} />
              <Route path="hosts/:id" element={<HostDetailPage />} />
              <Route path="containers" element={<ContainersPage />} />
              <Route path="containers/:id" element={<ContainerDetailPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="incidents" element={<IncidentsPage />} />
              <Route path="incidents/:id" element={<IncidentsPage />} />
              <Route path="deployments" element={<DeploymentsPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DarkModeInit>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
