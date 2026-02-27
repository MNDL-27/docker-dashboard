'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ContainerTable } from '@/components/fleet/ContainerTable';
import Link from 'next/link';

interface Host {
    id: string;
    organizationId: string;
    name: string;
    hostname: string;
    os: string;
    architecture: string;
    dockerVersion: string;
    status: 'ONLINE' | 'OFFLINE';
    lastSeen: string | null;
}

interface Container {
    id: string;
    dockerId: string;
    name: string;
    image: string;
    state: string;
    status: string;
    ports: any;
    startedAt: string | null;
}

export default function HostDetailPage({ params }: { params: Promise<{ hostId: string }> }) {
    const router = useRouter();
    const [host, setHost] = useState<Host | null>(null);
    const [containers, setContainers] = useState<Container[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Unwrap params in Next.js 15
    const resolvedParams = use(params);
    const { hostId } = resolvedParams;

    useEffect(() => {
        async function fetchHostData() {
            try {
                const [hostData, containersData] = await Promise.all([
                    apiFetch<{ host: Host }>(`/api/hosts/${hostId}`),
                    apiFetch<{ containers: Container[] }>(`/api/hosts/${hostId}/containers`)
                ]);

                // Compute online status if offline threshold passed (1 min for example)
                // Just doing simple assignment from API for now, API should return accurate status
                setHost(hostData.host);
                setContainers(containersData.containers);
            } catch (err: any) {
                setError(err.message || 'Failed to load host data');
            } finally {
                setLoading(false);
            }
        }

        fetchHostData();
        const interval = setInterval(fetchHostData, 10000); // 10s refresh for containers
        return () => clearInterval(interval);
    }, [hostId]);

    if (loading) return <div className="p-8">Loading host details...</div>;

    if (error || !host) {
        return (
            <div className="p-8">
                <h2>Error</h2>
                <p className="error">{error || 'Host not found'}</p>
                <Link href="/fleet" className="back-link">&larr; Back to Fleet</Link>
            </div>
        );
    }

    return (
        <div className="host-detail-container">
            <Link href="/fleet" className="back-link">&larr; Back to Fleet</Link>

            <header className="page-header">
                <div className="title-row">
                    <h1>{host.name}</h1>
                    <span className={`status-badge ${host.status.toLowerCase()}`}>
                        {host.status}
                    </span>
                </div>
                <div className="metadata-row">
                    <div className="metadata-item">
                        <span className="label">Hostname:</span>
                        <span className="value">{host.hostname}</span>
                    </div>
                    <div className="metadata-item">
                        <span className="label">OS/Arch:</span>
                        <span className="value">{host.os} / {host.architecture}</span>
                    </div>
                    <div className="metadata-item">
                        <span className="label">Docker Version:</span>
                        <span className="value">{host.dockerVersion}</span>
                    </div>
                    <div className="metadata-item">
                        <span className="label">Last Seen:</span>
                        <span className="value">{host.lastSeen ? new Date(host.lastSeen).toLocaleString() : 'Never'}</span>
                    </div>
                </div>
            </header>

            <section className="containers-section">
                <h2>Containers ({containers.length})</h2>
                <ContainerTable containers={containers} />
            </section>

            <style jsx>{`
                .host-detail-container {
                    padding: 32px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .back-link {
                    display: inline-block;
                    color: #64748b;
                    text-decoration: none;
                    margin-bottom: 24px;
                    font-size: 14px;
                    font-weight: 500;
                }
                .back-link:hover {
                    color: #1e293b;
                }
                .page-header {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 24px;
                    margin-bottom: 32px;
                }
                .title-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 16px;
                }
                .title-row h1 {
                    font-size: 24px;
                    color: #1e293b;
                    margin: 0;
                }
                .status-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .status-badge.online {
                    background: #dcfce7;
                    color: #166534;
                }
                .status-badge.offline {
                    background: #fee2e2;
                    color: #991b1b;
                }
                .metadata-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    padding-top: 16px;
                    border-top: 1px solid #e2e8f0;
                }
                .metadata-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .label {
                    font-size: 12px;
                    color: #64748b;
                    font-weight: 500;
                    text-transform: uppercase;
                }
                .value {
                    font-size: 14px;
                    color: #1e293b;
                }
                .containers-section h2 {
                    font-size: 20px;
                    color: #1e293b;
                    margin-bottom: 16px;
                }
                .error {
                    color: #dc2626;
                }
                .p-8 {
                    padding: 32px;
                }
            `}</style>
        </div>
    );
}
