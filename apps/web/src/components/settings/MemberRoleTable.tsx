'use client';

import { useMemo, useState } from 'react';
import {
    OrganizationMember,
    OrganizationRole,
    removeOrganizationMember,
    updateOrganizationMemberRole,
} from '@/lib/api';

interface MemberRoleTableProps {
    organizationId: string;
    currentUserId: string;
    currentRole: OrganizationRole;
    members: OrganizationMember[];
    onMembersChanged: () => void;
}

const ASSIGNABLE_ROLES: OrganizationRole[] = ['ADMIN', 'OPERATOR', 'VIEWER'];

function canManageTarget(actorRole: OrganizationRole, targetRole: OrganizationRole): boolean {
    if (actorRole === 'OWNER') {
        return targetRole !== 'OWNER';
    }
    if (actorRole === 'ADMIN') {
        return targetRole === 'OPERATOR' || targetRole === 'VIEWER';
    }
    return false;
}

function allowedNextRoles(actorRole: OrganizationRole): OrganizationRole[] {
    if (actorRole === 'OWNER') {
        return ASSIGNABLE_ROLES;
    }
    if (actorRole === 'ADMIN') {
        return ['OPERATOR', 'VIEWER'];
    }
    return [];
}

export function MemberRoleTable({
    organizationId,
    currentUserId,
    currentRole,
    members,
    onMembersChanged,
}: MemberRoleTableProps) {
    const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
    const [pendingRoles, setPendingRoles] = useState<Record<string, OrganizationRole>>({});
    const [error, setError] = useState<string | null>(null);

    const nextRoles = useMemo(() => allowedNextRoles(currentRole), [currentRole]);

    async function handleRoleUpdate(member: OrganizationMember) {
        const nextRole = pendingRoles[member.id] ?? member.role;
        if (nextRole === member.role) {
            return;
        }

        setUpdatingMemberId(member.id);
        setError(null);

        try {
            await updateOrganizationMemberRole(organizationId, member.id, nextRole);
            onMembersChanged();
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : 'Failed to update member role');
        } finally {
            setUpdatingMemberId(null);
        }
    }

    async function handleRemove(member: OrganizationMember) {
        setRemovingMemberId(member.id);
        setError(null);

        try {
            await removeOrganizationMember(organizationId, member.id);
            onMembersChanged();
        } catch (removeError) {
            setError(removeError instanceof Error ? removeError.message : 'Failed to remove member');
        } finally {
            setRemovingMemberId(null);
        }
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">Organization members</h2>
                <p className="text-sm text-slate-400 mt-1">
                    Owners and admins can adjust roles and remove users according to role matrix constraints.
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs tracking-wider">
                        <tr>
                            <th className="px-6 py-3">Member</th>
                            <th className="px-6 py-3">Current role</th>
                            <th className="px-6 py-3">Joined</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {members.map((member) => {
                            const isSelf = member.user.id === currentUserId;
                            const canManage = canManageTarget(currentRole, member.role) && !isSelf;
                            const selectedRole = pendingRoles[member.id] ?? member.role;

                            return (
                                <tr key={member.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-slate-100 font-medium">{member.user.name ?? 'Unnamed user'}</div>
                                        <div className="text-xs text-slate-500">{member.user.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-slate-800 text-slate-300">
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {new Date(member.joinedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {canManage ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <select
                                                    value={selectedRole}
                                                    onChange={(event) => {
                                                        setPendingRoles((previous) => ({
                                                            ...previous,
                                                            [member.id]: event.target.value as OrganizationRole,
                                                        }));
                                                    }}
                                                    disabled={updatingMemberId === member.id}
                                                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200"
                                                >
                                                    {nextRoles.map((roleOption) => (
                                                        <option key={roleOption} value={roleOption}>
                                                            {roleOption}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRoleUpdate(member)}
                                                    disabled={updatingMemberId === member.id || selectedRole === member.role}
                                                    className="px-3 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemove(member)}
                                                    disabled={removingMemberId === member.id}
                                                    className="px-3 py-1 rounded text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-right text-xs text-slate-500">
                                                {isSelf ? 'You' : 'No permission'}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {members.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-slate-500">No members found for this organization.</div>
            )}

            {error && <div className="px-6 py-3 text-sm text-red-400 border-t border-slate-800">{error}</div>}
        </div>
    );
}
