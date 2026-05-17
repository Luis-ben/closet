import type { z } from "zod";
import { AppError } from "./errors";

export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "请求参数不合法", result.error.flatten());
  }

  return result.data;
}

export const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const maxImageSizeBytes = 5 * 1024 * 1024;
