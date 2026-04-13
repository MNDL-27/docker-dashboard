import { OrganizationMembersWorkspaceContainer } from "@/components/settings/OrganizationMembersWorkspace";
import { PageHeader } from "@/components/shared/PageHeader";

export default function MembersPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Members"
        description="Manage team access and roles"
        breadcrumbs={[{ label: "Operations" }, { label: "Members" }]}
      />
      <OrganizationMembersWorkspaceContainer />
    </div>
  );
}
