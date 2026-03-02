import { DashboardShell } from '@/components/navigation/DashboardShell';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardShell>{children}</DashboardShell>;
}
