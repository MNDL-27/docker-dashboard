'use client';

import { useState, useMemo } from 'react';

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

interface ContainerTableProps {
    containers: Container[];
}

export function ContainerTable({ containers }: ContainerTableProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const filtered = useMemo(() => {
        return containers.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.image.toLowerCase().includes(search.toLowerCase());

            let matchesStatus = true;
            if (statusFilter === 'RUNNING') {
                matchesStatus = c.state === 'running';
            } else if (statusFilter === 'EXITED') {
                matchesStatus = c.state === 'exited';
            }

            return matchesSearch && matchesStatus;
        });
    }, [containers, search, statusFilter]);

    function renderPorts(portsObj: any) {
        if (!portsObj || Object.keys(portsObj).length === 0) return '-';
        return Object.entries(portsObj).map(([internal, external]) => {
            if (external) {
                return <div key={internal}>{String(external)} &rarr; {internal}</div>;
            }
            return <div key={internal}>{internal}</div>;
        });
    }

    return (
        <div className="container-table-wrapper">
            <div className="filters">
                <input
                    type="text"
                    placeholder="Search containers by name or image..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="search-input"
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="status-select"
                >
                    <option value="ALL">All Statuses</option>
                    <option value="RUNNING">Running</option>
                    <option value="EXITED">Exited</option>
                </select>
            </div>

            {filtered.length === 0 ? (
                <div className="empty-state">
                    No containers found matching your filters.
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="containers-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Image</th>
                                <th>State</th>
                                <th>Status</th>
                                <th>Ports</th>
                                <th>Started</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id}>
                                    <td><strong>{c.name}</strong></td>
                                    <td className="image-cell" title={c.image}>
                                        {c.image.split('@')[0]}
                                    </td>
                                    <td>
                                        <span className={`state-badge ${c.state}`}>
                                            {c.state}
                                        </span>
                                    </td>
                                    <td><span className="status-text">{c.status}</span></td>
                                    <td className="ports-cell">{renderPorts(c.ports)}</td>
                                    <td>{c.startedAt ? new Date(c.startedAt).toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style jsx>{`
                .container-table-wrapper {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 24px;
                }
                .filters {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 24px;
                }
                .search-input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .status-select {
                    padding: 10px 14px;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                }
                .empty-state {
                    padding: 48px;
                    text-align: center;
                    color: #64748b;
                    background: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    border-radius: 8px;
                }
                .table-responsive {
                    overflow-x: auto;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                }
                .containers-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .containers-table th, .containers-table td {
                    padding: 14px 16px;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 14px;
                }
                .containers-table th {
                    background: #f8fafc;
                    font-weight: 600;
                    color: #475569;
                    white-space: nowrap;
                }
                .containers-table tr:last-child td {
                    border-bottom: none;
                }
                .image-cell {
                    max-width: 250px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .status-text {
                    font-size: 13px;
                    color: #64748b;
                }
                .ports-cell {
                    font-family: monospace;
                    font-size: 12px;
                    color: #475569;
                }
                .state-badge {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: capitalize;
                }
                .state-badge.running {
                    background: #dcfce7;
                    color: #166534;
                }
                .state-badge.exited {
                    background: #fee2e2;
                    color: #991b1b;
                }
                .state-badge.created {
                    background: #fef3c7;
                    color: #92400e;
                }
            `}</style>
        </div>
    );
}
