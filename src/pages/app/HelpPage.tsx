import { PageHeader } from "@/components/shared/PageHeader";
import { BookOpen, Mail, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

const resources = [
  { icon: BookOpen, title: "Documentation", desc: "Product guides and setup details for the current feature set.", link: "/docs", external: false },
  { icon: Wrench, title: "Setup Guide", desc: "Open the in-app onboarding and rollout guide for your active organization.", link: "/app/setup-guide", external: false },
  { icon: Mail, title: "Contact Support", desc: "Reach the team directly for rollout questions and operational help.", link: "mailto:support@dockerdash.app", external: true },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Help & Support" description="Documentation, setup help, and direct support paths" breadcrumbs={[{ label: "Help" }]} />
      <p className="text-sm text-muted-foreground">
        Docker Dashboard keeps support intentionally lightweight in v1: docs, the setup guide, and a direct email path.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        {resources.map(r => (
          r.external ? (
            <a key={r.title} href={r.link} className="glass-card p-6 hover:bg-accent/30 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <r.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{r.title}</h3>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </a>
          ) : (
            <Link key={r.title} to={r.link} className="glass-card p-6 hover:bg-accent/30 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <r.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{r.title}</h3>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </Link>
          )
        ))}
      </div>
    </div>
  );
}
