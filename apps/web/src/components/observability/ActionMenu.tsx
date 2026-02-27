'use client';

import { useState } from 'react';
import { Play, Square, RotateCw } from 'lucide-react';

interface Props {
    containerId: string;
    state: string;
    isProtected: boolean;
    userRole: 'ADMIN' | 'OPERATOR' | 'VIEWER';
    onAction: (action: 'START' | 'STOP' | 'RESTART', reason: string) => Promise<void>;
}

export default function ActionMenu({ containerId, state, isProtected, userRole, onAction }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [actionType, setActionType] = useState<'START' | 'STOP' | 'RESTART' | null>(null);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isRunning = state === 'running';

    // RBAC logic
    const canStart = userRole === 'ADMIN' || userRole === 'OPERATOR';
    const canRestart = userRole === 'ADMIN' || userRole === 'OPERATOR';
    const canStop = userRole === 'ADMIN' || (userRole === 'OPERATOR' && !isProtected);

    const handleActionClick = (type: 'START' | 'STOP' | 'RESTART') => {
        setActionType(type);
        setReason('');
        setError(null);
        setIsOpen(true);
    };

    const handleConfirm = async () => {
        if (!actionType) return;

        // Require reason for Stop/Restart on protected
        if ((actionType === 'STOP' || actionType === 'RESTART') && isProtected && !reason.trim()) {
            setError('A reason is required for actions on protected containers.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await onAction(actionType, reason);
            setIsOpen(false);
        } catch (err: any) {
            setError(err.message || 'Action failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="flex bg-slate-800 rounded-md border border-slate-700 overflow-hidden">
                <button
                    onClick={() => handleActionClick('START')}
                    disabled={isRunning || !canStart}
                    className={`flex items-center justify-center p-2 text-sm font-medium transition-colors border-r border-slate-700 w-12
            ${isRunning || !canStart
                            ? 'text-slate-600 cursor-not-allowed bg-slate-900/50'
                            : 'text-emerald-400 hover:bg-slate-700'}`}
                    title={!canStart ? "Insufficient permissions" : "Start Container"}
                >
                    <Play className="w-4 h-4" />
                </button>

                <button
                    onClick={() => handleActionClick('RESTART')}
                    disabled={!isRunning || !canRestart}
                    className={`flex items-center justify-center p-2 text-sm font-medium transition-colors border-r border-slate-700 w-12
            ${!isRunning || !canRestart
                            ? 'text-slate-600 cursor-not-allowed bg-slate-900/50'
                            : 'text-amber-400 hover:bg-slate-700'}`}
                    title={!canRestart ? "Insufficient permissions" : "Restart Container"}
                >
                    <RotateCw className="w-4 h-4" />
                </button>

                <button
                    onClick={() => handleActionClick('STOP')}
                    disabled={!isRunning || !canStop}
                    className={`flex items-center justify-center p-2 text-sm font-medium transition-colors w-12
            ${!isRunning
                            ? 'text-slate-600 cursor-not-allowed bg-slate-900/50'
                            : !canStop
                                ? 'text-slate-600 cursor-not-allowed bg-slate-900/50 hover:text-red-900' // Hint it's blocked
                                : 'text-red-400 hover:bg-slate-700 hover:text-red-300'}`}
                    title={!canStop && isProtected ? "Cannot stop protected container" : !canStop ? "Insufficient permissions" : "Stop Container"}
                >
                    <Square className="w-4 h-4 fill-current" />
                </button>
            </div>

            {isOpen && actionType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold text-slate-100 mb-2">
                            Confirm {actionType.charAt(0) + actionType.slice(1).toLowerCase()}
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Are you sure you want to {actionType.toLowerCase()} container <span className="font-mono text-slate-300">{containerId.substring(0, 12)}</span>?
                            {isProtected && <span className="block mt-2 text-amber-500 font-semibold text-xs uppercase tracking-wider">Warning: Protected Container</span>}
                        </p>

                        <div className="mb-6">
                            <label htmlFor="reason" className="block text-sm font-medium text-slate-300 mb-1">
                                Reason {isProtected && (actionType === 'STOP' || actionType === 'RESTART') ? <span className="text-red-400">*</span> : <span className="text-slate-500">(Optional)</span>}
                            </label>
                            <textarea
                                id="reason"
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none sm:text-sm"
                                placeholder="Enter justification for audit logs..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsOpen(false)}
                                disabled={loading}
                                className="px-4 py-2 rounded-md font-medium text-slate-300 hover:bg-slate-800 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className={`flex items-center justify-center px-4 py-2 rounded-md font-medium text-white transition-colors text-sm min-w-[100px]
                  ${actionType === 'STOP' ? 'bg-red-600 hover:bg-red-500' :
                                        actionType === 'START' ? 'bg-emerald-600 hover:bg-emerald-500' :
                                            'bg-amber-600 hover:bg-amber-500'}
                  ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : null}
                                {loading ? 'Executing...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
