import { PageHeader } from "@/components/shared/PageHeader";
import { PremiumFeatureBlock } from "@/components/shared/PremiumFeatureBlock";
import { OrganizationMembersWorkspaceContainer } from "@/components/settings/OrganizationMembersWorkspace";
import { useViewerState } from "@/hooks/useViewerState";

export default function MembersPage() {
  const { data: viewer } = useViewerState();
  const entitlements = viewer?.entitlements;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Team Management"
        description="Manage organization members, roles, and invitations."
        breadcrumbs={[{ label: "Management" }, { label: "Team" }]}
      />

      <PremiumFeatureBlock
        title="Team Collaboration"
        description="Upgrade your plan to invite team members to your organization and manage access together."
        hasAccess={entitlements?.canUseTeamCollaboration ?? false}
      >
        <OrganizationMembersWorkspaceContainer />
      </PremiumFeatureBlock>
    </div>
  );
}
