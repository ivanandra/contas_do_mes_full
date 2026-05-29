/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WHATSAPP_NUMBER?: string
  readonly VITE_WHATSAPP_JOIN_CODE?: string
  readonly VITE_BETA_BANNER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
