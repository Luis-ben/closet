import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../../plugins/auth";
import { AppError } from "../../utils/errors";
import { ok } from "../../utils/response";
import { allowedImageMimeTypes, maxImageSizeBytes } from "../../utils/validation";
import { getImageStorageProvider, getPublicBaseUrl, getUploadDir } from "./config";

const mimeToExtension: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: maxImageSizeBytes
    }
  });

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
