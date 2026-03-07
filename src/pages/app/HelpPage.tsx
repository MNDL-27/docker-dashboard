import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { BookOpen, MessageCircle, FileText, ExternalLink } from "lucide-react";

const resources = [
  { icon: BookOpen, title: "Documentation", desc: "Guides, API reference, and tutorials", link: "#" },
  { icon: FileText, title: "Changelog", desc: "Latest updates and release notes", link: "#" },
  { icon: MessageCircle, title: "Community", desc: "Join the Docker Dashboard community", link: "#" },
];

const changelog = [
  { version: "v1.4.2", date: "Jan 10, 2024", changes: ["Improved container metrics accuracy", "Added Slack thread notifications", "Fixed agent reconnection on network flap"] },
  { version: "v1.4.1", date: "Dec 28, 2023", changes: ["New log search syntax", "PagerDuty integration", "Performance improvements for large fleets"] },
  { version: "v1.4.0", date: "Dec 15, 2023", changes: ["Incident management system", "Custom dashboards", "Team SSO support", "Audit log export"] },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Help & Support" description="Documentation, changelog, and resources" breadcrumbs={[{ label: "Help" }]} />

      <div className="grid md:grid-cols-3 gap-4">
        {resources.map(r => (
          <div key={r.title} className="glass-card p-6 hover:bg-accent/30 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <r.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">{r.title}</h3>
            <p className="text-sm text-muted-foreground">{r.desc}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Changelog</h3>
        <div className="space-y-4">
          {changelog.map(entry => (
            <div key={entry.version} className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-primary">{entry.version}</span>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <ul className="space-y-1.5">
                {entry.changes.map(c => (
                  <li key={c} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
