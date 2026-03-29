import type { Oil } from '../db/schema'

interface LibraryColumnProps {
  oils: Oil[]
  filter: string
  onFilterChange: (v: string) => void
  onAddOilToRecipe: (oil: Oil) => void
}

export function LibraryColumn({
  oils,
  filter,
  onFilterChange,
  onAddOilToRecipe,
}: LibraryColumnProps) {
  const q = filter.trim().toLowerCase()
  const list = q
    ? oils.filter((o) => o.name.toLowerCase().includes(q))
    : oils

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-2 shrink-0 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        Library
      </h2>
      <input
        type="search"
        placeholder="Search oils…"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="mb-2 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        aria-label="Search oils"
      />
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {list.length === 0 ? (
          <li className="text-sm text-zinc-500">
            No oils yet. They appear as you work in recipes (saved automatically).
          </li>
        ) : (
          list.map((oil) => (
            <li key={oil.name}>
              <button
                type="button"
                onClick={() => onAddOilToRecipe(oil)}
                className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-violet-50 dark:hover:bg-zinc-800"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {oil.name}
                </span>
                {oil.lastUsedMaxPercent != null && (
                  <span className="ml-2 text-xs text-zinc-500">
                    last max {oil.lastUsedMaxPercent}%
                  </span>
                )}
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
