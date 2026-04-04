import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppRootRedirect from "@/components/AppRootRedirect";
import { isAppSubdomain, isDocsSubdomain } from "@/lib/hostname";
import { RequireAppSubdomain } from "@/components/RequireAppSubdomain";
import LandingPage from "./pages/LandingPage";
import FeaturesPage from "./pages/FeaturesPage";
import PricingPage from "./pages/PricingPage";
import SecurityPage from "./pages/SecurityPage";
import DocsPage from "./pages/DocsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CreateOrgPage from "./pages/CreateOrgPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import RefundsPage from "./pages/RefundsPage";
import ContactPage from "./pages/ContactPage";
import { ClerkProvider } from "@clerk/clerk-react";
import OnboardingPage from "./pages/OnboardingPage";
import { RequirePlatformAdmin } from "@/components/RequirePlatformAdmin";
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
import SetupGuidePage from "./pages/app/SetupGuidePage";
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

let paddleInitialized = false;

const PaddleInitializer = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    if (paddleInitialized) return;

    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
    if (!token) {
      console.warn("Paddle client token missing; skipping initialization.");
      return;
    }

    if (!window.Paddle) {
      console.warn("Paddle.js script not loaded yet; initialization will be retried on next mount or by safe interaction.");
      return;
    }

    try {
      const environment = token.startsWith('live_') ? 'production' : 'sandbox';
      window.Paddle.Environment.set(environment);
      window.Paddle.Initialize({ token });
      paddleInitialized = true;
      console.log(`Paddle.js initialized successfully in ${environment} mode.`);
    } catch (error) {
      console.error("Failed to initialize Paddle.js:", error);
    }
  }, []);
  return <>{children}</>;
};

const App = () => (
  <ClerkProvider
    publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
    signInUrl="/login"
    signUpUrl="/sign-up"
    signInFallbackRedirectUrl="/app"
    signUpFallbackRedirectUrl="/app"
    afterSignOutUrl="/app"
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DarkModeInit>
          <PaddleInitializer>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Marketing */}
                <Route path="/" element={isDocsSubdomain() ? <DocsPage /> : isAppSubdomain() ? <AppRootRedirect /> : <LandingPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/security" element={<SecurityPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/tos" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/refunds" element={<RefundsPage />} />
                {/* Auth */}
                <Route path="/login/*" element={<RequireAppSubdomain><LoginPage /></RequireAppSubdomain>} />
                <Route path="/sign-up/*" element={<RequireAppSubdomain><SignupPage /></RequireAppSubdomain>} />
                <Route path="/signup" element={<RequireAppSubdomain><Navigate to="/sign-up" replace /></RequireAppSubdomain>} />
                <Route path="/create-org" element={<RequireAppSubdomain><CreateOrgPage /></RequireAppSubdomain>} />
                <Route path="/onboarding" element={<RequireAppSubdomain key="onboarding"><ProtectedRoute requireOnboarded={false}><OnboardingPage /></ProtectedRoute></RequireAppSubdomain>} />
                {/* App Shell - Protected */}
                <Route path="/app" element={<RequireAppSubdomain key="app"><ProtectedRoute><AppShell /></ProtectedRoute></RequireAppSubdomain>}>
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
                  <Route path="admin" element={<RequirePlatformAdmin><AdminPage /></RequirePlatformAdmin>} />
                  <Route path="help" element={<HelpPage />} />
                  <Route path="setup-guide" element={<SetupGuidePage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </PaddleInitializer>
        </DarkModeInit>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>
);

export default App;
