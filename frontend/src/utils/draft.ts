import { useCallback, useEffect, useRef } from 'react'

/**
 * In-progress "create item" drafts (DAV-87).
 *
 * Every create form stores what the user is typing in localStorage so that an
 * accidental close (Escape, the modal X) never loses their input. The draft is
 * only removed on an explicit Cancel, an explicit Clear, or a successful
 * create. All localStorage access is defensive: quota errors, private-mode
 * restrictions and corrupt payloads must never break the form.
 */

/** Prefix shared by every draft key. */
export const DRAFT_KEY_PREFIX = 'davai_draft_'

/** Item types that keep a draft. */
export type DraftKind = 'work_item' | 'user_support' | 'incident' | 'monitoring_log'

/**
 * Storage key for a draft: `davai_draft_<kind>_<PROJECTKEY>`.
 *
 * The work item draft is deliberately shared between the list and the board
 * view so a draft typed in one is available in the other.
 */
export function draftStorageKey(kind: DraftKind, projectKey: string): string {
  const key = String(projectKey || 'DAV').toUpperCase()
  return `${DRAFT_KEY_PREFIX}${kind}_${key}`
}

export type DraftValues = Record<string, unknown>

/** Optional per-field validators, e.g. "status must be an available option". */
export type DraftValidators<T extends DraftValues> = Partial<
  Record<keyof T & string, (value: unknown) => boolean>
>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * True when no field differs from its initial/default value, i.e. there is
 * nothing worth persisting. Used both to skip writing and to disable Clear.
 */
export function isDraftBlank(
  values: DraftValues,
  initialValues: DraftValues
): boolean {
  const keys = new Set([...Object.keys(values), ...Object.keys(initialValues)])
  for (const key of keys) {
    if (values[key] !== initialValues[key]) return false
  }
  return true
}

/**
 * Read and validate a stored draft, keeping track of the fields that were
 * present in storage but rejected by the sanitising rules.
 *
 * `patch` is what the form can restore; `rejected` holds the raw stored values
 * that could not be applied (wrong type, unknown status, ...). Callers keep the
 * rejected values in storage so a transient rejection (e.g. project statuses
 * not loaded yet) never permanently discards the user's input.
 *
 * Corrupt or non-object payloads are removed and reported as `null`. A draft
 * that restores nothing while still carrying rejected values is returned as an
 * empty `patch` with that `rejected` set, so it is not discarded; one that
 * restores nothing and holds nothing usable either is removed. Never thrown.
 */
export interface DetailedDraft<T extends DraftValues> {
  patch: Partial<T>
  rejected: DraftValues
}

export function readDraftDetailed<T extends DraftValues>(
  storageKey: string,
  initialValues: T,
  validators: DraftValidators<T> = {}
): DetailedDraft<T> | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(storageKey)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    removeDraft(storageKey)
    return null
  }

  if (!isPlainObject(parsed)) {
    removeDraft(storageKey)
    return null
  }

  const patch: DraftValues = {}
  const rejected: DraftValues = {}
  for (const field of Object.keys(initialValues) as (keyof T & string)[]) {
    if (!(field in parsed)) continue
    const value = parsed[field]
    const validator = validators[field]
    if (typeof value !== typeof initialValues[field] || (validator && !validator(value))) {
      rejected[field] = value
      continue
    }
    patch[field] = value
  }

  if (Object.keys(patch).length === 0) {
    // Nothing usable could be restored. Keep the stored draft when it still
    // holds rejected values, so a transient rejection does not destroy input.
    if (Object.keys(rejected).length === 0) {
      removeDraft(storageKey)
      return null
    }
    return { patch: {} as Partial<T>, rejected }
  }

  // A stored draft that only contains defaults carries no user input.
  if (isDraftBlank({ ...initialValues, ...patch }, initialValues)) {
    removeDraft(storageKey)
    return null
  }

  return { patch: patch as Partial<T>, rejected }
}

/**
 * Read and validate a stored draft (see {@link readDraftDetailed}).
 * Returns only the fields that can be restored.
 */
export function readDraft<T extends DraftValues>(
  storageKey: string,
  initialValues: T,
  validators: DraftValidators<T> = {}
): Partial<T> | null {
  return readDraftDetailed(storageKey, initialValues, validators)?.patch ?? null
}

/** Persist a draft. Storage failures (quota, private mode) are swallowed. */
export function writeDraft(storageKey: string, values: DraftValues): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(values))
  } catch {
    // Private-browsing / quota failures are non-fatal: the form keeps working.
  }
}

/** Remove a stored draft. Storage failures are swallowed. */
export function removeDraft(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Ignore: there is nothing sensible to do if storage is unavailable.
  }
}

export interface UseDraftPersistenceOptions<T extends DraftValues> {
  /** localStorage key, see {@link draftStorageKey}. */
  storageKey: string
  /** Current form values. */
  values: T
  /** Defaults the form resets to; also used for blank detection and typing. */
  initialValues: T
  /** Called once on mount, and again whenever `storageKey` changes, with the validated stored draft. */
  restore: (patch: Partial<T>) => void
  /** Optional per-field validators applied when restoring. */
  validators?: DraftValidators<T>
}

export interface DraftPersistence {
  /** True when at least one field differs from its default (i.e. Clear is meaningful). */
  isDirty: boolean
  /** Remove the stored draft. Component state is left untouched. */
  clear: () => void
}

/**
 * Write the draft on every change and restore it once per storage key.
 *
 * When the storage key changes (e.g. the user navigates from project A to
 * project B without a remount) the form is first reset to `initialValues` and
 * only then is B's draft applied, so A's text can never be written under B's
 * key.
 *
 * Fields rejected by the validators are kept in storage (merged back on every
 * write) until the user edits them, so a transient rejection never destroys
 * their input. The first persistence pass after a restore is skipped so the
 * pre-restore defaults are never written back.
 */
export function useDraftPersistence<T extends DraftValues>({
  storageKey,
  values,
  initialValues,
  restore,
  validators
}: UseDraftPersistenceOptions<T>): DraftPersistence {
  const restoreRef = useRef(restore)
  restoreRef.current = restore
  const initialValuesRef = useRef<T>(initialValues)
  initialValuesRef.current = initialValues
  const validatorsRef = useRef(validators)
  validatorsRef.current = validators

  const restoredKeyRef = useRef<string | null>(null)
  const skipPersistRef = useRef(true)
  /** Values as restored, used to tell "still untouched" fields from edited ones. */
  const baselineRef = useRef<DraftValues>({})
  /** Stored values the validators rejected; kept in storage on every write. */
  const rejectedRef = useRef<DraftValues>({})

  useEffect(() => {
    const previousKey = restoredKeyRef.current
    if (previousKey === storageKey) return
    restoredKeyRef.current = storageKey
    // The restore below changes state; don't persist the pre-restore defaults.
    skipPersistRef.current = true

    const initial = initialValuesRef.current
    rejectedRef.current = {}
    baselineRef.current = { ...initial }

    // A different project's form must not inherit the previous values.
    if (previousKey !== null) restoreRef.current(initial)

    const detailed = readDraftDetailed<T>(storageKey, initial, validatorsRef.current)
    if (detailed) {
      restoreRef.current(detailed.patch)
      rejectedRef.current = detailed.rejected
      baselineRef.current = { ...initial, ...detailed.patch }
    }
  }, [storageKey])

  const serializedValues = JSON.stringify(values)

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false
      return
    }
    let parsed: DraftValues
    try {
      parsed = JSON.parse(serializedValues) as DraftValues
    } catch {
      return
    }
    if (isDraftBlank(parsed, initialValuesRef.current)) {
      removeDraft(storageKey)
      return
    }
    // Preserve stored values that could not be applied and that the user has
    // not edited since the restore.
    const merged: DraftValues = { ...parsed }
    for (const [field, rejectedValue] of Object.entries(rejectedRef.current)) {
      if (parsed[field] === baselineRef.current[field]) merged[field] = rejectedValue
    }
    writeDraft(storageKey, merged)
  }, [serializedValues, storageKey])

  const clear = useCallback(() => removeDraft(storageKey), [storageKey])

  return {
    isDirty: !isDraftBlank(values, initialValues),
    clear
  }
}
