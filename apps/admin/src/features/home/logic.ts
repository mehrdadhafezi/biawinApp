import { describeHomeError, isStaleRecordError } from "./errors";
import type { ReorderEntry } from "./types";
import { validateReorderEntries } from "./validation";

/**
 * `stale: true` on a failure means the record(s) this action targeted no
 * longer exist (404, or a 422 naming unknown ids): the on-screen list is out
 * of date and the caller must refetch it rather than leave it as is. Local
 * state is never mutated as if the action had succeeded.
 */
export type FailureResult = { success: false; message: string; stale: boolean };
export type ActionResult<T> = { success: true; item: T } | FailureResult;
export type ListActionResult<T> = { success: true; items: T[] } | FailureResult;

function failure(error: unknown, fallback: string): FailureResult {
  return { success: false, message: describeHomeError(error, fallback), stale: isStaleRecordError(error) };
}

export interface ToggleActiveDeps<TAdmin> {
  update: (id: string, input: { active: boolean }) => Promise<TAdmin>;
}

/**
 * Same factored-out-plain-function pattern as `performAdminLogin`/
 * `performMediaUpload` (Stage 5.17/5.18) — directly unit-testable with a
 * mocked `update`, no rendering needed. Shared across all 4 Home resources
 * since the shape (`PUT .../:id` with a partial `active` patch) is
 * identical; each resource still calls its own dedicated endpoint via its
 * own `homeXxxApi.update`.
 */
export async function performToggleActive<TAdmin>(
  id: string,
  nextActive: boolean,
  deps: ToggleActiveDeps<TAdmin>,
): Promise<ActionResult<TAdmin>> {
  try {
    const item = await deps.update(id, { active: nextActive });
    return { success: true, item };
  } catch (error) {
    return failure(error, "به‌روزرسانی وضعیت با خطا مواجه شد.");
  }
}

export interface ReorderDeps<TAdmin> {
  reorder: (items: ReorderEntry[]) => Promise<unknown>;
  list: (limit?: number) => Promise<{ items: TAdmin[] }>;
}

/**
 * Reorders, then always re-fetches the admin list rather than trusting the
 * reorder endpoint's own response (which is shaped as the *public* list —
 * see `home-resource-api.ts`'s doc comment). On failure, returns
 * `success: false` and never touches the caller's list state — the caller
 * must check `.success` before applying anything, so a failed reorder can
 * never present as if it succeeded.
 */
export async function performReorder<TAdmin>(
  items: ReorderEntry[],
  deps: ReorderDeps<TAdmin>,
): Promise<ListActionResult<TAdmin>> {
  // Client guard mirroring the backend's strict reorder DTO — never send an
  // empty / duplicate-id / duplicate-position / malformed payload.
  const invalid = validateReorderEntries(items);
  if (invalid) return { success: false, message: invalid, stale: false };
  try {
    await deps.reorder(items);
    const refreshed = await deps.list();
    return { success: true, items: refreshed.items };
  } catch (error) {
    return failure(error, "تغییر ترتیب با خطا مواجه شد.");
  }
}

export interface SaveDeps<TInput, TAdmin> {
  create?: (input: TInput) => Promise<TAdmin>;
  update?: (id: string, input: Partial<TInput>) => Promise<TAdmin>;
}

/** `mode: "create"` requires `deps.create`; `mode: "edit"` requires `deps.update` + `id`. */
export async function performSave<TInput, TAdmin>(
  mode: "create" | "edit",
  id: string | null,
  input: TInput,
  deps: SaveDeps<TInput, TAdmin>,
): Promise<ActionResult<TAdmin>> {
  try {
    const item =
      mode === "create"
        ? await deps.create!(input)
        : await deps.update!(id!, input);
    return { success: true, item };
  } catch (error) {
    return failure(error, "ذخیره‌سازی با خطا مواجه شد.");
  }
}

export interface RemoveDeps {
  remove: (id: string) => Promise<{ id: string }>;
}

export async function performRemove(id: string, deps: RemoveDeps): Promise<{ success: true } | FailureResult> {
  try {
    await deps.remove(id);
    return { success: true };
  } catch (error) {
    return failure(error, "حذف با خطا مواجه شد.");
  }
}

/**
 * Computes the new `{id, sortOrder}[]` payload for a one-step move within a
 * displayed list, reassigning *every* item's `sortOrder` to its new index
 * (not just the two swapped rows) — keeps sortOrder values canonical/
 * sequential rather than accumulating drift across repeated reorders.
 */
export function moveItem<T>(items: T[], index: number, direction: "up" | "down", getId: (item: T) => string): ReorderEntry[] {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items.map((item, i) => ({ id: getId(item), sortOrder: i }));

  const reordered = [...items];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
  return reordered.map((item, i) => ({ id: getId(item), sortOrder: i }));
}
