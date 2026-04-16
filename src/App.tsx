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
import { ClerkProvider } from "@clerk/clerk-react";
import { RequirePlatformAdmin } from "@/components/RequirePlatformAdmin";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const CreateOrgPage = lazy(() => import("./pages/CreateOrgPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const RefundsPage = lazy(() => import("./pages/RefundsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const DashboardPage = lazy(() => import("./pages/app/DashboardPage"));
const HostsPage = lazy(() => import("./pages/app/HostsPage"));
const HostDetailPage = lazy(() => import("./pages/app/HostDetailPage"));
const ContainersPage = lazy(() => import("./pages/app/ContainersPage"));
const ContainerDetailPage = lazy(() => import("./pages/app/ContainerDetailPage"));
const LogsPage = lazy(() => import("./pages/app/LogsPage"));
const AlertsPage = lazy(() => import("./pages/app/AlertsPage"));
const MembersPage = lazy(() => import("./pages/app/MembersPage"));
const BillingPage = lazy(() => import("./pages/app/BillingPage"));
const SettingsPage = lazy(() => import("./pages/app/SettingsPage"));
const OrganizationsPage = lazy(() => import("./pages/app/OrganizationsPage"));
const AdminPage = lazy(() => import("./pages/app/AdminPage"));
const HelpPage = lazy(() => import("./pages/app/HelpPage"));
const SetupGuidePage = lazy(() => import("./pages/app/SetupGuidePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

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
              <Suspense fallback={<RouteFallback />}>
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
                    <Route path="monitoring" element={<Navigate to="/app/alerts" replace />} />
                    <Route path="logs" element={<LogsPage />} />
                    <Route path="alerts" element={<AlertsPage />} />
                    <Route path="incidents" element={<Navigate to="/app/alerts" replace />} />
                    <Route path="incidents/:id" element={<Navigate to="/app/alerts" replace />} />
                    <Route path="deployments" element={<Navigate to="/app/hosts" replace />} />
                    <Route path="members" element={<MembersPage />} />
                    <Route path="billing" element={<BillingPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="admin" element={<RequirePlatformAdmin><AdminPage /></RequirePlatformAdmin>} />
                    <Route path="help" element={<HelpPage />} />
                    <Route path="setup-guide" element={<SetupGuidePage />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </PaddleInitializer>
        </DarkModeInit>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>
);

export default App;
