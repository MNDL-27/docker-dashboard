import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Box } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center"><Box className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-semibold tracking-tight">Docker Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/signup"><Button size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      <section className="py-20">
        <div className="max-w-lg mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Get in Touch</h1>
            <p className="text-muted-foreground">Book a demo or ask about Enterprise plans.</p>
          </div>
          <div className="glass-card p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First name</Label><Input placeholder="Jane" /></div>
              <div className="space-y-2"><Label>Last name</Label><Input placeholder="Doe" /></div>
            </div>
            <div className="space-y-2"><Label>Work email</Label><Input type="email" placeholder="you@company.com" /></div>
            <div className="space-y-2"><Label>Company</Label><Input placeholder="Acme Corp" /></div>
            <div className="space-y-2"><Label>Message</Label><Textarea placeholder="Tell us about your use case..." rows={4} /></div>
            <Button className="w-full">Send Message</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
