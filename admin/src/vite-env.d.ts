/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the API base URL. Defaults to '/api/v1' (proxied in dev). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
