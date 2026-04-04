import { useRef, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  exportBackupJson,
  importBackupJson,
  recipeToCsv,
} from '../lib/export'
import type { Recipe } from '../db/schema'

interface SettingsPanelProps {
  activeRecipe: Recipe
  onImportDone: () => void
  onError: (message: string) => void
  onClose: () => void
}

export function SettingsPanel({
  activeRecipe,
  onImportDone,
  onError,
  onClose,
}: SettingsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  async function downloadJson() {
    try {
      const json = await exportBackupJson()
      const blob = new Blob([json], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `aromacalc-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      await importBackupJson(text)
      onImportDone()
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  async function downloadCsv() {
    try {
      const csv = recipeToCsv(activeRecipe)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const safe = activeRecipe.title.replace(/[^\w-]+/g, '_') || 'recipe'
      a.download = `${safe}-report.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'CSV export failed')
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="mx-4 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <section className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Data Backup
            </h3>
            <p className="mb-2 text-xs text-zinc-500">
              Export all recipes and library oils, or restore from a previous backup.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadJson}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Export Backup
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Restore Backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onFile}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Recipe Export
            </h3>
            <p className="mb-2 text-xs text-zinc-500">
              Export the current recipe as a CSV report.
            </p>
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Export Recipe CSV
            </button>
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              About
            </h3>
            <p className="text-xs text-zinc-500">
              AromaCalc v1.0 — Essential oil recipe calculator.
            </p>
          </div>

          <OfflineIndicator />
        </section>
      </div>
    </div>
  )
}

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const {
    offlineReady: [offlineReady],
  } = useRegisterSW({
    onOfflineReady() {
      console.log('[SW] App ready to work offline')
    },
  })

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
      <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        PWA Status
      </h3>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            offlineReady
              ? 'bg-emerald-500 shadow-[0_0_6px_var(--tw-shadow-color)] shadow-emerald-500/50'
              : isOnline
                ? 'bg-amber-500'
                : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-zinc-500">
          {offlineReady
            ? 'Ready for offline use'
            : isOnline
              ? 'Caching app for offline use...'
              : 'Offline (data saved locally)'}
        </span>
      </div>
      {!isOnline && (
        <p className="mt-1 text-xs text-zinc-400">
          Your recipes are stored locally and will sync when back online.
        </p>
      )}
    </div>
  )
}
