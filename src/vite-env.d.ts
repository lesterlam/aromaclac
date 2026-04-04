/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register/react' {
  import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

  export interface useRegisterSWOptions extends RegisterSWOptions {
    immediate?: boolean
  }

  export function useRegisterSW(options?: useRegisterSWOptions): {
    needRefresh: [boolean, React.Dispatch<React.SetStateAction<boolean>>]
    offlineReady: [boolean, React.Dispatch<React.SetStateAction<boolean>>]
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  }
}