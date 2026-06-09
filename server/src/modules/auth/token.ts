import { createHmac, timingSafeEqual } from "crypto";
import type { UserRecord } from "../../store/types";

const signedTokenPrefix = "closet-token-v1.";
const mockTokenPrefix = "mock-token-";
const defaultDevSecret = "dev-only-auth-secret-change-me";
const defaultTtlSeconds = 60 * 60 * 24 * 30;

interface SessionTokenPayload {
  sub: string;
  openid: string;
  iat: number;
  exp: number;
}

export interface VerifiedSessionToken {
  userId: string;
  openid: string;
}

function getTokenSecret(): string {
  return process.env.AUTH_TOKEN_SECRET ?? defaultDevSecret;
}

function getTokenTtlSeconds(): number {
  const ttl = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? defaultTtlSeconds);

  return Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : defaultTtlSeconds;
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  return createHmac("sha256", getTokenSecret()).update(payload).digest("base64url");
}

function signaturesMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createSessionToken(user: UserRecord): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = getTokenTtlSeconds();
  const payload: SessionTokenPayload = {
    sub: user._id,
    openid: user.openid,
    iat: now,
    exp: now + expiresIn
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return {
    token: `${signedTokenPrefix}${encodedPayload}.${signature}`,
    expiresIn
  };
}

export function verifySessionToken(token: string): VerifiedSessionToken | null {
  if (!token.startsWith(signedTokenPrefix)) {
    return null;
  }

  const rawToken = token.slice(signedTokenPrefix.length);
  const [encodedPayload, signature] = rawToken.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);

  if (!signaturesMatch(expectedSignature, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<SessionTokenPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (
      !payload.sub ||
      !payload.openid ||
      typeof payload.exp !== "number" ||
      payload.exp <= now
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      openid: payload.openid
    };
  } catch {
    return null;
  }
}

export function verifyDevMockToken(token: string): VerifiedSessionToken | null {
  if (process.env.NODE_ENV === "production" || !token.startsWith(mockTokenPrefix)) {
    return null;
  }

  const userId = token.slice(mockTokenPrefix.length);

  if (!userId) {
    return null;
  }

  return {
    userId,
    openid: ""
  };
}
