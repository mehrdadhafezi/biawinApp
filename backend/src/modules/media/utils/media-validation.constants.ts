/**
 * Closed allow-list, not env-configurable (docs env.validation.ts's own
 * comment explains why: this is a fixed security decision, not a per-
 * environment tunable). `image/svg+xml` is deliberately excluded — an SVG
 * can embed `<script>`/event-handler content and is not safe to treat as a
 * passive image the way raster formats are; supporting it would need real
 * sanitization this stage doesn't build.
 */
export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

export function isAllowedMediaMimeType(
  mimeType: string,
): mimeType is AllowedMediaMimeType {
  return (ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(mimeType);
}

export const MIME_TYPE_EXTENSION: Record<AllowedMediaMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
