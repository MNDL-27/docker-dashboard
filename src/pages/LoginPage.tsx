import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { Box, Server, Shield, Activity } from "lucide-react";
import { LoginBackground } from "@/components/ui/LoginBackground";

const features = [
  { icon: Server, title: "Multi-Host Monitoring", desc: "Monitor all your Docker hosts from a single pane of glass." },
  { icon: Activity, title: "Centralized Logs & Metrics", desc: "Real-time visibility into infrastructure health." },
  { icon: Shield, title: "Secure Agent", desc: "Lightweight, TLS-encrypted proxy directly to docker.sock." },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background relative overflow-hidden">
      <LoginBackground />

      {/* Left Column: Marketing / Brand (Hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 lg:w-5/12 border-r border-border bg-card/30 p-12 flex-col justify-between relative overflow-hidden z-10">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm mx-auto flex-1 flex flex-col">
          {/* Logo Nav */}
          <Link to="/" className="flex items-center gap-2 mb-16">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Watchtower</span>
          </Link>

          {/* Headline */}
          <div className="mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-6">
              Monitor your fleet<br />
              <span className="text-muted-foreground">from one plane.</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Sign in to manage your hosts, view real-time container metrics, and configure smart alerts.
            </p>
          </div>

          {/* Feature Bullets */}
          <div className="space-y-8 mt-auto">
            {features.map((f, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Auth Card */}
      <div className="flex-1 flex flex-col relative w-full items-center justify-center p-4 sm:p-8">
        {/* Mobile Header (Shows only on small screens) */}
        <div className="md:hidden w-full max-w-[400px] mb-8 flex justify-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Watchtower</span>
          </Link>
        </div>

        <div className="w-full max-w-[400px]">
          {/* We rely entirely on Clerk for Auth to not break existing flow or sign-up states. */}
          <SignIn 
            routing="path" 
            path="/login" 
            forceRedirectUrl="/app"
            fallbackRedirectUrl="/app" 
            appearance={{
              layout: {
                socialButtonsPlacement: 'bottom',
                socialButtonsVariant: 'auto',
              },
              variables: {
                colorPrimary: 'hsl(var(--primary))',
                colorBackground: 'hsl(var(--card))',
                colorInputBackground: 'hsl(var(--muted))',
                colorInputText: 'hsl(var(--foreground))',
                colorText: 'hsl(var(--foreground))',
                colorTextSecondary: 'hsl(var(--muted-foreground))',
                borderRadius: '0.75rem',
                fontFamily: 'inherit',
              },
              elements: {
                rootBox: "w-full",
                cardBox: "w-full border border-border shadow-2xl shadow-black/50 backdrop-blur bg-card/50",
                headerTitle: "text-2xl font-bold tracking-tight text-foreground",
                headerSubtitle: "text-muted-foreground",
                socialButtonsBlockButton: "border-border hover:bg-muted text-foreground transition-colors",
                dividerLine: "bg-border",
                dividerText: "text-muted-foreground",
                formFieldLabel: "text-foreground font-medium",
                formFieldInput: "bg-muted/50 border-border focus:ring-2 focus:ring-primary/20",
                formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors",
                footerAction: "hidden",
                footerActionText: "hidden",
                footerActionLink: "hidden",
                identityPreviewText: "text-foreground",
                identityPreviewEditButtonIcon: "text-muted-foreground hover:text-foreground",
              }
            }}
          />
        </div>
        
        {/* Simple minimal footer below auth card */}
        <div className="w-full max-w-[400px] mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            By signing in, you agree to our <Link to="/terms" className="hover:text-primary transition-colors underline underline-offset-4">Terms of Service</Link> and <Link to="/privacy" className="hover:text-primary transition-colors underline underline-offset-4">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
