import { MediaStorageService } from '../media/media-storage.service';

/** Shared by every Home CMS service with a `mediaAsset` relation — resolves the same static-bridge URL `MediaService`/`OrbitItemsService` already use, never a raw key. */
export function resolveMediaUrl(
  mediaStorage: MediaStorageService,
  mediaAsset: { key: string } | null | undefined,
): string | null {
  return mediaAsset ? mediaStorage.resolvePublicUrl(mediaAsset.key) : null;
}
