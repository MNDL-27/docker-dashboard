'use client';

import { useMemo, useState } from 'react';
import { HostEnrollmentTokenResponse, issueHostEnrollmentToken } from '@/lib/api';

interface Project {
    id: string;
    name: string;
}

interface AddHostDialogProps {
    organizationId: string;
    projects?: Project[];
    defaultProjectId?: string;
    onClose: () => void;
}

export function AddHostDialog({ organizationId, projects = [], defaultProjectId, onClose }: AddHostDialogProps) {
    const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId || '');
    const [enrollment, setEnrollment] = useState<HostEnrollmentTokenResponse | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedProject = useMemo(
        () => projects.find((project) => project.id === selectedProjectId),
        [projects, selectedProjectId]
    );

    const expiresAtLabel = useMemo(() => {
        if (!enrollment?.expiresAt) {
            return '';
        }

        const parsed = new Date(enrollment.expiresAt);
        if (Number.isNaN(parsed.getTime())) {
            return enrollment.expiresAt;
        }

        return parsed.toLocaleString();
    }, [enrollment?.expiresAt]);

    async function handleGenerate() {
        if (!selectedProjectId) {
            setError('Please select a project (client workspace)');
            return;
        }

        setLoading(true);
        setError(null);
        setCopyState('idle');

        try {
            const response = await issueHostEnrollmentToken(organizationId, selectedProjectId);
            setEnrollment(response);
        } catch (err: any) {
            setError(err.message || 'Failed to generate token');
        } finally {
            setLoading(false);
        }
    }

    async function handleCopyCommand() {
        if (!enrollment?.command) {
            return;
        }

        try {
            await navigator.clipboard.writeText(enrollment.command);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    }

    return (
        <div className="dialog-backdrop">
            <div className="dialog-content">
                <h2>Add New Host</h2>
                {!enrollment ? (
                    <>
                        <p>
                            Step 1: choose the target organization project.<br />
                            Step 2: generate a short-lived bootstrap token.<br />
                            Step 3: copy and run one install command on the host.
                        </p>

                        <div className="form-field">
                            <label>Client / Project</label>
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="project-select"
                            >
                                <option value="">-- Select a project --</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {error && <div className="error-message">{error}</div>}
                        <div className="dialog-actions">
                            <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
                            <button className="btn-primary" onClick={handleGenerate} disabled={loading || !selectedProjectId}>
                                {loading ? 'Generating...' : 'Generate Command'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="detail-grid">
                            <div><strong>Project:</strong> {enrollment.projectName || selectedProject?.name}</div>
                            <div><strong>Cloud URL:</strong> {enrollment.cloudUrl}</div>
                            <div><strong>Token Expires:</strong> {expiresAtLabel}</div>
                        </div>
                        <pre className="command-box">
                            <code>{enrollment.command}</code>
                        </pre>
                        {error && <div className="error-message">{error}</div>}
                        <div className="dialog-actions">
                            <button className="btn-secondary" onClick={handleCopyCommand}>Copy Command</button>
                            <button className="btn-secondary" onClick={() => setEnrollment(null)}>Generate New Token</button>
                            <button className="btn-primary" onClick={onClose}>Done</button>
                        </div>
                        {copyState === 'copied' && <p className="copy-state">Command copied to clipboard.</p>}
                        {copyState === 'failed' && <p className="error-message">Copy failed. Select and copy manually.</p>}
                    </>
                )}
            </div>
            <style jsx>{`
                .dialog-backdrop {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .dialog-content {
                    background: white;
                    padding: 24px;
                    border-radius: 8px;
                    max-width: 500px;
                    width: 100%;
                    color: #333;
                }
                .form-field {
                    margin: 16px 0;
                }
                .form-field label {
                    display: block;
                    font-size: 14px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 6px;
                }
                .project-select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d4d4d8;
                    border-radius: 6px;
                    font-size: 14px;
                    color: #333;
                    background: #fff;
                }
                .command-box {
                    background: #f4f4f5;
                    padding: 12px;
                    border-radius: 4px;
                    overflow-x: auto;
                    font-size: 14px;
                    margin: 16px 0;
                    border: 1px solid #e4e4e7;
                }
                .detail-grid {
                    display: grid;
                    gap: 8px;
                    margin-top: 12px;
                    color: #334155;
                    font-size: 14px;
                }
                .dialog-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                }
                .btn-primary {
                    background: #2563eb;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .btn-secondary {
                    background: transparent;
                    color: #3f3f46;
                    border: 1px solid #d4d4d8;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .error-message {
                    color: #dc2626;
                    margin: 12px 0;
                }
                .copy-state {
                    color: #047857;
                    margin: 12px 0 0;
                    font-size: 14px;
                }
            `}</style>
        </div>
    );
}
