import { cn } from '@/lib/utils';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface StatusBadgeProps {
  status: WebSocketStatus;
  label: string;
  className?: string;
}

export const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  const getStatusConfig = (status: WebSocketStatus) => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-status-connected',
          text: 'text-status-connected',
          label: 'OPEN'
        };
      case 'connecting':
        return {
          color: 'bg-status-connecting',
          text: 'text-status-connecting',
          label: 'CONNECTING'
        };
      case 'error':
        return {
          color: 'bg-status-error',
          text: 'text-status-error',
          label: 'ERROR'
        };
      case 'disconnected':
      default:
        return {
          color: 'bg-status-closed',
          text: 'text-status-closed',
          label: 'CLOSED'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn("w-2 h-2 rounded-full", config.color)} />
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
};