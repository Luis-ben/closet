import path from "node:path";

export function getUploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
}

export function getPublicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
