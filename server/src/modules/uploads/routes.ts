import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../../plugins/auth";
import { AppError } from "../../utils/errors";
import { nowIso } from "../../utils/ids";
import { ok } from "../../utils/response";
import { allowedImageMimeTypes, maxImageSizeBytes } from "../../utils/validation";
import { parseWithSchema } from "../../utils/validation";
import {
  getImageStorageProvider,
  getPublicBaseUrl,
  getUploadDir,
  getWechatCloudEnv
} from "./config";
import { createCosUploadCredential } from "./cosSignature";

const mimeToExtension: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

const createUploadTokenBodySchema = z.object({
  fileName: z.string().min(1).max(160),
  mimeType: z.enum(allowedImageMimeTypes),
  sizeBytes: z.number().int().positive().max(maxImageSizeBytes)
});

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: maxImageSizeBytes
    }
  });

  app.post(
    "/uploads/image-token",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const body = parseWithSchema(createUploadTokenBodySchema, request.body);
      const extension = mimeToExtension[body.mimeType] ?? ".png";
      const objectKey = createObjectKey(request.user!.id, extension);
      const storageProvider = getImageStorageProvider();

      if (storageProvider === "cos") {
        const credential = createCosUploadCredential({
          objectKey,
          mimeType: body.mimeType
        });

        return ok({
          provider: storageProvider,
          objectKey,
          uploadUrl: credential.uploadUrl,
          imageUrl: credential.imageUrl,
          headers: credential.headers,
          formData: null,
          cloudPath: null,
          imageMeta: {
            sizeBytes: body.sizeBytes,
            mimeType: body.mimeType
          },
          expiresAt: credential.expiresAt
        });
      }

      if (storageProvider === "wechat-cloud") {
        return ok({
          provider: storageProvider,
          objectKey,
          uploadUrl: null,
          imageUrl: `cloud://${requireConfig(getWechatCloudEnv(), "WECHAT_CLOUD_ENV")}/${objectKey}`,
          headers: null,
          formData: null,
          cloudPath: objectKey,
          imageMeta: {
            sizeBytes: body.sizeBytes,
            mimeType: body.mimeType
          },
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        });
      }

      return ok({
        provider: storageProvider,
        objectKey,
        uploadUrl: `${getPublicBaseUrl()}/api/uploads/image`,
        imageUrl: null,
        headers: null,
        formData: null,
        cloudPath: null,
        imageMeta: {
          sizeBytes: body.sizeBytes,
          mimeType: body.mimeType
        },
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      });
    }
  );

  app.post(
    "/uploads/image",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      if (process.env.NODE_ENV === "production" && getImageStorageProvider() !== "local") {
        throw new AppError(501, "UPLOAD_STORAGE_NOT_IMPLEMENTED", "生产环境请通过对象存储上传图片");
      }

      const file = await request.file();

      if (!file) {
        throw new AppError(400, "UPLOAD_FILE_REQUIRED", "请选择要上传的图片");
      }

      if (!allowedImageMimeTypes.includes(file.mimetype as (typeof allowedImageMimeTypes)[number])) {
        throw new AppError(400, "UPLOAD_FILE_TYPE_INVALID", "仅支持 JPG、PNG、WebP 图片");
      }

      const uploadDir = getUploadDir();
      await fs.mkdir(uploadDir, {
        recursive: true
      });

      const extension = mimeToExtension[file.mimetype] ?? (path.extname(file.filename).toLowerCase() || ".png");
      const fileName = `${Date.now()}-${randomUUID()}${extension}`;
      const filePath = path.join(uploadDir, fileName);

      try {
        await pipeline(file.file, await fs.open(filePath, "w").then((handle) => handle.createWriteStream()));
      } catch (error) {
        await fs.rm(filePath, {
          force: true
        });

        if (error instanceof Error && /File size limit exceeded/i.test(error.message)) {
          throw new AppError(400, "UPLOAD_FILE_TOO_LARGE", "图片不能超过 5MB");
        }

        throw error;
      }

      const stat = await fs.stat(filePath);

      return ok({
        imageUrl: `${getPublicBaseUrl()}/uploads/${fileName}`,
        imageMeta: {
          sizeBytes: stat.size,
          mimeType: file.mimetype
        }
      });
    }
  );
}

function createObjectKey(userId: string, extension: string): string {
  const date = nowIso().slice(0, 10);

  return `uploads/${userId}/${date}/${Date.now()}-${randomUUID()}${extension}`;
}

function requireConfig(value: string, name: string): string {
  if (!value) {
    throw new AppError(500, "UPLOAD_STORAGE_NOT_CONFIGURED", `${name} 未配置`);
  }

  return value;
}
