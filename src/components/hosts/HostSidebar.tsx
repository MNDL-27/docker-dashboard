import { Search, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HostCard } from "@/components/hosts/HostCard";
import type { DockerHost } from "@/types/database";
import type { HostMetricsPoint } from "@/hooks/useHostMetrics";

interface HostSidebarProps {
  filteredHosts: DockerHost[];
  selectedHost: DockerHost | null;
  selectedPreviewMetrics: Pick<HostMetricsPoint, "cpu" | "memory"> | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectHost: (hostId: string) => void;
  onHideSidebar: () => void;
  isHostLocked: (hostId: string) => boolean;
}

export function HostSidebar({
  filteredHosts,
  selectedHost,
  selectedPreviewMetrics,
  search,
  onSearchChange,
  onSelectHost,
  onHideSidebar,
  isHostLocked,
}: HostSidebarProps) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-white/5 px-5 py-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Host infrastructure</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Browse hosts</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onHideSidebar}
            aria-label="Hide host infrastructure panel"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input 
            value={search} 
            onChange={(event) => onSearchChange(event.target.value)} 
            placeholder="Search hosts..." 
            className="pl-9" 
          />
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-18rem)]">
        <div className="space-y-3 p-4">
          {filteredHosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
              No hosts match your search.
            </div>
          ) : (
            filteredHosts.map((host) => (
              <HostCard
                key={host.id}
                host={host}
                selected={host.id === selectedHost?.id}
                previewMetrics={host.id === selectedHost?.id ? selectedPreviewMetrics : null}
                onSelect={() => onSelectHost(host.id)}
                isLocked={isHostLocked(host.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
