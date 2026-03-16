//backend/src/lib/mobile-auth.ts
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import { env } from "./env.js";

const googleClient = new OAuth2Client();

const allowedAudiences = env.MOBILE_GOOGLE_CLIENT_IDS.split(",").map((v) =>
  v.trim(),
);

type MobileTokenPayload = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

export async function verifyGoogleIdToken(idToken: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: allowedAudiences,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email || !payload.name) {
    throw new Error("Invalid Google token payload");
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
  return jwt.sign(payload, env.MOBILE_JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyMobileAppToken(token: string): MobileTokenPayload {
  return jwt.verify(token, env.MOBILE_JWT_SECRET) as MobileTokenPayload;
}
