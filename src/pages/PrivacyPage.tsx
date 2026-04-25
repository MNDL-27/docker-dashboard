import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { SEO } from "@/components/shared/SEO";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title="Privacy Policy" description="Learn how we handle your data and ensure your privacy at Docker Dashboard." />
      <PublicNavbar />
      <main className="flex-1 py-20 px-4">
        <div className="max-w-3xl mx-auto prose prose-invert">
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mb-6">Last Updated: March 22, 2026</p>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">1. Account & Authentication Data</h2>
            <p className="text-muted-foreground mb-4">
              We collect basic account information (email, name) through our authentication provider, Clerk. This data is used solely to provide access to the service and manage your organizations.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">2. Host Metadata</h2>
            <p className="text-muted-foreground mb-4">
              When you connect a host, we store metadata such as hostnames, OS version, and container status. We do not store your private keys or sensitive application data. Communication between the agent and our dashboard is encrypted via TLS.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">3. Logs & Analytics</h2>
            <p className="text-muted-foreground mb-4">
              We may collect anonymized usage analytics and error logs to improve the performance and reliability of the service. This data does not personally identify you or your infrastructure.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">4. Billing Data</h2>
            <p className="text-muted-foreground mb-4">
              Payment processing is handled by Paddle. We do not store your credit card information on our servers. Paddle provides us with transactional data required for subscription management.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">5. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              For any privacy-related requests or questions, please contact us at <a href="mailto:privacy@dockerdash.app" className="text-primary hover:underline">privacy@dockerdash.app</a>.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
