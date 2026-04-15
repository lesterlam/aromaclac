import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  exportBackupJson,
  previewImport,
  executeImport,
  importBackupJsonLegacy,
} from '../lib/export'
import { recipeToCsv } from '../lib/csvExport'
import { sanitizeForFilename } from '../lib/sanitize'
import { ImportConfirmDialog } from './ImportConfirmDialog'
import type { Recipe } from '../db/schema'
import type { Oil } from '../db/schema'

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
  
  // Import confirmation state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingImportData, setPendingImportData] = useState<{
    oils: Oil[]
    recipes: Recipe[]
  } | null>(null)

  async function downloadJson() {
    try {
      const json = await exportBackupJson()
      const blob = new Blob([json], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `aromacalc-backup-${sanitizeForFilename(new Date().toISOString().slice(0, 10))}.json`
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

    let text: string
    try {
      text = await file.text()
    } catch {
      onError('Failed to read file.')
      return
    }

    // Step 1: Validate and get preview data
    const previewResult = await previewImport(text)

    if (!previewResult.valid || !previewResult.data) {
      // Try legacy format if V2 validation fails
      try {
        await importBackupJsonLegacy(text)
        onImportDone()
        onClose()
        return
      } catch (err) {
        onError(previewResult.error ?? 'Invalid backup file.')
        return
      }
    }

    // Step 2: Show confirmation dialog
    setPendingImportData(previewResult.data)
    setShowConfirmDialog(true)
  }

  async function handleConfirmImport() {
    if (!pendingImportData) return

    try {
      await executeImport(pendingImportData)
      setShowConfirmDialog(false)
      setPendingImportData(null)
      onImportDone()
      onClose()
    } catch (err) {
      setShowConfirmDialog(false)
      setPendingImportData(null)
      onError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  function handleCancelImport() {
    setShowConfirmDialog(false)
    setPendingImportData(null)
  }

  async function downloadCsv() {
    try {
      const csv = recipeToCsv(activeRecipe)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const safe = sanitizeForFilename(activeRecipe.title) || 'recipe'
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
    <>
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
                AromaCalc v1.1 — Essential oil recipe calculator.
              </p>
            </div>

            <OfflineIndicator />
          </section>
        </div>
      </div>

      {/* Import confirmation dialog */}
      {showConfirmDialog && pendingImportData && (
        <ImportConfirmDialog
          oilsCount={pendingImportData.oils.length}
          recipesCount={pendingImportData.recipes.length}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
        />
      )}
    </>
  )
}

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const {
    offlineReady: [offlineReady],
  } = useRegisterSW({
    onOfflineReady() {
      // No console.log in production
    },
  })

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
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