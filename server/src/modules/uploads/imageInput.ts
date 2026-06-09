import { z } from "zod";
import { getCosPublicBaseUrl, getImageStorageProvider, getPublicBaseUrl } from "./config";
import { AppError } from "../../utils/errors";
import { allowedImageMimeTypes, maxImageSizeBytes } from "../../utils/validation";

export const imageMetaSchema = z.object({
  sizeBytes: z.number().int().positive().max(maxImageSizeBytes),
  mimeType: z.enum(allowedImageMimeTypes)
});

export type ImageMetaInput = z.infer<typeof imageMetaSchema>;

function isDevelopmentOnlyImageUrl(value: string): boolean {
  return /^(wxfile:\/\/|mock:\/\/)/.test(value);
}

function isAllowedProductionImageUrl(value: string): boolean {
  const storageProvider = getImageStorageProvider();

  if (storageProvider === "wechat-cloud") {
    return value.startsWith("cloud://");
  }

  if (storageProvider === "cos") {
    const cosPublicBaseUrl = getCosPublicBaseUrl();

    return Boolean(cosPublicBaseUrl) && value.startsWith(`${cosPublicBaseUrl}/`);
  }

  return value.startsWith(`${getPublicBaseUrl()}/uploads/`);
}

export const imageUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => /^(https?:\/\/|cloud:\/\/|wxfile:\/\/|mock:\/\/)/.test(value), {
    message: "图片地址必须是 http、cloud、wxfile 或 mock 协议"
  })
  .refine(
    (value) => {
      if (process.env.NODE_ENV !== "production") {
        return true;
      }

      return !isDevelopmentOnlyImageUrl(value) && isAllowedProductionImageUrl(value);
    },
    {
      message: "生产环境只能使用已上传到对象存储或本服务上传目录的图片"
    }
  );

export function requireProductionImageMeta(imageMeta: ImageMetaInput | undefined): ImageMetaInput | undefined {
  if (process.env.NODE_ENV === "production" && !imageMeta) {
    throw new AppError(400, "VALIDATION_ERROR", "生产环境必须提交图片大小和 MIME 类型", {
      fieldErrors: {
        imageMeta: ["生产环境必须提交图片大小和 MIME 类型"]
      }
    });
  }

  return imageMeta;
}
