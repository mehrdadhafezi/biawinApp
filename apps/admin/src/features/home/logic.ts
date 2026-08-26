import { ApiError } from "../../lib/api-client";
import type { ReorderEntry } from "./types";

export type ActionResult<T> = { success: true; item: T } | { success: false; message: string };
export type ListActionResult<T> = { success: true; items: T[] } | { success: false; message: string };

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
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
    return { success: false, message: messageFor(error, "به‌روزرسانی وضعیت با خطا مواجه شد.") };
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
  try {
    await deps.reorder(items);
    const refreshed = await deps.list();
    return { success: true, items: refreshed.items };
  } catch (error) {
    return { success: false, message: messageFor(error, "تغییر ترتیب با خطا مواجه شد.") };
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
    return { success: false, message: messageFor(error, "ذخیره‌سازی با خطا مواجه شد.") };
  }
}

export interface RemoveDeps {
  remove: (id: string) => Promise<{ id: string }>;
}

export async function performRemove(id: string, deps: RemoveDeps): Promise<{ success: true } | { success: false; message: string }> {
  try {
    await deps.remove(id);
    return { success: true };
  } catch (error) {
    return { success: false, message: messageFor(error, "حذف با خطا مواجه شد.") };
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
