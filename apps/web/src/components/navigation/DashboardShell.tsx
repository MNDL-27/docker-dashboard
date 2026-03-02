'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type DashboardShellProps = {
    children: React.ReactNode;
    onSignOut?: () => void;
};

const NAV_LINKS = [
    { href: '/fleet', label: 'Fleet' },
    { href: '/alerts', label: 'Alerts' },
    { href: '/audit', label: 'Audit' },
    { href: '/settings/members', label: 'Settings' },
];

function isActivePath(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children, onSignOut }: DashboardShellProps) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
                    <div className="flex items-center gap-6">
                        <Link href="/fleet" className="text-sm font-semibold tracking-wide text-slate-100">
                            Docker Dashboard
                        </Link>
                        <nav className="flex items-center gap-2" aria-label="Primary">
                            {NAV_LINKS.map((link) => {
                                const active = isActivePath(pathname, link.href);

                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`rounded-md px-3 py-2 text-sm transition-colors ${
                                            active
                                                ? 'bg-slate-700 text-slate-100'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                                        }`}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <button
                        type="button"
                        onClick={onSignOut}
                        className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Sign out
                    </button>
                </div>
            </header>
            <main>{children}</main>
        </div>
    );
}
