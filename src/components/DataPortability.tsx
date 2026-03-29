import { useRef } from 'react'
import {
  exportBackupJson,
  importBackupJson,
  recipeToCsv,
} from '../lib/export'
import type { Recipe } from '../db/schema'

interface DataPortabilityProps {
  activeRecipe: Recipe
  onImportDone: () => void
  onError: (message: string) => void
}

export function DataPortability({
  activeRecipe,
  onImportDone,
  onError,
}: DataPortabilityProps) {
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

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
      <span className="text-xs font-medium uppercase text-zinc-500">Data</span>
      <button
        type="button"
        onClick={downloadJson}
        className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        Backup JSON
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        Restore JSON
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
      />
      <button
        type="button"
        onClick={downloadCsv}
        className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        Recipe CSV
      </button>
    </div>
  )
}
