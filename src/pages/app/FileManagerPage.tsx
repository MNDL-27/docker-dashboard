import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Home,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Server,
  X,
  AlertTriangle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useContainerFileList, useContainerFileContent } from "@/hooks/useContainerFiles";
import { useContainers } from "@/hooks/useDocker";
import { useViewerState } from "@/hooks/useViewerState";
import { PremiumFeatureBlock } from "@/components/shared/PremiumFeatureBlock";
import type { FileEntry } from "@/services/docker-api";

// ── Helpers ──

function getFileIcon(entry: FileEntry) {
  if (entry.type === "directory") return Folder;
  if (entry.type === "symlink") return Link2;
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  if (["json", "jsonl"].includes(ext)) return FileJson;
  if (["ts", "tsx", "js", "jsx", "py", "go", "rs", "sh", "bash", "rb", "java", "c", "cpp", "h", "css", "scss", "html", "xml", "yaml", "yml", "toml", "ini", "conf", "cfg", "env", "dockerfile", "makefile"].includes(ext)) return FileCode;
  if (["md", "txt", "log", "csv"].includes(ext)) return FileText;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    py: "python", go: "go", rs: "rust", sh: "bash", bash: "bash",
    rb: "ruby", java: "java", c: "c", cpp: "cpp", h: "c",
    css: "css", scss: "scss", html: "html", xml: "xml",
    md: "markdown", sql: "sql", dockerfile: "dockerfile",
    makefile: "makefile", ini: "ini", conf: "conf", cfg: "conf",
    env: "bash", log: "log", txt: "plaintext", csv: "csv",
  };
  return map[ext] || "plaintext";
}

// ── Breadcrumb ──

function PathBreadcrumb({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (path: string) => void;
}) {
  const segments = path.split("/").filter(Boolean);

  return (
    <div className="flex items-center gap-1 overflow-x-auto text-sm">
      <button
        type="button"
        onClick={() => onNavigate("/")}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
        <span>/</span>
      </button>
      {segments.map((segment, index) => {
        const segmentPath = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        return (
          <div key={segmentPath} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
            <button
              type="button"
              onClick={() => onNavigate(segmentPath)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                isLast
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              {segment}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Container Selector ──

function ContainerSelector({
  containers,
  selectedContainerId,
  selectedHostId,
  onSelect,
}: {
  containers: any[];
  selectedContainerId: string | null;
  selectedHostId: string | null;
  onSelect: (containerId: string, hostId: string, containerName: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContainers = useMemo(() => {
    const running = containers.filter((c: any) => c.State === "running");
    if (!searchQuery) return running;
    const q = searchQuery.toLowerCase();
    return running.filter(
      (c: any) =>
        (c.Names?.[0] || "").toLowerCase().includes(q) ||
        (c.Image || "").toLowerCase().includes(q) ||
        (c._hostName || "").toLowerCase().includes(q),
    );
  }, [containers, searchQuery]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search running containers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background/40 border-white/10 rounded-xl"
        />
      </div>
      <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
        {filteredContainers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {containers.length === 0
              ? "No containers available"
              : "No running containers match your search. File browsing requires a running container."}
          </div>
        ) : (
          filteredContainers.map((c: any) => {
            const name = (c.Names?.[0] || "").replace(/^\//, "");
            const isSelected = c.Id === selectedContainerId && c._hostId === selectedHostId;
            return (
              <button
                key={`${c._hostId}-${c.Id}`}
                type="button"
                onClick={() => onSelect(c.Id, c._hostId, name)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all",
                  isSelected
                    ? "border border-primary/30 bg-primary/10"
                    : "border border-transparent hover:border-white/10 hover:bg-white/5",
                )}
              >
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", isSelected ? "bg-primary/20" : "bg-white/5")}>
                  <HardDrive className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", isSelected ? "text-primary" : "text-foreground")}>{name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{(c.Image || "").split(":")[0]}</span>
                    {c._hostName && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="flex items-center gap-1 truncate">
                          <Server className="h-3 w-3" />
                          {c._hostName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── File Content Viewer ──

function FileViewer({
  hostId,
  containerId,
  filePath,
  onClose,
}: {
  hostId: string;
  containerId: string;
  filePath: string;
  onClose: () => void;
}) {
  const { data: viewer } = useViewerState();
  const canRead = !!viewer?.entitlements?.canUseFileManager;

  const { data, isLoading, error } = useContainerFileContent(
    canRead ? hostId : null,
    canRead ? containerId : null,
    canRead ? filePath : null
  );
  const fileName = filePath.split("/").pop() || filePath;
  const lang = getLanguageFromPath(filePath);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-primary" />
            <span className="truncate font-mono text-sm font-medium text-foreground">{fileName}</span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{lang}</span>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{filePath}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 rounded-lg">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!canRead ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-md w-full">
              <PremiumFeatureBlock
                title="File Explorer Pro"
                description="Viewing file contents is a premium feature. Upgrade your plan to inspect configuration files, logs, and more directly from the dashboard."
              />
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          </div>
        ) : data?.binary ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
            <File className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Binary file ({formatFileSize(data.size)})</p>
            <p className="text-xs text-muted-foreground/60">Binary file preview is not supported</p>
          </div>
        ) : (
          <div className="relative">
            {data?.truncated && (
              <div className="sticky top-0 z-10 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning">
                File truncated — showing first 2 MB of {formatFileSize(data.size)}
              </div>
            )}
            {data?.size !== undefined && (
              <div className="border-b border-white/5 px-4 py-1.5 text-right text-xs text-muted-foreground/60">
                {formatFileSize(data.size)}
              </div>
            )}
            <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-foreground/90">
              <code>{data?.content || ""}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function FileManagerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: viewer } = useViewerState();
  const orgId = viewer?.active_org_id;

  const paramContainerId = searchParams.get("container");
  const paramHostId = searchParams.get("host");

  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(paramContainerId);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(paramHostId);
  const [selectedContainerName, setSelectedContainerName] = useState<string>("");
  const [currentPath, setCurrentPath] = useState("/");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const { data: containers = [], isLoading: containersLoading } = useContainers(orgId, true);

  const {
    data: dirData,
    isLoading: dirLoading,
    error: dirError,
    refetch: refetchDir,
  } = useContainerFileList(selectedHostId, selectedContainerId, currentPath);

  const entries = dirData?.entries ?? [];
  const filteredEntries = useMemo(() => {
    if (!filterQuery) return entries;
    const q = filterQuery.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, filterQuery]);

  const handleSelectContainer = (containerId: string, hostId: string, containerName: string) => {
    setSelectedContainerId(containerId);
    setSelectedHostId(hostId);
    setSelectedContainerName(containerName);
    setCurrentPath("/");
    setSelectedFile(null);
    setFilterQuery("");
    setSearchParams({ host: hostId, container: containerId });
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
    setFilterQuery("");
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.type === "directory") {
      const newPath = currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`;
      handleNavigate(newPath);
    } else if (entry.type === "file" || entry.type === "symlink") {
      const filePath = currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`;
      setSelectedFile(filePath);
    }
  };

  const handleRefresh = () => {
    refetchDir();
    if (selectedFile) {
      queryClient.invalidateQueries({
        queryKey: ["container-fs-read", selectedHostId, selectedContainerId, selectedFile],
      });
    }
  };

  const hasContainer = !!selectedContainerId && !!selectedHostId;

  const canUseFileManager = !!viewer?.entitlements?.canUseFileManager;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="File Manager"
        description="Browse and view files inside your Docker containers"
        breadcrumbs={[{ label: "File Manager" }]}
      />

      {!canUseFileManager ? (
        <div className="glass-card rounded-[28px] p-8">
          <PremiumFeatureBlock
            title="File Manager"
            description="Browse container filesystems, inspect configuration files, and preview logs directly from the dashboard. Upgrade to an Individual, Business, or Dedicated plan to unlock the File Manager."
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
          {/* Left: Container selector */}
          <div className="glass-card rounded-[28px] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Select Container
            </h3>
            {containersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ContainerSelector
                containers={containers as any[]}
                selectedContainerId={selectedContainerId}
                selectedHostId={selectedHostId}
                onSelect={handleSelectContainer}
              />
            )}
          </div>

          {/* Right: File browser + viewer */}
          <div className="min-w-0 space-y-4">
            {!hasContainer ? (
              <div className="glass-card flex flex-col items-center justify-center rounded-[28px] py-24 text-center">
                <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-lg font-medium text-foreground">Select a running container</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Choose a container from the sidebar to browse its filesystem. Only running containers support file browsing.
                </p>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="glass-card flex items-center gap-3 rounded-[20px] px-5 py-3">
                  <div className="flex-1 overflow-hidden">
                    <PathBreadcrumb path={currentPath} onNavigate={handleNavigate} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Filter..."
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        className="h-8 w-40 bg-background/40 border-white/10 rounded-lg pl-8 text-xs"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={handleRefresh}
                      title="Refresh"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className={cn("grid gap-4", selectedFile ? "xl:grid-cols-[1fr,1fr]" : "xl:grid-cols-1")}>
                  {/* Directory listing */}
                  <div className="glass-card min-w-0 rounded-[24px] overflow-hidden">
                    <div className="border-b border-white/5 px-5 py-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {selectedContainerName || "Files"}
                        </h4>
                        <span className="rounded-full bg-white/5 px-3 py-0.5 text-xs text-muted-foreground">
                          {filteredEntries.length} {filteredEntries.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                    </div>

                    {dirLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : dirError ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <AlertTriangle className="h-8 w-8 text-destructive/60" />
                        <p className="text-sm text-destructive">{(dirError as Error).message}</p>
                        <p className="text-xs text-muted-foreground">Make sure the container is running and the path exists.</p>
                      </div>
                    ) : filteredEntries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Folder className="mb-3 h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          {filterQuery ? "No files match your filter" : "Empty directory"}
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[560px] overflow-y-auto">
                        {/* Parent directory */}
                        {currentPath !== "/" && (
                          <button
                            type="button"
                            onClick={() => {
                              const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
                              handleNavigate(parent);
                            }}
                            className="flex w-full items-center gap-3 border-b border-white/5 px-5 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                          >
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">..</span>
                          </button>
                        )}
                        {filteredEntries.map((entry) => {
                          const Icon = getFileIcon(entry);
                          const entryPath = currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`;
                          const isActive = selectedFile === entryPath;
                          return (
                            <button
                              key={entry.name}
                              type="button"
                              onClick={() => handleEntryClick(entry)}
                              className={cn(
                                "group flex w-full items-center gap-3 border-b border-white/5 px-5 py-2.5 text-left text-sm transition-colors",
                                isActive
                                  ? "bg-primary/10"
                                  : "hover:bg-white/5",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  entry.type === "directory"
                                    ? "text-primary"
                                    : entry.type === "symlink"
                                      ? "text-sky-400"
                                      : "text-muted-foreground",
                                )}
                              />
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate",
                                  entry.type === "directory"
                                    ? "font-medium text-foreground"
                                    : isActive
                                      ? "text-primary"
                                      : "text-foreground/80",
                                )}
                              >
                                {entry.name}
                                {entry.linkTarget && (
                                  <span className="ml-1.5 text-xs text-muted-foreground/60">→ {entry.linkTarget}</span>
                                )}
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground/60">
                                {entry.type === "directory" ? "" : formatFileSize(entry.size)}
                              </span>
                              <span className="hidden shrink-0 font-mono text-xs text-muted-foreground/40 sm:block">
                                {entry.permissions}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* File content viewer */}
                  {selectedFile && selectedHostId && selectedContainerId && (
                    <div className="glass-card min-w-0 overflow-hidden rounded-[24px]">
                      <FileViewer
                        hostId={selectedHostId}
                        containerId={selectedContainerId}
                        filePath={selectedFile}
                        onClose={() => setSelectedFile(null)}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
