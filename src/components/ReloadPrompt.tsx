import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function ReloadPrompt() {
  const [shouldShow, setShouldShow] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl: string, r: ServiceWorkerRegistration | undefined) {
      if (import.meta.env.DEV) {
        console.log('[SW] Registered:', r)
      }
    },
    onRegisterError(error: Error) {
      if (import.meta.env.DEV) {
        console.error('[SW] Registration error:', error)
      }
    },
    onOfflineReady() {
      if (import.meta.env.DEV) {
        console.log('[SW] App ready to work offline')
      }
    },
  })

  useEffect(() => {
    if (needRefresh) {
      setShouldShow(true)
    }
  }, [needRefresh])

  function handleReload() {
    void updateServiceWorker()
    setShouldShow(false)
  }

  function handleDismiss() {
    setNeedRefresh(false)
    setShouldShow(false)
  }

  if (!shouldShow) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg dark:border-emerald-800 dark:bg-emerald-950">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            New version available
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Update to get the latest features
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReload}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded border border-emerald-300 px-2 py-1.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}