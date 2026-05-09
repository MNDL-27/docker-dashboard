import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { SEO } from "@/components/shared/SEO";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO title="Page Not Found" description="The page you're looking for doesn't exist or has been moved." />
      <PublicNavbar />

      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="glass-card max-w-md w-full p-10 text-center animate-fade-in">
          <div className="rounded-xl bg-primary/10 p-4 mb-6 w-fit mx-auto">
            <Search className="h-8 w-8 text-primary" />
          </div>

          <h1 className="text-5xl font-bold tracking-tight mb-2">404</h1>
          <p className="text-lg text-muted-foreground mb-2">Page not found</p>
          <p className="text-sm text-muted-foreground mb-8">
            The page <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{location.pathname}</code> doesn't exist or has been moved.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Button>
            </Link>
            <Link to="/docs">
              <Button size="sm">View Docs</Button>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default NotFound;
