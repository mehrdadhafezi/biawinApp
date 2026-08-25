import type { AllowedMediaMimeType } from './media-validation.constants';

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Parses width/height directly from each format's own header bytes —
 * deliberately no image-decoding library (`sharp`/`image-size`/`probe-
 * image-size`): the npm registry was unreachable for the whole
 * implementation window (same constraint as `file-signature.util.ts`), and
 * every format's dimension fields sit at fixed, well-documented byte
 * offsets that don't require decoding actual pixel data to read. Returns
 * `null` (never throws) for anything unparseable — a metadata-extraction
 * failure must not block an otherwise-valid upload.
 */
export function extractImageDimensions(
  buffer: Buffer,
  mimeType: AllowedMediaMimeType,
): ImageDimensions | null {
  try {
    switch (mimeType) {
      case 'image/png':
        return extractPngDimensions(buffer);
      case 'image/gif':
        return extractGifDimensions(buffer);
      case 'image/jpeg':
        return extractJpegDimensions(buffer);
      case 'image/webp':
        return extractWebpDimensions(buffer);
    }
  } catch {
    return null;
  }
}

/** PNG: signature (8 bytes) + IHDR chunk — length(4) + "IHDR"(4) + width(4, BE) + height(4, BE). */
function extractPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** GIF: signature (6 bytes) + width(2, LE) + height(2, LE). */
function extractGifDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 10) return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

/**
 * JPEG: scan marker segments after the FFD8 SOI marker until a Start-Of-
 * Frame marker (0xC0–0xCF, excluding DHT/JPG/DAC 0xC4/0xC8/0xCC) — its
 * payload is precision(1) + height(2, BE) + width(2, BE).
 */
function extractJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    // Markers with no payload/length (standalone).
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) return null; // EOI reached, nothing found
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/** WebP: RIFF/WEBP container (12 bytes) + one of the VP8 /VP8L/VP8X sub-chunk layouts. */
function extractWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 21) return null;
  const chunkFourCc = buffer.toString('ascii', 12, 16);
  const chunkDataOffset = 20; // 12 (RIFF/size/WEBP) + 4 (sub-chunk fourCC) + 4 (sub-chunk size)

  if (chunkFourCc === 'VP8X') {
    // 1 byte flags + 3 bytes reserved, then 3-byte LE (canvas width - 1), 3-byte LE (canvas height - 1).
    const w = buffer.readUIntLE(chunkDataOffset + 4, 3) + 1;
    const h = buffer.readUIntLE(chunkDataOffset + 7, 3) + 1;
    return { width: w, height: h };
  }
  if (chunkFourCc === 'VP8L') {
    // 1 byte signature (0x2F) + 4 bytes packed: 14 bits width-1, 14 bits height-1.
    const packed = buffer.readUInt32LE(chunkDataOffset + 1);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    };
  }
  if (chunkFourCc === 'VP8 ') {
    // 3-byte frame tag + 3-byte start code (0x9d 0x01 0x2a), then width/height each 2 bytes LE (14 bits + 2-bit scale).
    const width = buffer.readUInt16LE(chunkDataOffset + 6) & 0x3fff;
    const height = buffer.readUInt16LE(chunkDataOffset + 8) & 0x3fff;
    return { width, height };
  }
  return null;
}
