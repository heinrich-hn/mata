/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_S3_ACCESS_KEY_ID: string
  readonly VITE_SUPABASE_S3_SECRET_ACCESS_KEY: string
  readonly VITE_SUPABASE_S3_ENDPOINT: string
  readonly VITE_SUPABASE_S3_REGION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// PWA virtual module declaration
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: Error) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reload?: boolean) => Promise<void>
}
