import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

/**
 * Object storage layer, uniform for dev (MinIO) and production (any
 * S3-compatible provider) — both speak the S3 API, so only STORAGE_* env vars
 * change between environments, never this code. Object keys, not raw
 * files/URLs, are what's stored on domain models (User.Profile.avatarKey,
 * Service.imageKey, ...); consumers ask for a short-lived presigned URL when
 * they actually need to read/write bytes.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('STORAGE_BUCKET');
    this.client = new S3Client({
      endpoint: this.config.getOrThrow<string>('STORAGE_ENDPOINT'),
      region: this.config.get<string>('STORAGE_REGION', 'us-east-1'),
      forcePathStyle: this.config.get<boolean>(
        'STORAGE_FORCE_PATH_STYLE',
        true,
      ),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('STORAGE_SECRET_KEY'),
      },
    });
  }

  /** Builds a namespaced, collision-safe object key, e.g. "avatars/<uuid>.jpg". */
  buildKey(namespace: string, extension: string): string {
    return `${namespace}/${randomUUID()}.${extension.replace(/^\./, '')}`;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Reads an object's full bytes back out of the bucket — added for Stage
   * 5.21's `/media/:filename` static-bridge route (`MediaFilesController`),
   * the first real reader this service has ever needed (every other caller
   * only ever put/deleted/presigned). Buffers the whole object in memory
   * rather than streaming the response through — acceptable for the small
   * photo-sized files (`MEDIA_MAX_FILE_SIZE_BYTES`, 5MB default) this
   * bucket actually holds; revisit if a much larger file type is ever
   * stored here.
   */
  async getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.client.send(command);
    const body = await streamToBuffer(response.Body as Readable);
    return {
      body,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }

  async getPresignedGetUrl(
    key: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    // Always re-wrapped via `Buffer.from()` (even when `chunk` is already a
    // Buffer) rather than pushed as-is — Node's stream async iterator types
    // `chunk` as `any`, so an `instanceof Buffer` narrow still leaves a
    // generic-parameter mismatch (`Buffer<any>` vs. this array's
    // `Buffer<ArrayBufferLike>`); re-wrapping produces a concretely-typed
    // Buffer either way, cheaply (a no-op copy when it's already a Buffer).
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}
