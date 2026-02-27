import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { AddHostDialog } from './AddHostDialog';
import Link from 'next/link';

interface Host {
    id: string;
    name: string;
    hostname: string;
    os: string;
    architecture: string;
    status: 'ONLINE' | 'OFFLINE';
    lastSeen: string | null;
    containerCount: number;
}

export function HostList({ organizationId }: { organizationId: string }) {
    const [hosts, setHosts] = useState<Host[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);

    async function fetchHosts() {
        try {
            const data = await apiFetch<{ hosts: Host[] }>(`/api/hosts?organizationId=${organizationId}`);
            setHosts(data.hosts);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch hosts');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (organizationId) {
            fetchHosts();
            const interval = setInterval(fetchHosts, 30000);
            return () => clearInterval(interval);
        }
    }, [organizationId]);

    if (loading) return <div>Loading fleet...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="host-list-container">
            <div className="header">
                <h2>Fleet Inventory</h2>
                <button className="btn-primary" onClick={() => setShowAddDialog(true)}>Add Host</button>
            </div>

            {hosts.length === 0 ? (
                <div className="empty-state">
                    <p>No hosts enrolled yet. Add your first host to start monitoring containers.</p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="host-table">
                        <thead>
                            <tr>
                                <th>Name / Hostname</th>
                                <th>OS / Architecture</th>
                                <th>Status</th>
                                <th>Containers</th>
                                <th>Last Seen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hosts.map(host => (
                                <tr key={host.id}>
                                    <td>
                                        <Link href={`/fleet/${host.id}`} className="host-link">
                                            <strong>{host.name}</strong>
                                            <div className="subtext">{host.hostname}</div>
                                        </Link>
                                    </td>
                                    <td>
                                        {host.os} / {host.architecture}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${host.status.toLowerCase()}`}>
                                            {host.status}
                                        </span>
                                    </td>
                                    <td>{host.containerCount}</td>
                                    <td>
                                        {host.lastSeen ? new Date(host.lastSeen).toLocaleString() : 'Never'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showAddDialog && (
                <AddHostDialog
                    organizationId={organizationId}
                    onClose={() => {
                        setShowAddDialog(false);
                        fetchHosts();
                    }}
                />
            )}

            <style jsx>{`
                .host-list-container {
                    margin-top: 24px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .btn-primary {
                    background: #2563eb;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .empty-state {
                    background: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    padding: 48px;
                    text-align: center;
                    border-radius: 8px;
                    color: #64748b;
                }
                .table-wrapper {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .host-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .host-table th, .host-table td {
                    padding: 16px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .host-table th {
                    background: #f8fafc;
                    font-weight: 600;
                    color: #475569;
                    font-size: 14px;
                }
                .host-link {
                    color: #2563eb;
                    text-decoration: none;
                }
                .host-link:hover {
                    text-decoration: underline;
                }
                .subtext {
                    font-size: 12px;
                    color: #64748b;
                    margin-top: 4px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 4px 8px;
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
                .error {
                    color: #dc2626;
                }
            `}</style>
        </div>
    );
}
