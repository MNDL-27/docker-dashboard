'use client';

import { FormEvent, useState } from 'react';
import { createOrganizationInvite, OrganizationRole } from '@/lib/api';

interface InviteMemberFormProps {
    organizationId: string;
    disabled: boolean;
    onInviteCreated: () => void;
}

const ASSIGNABLE_ROLES: OrganizationRole[] = ['ADMIN', 'OPERATOR', 'VIEWER'];

export function InviteMemberForm({ organizationId, disabled, onInviteCreated }: InviteMemberFormProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<OrganizationRole>('VIEWER');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (disabled) {
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const invite = await createOrganizationInvite(organizationId, email, role);
            setEmail('');
            setRole('VIEWER');
            setSuccess(`Invite created for ${invite.email} as ${invite.role}.`);
            onInviteCreated();
        } catch (submissionError) {
            setError(submissionError instanceof Error ? submissionError.message : 'Failed to create invite');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-100">Invite teammate</h2>
                <p className="text-sm text-slate-400 mt-1">Send an organization invite with a deterministic starting role.</p>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
                <div>
                    <label htmlFor="invite-email" className="block text-sm font-medium text-slate-400 mb-1">
                        Email
                    </label>
                    <input
                        id="invite-email"
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="teammate@example.com"
                        disabled={disabled || submitting}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-60"
                    />
                </div>

                <div>
                    <label htmlFor="invite-role" className="block text-sm font-medium text-slate-400 mb-1">
                        Role
                    </label>
                    <select
                        id="invite-role"
                        value={role}
                        onChange={(event) => setRole(event.target.value as OrganizationRole)}
                        disabled={disabled || submitting}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-60"
                    >
                        {ASSIGNABLE_ROLES.map((assignableRole) => (
                            <option key={assignableRole} value={assignableRole}>
                                {assignableRole}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={disabled || submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    {submitting ? 'Sending...' : 'Send invite'}
                </button>
            </form>

            {disabled && (
                <p className="mt-3 text-sm text-amber-300">
                    Invite creation is restricted to organization owners and admins.
                </p>
            )}

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            {success && <p className="mt-3 text-sm text-emerald-400">{success}</p>}
        </div>
    );
}
