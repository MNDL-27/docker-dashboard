import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppRootRedirect from "@/components/AppRootRedirect";
import { isAppSubdomain, isDocsSubdomain, isPreviewAuthBypassEnabled } from "@/lib/hostname";
import { RequireAppSubdomain } from "@/components/RequireAppSubdomain";
import { ClerkProvider } from "@clerk/react";
import { RequirePlatformAdmin } from "@/components/RequirePlatformAdmin";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { usePageViewTracking } from "@/hooks/usePageViewTracking";
import { useViewerState } from "@/hooks/useViewerState";

/**
 * Wraps React.lazy to automatically reload the page if a chunk fails to load.
 * This happens when a new version is deployed and the user's browser tries to fetch
 * an old JS chunk hash that no longer exists on the server.
 */
function lazyLoad<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch dynamically imported module')) {
        console.warn('Chunk load error detected. Reloading page to fetch latest version...', error);
        window.location.reload();
        // Return a dummy module while the page reloads
        return { default: () => <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> } as any;
      }
      throw error;
    }
  });
}

const LandingPage = lazyLoad(() => import("./pages/LandingPage"));
const FeaturesPage = lazyLoad(() => import("./pages/FeaturesPage"));
const PricingPage = lazyLoad(() => import("./pages/PricingPage"));
const SecurityPage = lazyLoad(() => import("./pages/SecurityPage"));
const DocsPage = lazyLoad(() => import("./pages/DocsPage"));
const LoginPage = lazyLoad(() => import("./pages/LoginPage"));
const SignupPage = lazyLoad(() => import("./pages/SignupPage"));
const CreateOrgPage = lazyLoad(() => import("./pages/CreateOrgPage"));
const TermsPage = lazyLoad(() => import("./pages/TermsPage"));
const PrivacyPage = lazyLoad(() => import("./pages/PrivacyPage"));
const RefundsPage = lazyLoad(() => import("./pages/RefundsPage"));
const ContactPage = lazyLoad(() => import("./pages/ContactPage"));
const OnboardingPage = lazyLoad(() => import("./pages/OnboardingPage"));
const DedicatedStartPage = lazyLoad(() => import("./pages/DedicatedStartPage"));
const DedicatedIntakePage = lazyLoad(() => import("./pages/DedicatedIntakePage"));
const DashboardPage = lazyLoad(() => import("./pages/app/DashboardPage"));
const HostsPage = lazyLoad(() => import("./pages/app/HostsPage"));
const HostDetailPage = lazyLoad(() => import("./pages/app/HostDetailPage"));
const ContainersPage = lazyLoad(() => import("./pages/app/ContainersPage"));
const ContainerDetailPage = lazyLoad(() => import("./pages/app/ContainerDetailPage"));
const FileManagerPage = lazyLoad(() => import("./pages/app/FileManagerPage"));
const LogsPage = lazyLoad(() => import("./pages/app/LogsPage"));
const AlertsPage = lazyLoad(() => import("./pages/app/AlertsPage"));
const MembersPage = lazyLoad(() => import("./pages/app/MembersPage"));
const BillingPage = lazyLoad(() => import("./pages/app/BillingPage"));
const SettingsPage = lazyLoad(() => import("./pages/app/SettingsPage"));
const OrganizationsPage = lazyLoad(() => import("./pages/app/OrganizationsPage"));
const AdminPage = lazyLoad(() => import("./pages/app/AdminPage"));
const HelpPage = lazyLoad(() => import("./pages/app/HelpPage"));
const SetupGuidePage = lazyLoad(() => import("./pages/app/SetupGuidePage"));
const DedicatedDeploymentPage = lazyLoad(() => import("./pages/app/DedicatedDeploymentPage"));
const NotFound = lazyLoad(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const DarkModeInit = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    if (!document.documentElement.classList.contains("light")) {
      document.documentElement.classList.add("dark");
    }
  }, []);
  return <>{children}</>;
};



const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const PageViewTracker = () => { usePageViewTracking(); return null; };

const App = () => {
  const previewBypass = isPreviewAuthBypassEnabled();

  return (
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
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <PageViewTracker />
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  {/* Marketing */}
                  <Route path="/" element={isDocsSubdomain() ? <DocsPage /> : isAppSubdomain() ? <AppRootRedirect /> : <LandingPage />} />
                  <Route path="/features" element={<FeaturesPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/security" element={<SecurityPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/dedicated/start" element={<DedicatedStartPage />} />
                  <Route path="/tos" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/refunds" element={<RefundsPage />} />
                  {/* Auth */}
                  <Route path="/login/*" element={previewBypass ? <Navigate to="/app" replace /> : <RequireAppSubdomain><LoginPage /></RequireAppSubdomain>} />
                  <Route path="/sign-up/*" element={previewBypass ? <Navigate to="/app" replace /> : <RequireAppSubdomain><SignupPage /></RequireAppSubdomain>} />
                  <Route path="/signup" element={previewBypass ? <Navigate to="/app" replace /> : <RequireAppSubdomain><Navigate to="/sign-up" replace /></RequireAppSubdomain>} />
                  <Route path="/create-org" element={<RequireAppSubdomain><CreateOrgPage /></RequireAppSubdomain>} />
                  <Route path="/onboarding" element={<RequireAppSubdomain key="onboarding"><ProtectedRoute requireOnboarded={false}><OnboardingPage /></ProtectedRoute></RequireAppSubdomain>} />
                  <Route
                    path="/dedicated/intake"
                    element={
                      <RequireAppSubdomain key="dedicated-intake">
                        <ProtectedRoute requireOnboarded={false} allowMissingOrganization skipResolvedRedirect>
                          <DedicatedIntakePage />
                        </ProtectedRoute>
                      </RequireAppSubdomain>
                    }
                  />
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
                    <Route
                      path="files"
                      element={<FileManagerPage />}
                    />
                    <Route path="alerts" element={<AlertsPage />} />
                    <Route path="incidents" element={<Navigate to="/app/alerts" replace />} />
                    <Route path="incidents/:id" element={<Navigate to="/app/alerts" replace />} />
                    <Route path="deployments" element={<Navigate to="/app/hosts" replace />} />
                    <Route path="billing" element={<BillingPage />} />
                    <Route path="members" element={<MembersPage />} />
                    <Route path="dedicated-deployment" element={<DedicatedDeploymentPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="admin" element={<RequirePlatformAdmin><AdminPage /></RequirePlatformAdmin>} />
                    <Route path="help" element={<HelpPage />} />
                    <Route path="setup-guide" element={<SetupGuidePage />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
        </DarkModeInit>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>
  );
};

export default App;
