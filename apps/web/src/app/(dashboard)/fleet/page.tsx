'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HostList } from '@/components/fleet/HostList';
import { apiFetch } from '@/lib/api';

export default function FleetPage() {
    const router = useRouter();
    const [orgId, setOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch user's organizations and pick the first one
        apiFetch<{ organizations: Array<{ id: string }> }>('/api/organizations')
            .then(data => {
                if (data.organizations && data.organizations.length > 0) {
                    setOrgId(data.organizations[0].id);
                }
            })
            .catch(() => {
                router.replace('/login');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [router]);

    if (loading) {
        return <div className="p-8">Loading fleet dashboard...</div>;
    }

    if (!orgId) {
        return (
            <div className="p-8">
                <h2>No Organization Found</h2>
                <p>You must belong to an organization to view the fleet.</p>
            </div>
        );
    }

    return (
        <div className="fleet-page-container">
            <header className="page-header">
                <h1>Fleet Management</h1>
                <p>Manage your enrolled hosts and view container metrics.</p>
            </header>

            <HostList organizationId={orgId} />

            <style jsx>{`
                .fleet-page-container {
                    padding: 32px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .page-header {
                    margin-bottom: 32px;
                }
                .page-header h1 {
                    font-size: 24px;
                    color: #1e293b;
                    margin: 0 0 8px 0;
                }
                .page-header p {
                    color: #64748b;
                    margin: 0;
                }
                .p-8 {
                    padding: 32px;
                }
            `}</style>
        </div>
    );
}
