import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../infra/storage/storage.service';
import { MediaStorageService } from './media-storage.service';

/**
 * No spec existed for this service before Stage 5.21 — added alongside the
 * `resolvePublicUrl()` behavior change (relative `/media/{filename}` →
 * absolute `PUBLIC_API_ORIGIN`-based URL) so the new contract has real
 * coverage, not just the pre-existing indirect coverage from services that
 * mock this class entirely (`HomeServiceBannersService.spec.ts` etc.).
 */
describe('MediaStorageService', () => {
  let service: MediaStorageService;
  let config: { get: jest.Mock };

  beforeEach(async () => {
    config = { get: jest.fn().mockReturnValue('http://localhost:4000') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaStorageService,
        { provide: StorageService, useValue: {} },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(MediaStorageService);
  });

  it('resolvePublicUrl builds an absolute URL from PUBLIC_API_ORIGIN + the versioned media route', () => {
    const url = service.resolvePublicUrl(
      'media/550e8400-e29b-41d4-a716-446655440000.webp',
    );

    expect(url).toBe(
      'http://localhost:4000/api/v1/media/550e8400-e29b-41d4-a716-446655440000.webp',
    );
    expect(config.get).toHaveBeenCalledWith(
      'PUBLIC_API_ORIGIN',
      'http://localhost:4000',
    );
  });

  it('resolvePublicUrl uses only the filename, not the full key, in the path', () => {
    config.get.mockReturnValue('https://api.biawin.ir');

    const url = service.resolvePublicUrl('media/abc.png');

    expect(url).toBe('https://api.biawin.ir/api/v1/media/abc.png');
  });

  it('buildKey delegates to StorageService.buildKey with the media namespace', () => {
    const storage = {
      buildKey: jest.fn().mockReturnValue('media/generated.png'),
    };
    const withRealStorage = new MediaStorageService(
      storage as never,
      config as never,
    );

    const key = withRealStorage.buildKey('image/png');

    expect(storage.buildKey).toHaveBeenCalledWith('media', 'png');
    expect(key).toBe('media/generated.png');
  });
});
