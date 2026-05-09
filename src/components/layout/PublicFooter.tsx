import { Link } from "react-router-dom";
import { Box } from "lucide-react";

const footerLinks = {
  Product: [
    { to: "/features", label: "Features" },
    { to: "/pricing", label: "Pricing" },
    { to: "/security", label: "Security" },
    { to: "/docs", label: "Documentation" },
  ],
  Legal: [
    { to: "/tos", label: "Terms of Service" },
    { to: "/privacy", label: "Privacy Policy" },
    { to: "/refunds", label: "Refund Policy" },
  ],
  Support: [
    { to: "/contact", label: "Contact" },
    { href: "mailto:support@dockerdash.app", label: "Email Support" },
    { to: "/docs", label: "Help Center" },
  ],
};

export function PublicFooter() {
  return (
    <footer className="bg-card/50 border-t border-border/60 py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center shadow-sm shadow-primary/20">
                <Box className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold tracking-tight">DockerDash</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Fleet monitoring for teams who self-host Docker. Lightweight agent, real-time metrics, zero Docker socket exposure.
            </p>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">{title}</h4>
              <ul className="space-y-2 text-sm">
                {links.map((link) => (
                  <li key={link.label}>
                    {"to" in link ? (
                      <Link to={link.to} className="text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} DockerDash. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link to="/tos" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/refunds" className="hover:text-foreground transition-colors">Refunds</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
