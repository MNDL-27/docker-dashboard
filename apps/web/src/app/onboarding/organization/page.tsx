'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrganization, fetchCurrentUser, fetchOrganizations, setSelectedOrganizationId } from '@/lib/api';

export default function OrganizationOnboardingPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                await fetchCurrentUser();
                const organizations = await fetchOrganizations();

                if (cancelled) {
                    return;
                }

                if (organizations.length > 0) {
                    setSelectedOrganizationId(organizations[0].id);
                    router.replace('/fleet');
                    return;
                }
            } catch {
                router.replace('/login');
                return;
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [router]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!name.trim()) {
            setError('Organization name is required.');
            return;
        }

        setError(null);
        setCreating(true);

        try {
            const organization = await createOrganization(name.trim(), slug.trim() || undefined);
            setSelectedOrganizationId(organization.id);
            router.replace('/fleet');
            router.refresh();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Failed to create organization.');
        } finally {
            setCreating(false);
        }
    }

    if (loading) {
        return (
            <div className="auth-container">
                <span className="spinner" />
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h1>Create your organization</h1>
                <p className="subtitle">
                    Start by creating an organization to establish your workspace boundary.
                </p>

                {error ? <div className="alert-error">{error}</div> : null}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="organization-name">Organization name</label>
                        <input
                            id="organization-name"
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Acme Operations"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="organization-slug">Slug (optional)</label>
                        <input
                            id="organization-slug"
                            type="text"
                            value={slug}
                            onChange={(event) => setSlug(event.target.value)}
                            placeholder="acme-ops"
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={creating}>
                        {creating ? <span className="spinner" /> : 'Create organization'}
                    </button>
                </form>
            </div>
        </div>
    );
}
