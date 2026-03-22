/**
 * Storage helpers using Cloudflare R2 (S3-compatible API).
 *
 * R2 is accessed via @aws-sdk/client-s3 with the R2 endpoint.
 * Public files are served from R2_PUBLIC_URL (custom domain or r2.dev URL).
 * Private files use pre-signed download URLs.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey) {
    throw new Error(
      "R2 credentials missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY"
    );
  }

  _client = new S3Client({
    region: "auto",
    endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
    },
  });

  return _client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Build the public URL for a stored object.
 * Uses R2_PUBLIC_URL if configured (custom domain or r2.dev),
 * otherwise falls back to a pre-signed URL.
 */
function buildPublicUrl(key: string): string | null {
  if (!ENV.r2PublicUrl) return null;
  const base = ENV.r2PublicUrl.replace(/\/+$/, "");
  return `${base}/${key}`;
}

/**
 * Upload a file to R2.
 *
 * @param relKey - Relative storage key (e.g. "generated/12345.png")
 * @param data   - File contents
 * @param contentType - MIME type
 * @returns { key, url } where url is the public or pre-signed download URL
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const client = getClient();
  const key = normalizeKey(relKey);

  const body =
    typeof data === "string" ? Buffer.from(data, "utf-8") : data;

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // Prefer public URL; fall back to pre-signed URL
  const publicUrl = buildPublicUrl(key);
  if (publicUrl) {
    return { key, url: publicUrl };
  }

  // Generate a pre-signed URL valid for 1 hour
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
    }),
    { expiresIn: 3600 }
  );

  return { key, url };
}

/**
 * Get a download URL for a stored file.
 *
 * @param relKey - Relative storage key
 * @returns { key, url }
 */
export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  const publicUrl = buildPublicUrl(key);
  if (publicUrl) {
    return { key, url: publicUrl };
  }

  const client = getClient();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
    }),
    { expiresIn: 3600 }
  );

  return { key, url };
}
