'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser, logout, AuthUser } from '@/lib/api';

export default function HomePage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        fetchCurrentUser()
            .then((currentUser) => {
                if (!active) {
                    return;
                }
                setUser(currentUser);
                setLoading(false);
            })
            .catch(() => {
                if (!active) {
                    return;
                }
                setUser(null);
                setLoading(false);
                router.replace('/login');
            });

        return () => {
            active = false;
        };
    }, [router]);

    async function handleLogout() {
        try {
            await logout();
        } finally {
            setUser(null);
            router.replace('/login');
            router.refresh();
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
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Docker Dashboard Cloud</h1>
                <button className="btn-logout" onClick={handleLogout}>
                    Sign out
                </button>
            </div>

            <div className="welcome-card">
                <h2>Welcome{user?.name ? `, ${user.name}` : ''}!</h2>
                <p>
                    Your cloud dashboard is ready. Organizations and container management
                    coming soon.
                </p>
            </div>
        </div>
    );
}
