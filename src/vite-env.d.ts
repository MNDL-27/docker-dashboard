/// <reference types="vite/client" />

interface Window {
  Paddle?: {
    Environment: {
      set: (env: 'sandbox' | 'production') => void;
    };
    Initialize: (options: { token: string }) => void;
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
