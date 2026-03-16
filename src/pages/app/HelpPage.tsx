import { PageHeader } from "@/components/shared/PageHeader";
import { BookOpen, MessageCircle, FileText, Construction } from "lucide-react";

const resources = [
  { icon: BookOpen, title: "Documentation", desc: "Guides, API reference, and tutorials", link: "#" },
  { icon: FileText, title: "Changelog", desc: "Latest updates and release notes", link: "#" },
  { icon: MessageCircle, title: "Community", desc: "Join the Docker Dashboard community", link: "#" },
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
        <div className="glass-card p-12 text-center">
          <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Release notes and product updates will be integrated here soon.
          </p>
        </div>
      </div>
    </div>
  );
}
