/// <reference types="vite/client" />

interface Window {
  Paddle?: {
    Initialize: (options: { token: string; environment?: 'sandbox' | 'production' }) => void;
    Checkout: {
      open: (options: {
        items: Array<{ priceId: string; quantity: number }>;
        customer?: { email: string };
        customData?: Record<string, string | number | boolean | null>;
        settings?: {
          displayMode?: 'overlay' | 'inline';
          theme?: 'light' | 'dark';
          locale?: string;
        };
      }) => void;
    };
  };
}
