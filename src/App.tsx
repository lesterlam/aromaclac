import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LibraryColumn } from './components/LibraryColumn'
import { RecipeWorkspace } from './components/RecipeWorkspace'
import { SettingsPanel } from './components/SettingsPanel'
import type { BaseOil, Oil, Recipe } from './db/schema'
import { db } from './db/schema'

const EMPTY_OILS: Oil[] = []
const EMPTY_BASE_OILS: BaseOil[] = []
const EMPTY_RECIPES: Recipe[] = []

function newRecipe(): Recipe {
  return {
    id: crypto.randomUUID(),
    title: 'New Recipe',
    description: '',
    targetVolumeML: 50,
    baseOils: [
      { name: '', ratio: 1 },
    ],
    categories: [
      {
        id: crypto.randomUUID(),
        name: 'Mid-Tone',
        essentialOils: [],
      },
    ],
  }
}

async function syncOilsFromRecipe(recipe: Recipe): Promise<void> {
  for (const cat of recipe.categories) {
    for (const line of cat.essentialOils) {
      const name = line.name.trim()
      if (!name) continue
      await db.oils.put({
        name,
        lastUsedMaxPercent: line.maxPercentLimit,
      })
    }
  }
}

async function syncBaseOilsFromRecipe(recipe: Recipe): Promise<void> {
  for (const base of recipe.baseOils) {
    const name = base.name.trim()
    if (!name) continue
    await db.baseOils.put({ name })
  }
}

async function persistRecipe(recipe: Recipe): Promise<void> {
  await db.recipes.put(recipe)
  await syncOilsFromRecipe(recipe)
  await syncBaseOilsFromRecipe(recipe)
}

const LAST_RECIPE_ID_KEY = 'aromacalc-last-recipe-id'

export default function App() {
  const oilsLive = useLiveQuery(() => db.oils.orderBy('name').toArray(), [])
  const baseOilsLive = useLiveQuery(() => db.baseOils.orderBy('name').toArray(), [])
  const recipesLive = useLiveQuery(() => db.recipes.orderBy('title').toArray(), [])
  const oils = oilsLive ?? EMPTY_OILS
  const baseOils = baseOilsLive ?? EMPTY_BASE_OILS
  const recipesFromDb = recipesLive ?? EMPTY_RECIPES

  const [recipe, setRecipe] = useState<Recipe>(newRecipe)
  const [libraryFilter, setLibraryFilter] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const hydratedFromDb = useRef(false)

  // Load the last opened recipe when IndexedDB data is available
  useEffect(() => {
    // Only run once when recipes are loaded (recipesLive becomes non-null)
    if (!recipesLive || hydratedFromDb.current) return
    hydratedFromDb.current = true

    const lastId = localStorage.getItem(LAST_RECIPE_ID_KEY)
    if (lastId) {
      const lastRecipe = recipesLive.find((r) => r.id === lastId)
      if (lastRecipe) {
        setRecipe({ ...lastRecipe })
        return
      }
    }

    // Fall back to first recipe
    if (recipesLive.length > 0) {
      setRecipe({ ...recipesLive[0] })
    }
  }, [recipesLive])

  const persistReady = useRef(false)
  useEffect(() => {
    if (!persistReady.current) {
      persistReady.current = true
      return
    }
    const t = window.setTimeout(() => {
      void persistRecipe(recipe)
    }, 400)
    return () => window.clearTimeout(t)
  }, [recipe])

  const recipeInDb = useMemo(
    () => recipesFromDb.some((r) => r.id === recipe.id),
    [recipesFromDb, recipe.id],
  )

  // Save last opened recipe ID when recipe changes (if it's an existing recipe)
  useEffect(() => {
    if (recipeInDb) {
      localStorage.setItem(LAST_RECIPE_ID_KEY, recipe.id)
    }
  }, [recipe.id, recipeInDb])

  const flushAndSelectRecipe = useCallback(
    async (id: string) => {
      await persistRecipe(recipe)
      const found = await db.recipes.get(id)
      if (found) {
        setRecipe({ ...found })
        localStorage.setItem(LAST_RECIPE_ID_KEY, id)
      }
    },
    [recipe],
  )

  const flushAndNewRecipe = useCallback(async () => {
    await persistRecipe(recipe)
    setRecipe(newRecipe())
    localStorage.removeItem(LAST_RECIPE_ID_KEY)
  }, [recipe])

  const removeRecipe = useCallback(
    async (id: string) => {
      await db.recipes.delete(id)
      // Switch to another recipe or create a new one
      const remaining = await db.recipes.orderBy('title').toArray()
      if (remaining.length > 0) {
        setRecipe({ ...remaining[0] })
      } else {
        setRecipe(newRecipe())
      }
    },
    [],
  )

  const removeOilFromLibrary = (name: string) => {
    void db.oils.delete(name)
  }

  const removeBaseOilFromLibrary = (name: string) => {
    void db.baseOils.delete(name)
  }

  const addBaseOilFromLibrary = (oil: BaseOil) => {
    setRecipe((r) => {
      // If there's an empty base oil row, replace it
      const emptyIndex = r.baseOils.findIndex((b) => b.name === '')
      if (emptyIndex >= 0) {
        return {
          ...r,
          baseOils: r.baseOils.map((b, i) =>
            i === emptyIndex ? { name: oil.name, ratio: 1 } : b,
          ),
        }
      }
      // Otherwise, add a new row
      return {
        ...r,
        baseOils: [
          ...r.baseOils,
          {
            name: oil.name,
            ratio: 1,
          },
        ],
      }
    })
  }

  const addOilFromLibrary = (oil: Oil) => {
    setRecipe((r) => {
      const cats = [...r.categories]
      if (cats.length === 0) {
        cats.push({
          id: crypto.randomUUID(),
          name: 'Default',
          essentialOils: [],
        })
      }
      const first = cats[0]
      cats[0] = {
        ...first,
        essentialOils: [
          ...first.essentialOils,
          {
            id: crypto.randomUUID(),
            name: oil.name,
            drops: 1,
            maxPercentLimit: oil.lastUsedMaxPercent,
          },
        ],
      }
      return { ...r, categories: cats }
    })
  }

  return (
    <div className="flex min-h-svh flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight">AromaCalc</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-zinc-500">Saved automatically</p>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Recipes</span>
              <select
                value={recipeInDb ? recipe.id : ''}
                onChange={(e) => {
                  if (e.target.value) void flushAndSelectRecipe(e.target.value)
                }}
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              >
                {!recipeInDb && (
                  <option value="">— current (unsaved) —</option>
                )}
                {recipesFromDb.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title || 'Untitled'}
                  </option>
                ))}
              </select>
              {recipeInDb && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete "${recipe.title || 'Untitled'}"?`)) {
                      void removeRecipe(recipe.id)
                    }
                  }}
                  className="rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                  aria-label="Delete recipe"
                >
                  ×
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => void flushAndNewRecipe()}
              className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              New recipe
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Settings"
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <SettingsPanel
          activeRecipe={recipe}
          onImportDone={() => {
            setToast('Restored from backup.')
            void db.recipes.toArray().then((list) => {
              if (list.length) setRecipe({ ...list[0] })
            })
          }}
          onError={(m) => setToast(m)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {toast && (
        <div className="border-b border-zinc-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-zinc-700 dark:bg-amber-950 dark:text-amber-100">
          {toast}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setToast(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-3 p-3 lg:grid lg:min-h-0 lg:grid-cols-[minmax(200px,260px)_1fr] lg:gap-4">
        <LibraryColumn
          essentialOils={oils}
          baseOils={baseOils}
          filter={libraryFilter}
          onFilterChange={setLibraryFilter}
          onAddOilToRecipe={addOilFromLibrary}
          onAddBaseOilToRecipe={addBaseOilFromLibrary}
          onRemoveOil={removeOilFromLibrary}
          onRemoveBaseOil={removeBaseOilFromLibrary}
        />
        <RecipeWorkspace
          recipe={recipe}
          onRecipeChange={setRecipe}
          essentialOilLibrary={oils}
          baseOilLibrary={baseOils}
        />
      </main>
    </div>
  )
}
