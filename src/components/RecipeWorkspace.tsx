import { useMemo } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Recipe } from '../db/schema'
import {
  calculateBaseVolumes,
  dropsInCategory,
  getSafetyStatus,
  roundMlForDisplay,
  totalBaseMlFromRows,
  totalDropsInRecipe,
} from '../logic/aroma'

interface RecipeWorkspaceProps {
  recipe: Recipe
  onRecipeChange: (r: Recipe) => void
}

function newEoId(): string {
  return crypto.randomUUID()
}

function newCatId(): string {
  return crypto.randomUUID()
}

function findContainerId(recipe: Recipe, id: string): string | null {
  for (const c of recipe.categories) {
    if (c.id === id) return c.id
    if (c.essentialOils.some((e) => e.id === id)) return c.id
  }
  return null
}

export function RecipeWorkspace({
  recipe,
  onRecipeChange,
}: RecipeWorkspaceProps) {
  const baseCalculated = useMemo(
    () => calculateBaseVolumes(recipe.baseOils ?? []),
    [recipe.baseOils],
  )
  const totalBaseMl = totalBaseMlFromRows(baseCalculated)
  const totalDropsAll = totalDropsInRecipe(recipe)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const activeContainer = findContainerId(recipe, activeId)
    const overContainer = findContainerId(recipe, overId)
    if (!activeContainer || !overContainer) return

    const cats = recipe.categories.map((c) => ({
      ...c,
      essentialOils: [...c.essentialOils],
    }))
    const src = cats.find((c) => c.id === activeContainer)
    const tgt = cats.find((c) => c.id === overContainer)
    if (!src || !tgt) return

    if (activeContainer === overContainer) {
      const oldIndex = src.essentialOils.findIndex((e) => e.id === activeId)
      const newIndex = src.essentialOils.findIndex((e) => e.id === overId)
      if (oldIndex < 0 || newIndex < 0) return
      src.essentialOils = arrayMove(src.essentialOils, oldIndex, newIndex)
    } else {
      const activeIndex = src.essentialOils.findIndex((e) => e.id === activeId)
      if (activeIndex < 0) return
      const [moved] = src.essentialOils.splice(activeIndex, 1)
      const overIndex = tgt.essentialOils.findIndex((e) => e.id === overId)
      const insertAt = overIndex >= 0 ? overIndex : tgt.essentialOils.length
      tgt.essentialOils.splice(insertAt, 0, moved)
    }

    onRecipeChange({ ...recipe, categories: cats })
  }

  const updateBase = (
    index: number,
    patch: Partial<{
      name: string
      ratio: number
      isFixedVolume: boolean
      volumeML: number
    }>,
  ) => {
    const next = recipe.baseOils.map((b, i) => {
      if (i !== index) {
        if (patch.isFixedVolume === true) {
          return { ...b, isFixedVolume: false }
        }
        return b
      }
      return { ...b, ...patch }
    })
    onRecipeChange({ ...recipe, baseOils: next })
  }

  const setFixedOnly = (index: number) => {
    onRecipeChange({
      ...recipe,
      baseOils: recipe.baseOils.map((b, i) => ({
        ...b,
        isFixedVolume: i === index,
      })),
    })
  }

  const addBaseRow = () => {
    onRecipeChange({
      ...recipe,
      baseOils: [
        ...recipe.baseOils,
        {
          name: '',
          ratio: 1,
          isFixedVolume: false,
          volumeML: 0,
        },
      ],
    })
  }

  const removeBaseRow = (index: number) => {
    let next = recipe.baseOils.filter((_, i) => i !== index)
    if (next.length === 0) {
      next = [
        { name: 'Jojoba', ratio: 1, isFixedVolume: true, volumeML: 50 },
      ]
    } else {
      const hasFixed = next.some((b) => b.isFixedVolume)
      if (!hasFixed) {
        next[0] = { ...next[0], isFixedVolume: true }
      }
    }
    onRecipeChange({ ...recipe, baseOils: next })
  }

  const addCategory = () => {
    onRecipeChange({
      ...recipe,
      categories: [
        ...recipe.categories,
        {
          id: newCatId(),
          name: 'New category',
          essentialOils: [],
        },
      ],
    })
  }

  const updateCategoryName = (categoryId: string, name: string) => {
    onRecipeChange({
      ...recipe,
      categories: recipe.categories.map((c) =>
        c.id === categoryId ? { ...c, name } : c,
      ),
    })
  }

  const addEoToCategory = (categoryId: string) => {
    onRecipeChange({
      ...recipe,
      categories: recipe.categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              essentialOils: [
                ...c.essentialOils,
                {
                  id: newEoId(),
                  name: '',
                  drops: 1,
                  maxPercentLimit: 1,
                },
              ],
            }
          : c,
      ),
    })
  }

  const updateEo = (
    categoryId: string,
    lineId: string,
    patch: Partial<{ name: string; drops: number; maxPercentLimit: number }>,
  ) => {
    onRecipeChange({
      ...recipe,
      categories: recipe.categories.map((c) =>
        c.id !== categoryId
          ? c
          : {
              ...c,
              essentialOils: c.essentialOils.map((e) =>
                e.id === lineId ? { ...e, ...patch } : e,
              ),
            },
      ),
    })
  }

  const removeEo = (categoryId: string, lineId: string) => {
    onRecipeChange({
      ...recipe,
      categories: recipe.categories.map((c) =>
        c.id !== categoryId
          ? c
          : {
              ...c,
              essentialOils: c.essentialOils.filter((e) => e.id !== lineId),
            },
      ),
    })
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        Workspace
      </h2>

      <label className="mb-4 block text-xs">
        Recipe title
        <input
          value={recipe.title}
          onChange={(e) =>
            onRecipeChange({ ...recipe, title: e.target.value })
          }
          className="mt-0.5 w-full max-w-md rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
      </label>

      <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
        Base oils
      </h3>
      <p className="mb-2 text-xs text-zinc-500">
        Set one anchor (fixed ml); others scale by ratio. Total base:{' '}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {roundMlForDisplay(totalBaseMl).toFixed(2)} ml
        </span>
      </p>
      <div className="mb-6 space-y-2">
        {(recipe.baseOils ?? []).map((row, i) => {
          const calc = baseCalculated[i]
          return (
            <div
              key={`base-${i}-${row.name}`}
              className="flex flex-wrap items-end gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800"
            >
              <label className="min-w-[100px] flex-1 text-xs">
                Name
                <input
                  value={row.name}
                  onChange={(e) => updateBase(i, { name: e.target.value })}
                  className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <label className="w-20 text-xs">
                Ratio
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={row.ratio}
                  onChange={(e) =>
                    updateBase(i, {
                      ratio: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name="fixed-base"
                  checked={row.isFixedVolume}
                  onChange={() => setFixedOnly(i)}
                />
                Fixed ml
              </label>
              {row.isFixedVolume && (
                <label className="w-24 text-xs">
                  ML
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.volumeML}
                    onChange={(e) =>
                      updateBase(i, {
                        volumeML: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
                  />
                </label>
              )}
              <span className="text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                → {roundMlForDisplay(calc?.calculatedML ?? 0).toFixed(2)} ml
              </span>
              <button
                type="button"
                onClick={() => removeBaseRow(i)}
                className="text-xs text-zinc-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={addBaseRow}
          className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          + Base oil
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-zinc-500">
          Categories & essential oils
        </h3>
        <button
          type="button"
          onClick={addCategory}
          className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          + Category
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {recipe.categories.map((cat) => {
            const catDrops = dropsInCategory(recipe, cat.id)
            const dropPct =
              totalDropsAll > 0
                ? ((catDrops / totalDropsAll) * 100).toFixed(1)
                : '0'
            const ids = cat.essentialOils.map((e) => e.id)

            return (
              <div
                key={cat.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input
                    value={cat.name}
                    onChange={(e) =>
                      updateCategoryName(cat.id, e.target.value)
                    }
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-900"
                    aria-label="Category name"
                  />
                  <span className="text-xs text-zinc-500">
                    {dropPct}% of recipe drops
                  </span>
                  <button
                    type="button"
                    onClick={() => addEoToCategory(cat.id)}
                    className="ml-auto text-xs text-violet-600 hover:underline dark:text-violet-400"
                  >
                    + Oil
                  </button>
                </div>

                <SortableContext
                  items={ids}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {cat.essentialOils.map((eo) => (
                      <SortableEoRow
                        key={eo.id}
                        eo={eo}
                        totalBaseMl={totalBaseMl}
                        onUpdate={(patch) => updateEo(cat.id, eo.id, patch)}
                        onRemove={() => removeEo(cat.id, eo.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </div>
            )
          })}
        </div>
      </DndContext>
    </section>
  )
}

function SortableEoRow({
  eo,
  totalBaseMl,
  onUpdate,
  onRemove,
}: {
  eo: {
    id: string
    name: string
    drops: number
    maxPercentLimit: number
  }
  totalBaseMl: number
  onUpdate: (patch: Partial<{
    name: string
    drops: number
    maxPercentLimit: number
  }>) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: eo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  const safety = getSafetyStatus(
    eo.drops,
    eo.maxPercentLimit,
    totalBaseMl,
  )
  const unsafe = !safety.isSafe && (eo.maxPercentLimit ?? 0) > 0
  const tip =
    unsafe && safety.suggestedBaseML != null
      ? `Increase Base Volume to ${roundMlForDisplay(safety.suggestedBaseML).toFixed(2)} ml to be safe.`
      : undefined

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-end gap-2 rounded border border-zinc-200 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-900"
    >
      <button
        type="button"
        className="cursor-grab touch-none px-1 text-zinc-400 hover:text-zinc-600 active:cursor-grabbing"
        aria-label="Drag to reorder or move category"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <label className="min-w-[100px] flex-1 text-xs">
        Name
        <input
          value={eo.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Oil"
          className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
      </label>
      <label className="w-16 text-xs">
        Drops
        <input
          type="number"
          min={0}
          step={1}
          value={eo.drops}
          onChange={(e) =>
            onUpdate({ drops: parseInt(e.target.value, 10) || 0 })
          }
          className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
        />
      </label>
      <label className="w-24 text-xs">
        Max % limit
        <input
          type="number"
          min={0}
          step={0.01}
          value={eo.maxPercentLimit}
          onChange={(e) =>
            onUpdate({
              maxPercentLimit: parseFloat(e.target.value) || 0,
            })
          }
          className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
        />
      </label>
      <span
        className={`text-xs tabular-nums ${unsafe ? 'font-medium text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'}`}
        title={tip}
      >
        {unsafe ? '⚠ ' : ''}
        Current %: {safety.currentPercentDisplay}%
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-zinc-500 hover:text-red-600"
      >
        Remove
      </button>
    </li>
  )
}
