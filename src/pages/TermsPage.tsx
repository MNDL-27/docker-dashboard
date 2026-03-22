import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />
      <main className="flex-1 py-20 px-4">
        <div className="max-w-3xl mx-auto prose prose-invert">
          <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
          <p className="text-muted-foreground text-sm mb-6">Last Updated: March 22, 2026</p>

          <section className="mb-10 border-l-4 border-primary/50 pl-4 py-2 bg-primary/5 rounded-r">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Legal Notice & Operator</h2>
            <p className="text-muted-foreground mb-4">
              Docker Dashboard is operated by <strong>Freaks Empire</strong>. These Terms of Service govern your access to and use of the Docker Dashboard website, application, and related services.
            </p>
            <p className="text-muted-foreground mb-4">
              The service is provided by Freaks Empire. For any legal or billing questions, please contact our support team at <a href="mailto:support@dockerdash.app" className="text-primary hover:underline">support@dockerdash.app</a>.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">1. Subscription Terms</h2>
            <p className="text-muted-foreground mb-4">
              Docker Dashboard offers various subscription tiers. By subscribing to a paid plan (Pro or Team), you agree to pay the fees associated with that tier. Subscriptions are billed in advance on a recurring monthly or annual basis.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">2. Cancellation Policy</h2>
            <p className="text-muted-foreground mb-4">
              You may cancel your subscription at any time through the Billing section of the application. Upon cancellation, you will continue to have access to the paid features until the end of your current billing cycle. No further charges will be applied.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">3. Acceptable Use</h2>
            <p className="text-muted-foreground mb-4">
              You agree not to use Docker Dashboard for any illegal purposes or to interfere with the operation of the service. You are responsible for all activity that occurs under your account and for maintaining the security of your hosts and credentials.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">4. Shared Responsibility & Self-Hosting</h2>
            <p className="text-muted-foreground mb-4">
              Docker Dashboard operates on a shared responsibility model. We provide the management interface and secure proxy, but you are responsible for the security, patches, and uptime of the hosts where you run the Docker Dashboard Agent. We do not provide an uptime guarantee for your individual hosts.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">5. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              Docker Dashboard provides the service "as is" without any warranty of any kind. In no event shall we be liable for any direct, indirect, or consequential damages arising from the use or inability to use the service.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
