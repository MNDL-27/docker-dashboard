import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Box, Building2, FolderOpen, Terminal, Check, ArrowRight, Copy } from "lucide-react";

const steps = ["Create Organization", "Create Project", "Connect Host", "You're Ready"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const installCommand = `docker run -d --name dd-agent \\
  --restart always \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -e DD_TOKEN="dk_install_a8f2c4d1b7e39e7f" \\
  -e DD_PROJECT="production-cluster" \\
  dockerdashboard/agent:latest`;

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Set up your workspace</h1>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`w-full h-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
              <span className={`text-[10px] ${i <= step ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
            </div>
          ))}
        </div>

        <div className="glass-card p-6 space-y-6 min-h-[280px]">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Name your organization</h2>
                  <p className="text-sm text-muted-foreground">This is your team workspace.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Organization name</Label>
                <Input placeholder="e.g. Acme Cloud" value={orgName} onChange={e => setOrgName(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => setStep(1)} disabled={!orgName}>Continue</Button>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Create your first project</h2>
                  <p className="text-sm text-muted-foreground">Projects group related hosts and containers.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Project name</Label>
                <Input placeholder="e.g. Production Cluster" value={projectName} onChange={e => setProjectName(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => setStep(2)} disabled={!projectName}>Continue</Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Terminal className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Connect your first host</h2>
                  <p className="text-sm text-muted-foreground">Run this command on your Docker host.</p>
                </div>
              </div>
              <div className="relative">
                <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono overflow-x-auto text-muted-foreground">
                  {installCommand}
                </pre>
                <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-7" onClick={handleCopy}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Or use <button className="text-primary hover:underline">docker-compose</button> • <button className="text-primary hover:underline">Kubernetes</button>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Skip for now</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>I've installed it</Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                <Check className="h-7 w-7 text-success" />
              </div>
              <h2 className="text-xl font-semibold">You're all set!</h2>
              <p className="text-sm text-muted-foreground">
                Your workspace is ready. Head to your dashboard to start monitoring.
              </p>
              <Button className="gap-2" onClick={() => navigate("/app")}>
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
