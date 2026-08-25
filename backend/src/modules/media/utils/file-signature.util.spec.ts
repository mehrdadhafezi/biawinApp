import { sniffImageMimeType } from './file-signature.util';
import {
  samplePng,
  sampleGif,
  sampleJpeg,
  sampleWebpVp8x,
} from './__fixtures__/sample-images';

describe('sniffImageMimeType', () => {
  it('identifies PNG from its magic bytes', () => {
    expect(sniffImageMimeType(samplePng())).toBe('image/png');
  });

  it('identifies JPEG from its magic bytes', () => {
    expect(sniffImageMimeType(sampleJpeg())).toBe('image/jpeg');
  });

  it('identifies GIF from its magic bytes', () => {
    expect(sniffImageMimeType(sampleGif())).toBe('image/gif');
  });

  it('identifies WebP from its magic bytes', () => {
    expect(sniffImageMimeType(sampleWebpVp8x())).toBe('image/webp');
  });

  it('returns null for content that matches no known image signature (e.g. plain text)', () => {
    expect(
      sniffImageMimeType(Buffer.from('<script>alert(1)</script>')),
    ).toBeNull();
  });

  it('returns null for a PNG-labeled file whose bytes are actually something else', () => {
    // The exact "declared MIME lies about the real bytes" case this function exists to catch.
    const fakePng = Buffer.from(
      'this is not an image, just text pretending to be one',
    );
    expect(sniffImageMimeType(fakePng)).toBeNull();
  });
});
