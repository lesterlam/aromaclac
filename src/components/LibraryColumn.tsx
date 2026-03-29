import { useState } from 'react'
import type { BaseOil, Oil } from '../db/schema'

interface LibraryColumnProps {
  essentialOils: Oil[]
  baseOils: BaseOil[]
  filter: string
  onFilterChange: (v: string) => void
  onAddOilToRecipe: (oil: Oil) => void
  onAddBaseOilToRecipe: (oil: BaseOil) => void
  onRemoveOil: (name: string) => void
  onRemoveBaseOil: (name: string) => void
}

export function LibraryColumn({
  essentialOils,
  baseOils,
  filter,
  onFilterChange,
  onAddOilToRecipe,
  onAddBaseOilToRecipe,
  onRemoveOil,
  onRemoveBaseOil,
}: LibraryColumnProps) {
  const [activeTab, setActiveTab] = useState<'essential' | 'base'>('essential')

  const q = filter.trim().toLowerCase()

  const filteredEssentialOils = q
    ? essentialOils.filter((o) => o.name.toLowerCase().includes(q))
    : essentialOils

  const filteredBaseOils = q
    ? baseOils.filter((o) => o.name.toLowerCase().includes(q))
    : baseOils

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-2 shrink-0 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        Library
      </h2>

      {/* Tabs */}
      <div className="mb-2 flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setActiveTab('essential')}
          className={`px-2 py-1 text-xs font-medium ${
            activeTab === 'essential'
              ? 'border-b-2 border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Essential Oils
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('base')}
          className={`px-2 py-1 text-xs font-medium ${
            activeTab === 'base'
              ? 'border-b-2 border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Base Oils
        </button>
      </div>

      <input
        type="search"
        placeholder={activeTab === 'essential' ? 'Search essential oils…' : 'Search base oils…'}
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        autoComplete="off"
        className="mb-2 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        aria-label="Search"
      />

      {/* Essential Oils Tab */}
      {activeTab === 'essential' && (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {filteredEssentialOils.length === 0 ? (
            <li className="text-sm text-zinc-500">
              No essential oils yet. They appear as you work in recipes.
            </li>
          ) : (
            filteredEssentialOils.map((oil) => (
              <li key={oil.name} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => onAddOilToRecipe(oil)}
                  className="flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-violet-50 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {oil.name}
                  </span>
                  {oil.lastUsedMaxPercent != null && (
                    <span className="ml-2 text-xs text-zinc-500">
                      max {oil.lastUsedMaxPercent}%
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveOil(oil.name)}
                  className="ml-1 flex-shrink-0 rounded px-1.5 py-1 text-xs text-zinc-400 opacity-0 hover:bg-zinc-200 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                  aria-label={`Remove ${oil.name}`}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Base Oils Tab */}
      {activeTab === 'base' && (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {filteredBaseOils.length === 0 ? (
            <li className="text-sm text-zinc-500">
              No base oils yet. They appear as you work in recipes.
            </li>
          ) : (
            filteredBaseOils.map((oil) => (
              <li key={oil.name} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => onAddBaseOilToRecipe(oil)}
                  className="flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-violet-50 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {oil.name}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveBaseOil(oil.name)}
                  className="ml-1 flex-shrink-0 rounded px-1.5 py-1 text-xs text-zinc-400 opacity-0 hover:bg-zinc-200 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                  aria-label={`Remove ${oil.name}`}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  )
}
