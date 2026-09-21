import { MediaStorageService } from '../media/media-storage.service';

/**
 * Shared by every Home CMS service with a `mediaAsset` relation — resolves the same static-bridge URL `MediaService`/`OrbitItemsService` already use, never a raw key.
 *
 * Stage 5.16-B (BD-2): a soft-deleted asset (`active === false`) resolves to
 * `null`, never to a URL the media route would 404. The Home row is kept and
 * its `mediaAssetId` is untouched; the Customer App's existing no-image
 * fallback applies. Read-only: nothing is written or re-mapped here.
 */
export function resolveMediaUrl(
  mediaStorage: MediaStorageService,
  mediaAsset: { key: string; active?: boolean } | null | undefined,
): string | null {
  if (!mediaAsset || mediaAsset.active === false) return null;
  return mediaStorage.resolvePublicUrl(mediaAsset.key);
}
