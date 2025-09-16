import { useEffect, useRef, useCallback, useState } from 'react';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  onMessage?: (data: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  status: WebSocketStatus;
  send: (data: string) => void;
  close: () => void;
  readyState: number;
}

export const useWebSocket = (
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  
  const [status, setStatus] = useState<WebSocketStatus>('connecting');

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setStatus('connecting');
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setStatus('connected');
        reconnectCountRef.current = 0;
        onOpen?.();
      };

      wsRef.current.onmessage = (event) => {
        onMessage?.(event.data);
      };

      wsRef.current.onclose = () => {
        setStatus('disconnected');
        onClose?.();

        // Attempt reconnection with exponential backoff
        if (shouldReconnectRef.current && reconnectCountRef.current < reconnectAttempts) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectCountRef.current),
            30000 // Max 30 seconds
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        setStatus('error');
        onError?.(error);
      };
    } catch (error) {
      setStatus('error');
      console.error('WebSocket connection error:', error);
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnectAttempts, reconnectInterval]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  const close = useCallback(() => {
    shouldReconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    connect();

    return () => {
      close();
    };
  }, [connect, close]);

  // Reset reconnection attempts when URL changes
  useEffect(() => {
    reconnectCountRef.current = 0;
    shouldReconnectRef.current = true;
  }, [url]);

  return {
    status,
    send,
    close,
    readyState: wsRef.current?.readyState ?? WebSocket.CLOSED,
  };
};