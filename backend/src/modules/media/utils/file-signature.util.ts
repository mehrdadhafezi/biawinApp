import type { AllowedMediaMimeType } from './media-validation.constants';

/**
 * Sniffs the real file format from its magic bytes rather than trusting the
 * multipart upload's client-declared `mimetype` (a client can label any
 * bytes with any Content-Type header — this is the actual security check;
 * the declared MIME is only ever used as a cross-check against this, never
 * trusted alone). Zero external dependencies deliberately — the npm
 * registry was unreachable from this environment across the last two admin
 * stages (Stage 5.16's bcrypt→scrypt, Stage 5.17's testing-library
 * substitution); a ~20-line signature check for a fixed 4-format allow-list
 * doesn't need a package (e.g. `file-type`) even when the registry is
 * reachable.
 */
export function sniffImageMimeType(
  buffer: Buffer,
): AllowedMediaMimeType | null {
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (buffer.length >= 6) {
    const header = buffer.toString('ascii', 0, 6);
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
