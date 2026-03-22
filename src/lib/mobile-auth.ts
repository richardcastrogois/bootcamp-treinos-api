//backend/src/lib/mobile-auth.ts
import { createHash, randomBytes } from "node:crypto";

import { OAuth2Client } from "google-auth-library";
import jwt, { type SignOptions } from "jsonwebtoken";

import { InvalidMobileAuthTokenError } from "../errors/index.js";
import { env } from "./env.js";

const googleClient = new OAuth2Client();

const allowedAudiences = env.MOBILE_GOOGLE_CLIENT_IDS.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const MOBILE_TOKEN_ISSUER = "bootcamp-treinos-api";
const MOBILE_TOKEN_AUDIENCE = "bootcamp-treinos-mobile";

type MobileTokenPayload = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

type MobileJwtPayload = MobileTokenPayload & jwt.JwtPayload;

export async function verifyGoogleIdToken(idToken: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: allowedAudiences,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email || !payload.name) {
    throw new InvalidMobileAuthTokenError("Invalid Google token payload");
  }

  if (!payload.email_verified) {
    throw new InvalidMobileAuthTokenError(
      "Google account email is not verified",
    );
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    emailVerified: payload.email_verified ?? false,
  };
}

export function signMobileAppToken(payload: MobileTokenPayload) {
  const signOptions: SignOptions = {
    algorithm: "HS256",
    issuer: MOBILE_TOKEN_ISSUER,
    audience: MOBILE_TOKEN_AUDIENCE,
    expiresIn: env.MOBILE_ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, env.MOBILE_JWT_SECRET, signOptions);
}

export function verifyMobileAppToken(token: string): MobileTokenPayload {
  const decoded = jwt.verify(token, env.MOBILE_JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: MOBILE_TOKEN_ISSUER,
    audience: MOBILE_TOKEN_AUDIENCE,
  }) as MobileJwtPayload;

  if (
    !decoded ||
    typeof decoded.sub !== "string" ||
    typeof decoded.email !== "string" ||
    typeof decoded.name !== "string"
  ) {
    throw new InvalidMobileAuthTokenError("Invalid mobile auth token payload");
  }

  return {
    sub: decoded.sub,
    email: decoded.email,
    name: decoded.name,
    picture: typeof decoded.picture === "string" ? decoded.picture : undefined,
  };
}

export function generateMobileRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashMobileRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
