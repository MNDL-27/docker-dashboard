import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganizationList } from "@clerk/clerk-react";
import { apiFetch } from "@/lib/api";
import { dedicatedDeploymentApi } from "@/services/dedicated-deployment-api";
import type {
  DedicatedDeploymentIntake,
  DedicatedDeploymentRecord,
  DedicatedIntakeState,
  DedicatedIntakeStep,
} from "@/types/dedicated";

export const DEDICATED_STEPS: DedicatedIntakeStep[] = [
  "scope",
  "infrastructure",
  "security",
  "integrations",
  "readiness",
  "review",
  "submitted",
];

export const DEFAULT_DEDICATED_INTAKE: DedicatedDeploymentIntake = {
  companyName: "",
  primaryContactName: "",
  primaryContactEmail: "",
  buyerRole: "",
  targetGoLiveWindow: "30_days",
  estimatedNodeRange: "6_15",
  environmentCount: 1,
  preferredRegion: "eu-central",
  secondaryRegions: [],
  needsCustomDomain: true,
  needsPrivateNetworking: false,
  complianceNeeds: [],
  retentionRequirementDays: 365,
  requiresSSO: true,
  integrations: [],
  technicalOwnerName: "",
  technicalOwnerEmail: "",
  operatorSeatEstimate: 5,
  hasExistingDockerAgentRollout: false,
  rolloutNotes: "",
  blockers: "",
};

function sanitizeOrgName(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 2 ? trimmed : "Dedicated Deployment";
}

async function waitForActiveOrganization(maxAttempts = 12) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const data = await apiFetch("/auth/me");
    const activeOrgId = data.user?.active_org_id as string | null | undefined;
    if (activeOrgId) {
      return activeOrgId;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
  }

  throw new Error("Workspace sync is still in progress. Please retry in a moment.");
}

export function useDedicatedDeployment() {
  return useQuery({
    queryKey: ["dedicated-deployment", "current"],
    queryFn: () => dedicatedDeploymentApi.getCurrent(),
    staleTime: 15_000,
    retry: false,
  });
}

export function useDedicatedIntakeState() {
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [state, setState] = useState<DedicatedIntakeState>({
    step: "scope",
    data: DEFAULT_DEDICATED_INTAKE,
    isSaving: false,
    isSubmitting: false,
    submitError: null,
    referenceId: null,
  });

  const stepIndex = useMemo(() => DEDICATED_STEPS.indexOf(state.step), [state.step]);

  const updateField = <K extends keyof DedicatedDeploymentIntake>(key: K, value: DedicatedDeploymentIntake[K]) => {
    setState((current) => ({
      ...current,
      data: {
        ...current.data,
        [key]: value,
      },
      submitError: null,
    }));
  };

  const toggleArrayValue = (
    key: "secondaryRegions" | "complianceNeeds" | "integrations",
    value: string,
  ) => {
    setState((current) => {
      const existing = current.data[key] as string[];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];

      return {
        ...current,
        data: {
          ...current.data,
          [key]: next,
        },
        submitError: null,
      };
    });
  };

  const nextStep = () => {
    setState((current) => {
      const currentIndex = DEDICATED_STEPS.indexOf(current.step);
      const next = DEDICATED_STEPS[Math.min(currentIndex + 1, DEDICATED_STEPS.length - 2)];
      return { ...current, step: next, submitError: null };
    });
  };

  const previousStep = () => {
    setState((current) => {
      const currentIndex = DEDICATED_STEPS.indexOf(current.step);
      const prev = DEDICATED_STEPS[Math.max(currentIndex - 1, 0)];
      return { ...current, step: prev, submitError: null };
    });
  };

  const ensureWorkspace = async () => {
    const auth = await apiFetch("/auth/me");
    const activeOrgId = auth.user?.active_org_id as string | null | undefined;
    if (activeOrgId) {
      return activeOrgId;
    }

    const firstMembership = userMemberships.data?.[0]?.organization?.id;
    if (firstMembership && setActive) {
      await setActive({ organization: firstMembership });
      return waitForActiveOrganization();
    }

    if (!createOrganization || !setActive) {
      throw new Error("Workspace tools are not ready yet. Please refresh and try again.");
    }

    const org = await createOrganization({ name: sanitizeOrgName(state.data.companyName) });
    await setActive({ organization: org.id });
    return waitForActiveOrganization();
  };

  const submit = async (): Promise<DedicatedDeploymentRecord> => {
    setState((current) => ({ ...current, isSubmitting: true, submitError: null }));

    try {
      await ensureWorkspace();
      const result = await dedicatedDeploymentApi.create(state.data);
      setState((current) => ({
        ...current,
        step: "submitted",
        isSubmitting: false,
        referenceId: result.reference_id,
      }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit the deployment request.";
      setState((current) => ({
        ...current,
        isSubmitting: false,
        submitError: message,
      }));
      throw error;
    }
  };

  return {
    state,
    stepIndex,
    updateField,
    toggleArrayValue,
    nextStep,
    previousStep,
    submit,
  };
}
