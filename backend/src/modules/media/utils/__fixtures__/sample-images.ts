/** Minimal, byte-accurate fixtures for each allowed format — real headers, not decodable pixel data (nothing here parses pixels, only headers). */

export function samplePng(width = 100, height = 50): Buffer {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(13);
  const type = Buffer.from('IHDR', 'ascii');
  const w = Buffer.alloc(4);
  w.writeUInt32BE(width);
  const h = Buffer.alloc(4);
  h.writeUInt32BE(height);
  const rest = Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]); // bit depth/color type/compression/filter/interlace
  const crc = Buffer.alloc(4);
  return Buffer.concat([signature, length, type, w, h, rest, crc]);
}

export function sampleGif(width = 64, height = 32): Buffer {
  const signature = Buffer.from('GIF89a', 'ascii');
  const w = Buffer.alloc(2);
  w.writeUInt16LE(width);
  const h = Buffer.alloc(2);
  h.writeUInt16LE(height);
  const rest = Buffer.from([0x00, 0x00, 0x00]);
  return Buffer.concat([signature, w, h, rest]);
}

export function sampleJpeg(width = 200, height = 150): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  // A minimal APP0/JFIF segment so the scanner has something to skip first.
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  // SOF0 (0xC0): marker(2) + length(2, BE, =11: 2 length + 1 precision + 2 height + 2 width + 1 numComponents + 3 component bytes) + precision(1) + height(2, BE) + width(2, BE) + numComponents(1) + 3 component bytes
  const sofLength = Buffer.alloc(2);
  sofLength.writeUInt16BE(11);
  const h = Buffer.alloc(2);
  h.writeUInt16BE(height);
  const w = Buffer.alloc(2);
  w.writeUInt16BE(width);
  const sof0 = Buffer.concat([
    Buffer.from([0xff, 0xc0]),
    sofLength,
    Buffer.from([0x08]), // precision
    h,
    w,
    Buffer.from([0x01, 0x01, 0x11, 0x00]), // numComponents=1, one component descriptor
  ]);
  return Buffer.concat([soi, app0, sof0]);
}

export function sampleWebpVp8x(width = 320, height = 240): Buffer {
  const riff = Buffer.from('RIFF', 'ascii');
  const size = Buffer.alloc(4); // not validated by our parser
  const webp = Buffer.from('WEBP', 'ascii');
  const fourCc = Buffer.from('VP8X', 'ascii');
  const chunkSize = Buffer.alloc(4);
  chunkSize.writeUInt32LE(10);
  const flags = Buffer.from([0x00, 0x00, 0x00, 0x00]); // flags + 3 reserved
  const w = Buffer.alloc(3);
  w.writeUIntLE(width - 1, 0, 3);
  const h = Buffer.alloc(3);
  h.writeUIntLE(height - 1, 0, 3);
  return Buffer.concat([riff, size, webp, fourCc, chunkSize, flags, w, h]);
}
