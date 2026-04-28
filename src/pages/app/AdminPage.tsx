import { useState } from "react";
import { useOrganization } from "@clerk/react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddHostDialog } from "@/components/docker/AddHostDialog";

import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminUserManagement } from "@/components/admin/AdminUserManagement";
import { AdminOrganizationManagement } from "@/components/admin/AdminOrganizationManagement";
import { AdminHostManagement } from "@/components/admin/AdminHostManagement";
import { AdminBillingManagement } from "@/components/admin/AdminBillingManagement";
import { AdminOperations } from "@/components/admin/AdminOperations";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";

const tabs = ["Overview", "Users", "Organizations", "Hosts", "Billing", "Operations", "Audit Log"] as const;
type AdminTab = (typeof tabs)[number];

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("Overview");
  const { organization: currentOrg } = useOrganization();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Admin"
        description="Internal control plane for platform operations, tenant access, and billing overrides"
        breadcrumbs={[{ label: "Admin" }]}
        actions={currentOrg ? <AddHostDialog orgId={currentOrg.id} /> : undefined}
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as AdminTab)} className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-secondary p-1">
          {tabs.map((item) => (
            <TabsTrigger key={item} value={item} className="text-xs">
              {item}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Overview">
          <AdminOverview />
        </TabsContent>

        <TabsContent value="Users">
          <AdminUserManagement />
        </TabsContent>

        <TabsContent value="Organizations">
          <AdminOrganizationManagement />
        </TabsContent>

        <TabsContent value="Hosts">
          <AdminHostManagement />
        </TabsContent>

        <TabsContent value="Billing">
          <AdminBillingManagement />
        </TabsContent>

        <TabsContent value="Operations">
          <AdminOperations />
        </TabsContent>

        <TabsContent value="Audit Log">
          <AdminAuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
