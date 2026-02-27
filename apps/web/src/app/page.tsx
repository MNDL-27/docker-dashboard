'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface User {
    id: string;
    email: string;
    name: string | null;
}

export default function HomePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch<{ user: User }>('/api/me')
            .then((data) => {
                setUser(data.user);
                setLoading(false);
            })
            .catch(() => {
                router.replace('/login');
            });
    }, [router]);

    async function handleLogout() {
        try {
            await apiFetch('/auth/logout', { method: 'POST' });
        } finally {
            router.replace('/login');
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
