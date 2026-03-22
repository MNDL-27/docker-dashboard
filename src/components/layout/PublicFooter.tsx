import { Link } from "react-router-dom";
import { Box } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
                <Box className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold tracking-tight">Docker Dashboard</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs transition-opacity hover:opacity-80">
              Modern monitor and management fleet for Docker containers. Secure, lightweight, and launch-ready.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Product</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/features" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link to="/security" className="hover:text-primary transition-colors">Security</Link></li>
              <li><Link to="/docs" className="hover:text-primary transition-colors">Documentation</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/tos" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/refunds" className="hover:text-primary transition-colors">Refund Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact Sales</Link></li>
              <li><a href="mailto:support@dockerdash.app" className="hover:text-primary transition-colors">Email Support</a></li>
              <li><Link to="/docs" className="hover:text-primary transition-colors">Help Center</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            © {new Date().getFullYear()} Docker Dashboard. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-sm font-medium text-muted-foreground">
            <Link to="/tos" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/refunds" className="hover:text-primary transition-colors">Refunds</Link>
            <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
