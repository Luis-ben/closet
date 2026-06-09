import { createHmac, createHash } from "node:crypto";
import { AppError } from "../../utils/errors";
import {
  getCosBucket,
  getCosPublicBaseUrl,
  getCosRegion,
  getCosSecretId,
  getCosSecretKey,
  getCosUploadUrl
} from "./config";

interface CosUploadCredentialInput {
  objectKey: string;
  mimeType: string;
  expiresInSeconds?: number;
}

export interface CosUploadCredential {
  uploadUrl: string;
  imageUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

const DEFAULT_EXPIRES_IN_SECONDS = 10 * 60;

export function createCosUploadCredential(input: CosUploadCredentialInput): CosUploadCredential {
  const secretId = requireConfig(getCosSecretId(), "COS_SECRET_ID");
  const secretKey = requireConfig(getCosSecretKey(), "COS_SECRET_KEY");
  const uploadUrl = buildCosUploadUrl(input.objectKey);
  const parsedUploadUrl = new URL(uploadUrl);
  const expiresInSeconds = input.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + expiresInSeconds;
  const keyTime = `${startTime};${endTime}`;
  const httpMethod = "put";
  const httpUri = encodeCosPath(parsedUploadUrl.pathname);
  const headerList = "content-type;host";
  const httpHeaders = `content-type=${encodeURIComponent(input.mimeType).toLowerCase()}&host=${encodeURIComponent(parsedUploadUrl.host).toLowerCase()}`;
  const signedUrlParams = "";
  const httpString = [httpMethod, httpUri, signedUrlParams, httpHeaders, ""].join("\n");
  const stringToSign = [
    "sha1",
    keyTime,
    sha1Hex(httpString),
    ""
  ].join("\n");
  const signKey = hmacSha1Hex(secretKey, keyTime);
  const signature = hmacSha1Hex(signKey, stringToSign);
  const authorization = [
    `q-sign-algorithm=sha1`,
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    `q-url-param-list=`,
    `q-signature=${signature}`
  ].join("&");

  return {
    uploadUrl,
    imageUrl: `${requireConfig(getCosPublicBaseUrl(), "COS_PUBLIC_BASE_URL")}/${input.objectKey}`,
    headers: {
      Authorization: authorization,
      "Content-Type": input.mimeType
    },
    expiresAt: new Date(endTime * 1000).toISOString()
  };
}

function buildCosUploadUrl(objectKey: string): string {
  const configuredUploadUrl = getCosUploadUrl();

  if (configuredUploadUrl) {
    return `${configuredUploadUrl.replace(/\/+$/, "")}/${objectKey}`;
  }

  const bucket = requireConfig(getCosBucket(), "COS_BUCKET");
  const region = requireConfig(getCosRegion(), "COS_REGION");

  return `https://${bucket}.cos.${region}.myqcloud.com/${objectKey}`;
}

function encodeCosPath(pathname: string): string {
  return pathname
    .split("/")
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
}

function sha1Hex(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function hmacSha1Hex(key: string, value: string): string {
  return createHmac("sha1", key).update(value).digest("hex");
}

function requireConfig(value: string, name: string): string {
  if (!value) {
    throw new AppError(500, "UPLOAD_STORAGE_NOT_CONFIGURED", `${name} 未配置`);
  }

  return value;
}
