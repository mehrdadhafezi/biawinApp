import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Requires the full stack (Postgres, Redis, MinIO) — run via `docker compose up`
// then `pnpm --filter @biawin/backend test:e2e`. Not run in CI (see .github/workflows/ci.yml).
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: { status?: string } }) => {
        if (res.body.status !== 'ok') throw new Error('expected status ok');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
