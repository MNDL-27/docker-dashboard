export type DedicatedRegion =
  | "eu-central"
  | "eu-west"
  | "us-east"
  | "us-west"
  | "ap-south"
  | "custom";

export type ComplianceNeed =
  | "soc2"
  | "iso27001"
  | "gdpr"
  | "data_residency"
  | "none";

export type IntegrationNeed =
  | "aws_ecr"
  | "slack"
  | "pagerduty"
  | "email"
  | "pdf_reports"
  | "webhooks"
  | "sso";

export type DedicatedIntakeStep =
  | "scope"
  | "infrastructure"
  | "security"
  | "integrations"
  | "readiness"
  | "review"
  | "submitted";

export type DedicatedDeploymentStatus =
  | "intake_received"
  | "capacity_reserved"
  | "provisioning"
  | "hardening"
  | "ready_for_handoff"
  | "active";

export interface DedicatedDeploymentIntake {
  companyName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  buyerRole: string;
  targetGoLiveWindow: "asap" | "2_weeks" | "30_days" | "custom";
  estimatedNodeRange: "1_5" | "6_15" | "16_25" | "26_plus";
  environmentCount: number;
  preferredRegion: DedicatedRegion;
  secondaryRegions: DedicatedRegion[];
  needsCustomDomain: boolean;
  needsPrivateNetworking: boolean;
  complianceNeeds: ComplianceNeed[];
  retentionRequirementDays: number | null;
  requiresSSO: boolean;
  integrations: IntegrationNeed[];
  technicalOwnerName: string;
  technicalOwnerEmail: string;
  operatorSeatEstimate: number;
  hasExistingDockerAgentRollout: boolean;
  rolloutNotes: string;
  blockers: string;
}

export interface DedicatedIntakeState {
  step: DedicatedIntakeStep;
  data: DedicatedDeploymentIntake;
  isSaving: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  referenceId: string | null;
}

export interface DedicatedDeploymentChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface DedicatedDeploymentRecord {
  organization_id: string;
  reference_id: string;
  plan_id: "enterprise";
  status: DedicatedDeploymentStatus;
  target_window_label: string;
  latest_update_at: string;
  latest_update_note: string;
  technical_owner_name: string;
  technical_owner_email: string;
  intake_payload: DedicatedDeploymentIntake;
  checklist: DedicatedDeploymentChecklistItem[];
  created_at: string;
  updated_at: string;
}
