import type { Oil, Recipe } from '../db/schema'

interface ImportConfirmDialogProps {
  oilsCount: number
  recipesCount: number
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Dialog that asks for confirmation before importing backup data.
 * Warns users that existing data will be replaced.
 */
export function ImportConfirmDialog({
  oilsCount,
  recipesCount,
  onConfirm,
  onCancel,
}: ImportConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
    >
      <div className="mx-4 w-full max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-xl dark:border-amber-700 dark:bg-amber-950">
        <h2
          id="import-dialog-title"
          className="mb-3 text-lg font-semibold text-amber-900 dark:text-amber-100"
        >
          ⚠️ Replace All Data?
        </h2>

        <div className="mb-4 space-y-2 text-sm text-amber-800 dark:text-amber-200">
          <p>
            <strong>Warning:</strong> Importing this backup will replace all your existing data.
          </p>
          
          <div className="rounded border border-amber-300 bg-amber-100/50 p-3 dark:border-amber-600 dark:bg-amber-900/50">
            <p className="font-medium">This backup contains:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>{oilsCount} essential oil{oilsCount !== 1 ? 's' : ''}</li>
              <li>{recipesCount} recipe{recipesCount !== 1 ? 's' : ''}</li>
            </ul>
          </div>

          <p className="text-xs text-amber-700 dark:text-amber-300">
            Consider exporting your current data as a backup before proceeding.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
          >
            Replace All
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Preview the import data without importing it yet.
 * Returns parsed data ready for confirmation.
 */
export interface ImportPreview {
  oils: Oil[]
  recipes: Recipe[]
}

/**
 * Parse and validate import file content, returning preview data.
 */
export async function parseImportPreview(
  text: string,
  validateFn: (text: string) => Promise<{ oils: Oil[]; recipes: Recipe[] }>,
): Promise<ImportPreview> {
  return validateFn(text)
}