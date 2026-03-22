//backend/src/lib/get-mobile-user.ts
import { prisma } from "./db.js";
import { verifyMobileAppToken } from "./mobile-auth.js";

export async function getMobileUserFromAuthorizationHeader(
  authorization?: string,
) {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  try {
    const payload = verifyMobileAppToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    return user;
  } catch {
    return null;
  }
}
