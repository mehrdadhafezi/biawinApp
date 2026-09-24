/**
 * Stage 5.17-B — media-reference state for the Home forms.
 *
 * Why this exists: the Stage 5.16 backend returns `image: null` for a Home
 * row whose `MediaAsset` was soft-deleted, but the row still carries its old
 * `mediaAssetId`, and every Home write (POST/PUT) requires a referenced asset
 * to be ACTIVE (`assertMediaAssetUsable` → 422). A form that kept the stale id
 * in state and re-sent it on every save was therefore unable to save ANY edit.
 *
 * Contract: an "unavailable" original reference is never re-submitted unless
 * the admin explicitly resolves it — by choosing a replacement (send the new
 * id) or by clearing it (send `null`). Until then `mediaAssetId` is OMITTED
 * from the PUT body, which the backend treats as "unchanged" — so the admin
 * can still edit other fields, and nothing is silently rewritten.
 *
 * `image` is `null` for a row with an id only when the asset is inactive
 * (`resolveMediaUrl` in the backend returns `null` for a missing or
 * soft-deleted asset, and the FK guarantees the row exists).
 */
export interface MediaFieldState {
  /** The id currently selected (may be the original, possibly unavailable, one). */
  value: string | null;
  /** The ORIGINAL reference points to an asset that is no longer available. */
  unavailable: boolean;
  /** The admin has explicitly picked a replacement or cleared the reference. */
  resolved: boolean;
}

export function initMediaField(initial: { mediaAssetId?: string | null; image?: string | null } | undefined): MediaFieldState {
  const id = initial?.mediaAssetId ?? null;
  return { value: id, unavailable: id !== null && !initial?.image, resolved: false };
}

export function selectMedia(id: string): MediaFieldState {
  return { value: id, unavailable: false, resolved: true };
}

export function clearMedia(): MediaFieldState {
  return { value: null, unavailable: false, resolved: true };
}

/** `undefined` = omit the field from the request (leave the stored reference untouched). */
export function mediaPayloadValue(state: MediaFieldState): string | null | undefined {
  if (state.unavailable && !state.resolved) return undefined;
  return state.value;
}
