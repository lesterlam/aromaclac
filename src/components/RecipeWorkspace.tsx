import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Recipe, BaseOil, Oil } from '../db/schema'
import {
  calculateBaseVolumes,
  getSafetyStatus,
  oilMlInCategory,
  roundMlForDisplay,
  totalOilMlInRecipe,
} from '../logic/aroma'

interface RecipeWorkspaceProps {
  recipe: Recipe
  onRecipeChange: (r: Recipe) => void
  essentialOilLibrary: Oil[]
  baseOilLibrary: BaseOil[]
}

function newEoId(): string {
  return crypto.randomUUID()
}

function newCatId(): string {
  return crypto.randomUUID()
}

function findContainerId(recipe: Recipe, id: string): string | null {
  // Check if the id itself is a category id
  if (recipe.categories.some((c) => c.id === id)) {
    return id
  }
  // Check if the id belongs to an essential oil
  for (const c of recipe.categories) {
    if (c.essentialOils.some((e) => e.id === id)) return c.id
  }
  return null
}

export function RecipeWorkspace({
  recipe,
  onRecipeChange,
  essentialOilLibrary,
  baseOilLibrary,
}: RecipeWorkspaceProps) {
  const baseCalculated = useMemo(
    () => calculateBaseVolumes(recipe.baseOils ?? [], recipe.targetVolumeML),
    [recipe.baseOils, recipe.targetVolumeML],
  )
  const totalBaseMl = recipe.targetVolumeML

  // Track which category is being hovered during drag
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setHoveredCategoryId(null)
      return
    }
    const overId = String(over.id)
    const containerId = findContainerId(recipe, overId)
    setHoveredCategoryId(containerId)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setHoveredCategoryId(null)
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
    }>,
  ) => {
    const next = recipe.baseOils.map((b, i) =>
      i !== index ? b : { ...b, ...patch },
    )
    onRecipeChange({ ...recipe, baseOils: next })
  }

  const addBaseRow = () => {
    // Don't add if there's already an empty base oil row
    const hasEmptyRow = recipe.baseOils.some((b) => b.name === '')
    if (hasEmptyRow) return

    onRecipeChange({
      ...recipe,
      baseOils: [
        ...recipe.baseOils,
        {
          name: '',
          ratio: 1,
        },
      ],
    })
  }

  const removeBaseRow = (index: number) => {
    const next = recipe.baseOils.filter((_, i) => i !== index)
    if (next.length === 0) {
      next.push({ name: '', ratio: 1 })
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

  const removeCategory = (categoryId: string) => {
    const remaining = recipe.categories.filter((c) => c.id !== categoryId)
    if (remaining.length === 0) return
    onRecipeChange({ ...recipe, categories: remaining })
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
                  maxPercentLimit: null,
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
    patch: Partial<{ name: string; drops: number; maxPercentLimit: number | null }>,
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

  // Find the minimum drops across all essential oils
  const allDrops = recipe.categories.flatMap((c) =>
    c.essentialOils.map((e) => e.drops),
  )
  const minDrops = allDrops.length > 0 ? Math.min(...allDrops) : 0

  const increaseEssentialOils = () => {
    if (minDrops <= 0) return
    const newMin = minDrops + 1
    const factor = newMin / minDrops

    onRecipeChange({
      ...recipe,
      categories: recipe.categories.map((c) => ({
        ...c,
        essentialOils: c.essentialOils.map((e) => ({
          ...e,
          drops: Math.round(e.drops * factor),
        })),
      })),
    })
  }

  const decreaseEssentialOils = () => {
    if (minDrops <= 1) return // Can't go below 1
    const newMin = minDrops - 1
    const factor = newMin / minDrops

    onRecipeChange({
      ...recipe,
      categories: recipe.categories.map((c) => ({
        ...c,
        essentialOils: c.essentialOils.map((e) => ({
          ...e,
          drops: Math.max(1, Math.round(e.drops * factor)),
        })),
      })),
    })
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        Recipe Workspace
      </h2>

      <div className="mb-4 flex flex-col gap-3">
        <input
          value={recipe.title}
          onChange={(e) =>
            onRecipeChange({ ...recipe, title: e.target.value })
          }
          autoComplete="off"
          placeholder="Recipe title"
          className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-800"
        />
        <textarea
          value={recipe.description}
          onChange={(e) =>
            onRecipeChange({ ...recipe, description: e.target.value })
          }
          autoComplete="off"
          placeholder="Description (optional)"
          rows={2}
          className="w-full resize-none rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        />
      </div>

      <div className="mb-2 mt-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-zinc-500">
          Base oils
        </h3>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-zinc-500">Volume (ml)</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={recipe.targetVolumeML}
            onChange={(e) =>
              onRecipeChange({
                ...recipe,
                targetVolumeML: parseFloat(e.target.value) || 0,
              })
            }
            autoComplete="off"
            className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
      </div>
      <div className="mb-6 space-y-2">
        {(recipe.baseOils ?? []).map((row, i) => {
          const calc = baseCalculated[i]
          return (
            <BaseOilRow
              key={`base-${i}`}
              name={row.name}
              ratio={row.ratio}
              calculatedML={calc?.calculatedML ?? 0}
              library={baseOilLibrary}
              onUpdate={(patch) => updateBase(i, patch)}
              onRemove={() => removeBaseRow(i)}
            />
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
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-500">
          Categories & essential oils
          {(() => {
            const totalOilMl = totalOilMlInRecipe(recipe)
            const totalPct = totalBaseMl > 0 ? ((totalOilMl / totalBaseMl) * 100).toFixed(1) : '0'
            return (
              <span className="normal-case font-normal text-zinc-400">
                ({totalPct}% of base oil)
              </span>
            )
          })()}
          <span className="flex gap-1">
            <button
              type="button"
              onClick={decreaseEssentialOils}
              disabled={minDrops <= 1}
              className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              −
            </button>
            <button
              type="button"
              onClick={increaseEssentialOils}
              disabled={allDrops.length === 0}
              className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              +
            </button>
          </span>
        </h3>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {recipe.categories.map((cat) => {
            const catOilMl = oilMlInCategory(recipe, cat.id)
            const oilPct =
              totalBaseMl > 0
                ? ((catOilMl / totalBaseMl) * 100).toFixed(1)
                : '0'
            const ids = cat.essentialOils.map((e) => e.id)

            return (
              <SortableCategory
                key={cat.id}
                category={cat}
                oilPct={oilPct}
                ids={ids}
                totalBaseMl={totalBaseMl}
                canRemove={recipe.categories.length > 1}
                isOver={hoveredCategoryId === cat.id}
                essentialOilLibrary={essentialOilLibrary}
                onUpdateName={updateCategoryName}
                onRemove={removeCategory}
                onAddEo={addEoToCategory}
                onUpdateEo={updateEo}
                onRemoveEo={removeEo}
              />
            )
          })}
        </div>
      </DndContext>

      <button
        type="button"
        onClick={addCategory}
        className="mt-4 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
      >
        + Category
      </button>
    </section>
  )
}

function SortableCategory({
  category,
  oilPct,
  ids,
  totalBaseMl,
  canRemove,
  isOver,
  essentialOilLibrary,
  onUpdateName,
  onRemove,
  onAddEo,
  onUpdateEo,
  onRemoveEo,
}: {
  category: {
    id: string
    name: string
    essentialOils: {
      id: string
      name: string
      drops: number
      maxPercentLimit: number | null
    }[]
  }
  oilPct: string
  ids: string[]
  totalBaseMl: number
  canRemove: boolean
  isOver: boolean
  essentialOilLibrary: Oil[]
  onUpdateName: (id: string, name: string) => void
  onRemove: (id: string) => void
  onAddEo: (id: string) => void
  onUpdateEo: (catId: string, eoId: string, patch: Partial<{ name: string; drops: number; maxPercentLimit: number | null }>) => void
  onRemoveEo: (catId: string, eoId: string) => void
}) {
  // Use droppable so empty categories can receive drops
  const { setNodeRef } = useDroppable({
    id: category.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/50 ${isOver ? 'ring-2 ring-violet-500' : ''}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={category.name}
          onChange={(e) => onUpdateName(category.id, e.target.value)}
          autoComplete="off"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-900"
          aria-label="Category name"
        />
        <span className="text-xs text-zinc-500">
          {oilPct}% of base oil
        </span>
        {category.essentialOils.length === 0 && canRemove && (
          <button
            type="button"
            onClick={() => onRemove(category.id)}
            className="ml-auto text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
            aria-label="Remove category"
          >
            Remove
          </button>
        )}
        {category.essentialOils.length === 0 && canRemove && (
          <button
            type="button"
            onClick={() => onRemove(category.id)}
            className="ml-auto text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
            aria-label="Remove category"
          >
            Remove
          </button>
        )}
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {category.essentialOils.map((eo) => (
            <SortableEoRow
              key={eo.id}
              eo={eo}
              totalBaseMl={totalBaseMl}
              library={essentialOilLibrary}
              onUpdate={(patch) => onUpdateEo(category.id, eo.id, patch)}
              onRemove={() => onRemoveEo(category.id, eo.id)}
            />
          ))}
        </ul>
      </SortableContext>

      <button
        type="button"
        onClick={() => onAddEo(category.id)}
        className="mt-2 text-xs text-violet-600 hover:underline dark:text-violet-400"
      >
        + Oil
      </button>
    </div>
  )
}

function SortableEoRow({
  eo,
  totalBaseMl,
  library,
  onUpdate,
  onRemove,
}: {
  eo: {
    id: string
    name: string
    drops: number
    maxPercentLimit: number | null
  }
  totalBaseMl: number
  library: Oil[]
  onUpdate: (patch: Partial<{
    name: string
    drops: number
    maxPercentLimit: number | null
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

  // Local state for name input - only synced to recipe on blur
  const [localName, setLocalName] = useState(eo.name)
  const nameRef = useRef(eo.name) // Keep ref in sync with localName
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimeoutRef = useRef<number | null>(null)

  // Sync local name and ref when prop changes (e.g., switching recipes)
  useEffect(() => {
    setLocalName(eo.name)
    nameRef.current = eo.name
  }, [eo.name])

  // Filter suggestions based on input (case-insensitive)
  const suggestions = library.filter(
    (oil) =>
      localName.length > 0 &&
      oil.name.toLowerCase().includes(localName.toLowerCase()) &&
      oil.name.toLowerCase() !== localName.toLowerCase(),
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev,
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedIndex].name)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
  }

  const selectSuggestion = (selectedName: string) => {
    // Clear any pending blur timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }
    setLocalName(selectedName)
    nameRef.current = selectedName
    onUpdate({ name: selectedName })
    setShowSuggestions(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

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
  const unsafe = !safety.isSafe && eo.maxPercentLimit != null
  const tip =
    unsafe && safety.suggestedBaseML != null
      ? `Increase Base Volume to ${roundMlForDisplay(safety.suggestedBaseML).toFixed(2)} ml to be safe.`
      : undefined

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="relative flex flex-wrap items-end gap-2 rounded border border-zinc-200 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-900"
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
          ref={inputRef}
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value)
            nameRef.current = e.target.value
            setShowSuggestions(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay hiding to allow click on suggestion
            blurTimeoutRef.current = window.setTimeout(() => {
              setShowSuggestions(false)
              setSelectedIndex(-1)
              onUpdate({ name: nameRef.current })
            }, 150)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Oil"
          autoComplete="off"
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
          autoComplete="off"
          className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
        />
      </label>
      <label className="w-24 text-xs">
        Max % limit
        <input
          type="number"
          min={0}
          step={0.01}
          placeholder="None"
          value={eo.maxPercentLimit ?? ''}
          onChange={(e) => {
            const val = e.target.value
            onUpdate({
              maxPercentLimit: val === '' ? null : (parseFloat(val) || 0),
            })
          }}
          autoComplete="off"
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

      {/* Autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute left-6 top-full z-10 mt-1 max-h-40 w-48 overflow-y-auto rounded border border-zinc-300 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-800">
          {suggestions.map((oil, index) => (
            <li key={oil.name}>
              <button
                type="button"
                onClick={() => selectSuggestion(oil.name)}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-violet-50 dark:hover:bg-zinc-700 ${
                  index === selectedIndex
                    ? 'bg-violet-100 dark:bg-violet-900'
                    : ''
                }`}
              >
                {oil.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function BaseOilRow({
  name,
  ratio,
  calculatedML,
  library,
  onUpdate,
  onRemove,
}: {
  name: string
  ratio: number
  calculatedML: number
  library: BaseOil[]
  onUpdate: (patch: { name?: string; ratio?: number }) => void
  onRemove: () => void
}) {
  // Local state for name input - only synced to recipe on blur
  const [localName, setLocalName] = useState(name)
  const nameRef = useRef(name) // Keep ref in sync with localName
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimeoutRef = useRef<number | null>(null)

  // Sync local name and ref when prop changes (e.g., switching recipes)
  useEffect(() => {
    setLocalName(name)
    nameRef.current = name
  }, [name])

  // Filter suggestions based on input (case-insensitive)
  const suggestions = library.filter(
    (oil) =>
      localName.length > 0 &&
      oil.name.toLowerCase().includes(localName.toLowerCase()) &&
      oil.name.toLowerCase() !== localName.toLowerCase(),
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev,
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedIndex].name)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
  }

  const selectSuggestion = (selectedName: string) => {
    // Clear any pending blur timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }
    setLocalName(selectedName)
    nameRef.current = selectedName
    onUpdate({ name: selectedName })
    setShowSuggestions(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="relative border-b border-zinc-100 pb-2 dark:border-zinc-800">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[100px] flex-1 text-xs">
          Name
          <input
            ref={inputRef}
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value)
              nameRef.current = e.target.value
              setShowSuggestions(true)
              setSelectedIndex(-1)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay hiding to allow click on suggestion
              blurTimeoutRef.current = window.setTimeout(() => {
                setShowSuggestions(false)
                setSelectedIndex(-1)
                onUpdate({ name: nameRef.current })
              }, 150)
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
        <label className="w-20 text-xs">
          Parts
          <input
            type="number"
            min={0}
            step={0.1}
            value={ratio}
            onChange={(e) =>
              onUpdate({ ratio: parseFloat(e.target.value) || 0 })
            }
            autoComplete="off"
            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
        <span className="text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
          → {roundMlForDisplay(calculatedML).toFixed(2)} ml
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-zinc-500 hover:text-red-600"
        >
          Remove
        </button>
      </div>

      {/* Autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border border-zinc-300 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-800">
          {suggestions.map((oil, index) => (
            <li key={oil.name}>
              <button
                type="button"
                onClick={() => selectSuggestion(oil.name)}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-violet-50 dark:hover:bg-zinc-700 ${
                  index === selectedIndex
                    ? 'bg-violet-100 dark:bg-violet-900'
                    : ''
                }`}
              >
                {oil.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
