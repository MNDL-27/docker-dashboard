import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, LifeBuoy, Mail, Wrench } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { SEO } from "@/components/shared/SEO";

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Contact" 
        description="Need help with your Docker fleet? Reach out to our support team for technical assistance, billing questions, or enterprise inquiries."
      />
      <PublicNavbar />

      <main className="flex-1 py-20">
        <div className="max-w-4xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-4">Talk to the team behind Docker Dashboard</h1>
              <p className="text-lg text-muted-foreground">
                Use the direct contact paths below for support, rollout questions, and hosted deployment discussions.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><LifeBuoy className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-medium">Support</p>
                  <a href="mailto:support@dockerdash.app" className="text-sm text-muted-foreground hover:text-foreground">support@dockerdash.app</a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Mail className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-medium">Chat with sales</p>
                  <a href="mailto:sales@dockerdash.app" className="text-sm text-muted-foreground hover:text-foreground">sales@dockerdash.app</a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Wrench className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-medium">Implementation help</p>
                  <p className="text-sm text-muted-foreground">We can help with agent rollout, tunnel setup, and first-host onboarding.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 space-y-5">
            <h2 className="text-xl font-semibold">Best current paths</h2>
            <p className="text-sm text-muted-foreground">
              For now, the fastest way to reach us is by email. That keeps the contact path real while the in-app support workflow stays intentionally small.
            </p>
            <div className="space-y-3">
              <a href="mailto:support@dockerdash.app" className="block rounded-lg border border-border p-4 hover:bg-accent/30 transition-colors">
                <p className="text-sm font-medium">Technical support</p>
                <p className="text-sm text-muted-foreground">support@dockerdash.app</p>
              </a>
              <a href="mailto:sales@dockerdash.app" className="block rounded-lg border border-border p-4 hover:bg-accent/30 transition-colors">
                <p className="text-sm font-medium">Sales and rollout discussions</p>
                <p className="text-sm text-muted-foreground">sales@dockerdash.app</p>
              </a>
            </div>
            <Button asChild className="w-full text-base py-6">
              <a href="mailto:support@dockerdash.app?subject=Docker%20Dashboard%20support">Email Support</a>
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Contacting us means we may reply by email using the details you provide there. See our <Link to="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
