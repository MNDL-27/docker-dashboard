import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function RefundsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />
      <main className="flex-1 py-20 px-4">
        <div className="max-w-3xl mx-auto prose prose-invert">
          <h1 className="text-3xl font-bold mb-8">Refund Policy</h1>
          <p className="text-muted-foreground text-sm mb-6">Last Updated: March 22, 2026</p>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">1. General Policy</h2>
            <p className="text-muted-foreground mb-4">
              We offer a 14-day "no questions asked" refund policy for new subscriptions. If you are not satisfied with Docker Dashboard within your first two weeks of use, you are eligible for a full refund.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">2. Cancellation Timing</h2>
            <p className="text-muted-foreground mb-4">
              Refunds are only available for the most recent billing cycle. Monthly subscriptions must be requested within 14 days of the charge. Annual subscriptions must be requested within 30 days of the charge.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">3. What Happens After Cancellation</h2>
            <p className="text-muted-foreground mb-4">
              Once a refund is processed, your account will be downgraded to the Free tier immediately. You will lose access to paid features (Pro/Team) that exceed the Free tier limits.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-foreground">4. Contact Path</h2>
            <p className="text-muted-foreground mb-4">
              To request a refund or discuss a billing issue, please reach out to our billing team at <a href="mailto:billing@dockerdash.app" className="text-primary hover:underline">billing@dockerdash.app</a>.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
