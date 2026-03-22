import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Box, Mail, MessageSquare, Globe } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />

      <main className="flex-1 py-20">
        <div className="max-w-4xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-4">Enterprise-Grade Management Starts Here</h1>
              <p className="text-lg text-muted-foreground">
                Connect with our team to discuss custom Retention, SLAs, and On-Premise deployments for your Docker fleet.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Mail className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-medium">Email us</p>
                  <p className="text-sm text-muted-foreground">sales@dockerdash.app</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><MessageSquare className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-medium">Chat with sales</p>
                  <p className="text-sm text-muted-foreground">Average response: 2 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Globe className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-medium">Headquarters</p>
                  <p className="text-sm text-muted-foreground">San Francisco, CA</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First name</Label><Input placeholder="Jane" /></div>
              <div className="space-y-2"><Label>Last name</Label><Input placeholder="Doe" /></div>
            </div>
            <div className="space-y-2"><Label>Work email</Label><Input type="email" placeholder="you@company.com" /></div>
            <div className="space-y-2"><Label>Company</Label><Input placeholder="Acme Corp" /></div>
            <div className="space-y-2"><Label>Message</Label><Textarea placeholder="Tell us about your infrastructure needs..." rows={4} /></div>
            <Button className="w-full text-base py-6">Get a Demo</Button>
            <p className="text-[10px] text-center text-muted-foreground">
              By submitting this form, you agree to our <Link to="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
