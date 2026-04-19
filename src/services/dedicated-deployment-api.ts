import { apiFetch } from "@/lib/api";
import type { DedicatedDeploymentIntake, DedicatedDeploymentRecord } from "@/types/dedicated";

export const dedicatedDeploymentApi = {
  create: (input: DedicatedDeploymentIntake) =>
    apiFetch("/dedicated-deployments", {
      method: "POST",
      body: input,
    }) as Promise<DedicatedDeploymentRecord>,

  getCurrent: () =>
    apiFetch("/dedicated-deployments/current") as Promise<DedicatedDeploymentRecord | null>,
};
