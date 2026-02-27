import { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface AddHostDialogProps {
    organizationId: string;
    onClose: () => void;
}

export function AddHostDialog({ organizationId, onClose }: AddHostDialogProps) {
    const [token, setToken] = useState<string | null>(null);
    const [command, setCommand] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleGenerate() {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch<{ token: string; command: string }>('/api/hosts/tokens', {
                method: 'POST',
                body: { organizationId },
            });
            setToken(data.token);
            setCommand(data.command);
        } catch (err: any) {
            setError(err.message || 'Failed to generate token');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="dialog-backdrop">
            <div className="dialog-content">
                <h2>Add New Host</h2>
                {!command ? (
                    <>
                        <p>Generate an enrollment token and command to run on your host machine. The token will expire in 24 hours.</p>
                        {error && <div className="error-message">{error}</div>}
                        <div className="dialog-actions">
                            <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
                            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
                                {loading ? 'Generating...' : 'Generate Command'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p>Run the following command on your host machine to enroll it. This command contains your sensitive enrollment token.</p>
                        <pre className="command-box">
                            <code>{command}</code>
                        </pre>
                        <div className="dialog-actions">
                            <button className="btn-primary" onClick={onClose}>Done</button>
                        </div>
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
                .command-box {
                    background: #f4f4f5;
                    padding: 12px;
                    border-radius: 4px;
                    overflow-x: auto;
                    font-size: 14px;
                    margin: 16px 0;
                    border: 1px solid #e4e4e7;
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
            `}</style>
        </div>
    );
}
