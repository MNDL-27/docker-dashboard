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

          <div className="space-y-6">
            <p className="text-muted-foreground">
              You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period, and you will not be charged again after that date.
            </p>

            <p className="text-muted-foreground">
              Except where required by law, subscription fees already paid are generally non-refundable, and we do not automatically provide prorated refunds for unused time.
            </p>

            <p className="text-muted-foreground">
              We may provide partial or full refunds at our discretion for duplicate charges, billing errors, or other exceptional circumstances.
            </p>

            <p className="text-muted-foreground">
              Where applicable consumer protection laws grant you a right to withdraw, cancel, or receive a refund, those rights will apply.
            </p>

            <p className="text-muted-foreground">
              If you believe you were charged incorrectly, contact us at <a href="mailto:support@dockerdash.app" className="text-primary hover:underline">support@dockerdash.app</a> and we will review your request.
            </p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
