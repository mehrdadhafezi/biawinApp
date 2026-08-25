import { extractImageDimensions } from './image-metadata.util';
import {
  samplePng,
  sampleGif,
  sampleJpeg,
  sampleWebpVp8x,
} from './__fixtures__/sample-images';

describe('extractImageDimensions', () => {
  it('extracts width/height from a PNG header', () => {
    expect(extractImageDimensions(samplePng(100, 50), 'image/png')).toEqual({
      width: 100,
      height: 50,
    });
  });

  it('extracts width/height from a GIF header', () => {
    expect(extractImageDimensions(sampleGif(64, 32), 'image/gif')).toEqual({
      width: 64,
      height: 32,
    });
  });

  it('extracts width/height from a JPEG SOF0 segment', () => {
    expect(extractImageDimensions(sampleJpeg(200, 150), 'image/jpeg')).toEqual({
      width: 200,
      height: 150,
    });
  });

  it('extracts width/height from a WebP VP8X chunk', () => {
    expect(
      extractImageDimensions(sampleWebpVp8x(320, 240), 'image/webp'),
    ).toEqual({ width: 320, height: 240 });
  });

  it('returns null (never throws) for a truncated/unparseable buffer', () => {
    expect(
      extractImageDimensions(Buffer.from([0x89, 0x50]), 'image/png'),
    ).toBeNull();
  });
});
