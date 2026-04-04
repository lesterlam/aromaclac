import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Inline styles for smooth animations
const styles = {
  container: {
    animation: 'slideUp 0.3s ease-out',
  },
}

// Helper to reload the page
const reloadSW = () => {
  window.location.reload()
}

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('[SW] Registered:', swUrl, r)
    },
    onRegisterError(error) {
      console.log('[SW] Registration error', error)
    },
  })

  const [showOfflineToast, setShowOfflineToast] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Auto-hide the offline ready toast after 4 seconds
  useEffect(() => {
    if (offlineReady && !needRefresh) {
      setShowOfflineToast(true)
      setDismissed(false)
      
      const timer = setTimeout(() => {
        setShowOfflineToast(false)
      }, 4000)
      
      return () => clearTimeout(timer)
    }
  }, [offlineReady, needRefresh])

  // Hide offline toast when update becomes available
  useEffect(() => {
    if (needRefresh) {
      setShowOfflineToast(false)
    }
  }, [needRefresh])

  const handleUpdate = async () => {
    await updateServiceWorker(true)
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowOfflineToast(false)
    setOfflineReady(false)
  }

  // Don't render anything if dismissed or no notifications
  if (dismissed || (!showOfflineToast && !needRefresh)) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div
        className={`
          flex flex-col gap-3 rounded-2xl border p-4 shadow-2xl
          max-w-sm w-full
          bg-zinc-50 dark:bg-zinc-900
          border-emerald-200 dark:border-emerald-900
          ring-1 ring-emerald-100 dark:ring-emerald-950
        `}
        style={styles.container}
      >
        {/* Update Available State */}
        {needRefresh && (
          <>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  New version available
                </h3>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  Refresh to get the latest features and bug fixes.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className={`
                  flex-1 px-4 py-2 rounded-xl text-sm font-medium
                  text-emerald-700 dark:text-emerald-300
                  bg-emerald-50 dark:bg-emerald-900/30
                  hover:bg-emerald-100 dark:hover:bg-emerald-900/50
                  transition-colors duration-200
                  border border-emerald-200 dark:border-emerald-800
                `}
              >
                Later
              </button>
              <button
                onClick={handleUpdate}
                className={`
                  flex-1 px-4 py-2 rounded-xl text-sm font-medium
                  bg-emerald-600 dark:bg-emerald-500
                  text-white
                  hover:bg-emerald-700 dark:hover:bg-emerald-600
                  transition-colors duration-200
                  shadow-sm hover:shadow
                `}
              >
                Update & Refresh
              </button>
            </div>
          </>
        )}

        {/* Offline Ready State */}
        {showOfflineToast && !needRefresh && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <p className="flex-1 text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Ready to work offline
            </p>
            <button
              onClick={handleDismiss}
              className={`
                flex-shrink-0 p-1.5 rounded-lg
                text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-200
                hover:bg-emerald-100 dark:hover:bg-emerald-900/50
                transition-colors duration-200
              `}
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
