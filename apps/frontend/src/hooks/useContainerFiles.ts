import { useQuery } from "@tanstack/react-query";
import { dockerApi } from "@/services/docker-api";
import { MEDIUM_POLL_INTERVAL_MS, SLOW_POLL_INTERVAL_MS } from "@/lib/constants";

export function useContainerFileList(
  hostId?: string | null,
  containerId?: string | null,
  path: string = "/",
) {
  return useQuery({
    queryKey: ["container-fs-list", hostId, containerId, path],
    queryFn: () => dockerApi.listFiles(hostId!, containerId!, path),
    enabled: !!hostId && !!containerId,
    retry: false,
    staleTime: MEDIUM_POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  });
}

export function useContainerFileContent(
  hostId?: string | null,
  containerId?: string | null,
  path?: string | null,
) {
  return useQuery({
    queryKey: ["container-fs-read", hostId, containerId, path],
    queryFn: () => dockerApi.readFile(hostId!, containerId!, path!),
    enabled: !!hostId && !!containerId && !!path,
    retry: false,
    staleTime: SLOW_POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  });
}
