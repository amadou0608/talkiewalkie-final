/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Variables d'environnement custom (voir .env.example) — Phase 3.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
