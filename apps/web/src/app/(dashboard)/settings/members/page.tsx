'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InviteMemberForm } from '@/components/settings/InviteMemberForm';
import { MemberRoleTable } from '@/components/settings/MemberRoleTable';
import {
    fetchCurrentUser,
    fetchOrganizationMembers,
    fetchOrganizations,
    getInventoryDensityPreference,
    getSelectedOrganizationId,
    InventoryDensity,
    OrganizationMember,
    OrganizationRole,
    OrganizationSummary,
    setInventoryDensityPreference,
    setSelectedOrganizationId,
} from '@/lib/api';

function canManageMembers(role: OrganizationRole | undefined): role is OrganizationRole {
    return role === 'OWNER' || role === 'ADMIN';
}

export default function MembersSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [inventoryDensity, setInventoryDensity] = useState<InventoryDensity>('DETAILED');

    const currentOrganization = useMemo(
        () => organizations.find((organization) => organization.id === orgId),
        [orgId, organizations]
    );
    const currentRole = currentOrganization?.role;
    const canManage = canManageMembers(currentRole);

    useEffect(() => {
        setInventoryDensity(getInventoryDensityPreference());
    }, []);

    useEffect(() => {
        async function bootstrap() {
            try {
                const [user, availableOrganizations] = await Promise.all([
                    fetchCurrentUser(),
                    fetchOrganizations(),
                ]);

                if (!availableOrganizations.length) {
                    router.replace('/onboarding/organization');
                    return;
                }

                const persistedOrgId = getSelectedOrganizationId();
                const selectedOrg = persistedOrgId
                    ? availableOrganizations.find((organization) => organization.id === persistedOrgId)
                    : null;
                const activeOrgId = selectedOrg?.id ?? availableOrganizations[0].id;

                setCurrentUserId(user.id);
                setOrganizations(availableOrganizations);
                setSelectedOrganizationId(activeOrgId);
                setOrgId(activeOrgId);
            } catch {
                router.replace('/login');
            } finally {
                setLoading(false);
            }
        }

        void bootstrap();
    }, [router]);

    useEffect(() => {
        if (!orgId) {
            return;
        }

        void refreshMembers(orgId);
    }, [orgId]);

    async function refreshMembers(organizationId: string) {
        try {
            setError(null);
            const fetchedMembers = await fetchOrganizationMembers(organizationId);
            setMembers(fetchedMembers);
        } catch (refreshError) {
            setMembers([]);
            setError(refreshError instanceof Error ? refreshError.message : 'Failed to load members');
        }
    }

    function handleOrganizationChange(nextOrgId: string) {
        setSelectedOrganizationId(nextOrgId);
        setOrgId(nextOrgId);
    }

    function handleDensityChange(nextDensity: InventoryDensity) {
        setInventoryDensity(nextDensity);
        setInventoryDensityPreference(nextDensity);
    }

    if (loading) {
        return <div className="p-8 text-slate-400 font-medium">Loading member settings...</div>;
    }

    if (!orgId) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-6 text-amber-300">
                    No organization selected. Join or create an organization to manage members.
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Member management</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Invite teammates and maintain deterministic role assignments across your organization.
                    </p>
                </div>
                <select
                    value={orgId}
                    onChange={(event) => handleOrganizationChange(event.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm"
                >
                    {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                            {organization.name}
                        </option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <h2 className="text-base font-semibold text-slate-100">Inventory density</h2>
                <p className="mt-1 text-sm text-slate-400">
                    Set the default detail level for host and container cards in Fleet Inventory.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {(['SIMPLE', 'STANDARD', 'DETAILED'] as const).map((value) => {
                        const selected = inventoryDensity === value;

                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => handleDensityChange(value)}
                                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                    selected
                                        ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                                }`}
                            >
                                {value === 'SIMPLE' ? 'Simple' : value === 'STANDARD' ? 'Standard' : 'Detailed'}
                            </button>
                        );
                    })}
                </div>
            </div>

            <InviteMemberForm
                organizationId={orgId}
                disabled={!canManage}
                onInviteCreated={() => {
                    void refreshMembers(orgId);
                }}
            />

            {currentRole ? (
                <MemberRoleTable
                    organizationId={orgId}
                    currentRole={currentRole}
                    currentUserId={currentUserId}
                    members={members}
                    onMembersChanged={() => {
                        void refreshMembers(orgId);
                    }}
                />
            ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
                    Unable to resolve your organization role for this scope.
                </div>
            )}
        </div>
    );
}
