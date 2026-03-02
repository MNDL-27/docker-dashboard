'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser, fetchOrganizations, getSelectedOrganizationId, setSelectedOrganizationId } from '@/lib/api';

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            try {
                await fetchCurrentUser();
                const organizations = await fetchOrganizations();

                if (cancelled) {
                    return;
                }

                if (organizations.length === 0) {
                    router.replace('/onboarding/organization');
                    return;
                }

                const selectedOrganizationId = getSelectedOrganizationId();
                const selectedOrganizationStillAccessible = selectedOrganizationId
                    ? organizations.some((organization) => organization.id === selectedOrganizationId)
                    : false;

                if (!selectedOrganizationStillAccessible) {
                    setSelectedOrganizationId(organizations[0].id);
                }

                router.replace('/fleet');
            } catch {
                router.replace('/login');
            }
        };

        bootstrap();

        return () => {
            cancelled = true;
        };
    }, [router]);

    return (
        <div className="auth-container">
            <span className="spinner" />
        </div>
    );
}
