/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_PREVIEW_BYPASS_AUTH?: string;
  readonly VITE_DONATION_URL?: string;
  readonly VITE_PAYPAL_DONATION_URL?: string;
  readonly VITE_BUILD_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
