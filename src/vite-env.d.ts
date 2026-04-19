/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_PADDLE_CLIENT_TOKEN?: string;
  readonly VITE_PADDLE_ENV?: "sandbox" | "production";
  readonly VITE_PADDLE_LAUNCH_PRICE_ID?: string;
  readonly VITE_PADDLE_SCALE_PRICE_ID?: string;
  readonly VITE_PADDLE_PRO_PRICE_ID?: string;
  readonly VITE_PADDLE_TEAM_PRICE_ID?: string;
  readonly VITE_DONATION_URL?: string;
  readonly VITE_PAYPAL_DONATION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
