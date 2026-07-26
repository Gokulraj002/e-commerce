/**
 * PDF upload adapter.
 *
 * Driver is chosen from env at call time (not boot) so tests and dev machines
 * can flip between drivers without a restart:
 *   - STORAGE_DRIVER=cloudinary + CLOUDINARY_* set → cloudinary
 *   - STORAGE_DRIVER=s3         + AWS_*        set → S3 (aws-sdk v2)
 *   - anything else, or missing credentials         → local file (uploads/)
 *
 * Both cloudinary and aws-sdk are loaded through `createRequire` so this file
 * type-checks in environments where those runtime packages have not been
 * installed yet — the error surfaces at call time.
 */
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Cloudinary minimal typed surface ──────────────────────────────

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

type CloudinaryUploadCb = (
  err: unknown,
  result: CloudinaryUploadResult | undefined,
) => void;

interface CloudinaryV2 {
  config(opts: {
    cloud_name: string;
    api_key: string;
    api_secret: string;
    secure?: boolean;
  }): void;
  uploader: {
    upload_stream(
      opts: {
        public_id?: string;
        resource_type?: 'image' | 'raw' | 'auto' | 'video';
        folder?: string;
        format?: string;
      },
      cb: CloudinaryUploadCb,
    ): NodeJS.WritableStream;
  };
}

interface CloudinaryModule {
  v2: CloudinaryV2;
}

// ── AWS SDK v2 (S3.putObject) minimal typed surface ───────────────

interface S3PutObjectParams {
  Bucket: string;
  Key: string;
  Body: Buffer;
  ContentType?: string;
  ACL?: string;
}

interface S3PutObjectResp {
  ETag?: string;
}

interface S3Instance {
  putObject(params: S3PutObjectParams): {
    promise(): Promise<S3PutObjectResp>;
  };
}

type S3Ctor = new (opts: {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}) => S3Instance;

interface AwsSdkModule {
  S3: S3Ctor;
}

// ── Lazy require ──────────────────────────────────────────────────

const nodeRequire = createRequire(import.meta.url);

function loadCloudinary(): CloudinaryModule {
  try {
    return nodeRequire('cloudinary') as CloudinaryModule;
  } catch {
    throw new Error('cloudinary is not installed. Add `cloudinary` to the backend workspace.');
  }
}

function loadAwsSdk(): AwsSdkModule {
  try {
    return nodeRequire('aws-sdk') as AwsSdkModule;
  } catch {
    throw new Error('aws-sdk is not installed. Add `aws-sdk` to the backend workspace.');
  }
}

// ── Driver detection ──────────────────────────────────────────────

type Driver = 'cloudinary' | 's3' | 'local';

function hasCloudinaryCreds(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function hasS3Creds(): boolean {
  return Boolean(
    process.env.AWS_S3_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY,
  );
}

function pickDriver(): Driver {
  const raw = (process.env.STORAGE_DRIVER ?? '').toLowerCase();
  if (raw === 'cloudinary' && hasCloudinaryCreds()) return 'cloudinary';
  if (raw === 's3' && hasS3Creds()) return 's3';
  return 'local';
}

// ── Individual uploaders ──────────────────────────────────────────

async function uploadCloudinary(fileName: string, buffer: Buffer): Promise<string> {
  const mod = loadCloudinary();
  mod.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
    api_key: process.env.CLOUDINARY_API_KEY as string,
    api_secret: process.env.CLOUDINARY_API_SECRET as string,
    secure: true,
  });

  const publicId = fileName.replace(/\.pdf$/i, '');
  return new Promise<string>((resolve, reject) => {
    const stream = mod.v2.uploader.upload_stream(
      { public_id: publicId, resource_type: 'raw', folder: 'invoices', format: 'pdf' },
      (err, result) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        if (!result) {
          reject(new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

async function uploadS3(fileName: string, buffer: Buffer): Promise<string> {
  const mod = loadAwsSdk();
  const region = process.env.AWS_S3_REGION ?? 'ap-south-1';
  const s3 = new mod.S3({
    region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  });
  const bucket = process.env.AWS_S3_BUCKET as string;
  const key = `invoices/${fileName}`;
  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ACL: 'private',
    })
    .promise();
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function uploadLocal(fileName: string, buffer: Buffer): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // backend/src/services → backend/uploads (gitignored).
  const uploadsDir = path.resolve(here, '..', '..', 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, buffer);
  return `file://${filePath}`;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Upload a PDF buffer and return its retrievable URL.
 *
 * Dev-safe: if credentials are missing for the requested driver, silently
 * falls back to writing under backend/uploads/ and returns a `file://` URL.
 */
export async function uploadPdf(fileName: string, buffer: Buffer): Promise<string> {
  switch (pickDriver()) {
    case 'cloudinary':
      return uploadCloudinary(fileName, buffer);
    case 's3':
      return uploadS3(fileName, buffer);
    default:
      return uploadLocal(fileName, buffer);
  }
}
