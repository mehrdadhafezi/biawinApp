/* eslint-disable @typescript-eslint/unbound-method -- `mockResponse()`'s
 * return value is cast to the real `express.Response` type so `controller
 * .serve()` type-checks against it; that makes `res.setHeader` resolve to
 * Express's own (`this`-bound) method signature rather than a plain
 * `jest.Mock`, which is what actually trips this rule below. Every
 * `res.setHeader`/`res.send` reference here is only ever passed to
 * `expect(...)`, never invoked directly, so the rule's real concern (a
 * detached method silently losing its `this`) doesn't apply. */
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { MediaFilesController } from './media-files.controller';

function mockResponse() {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
  } as unknown as import('express').Response;
}

describe('MediaFilesController', () => {
  let controller: MediaFilesController;
  let prisma: { mediaAsset: { findFirst: jest.Mock } };
  let storage: { getObject: jest.Mock };

  beforeEach(async () => {
    prisma = { mediaAsset: { findFirst: jest.fn() } };
    storage = { getObject: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaFilesController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    controller = module.get(MediaFilesController);
  });

  it('serves the object bytes with the stored mimeType and a long-lived cache header for an active asset', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue({
      key: 'media/abc.webp',
      mimeType: 'image/webp',
      active: true,
    });
    storage.getObject.mockResolvedValue({
      body: Buffer.from('fake-bytes'),
      contentType: 'image/webp',
    });
    const res = mockResponse();

    await controller.serve('abc.webp', res);

    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
      where: { key: 'media/abc.webp', active: true },
    });
    expect(storage.getObject).toHaveBeenCalledWith('media/abc.webp');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=31536000, immutable',
    );
    // Overrides helmet()'s global `Cross-Origin-Resource-Policy: same-origin`
    // default — without this, a real <img> from a different origin (every
    // real deployment) silently fails to decode even though fetch() against
    // the same URL succeeds. Found live during Stage 5.21 verification.
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Resource-Policy',
      'cross-origin',
    );
    expect(res.send).toHaveBeenCalledWith(Buffer.from('fake-bytes'));
  });

  it('404s for a filename with no matching active MediaAsset row (missing or soft-deleted)', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    const res = mockResponse();

    await expect(controller.serve('missing.webp', res)).rejects.toThrow(
      NotFoundException,
    );
    expect(storage.getObject).not.toHaveBeenCalled();
  });
});
