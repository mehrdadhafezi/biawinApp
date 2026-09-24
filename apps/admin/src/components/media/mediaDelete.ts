import { describeMediaDeleteError, type MediaDeleteFailureKind } from "../../features/home/errors";

export type MediaDeleteResult =
  | { success: true }
  | {
      success: false;
      kind: MediaDeleteFailureKind;
      message: string;
      /** The asset no longer exists — the list is stale and must be refetched. */
      stale: boolean;
    };

export interface MediaDeleteDeps {
  remove: (id: string) => Promise<unknown>;
}

/**
 * Plain, unit-testable delete action for the Media page. Never bypasses the
 * backend's protection: a 409 (asset still referenced) is reported with what
 * references it and nothing is detached, rewritten or replaced; a 404 marks
 * the list stale.
 */
export async function performMediaDelete(id: string, deps: MediaDeleteDeps): Promise<MediaDeleteResult> {
  try {
    await deps.remove(id);
    return { success: true };
  } catch (error) {
    const { kind, message } = describeMediaDeleteError(error);
    return { success: false, kind, message, stale: kind === "not-found" };
  }
}
