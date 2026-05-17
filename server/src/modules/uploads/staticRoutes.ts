import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../utils/errors";
import { getUploadDir } from "./config";

const contentTypeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export async function uploadStaticRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { fileName: string } }>("/uploads/:fileName", async (request, reply) => {
    const fileName = request.params.fileName;

    if (!/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
      throw new AppError(400, "UPLOAD_FILE_NAME_INVALID", "图片地址不合法");
    }

    const extension = path.extname(fileName).toLowerCase();
    const contentType = contentTypeByExtension[extension];

    if (!contentType) {
      throw new AppError(404, "UPLOAD_FILE_NOT_FOUND", "图片不存在");
    }

    const filePath = path.join(getUploadDir(), fileName);

    if (!fs.existsSync(filePath)) {
      throw new AppError(404, "UPLOAD_FILE_NOT_FOUND", "图片不存在");
    }

    return reply.type(contentType).send(fs.createReadStream(filePath));
  });
}
